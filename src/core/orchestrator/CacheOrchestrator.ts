import { CacheManager } from '../cache/CacheManager';
import { CacheNamespace, CacheKeys, getUserNamespace } from '../cache/CacheKeys';
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

class MasterCacheOrchestrator {
  private static instance: MasterCacheOrchestrator;
  private currentUserId: string | null = null;
  private bootMetrics: Record<string, number> = {};

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

  /**
   * Set active authenticated user and adjust subsystem contexts
   */
  public setCurrentUser(user: any | null): void {
    const userId = user?.id || null;
    this.currentUserId = userId;
    SyncManager.setActiveUser(userId);

    if (userId) {
      // Initialize private realtime channel for this user (orders, profile changes)
      RealtimeManager.initializeUserSubscriptions(userId);
    } else {
      RealtimeManager.cleanupUserSubscriptions();
    }
  }

  /**
   * Get current active user ID
   */
  public getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Completely purges user private namespaces on logout
   */
  public async purgeUserCache(userId?: string | null): Promise<void> {
    const targetUserId = userId || this.currentUserId;
    if (!targetUserId) return;

    console.log(`[CacheOrchestrator] 🧹 Purging private cache and queues for user: ${targetUserId}`);

    await Promise.allSettled([
      CacheManager.clearUserData(targetUserId),
      CacheManager.clearNamespace(getUserNamespace(targetUserId)),
      CacheManager.clearNamespace(CacheNamespace.USER),
      CacheManager.clearNamespace(CacheNamespace.ORDERS),
      CacheManager.clearNamespace(CacheNamespace.CART),
    ]);

    SyncQueue.clearUserItems(targetUserId);
  }

  /**
   * Unified policy-driven fetcher
   */
  public async fetch<T = any>(
    resource: string,
    fetcher: () => Promise<T>,
    options?: OrchestratorFetchOptions<T>
  ): Promise<T> {
    const policy: CachePolicy = getPolicy(resource);
    const userId = options?.userId ?? (policy.userIsolated ? this.currentUserId : undefined);
    const namespace = options?.namespace || (policy.userIsolated ? getUserNamespace(userId) : CacheNamespace.STORE);
    const ttlMs = options?.ttlMs || policy.ttlMs;

    // 1. SERVER_AUTHORITATIVE Strategy (e.g. Checkout Totals, Payment)
    if (policy.strategy === CacheStrategy.SERVER_AUTHORITATIVE || policy.strategy === CacheStrategy.NETWORK_ONLY) {
      return await CacheManager.deduplicate(`net_${resource}_${userId || ''}`, fetcher);
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
        // Trigger background sync if configured
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
      const fresh = await CacheManager.deduplicate(`fetch_${resource}_${userId || ''}`, fetcher);
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
