import { CacheOrchestrator, OrchestratorFetchOptions } from '../core/orchestrator/CacheOrchestrator';
import { RealtimeManager } from '../core/realtime/RealtimeManager';
import { CacheKeys, CacheKeyType, CacheNamespace } from '../core/cache/CacheKeys';

export abstract class BaseRepository {
  protected orchestrator = CacheOrchestrator;
  protected realtime = RealtimeManager;

  /**
   * Fetch data with CacheOrchestrator policy execution (SWR, Cache-First, etc.),
   * deduplication, and user session isolation.
   */
  protected async fetchWithCache<T>(
    resource: string,
    fetcher: () => Promise<T>,
    options?: OrchestratorFetchOptions<T>
  ): Promise<T> {
    return this.orchestrator.fetch<T>(resource, fetcher, options);
  }

  /**
   * Get item scoped to active or specified user session
   */
  protected async getUserData<T>(key: CacheKeyType, userId?: string | null): Promise<T | null> {
    return this.orchestrator.getUserItem<T>(key, userId);
  }

  /**
   * Set item scoped to active or specified user session
   */
  protected async setUserData<T>(
    key: CacheKeyType,
    data: T,
    userId?: string | null,
    ttlMs?: number
  ): Promise<void> {
    return this.orchestrator.setUserItem<T>(key, data, userId, ttlMs);
  }

  /**
   * Invalidate user-scoped cache resource
   */
  protected async invalidateUserResource(key: CacheKeyType, userId?: string | null): Promise<void> {
    return this.orchestrator.invalidateUserResource(key, userId);
  }

  /**
   * Deduplicate async operations
   */
  protected async deduplicate<T>(dedupKey: string, fetcher: () => Promise<T>): Promise<T> {
    return this.orchestrator.deduplicate<T>(dedupKey, fetcher);
  }

  /**
   * Get active user session ID
   */
  protected getCurrentUserId(): string | null {
    return this.orchestrator.getCurrentUserId();
  }
}
