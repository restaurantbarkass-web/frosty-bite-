import { supabase } from '../../supabase';
import { SyncQueue, SyncQueueItem } from './SyncQueue';
import { CacheManager } from '../cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../cache/CacheKeys';

type OnlineStatusListener = (isOnline: boolean) => void;
type SyncActivityListener = (isSyncing: boolean, pendingCount: number) => void;

class MasterSyncManager {
  private static instance: MasterSyncManager;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private onlineListeners: Set<OnlineStatusListener> = new Set();
  private activityListeners: Set<SyncActivityListener> = new Set();
  private isProcessing = false;
  private syncTimer: any = null;
  private activeUserId: string | null = null;

  private constructor() {
    this.setupNetworkListeners();
    this.startPeriodicSync();
  }

  public static getInstance(): MasterSyncManager {
    if (!MasterSyncManager.instance) {
      MasterSyncManager.instance = new MasterSyncManager();
    }
    return MasterSyncManager.instance;
  }

  public setActiveUser(userId: string | null): void {
    this.activeUserId = userId;
    if (this.isOnline) {
      this.processQueue();
    }
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncManager] 🌐 Network online detected. Triggering queue processing & sync...');
        this.isOnline = true;
        this.notifyOnlineListeners(true);
        this.processQueue();
        this.runIncrementalSync();
      });

      window.addEventListener('offline', () => {
        console.log('[SyncManager] 📵 Network offline detected.');
        this.isOnline = false;
        this.notifyOnlineListeners(false);
      });
    }
  }

  private startPeriodicSync(): void {
    if (typeof window === 'undefined') return;
    // Periodic background sync every 60 seconds if online and tab is active
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      if (this.isOnline && !document.hidden) {
        this.runIncrementalSync();
        this.processQueue();
      }
    }, 60000);
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  public subscribeOnlineStatus(listener: OnlineStatusListener): () => void {
    this.onlineListeners.add(listener);
    listener(this.isOnline);
    return () => this.onlineListeners.delete(listener);
  }

  public subscribeSyncActivity(listener: SyncActivityListener): () => void {
    this.activityListeners.add(listener);
    listener(this.isProcessing, SyncQueue.getQueueSize());
    return () => this.activityListeners.delete(listener);
  }

  private notifyOnlineListeners(status: boolean): void {
    this.onlineListeners.forEach((l) => {
      try {
        l(status);
      } catch (_) {}
    });
  }

  private notifyActivityListeners(): void {
    const size = SyncQueue.getQueueSize();
    this.activityListeners.forEach((l) => {
      try {
        l(this.isProcessing, size);
      } catch (_) {}
    });
  }

  /**
   * Process pending items in the offline queue with concurrency control (max 2 concurrent)
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline) return;
    this.isProcessing = true;
    this.notifyActivityListeners();

    try {
      const pending = SyncQueue.getPendingItems(this.activeUserId);
      if (pending.length === 0) return;

      console.log(`[SyncManager] Processing ${pending.length} queued mutations (Concurrency: 2)...`);

      // Process in batches of 2 concurrent items
      const CONCURRENCY = 2;
      for (let i = 0; i < pending.length; i += CONCURRENCY) {
        const batch = pending.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((item) => this.processItem(item)));
      }
    } catch (err) {
      console.warn('[SyncManager] Queue processing error:', err);
    } finally {
      this.isProcessing = false;
      this.notifyActivityListeners();
    }
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    SyncQueue.markSyncing(item.id);
    try {
      switch (item.operation) {
        case 'save_review':
          await supabase.from('reviews').insert(item.payload);
          break;

        case 'update_profile':
          if (item.entityId) {
            await supabase.from('users').update(item.payload).eq('id', item.entityId);
          }
          break;

        case 'update_cart':
          // Cart sync with backend if logged in
          if (item.userId) {
            await supabase.from('users').update({ cart: item.payload }).eq('id', item.userId);
          }
          break;

        case 'toggle_wishlist':
          if (item.userId && item.payload) {
            await supabase.from('users').update({ wishlist: item.payload }).eq('id', item.userId);
          }
          break;

        case 'create_order':
          // Critical idempotent order submission
          if (item.payload) {
            const { error } = await supabase.from('orders').insert(item.payload);
            if (error) throw error;
          }
          break;

        case 'custom_mutation':
          if (item.entity && item.payload) {
            await supabase.from(item.entity).insert(item.payload);
          }
          break;

        default:
          break;
      }
      SyncQueue.markCompleted(item.id);
      console.log(`[SyncManager] Successfully processed mutation: ${item.operation} (${item.idempotencyKey})`);
    } catch (err: any) {
      console.warn(`[SyncManager] Item ${item.id} sync failed:`, err?.message);
      SyncQueue.markFailed(item.id, err?.message || 'Sync error');
    }
  }

  /**
   * Incremental synchronization for products, banners, and app config
   */
  async runIncrementalSync(): Promise<void> {
    if (!this.isOnline) return;

    try {
      await Promise.allSettled([
        this.syncProducts(),
        this.syncBanners(),
        this.syncConfig(),
      ]);
    } catch (err) {
      console.warn('[SyncManager] Incremental sync error:', err);
    }
  }

  private async syncProducts(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const cached = await CacheManager.get(CacheKeys.PRODUCTS, CacheNamespace.STORE);
        const hasDiff = JSON.stringify(data) !== JSON.stringify(cached);
        if (hasDiff) {
          console.log('[SyncManager] Fresh product changes detected from background sync');
          await CacheManager.set(CacheKeys.PRODUCTS, data, CacheNamespace.STORE);
        }
      }
    } catch (_) {}
  }

  private async syncBanners(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('priority', { ascending: false });

      if (!error && data) {
        await CacheManager.set(CacheKeys.BANNERS, data, CacheNamespace.STORE);
      }
    } catch (_) {}
  }

  private async syncConfig(): Promise<void> {
    try {
      const { data, error } = await supabase.from('app_config').select('*').limit(1).maybeSingle();
      if (!error && data) {
        await CacheManager.set(CacheKeys.APP_CONFIG, data, CacheNamespace.CONFIG);
      }
    } catch (_) {}
  }
}

export const SyncManager = MasterSyncManager.getInstance();

