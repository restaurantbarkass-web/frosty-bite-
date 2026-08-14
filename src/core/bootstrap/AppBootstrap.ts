import { CacheManager } from '../cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../cache/CacheKeys';
import { AuthManager } from '../auth/AuthManager';
import { SyncManager } from '../sync/SyncManager';
import { RealtimeManager } from '../realtime/RealtimeManager';
import { CacheOrchestrator } from '../orchestrator/CacheOrchestrator';
import { MENU_ITEMS } from '../../constants';

export interface BootstrapResult {
  isSessionRestored: boolean;
  cachedProducts: any[];
  cachedBanners: any[];
  cachedConfig: any | null;
  bootTimeMs: number;
}

class MasterAppBootstrap {
  private isBootstrapped = false;
  private bootstrapPromise: Promise<BootstrapResult> | null = null;

  async init(): Promise<BootstrapResult> {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      const startTime = performance.now();
      console.log('[AppBootstrap] 🚀 Starting Frosty Bite Master App Bootstrap...');

      // 1. Parallel fast read of critical cached data & session restoration
      const [sessionRes, cachedProducts, cachedBanners, cachedConfig] = await Promise.all([
        AuthManager.restoreSession(),
        CacheManager.get<any[]>(CacheKeys.PRODUCTS, CacheNamespace.STORE),
        CacheManager.get<any[]>(CacheKeys.BANNERS, CacheNamespace.STORE),
        CacheManager.get<any>(CacheKeys.APP_CONFIG, CacheNamespace.CONFIG),
      ]);

      const initialProducts = cachedProducts && cachedProducts.length > 0 ? cachedProducts : MENU_ITEMS;

      // Seed fallback cache if empty
      if (!cachedProducts || cachedProducts.length === 0) {
        CacheManager.set(CacheKeys.PRODUCTS, MENU_ITEMS, CacheNamespace.STORE).catch(() => {});
      }

      // 2. Non-blocking initialization of Realtime & Sync Queue in background
      setTimeout(() => {
        RealtimeManager.initializeStoreSubscriptions();
        if (sessionRes.user?.id) {
          RealtimeManager.initializeUserSubscriptions(sessionRes.user.id);
        }
        SyncManager.processQueue();
        SyncManager.runIncrementalSync();
      }, 30);

      const bootTimeMs = Math.round(performance.now() - startTime);
      CacheOrchestrator.recordBootStage('init', bootTimeMs);
      console.log(
        `[AppBootstrap] 🔥 Instant bootstrap ready in ${bootTimeMs}ms (Session: ${
          sessionRes.isRestored ? 'Restored' : 'Guest'
        }, Products: ${initialProducts.length})`
      );

      this.isBootstrapped = true;

      return {
        isSessionRestored: sessionRes.isRestored,
        cachedProducts: initialProducts,
        cachedBanners: cachedBanners || [],
        cachedConfig: cachedConfig || null,
        bootTimeMs,
      };
    })();

    return this.bootstrapPromise;
  }
}

export const AppBootstrap = new MasterAppBootstrap();

