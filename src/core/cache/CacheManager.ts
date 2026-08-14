import { CacheNamespace, CacheKeyType, buildStorageKey } from './CacheKeys';
import {
  CacheMetadata,
  CachedEnvelope,
  createCacheEnvelope,
  isEnvelopeFresh,
  isResponseNewer,
} from './CacheMetadata';
import { getTtlForResource, getPolicy, CacheStrategy } from './CachePolicy';
import { cacheStorageDriver } from './CacheStorage';

type CacheChangeListener = (data: any, metadata: CacheMetadata) => void;

class MasterCacheManager {
  private static instance: MasterCacheManager;
  private currentCacheVersion = 2;
  private listeners: Map<string, Set<CacheChangeListener>> = new Map();
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  private constructor() {
    this.checkVersionMigration();
  }

  public static getInstance(): MasterCacheManager {
    if (!MasterCacheManager.instance) {
      MasterCacheManager.instance = new MasterCacheManager();
    }
    return MasterCacheManager.instance;
  }

  private getCompositeKey(key: string, namespace: CacheNamespace | string, userId?: string | null): string {
    return buildStorageKey(namespace, key, userId);
  }

  /**
   * Version migration handler
   */
  private async checkVersionMigration(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const storedVersionStr = localStorage.getItem('fb_cache_master_version');
      const storedVersion = storedVersionStr ? parseInt(storedVersionStr, 10) : 1;

      if (storedVersion < this.currentCacheVersion) {
        console.log(`[CacheManager] Migrating cache from v${storedVersion} to v${this.currentCacheVersion}`);
        localStorage.setItem('fb_cache_master_version', this.currentCacheVersion.toString());
      }
    } catch (_) {}
  }

  /**
   * Request deduplication helper: coalesces duplicate in-flight requests
   */
  async deduplicate<T>(dedupKey: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.inFlightRequests.has(dedupKey)) {
      return this.inFlightRequests.get(dedupKey)! as Promise<T>;
    }

    const promise = (async () => {
      try {
        return await fetcher();
      } finally {
        this.inFlightRequests.delete(dedupKey);
      }
    })();

    this.inFlightRequests.set(dedupKey, promise);
    return promise;
  }

  /**
   * Get cached data with freshness check
   */
  async get<T = any>(
    key: CacheKeyType,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    userId?: string | null
  ): Promise<T | null> {
    const storageKey = this.getCompositeKey(key, namespace, userId);
    const envelope = await cacheStorageDriver.get<CachedEnvelope<T>>(storageKey);

    if (!envelope) return null;
    return envelope.data;
  }

  /**
   * Get full envelope including metadata
   */
  async getEnvelope<T = any>(
    key: CacheKeyType,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    userId?: string | null
  ): Promise<CachedEnvelope<T> | null> {
    const storageKey = this.getCompositeKey(key, namespace, userId);
    return await cacheStorageDriver.get<CachedEnvelope<T>>(storageKey);
  }

  /**
   * Check if a cached resource is fresh
   */
  async isFresh(
    key: CacheKeyType,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    userId?: string | null
  ): Promise<boolean> {
    const envelope = await this.getEnvelope(key, namespace, userId);
    if (!envelope) return false;
    return isEnvelopeFresh(envelope.metadata);
  }

  /**
   * Set cached data with calculated TTL, race protection, & envelope
   */
  async set<T = any>(
    key: CacheKeyType,
    data: T,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    customTtlMs?: number,
    etag?: string,
    userId?: string | null,
    serverUpdatedAt?: string | number
  ): Promise<void> {
    const storageKey = this.getCompositeKey(key, namespace, userId);

    // Race condition check: Ensure incoming write is newer than cached record
    const existing = await cacheStorageDriver.get<CachedEnvelope<T>>(storageKey);
    if (existing && !isResponseNewer(serverUpdatedAt, existing)) {
      console.warn(`[CacheManager] Discarded stale write for ${storageKey}`);
      return;
    }

    const ttl = customTtlMs || getTtlForResource(namespace, key);
    const envelope = createCacheEnvelope<T>(
      key,
      namespace,
      data,
      ttl,
      this.currentCacheVersion,
      etag,
      userId,
      serverUpdatedAt
    );

    await cacheStorageDriver.set(storageKey, envelope);

    // Notify listeners
    this.notifyListeners(storageKey, data, envelope.metadata);
  }

  /**
   * Surgically update a single element in a cached array without full refetch
   */
  async updateArrayItem<T = any>(
    key: CacheKeyType,
    predicate: (item: T) => boolean,
    updater: (item: T) => T,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    userId?: string | null
  ): Promise<void> {
    const existing = await this.get<T[]>(key, namespace, userId);
    if (Array.isArray(existing)) {
      const updated = existing.map((item) => (predicate(item) ? updater(item) : item));
      await this.set(key, updated, namespace, undefined, undefined, userId);
    }
  }

  /**
   * Invalidate entry (marks stale without deleting)
   */
  async invalidate(
    key: CacheKeyType,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    userId?: string | null
  ): Promise<void> {
    const storageKey = this.getCompositeKey(key, namespace, userId);
    const envelope = await cacheStorageDriver.get<CachedEnvelope<any>>(storageKey);
    if (envelope) {
      envelope.metadata.isStale = true;
      envelope.metadata.expiresAt = new Date(0).toISOString();
      await cacheStorageDriver.set(storageKey, envelope);
      this.notifyListeners(storageKey, envelope.data, envelope.metadata);
    }
  }

  /**
   * Delete entry
   */
  async remove(
    key: CacheKeyType,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    userId?: string | null
  ): Promise<void> {
    const storageKey = this.getCompositeKey(key, namespace, userId);
    await cacheStorageDriver.delete(storageKey);
  }

  /**
   * Clear an entire namespace (e.g. USER, CART, ORDERS on logout)
   */
  async clearNamespace(namespace: CacheNamespace | string): Promise<void> {
    await cacheStorageDriver.clearPrefix(`${namespace}:`);
  }

  /**
   * Clear all private user data on logout
   */
  async clearUserData(userId: string): Promise<void> {
    await cacheStorageDriver.clearUserCache(userId);
  }

  /**
   * Stale-While-Revalidate pattern execution:
   * 1. Returns cached value immediately if available
   * 2. Fires background fetcher silently with request deduplication
   * 3. Compares results, updates cache, and calls onUpdate if changed
   */
  async staleWhileRevalidate<T = any>(
    key: CacheKeyType,
    fetcher: () => Promise<T>,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    options?: {
      onUpdate?: (freshData: T) => void;
      ttlMs?: number;
      forceFresh?: boolean;
      userId?: string | null;
    }
  ): Promise<{ data: T; isFromCache: boolean }> {
    const dedupKey = `${this.getCompositeKey(key, namespace, options?.userId)}`;
    const cachedEnvelope = await this.getEnvelope<T>(key, namespace, options?.userId);
    const isFresh = cachedEnvelope ? isEnvelopeFresh(cachedEnvelope.metadata) : false;

    // If cache exists and is valid (or stale-while-revalidating is enabled)
    if (cachedEnvelope && !options?.forceFresh) {
      // If stale, trigger background revalidation without blocking
      if (!isFresh) {
        this.runBackgroundRevalidation(key, fetcher, namespace, cachedEnvelope.data, options);
      }
      return { data: cachedEnvelope.data, isFromCache: true };
    }

    // No cache exists or forced fresh — execute coalesced network fetch
    const freshData = await this.deduplicate(dedupKey, fetcher);
    if (freshData !== undefined && freshData !== null) {
      await this.set(key, freshData, namespace, options?.ttlMs, undefined, options?.userId);
    }
    return { data: freshData, isFromCache: false };
  }

  private async runBackgroundRevalidation<T>(
    key: CacheKeyType,
    fetcher: () => Promise<T>,
    namespace: CacheNamespace | string,
    existingData: T,
    options?: { onUpdate?: (freshData: T) => void; ttlMs?: number; userId?: string | null }
  ): Promise<void> {
    const dedupKey = `reval_${this.getCompositeKey(key, namespace, options?.userId)}`;
    try {
      const freshData = await this.deduplicate(dedupKey, fetcher);
      if (freshData !== undefined && freshData !== null) {
        const hasChanged = JSON.stringify(freshData) !== JSON.stringify(existingData);
        if (hasChanged) {
          await this.set(key, freshData, namespace, options?.ttlMs, undefined, options?.userId);
          if (options?.onUpdate) {
            options.onUpdate(freshData);
          }
        } else {
          // Touch cache metadata to extend TTL
          await this.touch(key, namespace, options?.userId);
        }
      }
    } catch (err) {
      console.warn(`[CacheManager] Background revalidation failed for ${namespace}:${key}:`, err);
    }
  }

  /**
   * Touch to extend expiration without full rewrite
   */
  async touch(
    key: CacheKeyType,
    namespace: CacheNamespace | string = CacheNamespace.STORE,
    userId?: string | null
  ): Promise<void> {
    const envelope = await this.getEnvelope(key, namespace, userId);
    if (envelope) {
      const ttl = getTtlForResource(namespace, key);
      envelope.metadata.updatedAt = new Date().toISOString();
      envelope.metadata.expiresAt = new Date(Date.now() + ttl).toISOString();
      envelope.metadata.isStale = false;
      const storageKey = this.getCompositeKey(key, namespace, userId);
      await cacheStorageDriver.set(storageKey, envelope);
    }
  }

  /**
   * Subscribe to cache updates for real-time reactivity
   */
  subscribe(
    key: CacheKeyType,
    namespace: CacheNamespace | string,
    listener: CacheChangeListener,
    userId?: string | null
  ): () => void {
    const storageKey = this.getCompositeKey(key, namespace, userId);
    if (!this.listeners.has(storageKey)) {
      this.listeners.set(storageKey, new Set());
    }
    this.listeners.get(storageKey)!.add(listener);

    return () => {
      const set = this.listeners.get(storageKey);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(storageKey);
        }
      }
    };
  }

  private notifyListeners(storageKey: string, data: any, metadata: CacheMetadata): void {
    const set = this.listeners.get(storageKey);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(data, metadata);
        } catch (e) {
          console.warn('[CacheManager] Listener exception:', e);
        }
      });
    }
  }
}

export const CacheManager = MasterCacheManager.getInstance();

