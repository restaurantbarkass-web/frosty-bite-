import { CacheManager } from '../cache/CacheManager';
import { CacheNamespace, CacheKeys, CacheKeyType, getUserNamespace, isUserIsolatedNamespace } from '../cache/CacheKeys';
import { getPolicy, CacheStrategy, CachePolicy } from '../cache/CachePolicy';
import { SyncManager } from '../sync/SyncManager';
import { SyncQueue } from '../sync/SyncQueue';
import { RealtimeManager } from '../realtime/RealtimeManager';
import { cacheStorageDriver } from '../cache/CacheStorage';

export interface OrchestratorFetchOptions<T> {
  namespace?: CacheNamespace | string;
  userId?: string | null;
  forceFresh?: boolean;
  ttlMs?: number;
  fallbackData?: T;
  onUpdate?: (freshData: T) => void;
}

export interface OrchestratorHealthReport {
  isOnline: boolean;
  queueSize: number;
  activeUserId: string | null;
  bootMetrics: Record<string, number>;
  timestamp: string;
}

/**
 * Central Orchestrator integrating CacheManager and SyncManager.
 * Provides unified methods for policy lookup, in-flight request deduplication,
 * and atomic user-specific cache namespace lifecycle management.
 */
class MasterCacheOrchestrator {
  private static instance: MasterCacheOrchestrator;
  private currentUserId: string | null = null;
  private bootMetrics: Record<string, number> = {};
  private activeNamespaceLocks: Set<string> = new Set();

  private constructor() {
    this.initBackgroundMaintenance();
  }

  public static getInstance(): MasterCacheOrchestrator {
    if (!MasterCacheOrchestrator.instance) {
      MasterCacheOrchestrator.instance = new MasterCacheOrchestrator();
    }
    return MasterCacheOrchestrator.instance;
  }

  /**
   * Periodic background maintenance: Prune expired entries every 30 minutes
   */
  private initBackgroundMaintenance(): void {
    if (typeof window === 'undefined') return;
    setInterval(() => {
      cacheStorageDriver.pruneExpired().catch(() => {});
    }, 30 * 60 * 1000);
  }

  // ==========================================
  // 1. UNIFIED POLICY MANAGEMENT
  // ==========================================

  /**
   * Resolves the cache policy for a given resource or key
   */
  public getPolicy(resource: string): CachePolicy {
    return getPolicy(resource);
  }

  // ==========================================
  // 2. UNIFIED REQUEST DEDUPLICATION
  // ==========================================

  /**
   * Coalesces duplicate in-flight async requests under a single deduplication key
   */
  public async deduplicate<T>(dedupKey: string, fetcher: () => Promise<T>): Promise<T> {
    return CacheManager.deduplicate<T>(dedupKey, fetcher);
  }

  // ==========================================
  // 3. ATOMIC USER-SPECIFIC NAMESPACE MANAGEMENT
  // ==========================================

  /**
   * Resolves the user-isolated cache namespace
   */
  public getUserNamespace(userId?: string | null): string {
    return getUserNamespace(userId ?? this.currentUserId);
  }

  /**
   * Atomically updates active user context across CacheManager, SyncManager, and RealtimeManager
   */
  public setCurrentUser(user: any | null): void {
    const userId = user?.id || null;
    const previousUserId = this.currentUserId;
    this.currentUserId = userId;

    // Synchronize SyncManager active user
    SyncManager.setActiveUser(userId);

    if (userId) {
      // Initialize private realtime channel for this user
      RealtimeManager.initializeUserSubscriptions(userId);
    } else {
      RealtimeManager.cleanupUserSubscriptions();
      if (previousUserId) {
        // Automatically purge previous user's private cache on logout
        this.purgeUserCache(previousUserId).catch((err) => {
          console.warn('[CacheOrchestrator] Error during automatic logout purge:', err);
        });
      }
    }
  }

  /**
   * Get current active user ID
   */
  public getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Atomically purges user-specific private cache namespaces and pending sync queues
   */
  public async purgeUserCache(userId?: string | null): Promise<void> {
    const targetUserId = userId || this.currentUserId;
    if (!targetUserId) return;

    const userNamespace = this.getUserNamespace(targetUserId);
    const lockKey = `purge_${userNamespace}`;

    // Prevent concurrent purge race conditions for the same user namespace
    if (this.activeNamespaceLocks.has(lockKey)) {
      return;
    }

    this.activeNamespaceLocks.add(lockKey);
    console.log(`[CacheOrchestrator] 🧹 Atomically purging private cache and queues for user: ${targetUserId}`);

    try {
      await Promise.allSettled([
        CacheManager.clearUserData(targetUserId),
        CacheManager.clearNamespace(userNamespace),
        CacheManager.clearNamespace(CacheNamespace.USER),
        CacheManager.clearNamespace(CacheNamespace.ORDERS),
        CacheManager.clearNamespace(CacheNamespace.CART),
      ]);

      SyncQueue.clearUserItems(targetUserId);
    } finally {
      this.activeNamespaceLocks.delete(lockKey);
    }
  }

  /**
   * Clears a specific user namespace atomically
   */
  public async clearUserNamespace(userId?: string | null): Promise<void> {
    const targetUserId = userId || this.currentUserId;
    if (!targetUserId) return;

    const userNs = this.getUserNamespace(targetUserId);
    await CacheManager.clearNamespace(userNs);
  }

  /**
   * Reads an item from a user-isolated namespace
   */
  public async getUserItem<T = any>(key: CacheKeyType, userId?: string | null): Promise<T | null> {
    const targetUserId = userId ?? this.currentUserId;
    const namespace = this.getUserNamespace(targetUserId);
    return CacheManager.get<T>(key, namespace, targetUserId);
  }

