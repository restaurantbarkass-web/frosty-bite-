/**
 * Low-level persistent cache driver using IndexedDB with Memory & LocalStorage fallbacks.
 * Hardened for user namespace isolation, bounded LRU memory usage, and background pruning.
 */

const DB_NAME = 'frostybite_master_cache';
const DB_VERSION = 2;
const STORE_KV = 'keyval';
const STORE_QUEUE = 'sync_queue';
const STORE_META = 'metadata';

const MAX_MEMORY_ENTRIES = 200;
const MAX_LOCALSTORAGE_ITEM_BYTES = 100 * 1024; // 100KB per entry in localStorage

class CacheStorageDriver {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryCache: Map<string, any> = new Map();
  private isIndexedDBAvailable: boolean = typeof window !== 'undefined' && 'indexedDB' in window;

  constructor() {
    if (this.isIndexedDBAvailable) {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        if (!this.isIndexedDBAvailable) {
          resolve(null);
          return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_KV)) {
            const kvStore = db.createObjectStore(STORE_KV, { keyPath: 'storageKey' });
            kvStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_QUEUE)) {
            const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
            queueStore.createIndex('status', 'status', { unique: false });
            queueStore.createIndex('createdAt', 'createdAt', { unique: false });
            queueStore.createIndex('priority', 'priority', { unique: false });
          }
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'key' });
          }
        };

        request.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          resolve(db);
        };

        request.onerror = (event: Event) => {
          console.warn('[CacheStorage] IndexedDB open error, falling back to LocalStorage/Memory:', event);
          resolve(null);
        };

        request.onblocked = () => {
          console.warn('[CacheStorage] IndexedDB open blocked by another tab');
        };
      } catch (err) {
        console.warn('[CacheStorage] IndexedDB init exception:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private enforceMemoryLimit(): void {
    if (this.memoryCache.size > MAX_MEMORY_ENTRIES) {
      const keysToDelete = Array.from(this.memoryCache.keys()).slice(0, 30);
      keysToDelete.forEach((k) => this.memoryCache.delete(k));
    }
  }

  /**
   * Get value by composite storageKey (e.g. "store:products", "user:xyz:cart")
   */
  async get<T = any>(storageKey: string): Promise<T | null> {
    // 1. Check hot memory cache
    if (this.memoryCache.has(storageKey)) {
      return this.memoryCache.get(storageKey) as T;
    }

    // 2. Try IndexedDB
    try {
      const db = await this.initDB();
      if (db) {
        const item = await new Promise<any>((resolve) => {
          try {
            const tx = db.transaction(STORE_KV, 'readonly');
            const store = tx.objectStore(STORE_KV);
            const req = store.get(storageKey);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });

        if (item !== null && item !== undefined) {
          this.memoryCache.set(storageKey, item);
          this.enforceMemoryLimit();
          return item as T;
        }
      }
    } catch (e) {
      console.warn('[CacheStorage] IndexedDB get error:', e);
    }

    // 3. Fallback to LocalStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(`fb_cache_${storageKey}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.memoryCache.set(storageKey, parsed);
          this.enforceMemoryLimit();
          return parsed as T;
        }
      }
    } catch (_) {}

    return null;
  }

  /**
   * Set value by composite storageKey
   */
  async set<T = any>(storageKey: string, value: T): Promise<void> {
    // 1. Update hot memory cache immediately
    this.memoryCache.set(storageKey, value);
    this.enforceMemoryLimit();

    // 2. Persist in IndexedDB asynchronously
    try {
      const db = await this.initDB();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(STORE_KV, 'readwrite');
            const store = tx.objectStore(STORE_KV);
            store.put({ storageKey, value, updatedAt: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch (e) {
      console.warn('[CacheStorage] IndexedDB set error:', e);
    }

    // 3. Keep safe bounded mirror in LocalStorage for small entities
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = JSON.stringify(value);
        if (raw.length < MAX_LOCALSTORAGE_ITEM_BYTES) {
          localStorage.setItem(`fb_cache_${storageKey}`, raw);
        }
      }
    } catch (_) {}
  }

  /**
   * Remove value by storageKey
   */
  async delete(storageKey: string): Promise<void> {
    this.memoryCache.delete(storageKey);

    try {
      const db = await this.initDB();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(STORE_KV, 'readwrite');
            const store = tx.objectStore(STORE_KV);
            store.delete(storageKey);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch (e) {
      console.warn('[CacheStorage] IndexedDB delete error:', e);
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(`fb_cache_${storageKey}`);
      }
    } catch (_) {}
  }

  /**
   * Clear all records in a namespace prefix (e.g. "user:", "user:123:")
   */
  async clearPrefix(prefix: string): Promise<void> {
    // Clear from memory
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from IndexedDB
    try {
      const db = await this.initDB();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(STORE_KV, 'readwrite');
            const store = tx.objectStore(STORE_KV);
            const req = store.openCursor();
            req.onsuccess = (event: any) => {
              const cursor = event.target.result;
              if (cursor) {
                if (cursor.key && typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
                  cursor.delete();
                }
                cursor.continue();
              } else {
                resolve();
              }
            };
            req.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch (e) {
      console.warn('[CacheStorage] Clear prefix error:', e);
    }

    // Clear from LocalStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const lsPrefix = `fb_cache_${prefix}`;
        const toDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(lsPrefix)) {
            toDelete.push(k);
          }
        }
        toDelete.forEach((k) => localStorage.removeItem(k));
      }
    } catch (_) {}
  }

  /**
   * Purges all private data for a specific user ID
   */
  async clearUserCache(userId: string): Promise<void> {
    if (!userId) return;
    await this.clearPrefix(`user:${userId}:`);
    await this.clearPrefix(`orders_${userId}`);
    await this.clearPrefix(`cart_${userId}`);
    await this.clearPrefix(`wishlist_${userId}`);
  }

  /**
   * Prune expired entries from cache to keep storage compact
   */
  async pruneExpired(): Promise<number> {
    let prunedCount = 0;
    try {
      const db = await this.initDB();
      if (db) {
        await new Promise<void>((resolve) => {
          try {
            const tx = db.transaction(STORE_KV, 'readwrite');
            const store = tx.objectStore(STORE_KV);
            const req = store.openCursor();
            const now = Date.now();

            req.onsuccess = (event: any) => {
              const cursor = event.target.result;
              if (cursor) {
                const record = cursor.value;
                const envelope = record?.value;
                if (envelope?.metadata?.expiresAt) {
                  const expiry = new Date(envelope.metadata.expiresAt).getTime();
                  if (now > expiry + 24 * 60 * 60 * 1000) { // Prune if expired by > 24 hours
                    cursor.delete();
                    prunedCount++;
                  }
                }
                cursor.continue();
              } else {
                resolve();
              }
            };
            req.onerror = () => resolve();
          } catch {
            resolve();
          }
        });
      }
    } catch (e) {
      console.warn('[CacheStorage] Pruning error:', e);
    }

    return prunedCount;
  }
}

export const cacheStorageDriver = new CacheStorageDriver();