  /**
   * Writes an item to a user-isolated namespace
   */
  public async setUserItem<T = any>(
    key: CacheKeyType,
    data: T,
    userId?: string | null,
    customTtlMs?: number
  ): Promise<void> {
    const targetUserId = userId ?? this.currentUserId;
    const namespace = this.getUserNamespace(targetUserId);
    return CacheManager.set<T>(key, data, namespace, customTtlMs, undefined, targetUserId);
  }

  /**
   * Invalidates a user-specific cached resource
   */
  public async invalidateUserResource(key: CacheKeyType, userId?: string | null): Promise<void> {
    const targetUserId = userId ?? this.currentUserId;
    const namespace = this.getUserNamespace(targetUserId);
    return CacheManager.invalidate(key, namespace, targetUserId);
  }

  // ==========================================
  // 4. UNIFIED POLICY-DRIVEN FETCHER
  // ==========================================

  /**
   * Unified policy-driven fetcher integrating CacheManager, SyncManager, request deduplication,
   * and user namespace resolution.
   */
  public async fetch<T = any>(
    resource: string,
    fetcher: () => Promise<T>,
    options?: OrchestratorFetchOptions<T>
  ): Promise<T> {
    const policy: CachePolicy = this.getPolicy(resource);
    const userId = options?.userId ?? (policy.userIsolated ? this.currentUserId : undefined);
    const namespace = options?.namespace || (policy.userIsolated ? this.getUserNamespace(userId) : CacheNamespace.STORE);
    const ttlMs = options?.ttlMs || policy.ttlMs;

    // 1. SERVER_AUTHORITATIVE Strategy (e.g. Checkout Totals, Payment)
    if (policy.strategy === CacheStrategy.SERVER_AUTHORITATIVE || policy.strategy === CacheStrategy.NETWORK_ONLY) {
      return await this.deduplicate(`net_${resource}_${userId || ''}`, fetcher);
    }

    // 2. CACHE_ONLY Strategy
    if (policy.strategy === CacheStrategy.CACHE_ONLY) {
      const cached = await CacheManager.get<T>(resource, namespace, userId);
      return cached ?? (options?.fallbackData as T);
    }

    // 3. CACHE_FIRST Strategy
    if (policy.strategy === CacheStrategy.CACHE_FIRST && !options?.forceFresh) {
      const cached = await CacheManager.get<T>(resource, namespace, userId);
      const isFresh = await CacheManager.isFresh(resource, namespace, userId);
      if (cached !== null && isFresh) {
        return cached;
      }
    }

    // 4. LOCAL_FIRST Strategy (e.g. Cart, Wishlist, Local Settings)
    if (policy.strategy === CacheStrategy.LOCAL_FIRST && !options?.forceFresh) {
      const cached = await CacheManager.get<T>(resource, namespace, userId);
      if (cached !== null) {
        return cached;
      }
    }

    // 5. STALE_WHILE_REVALIDATE Strategy (e.g. Products, Banners, Orders)
    if (policy.strategy === CacheStrategy.STALE_WHILE_REVALIDATE || policy.strategy === CacheStrategy.CACHE_FIRST) {
      try {
        const { data } = await CacheManager.staleWhileRevalidate<T>(resource, fetcher, namespace, {
          ttlMs,
          forceFresh: options?.forceFresh,
          userId,
          onUpdate: options?.onUpdate,
        });
        return data;
      } catch (networkErr) {
        console.warn(`[CacheOrchestrator] Network fetch failed for ${resource}, trying stale cache fallback:`, networkErr);
        const staleCached = await CacheManager.get<T>(resource, namespace, userId);
        if (staleCached !== null) {
          return staleCached;
        }
        if (options?.fallbackData !== undefined) {
          return options.fallbackData;
        }
        throw networkErr;
      }
    }

    // 6. Default Network First fallback
    try {
      const fresh = await this.deduplicate(`fetch_${resource}_${userId || ''}`, fetcher);
      if (fresh !== undefined && fresh !== null) {
        await CacheManager.set(resource, fresh, namespace, ttlMs, undefined, userId);
      }
      return fresh;
    } catch (err) {
      const cached = await CacheManager.get<T>(resource, namespace, userId);
      if (cached !== null) return cached;
      if (options?.fallbackData !== undefined) return options.fallbackData;
      throw err;
    }
  }

  // ==========================================
  // 5. SUBSYSTEM INTERACTION & HEALTH MONITORS
  // ==========================================

  /**
   * Triggers background sync queues and incremental syncs via SyncManager
   */
  public async triggerSync(): Promise<void> {
    await Promise.allSettled([
      SyncManager.processQueue(),
      SyncManager.runIncrementalSync(),
    ]);
  }

  /**
   * Gets online status from SyncManager
   */
  public isOnline(): boolean {
    return SyncManager.getOnlineStatus();
  }

  /**
   * Subscribes to network online status changes
   */
  public subscribeOnlineStatus(listener: (isOnline: boolean) => void): () => void {
    return SyncManager.subscribeOnlineStatus(listener);
  }

  /**
   * Record boot stage telemetry
   */
  public recordBootStage(stage: string, durationMs: number): void {
    this.bootMetrics[stage] = durationMs;
  }

  /**
   * Health report for diagnostics
   */
  public getHealthReport(): OrchestratorHealthReport {
    return {
      isOnline: SyncManager.getOnlineStatus(),
      queueSize: SyncQueue.getQueueSize(),
      activeUserId: this.currentUserId,
      bootMetrics: { ...this.bootMetrics },
      timestamp: new Date().toISOString(),
    };
  }
}

export const CacheOrchestrator = MasterCacheOrchestrator.getInstance();

