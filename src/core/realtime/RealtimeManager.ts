import { supabase } from '../../supabase';
import { CacheManager } from '../cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../cache/CacheKeys';

class MasterRealtimeManager {
  private static instance: MasterRealtimeManager;
  private isStoreSubscribed = false;
  private activeStoreChannels: any[] = [];
  private activeUserChannels: any[] = [];
  private activeUserId: string | null = null;

  private constructor() {}

  public static getInstance(): MasterRealtimeManager {
    if (!MasterRealtimeManager.instance) {
      MasterRealtimeManager.instance = new MasterRealtimeManager();
    }
    return MasterRealtimeManager.instance;
  }

  /**
   * Initialize all core public store realtime subscriptions in a centralized channel
   */
  public initializeStoreSubscriptions(): void {
    if (this.isStoreSubscribed) return;
    this.isStoreSubscribed = true;

    console.log('[RealtimeManager] ⚡ Initializing store realtime subscriptions...');

    try {
      const channel = supabase
        .channel('frosty_master_store_realtime')
        // Products live updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          async (payload) => {
            console.log('[RealtimeManager] Product change event:', payload.eventType);
            await this.handleProductChange(payload);
          }
        )
        // Banners live updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'banners' },
          async () => {
            console.log('[RealtimeManager] Banner change event detected');
            await CacheManager.invalidate(CacheKeys.BANNERS, CacheNamespace.STORE);
          }
        )
        // App config live updates
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_config' },
          async (payload) => {
            console.log('[RealtimeManager] App config change event');
            if (payload.new) {
              await CacheManager.set(CacheKeys.APP_CONFIG, payload.new, CacheNamespace.CONFIG);
            }
          }
        )
        .subscribe((status) => {
          console.log('[RealtimeManager] Master store subscription status:', status);
        });

      this.activeStoreChannels.push(channel);
    } catch (err) {
      console.warn('[RealtimeManager] Store subscription error:', err);
    }
  }

  /**
   * Initialize private realtime channel for an authenticated user (orders, notifications)
   */
  public initializeUserSubscriptions(userId: string): void {
    if (!userId || this.activeUserId === userId) return;
    this.cleanupUserSubscriptions();
    this.activeUserId = userId;

    console.log(`[RealtimeManager] ⚡ Subscribing to user realtime channel: ${userId}`);

    try {
      const userChannel = supabase
        .channel(`frosty_user_${userId}`)
        // Live order status updates
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            console.log('[RealtimeManager] User order change event:', payload.eventType);
            await this.handleUserOrderChange(payload, userId);
          }
        )
        // Live user profile changes (loyalty points, tier, etc.)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${userId}`,
          },
          async (payload) => {
            console.log('[RealtimeManager] User profile updated live');
            if (payload.new) {
              await CacheManager.set(CacheKeys.USER_PROFILE, payload.new, CacheNamespace.USER, undefined, undefined, userId);
            }
          }
        )
        .subscribe();

      this.activeUserChannels.push(userChannel);
    } catch (err) {
      console.warn('[RealtimeManager] User subscription error:', err);
    }
  }

  /**
   * Surgical product cache update (updates just 1 product without full reload)
   */
  private async handleProductChange(payload: any): Promise<void> {
    try {
      const cached = (await CacheManager.get<any[]>(CacheKeys.PRODUCTS, CacheNamespace.STORE)) || [];
      const eventType = payload.eventType;
      const record = payload.new || payload.old;

      if (!record?.id) {
        await CacheManager.invalidate(CacheKeys.PRODUCTS, CacheNamespace.STORE);
        return;
      }

      let updatedList = [...cached];

      if (eventType === 'INSERT') {
        const exists = updatedList.some((p) => p.id === record.id);
        if (!exists) {
          updatedList.unshift(record);
        }
      } else if (eventType === 'UPDATE') {
        updatedList = updatedList.map((p) => (p.id === record.id ? { ...p, ...record } : p));
      } else if (eventType === 'DELETE') {
        updatedList = updatedList.filter((p) => p.id !== record.id);
      }

      await CacheManager.set(
        CacheKeys.PRODUCTS,
        updatedList,
        CacheNamespace.STORE,
        undefined,
        undefined,
        undefined,
        record.updated_at || Date.now()
      );
    } catch (e) {
      console.warn('[RealtimeManager] Error updating cached products surgically:', e);
      await CacheManager.invalidate(CacheKeys.PRODUCTS, CacheNamespace.STORE);
    }
  }

  /**
   * Surgical user orders update
   */
  private async handleUserOrderChange(payload: any, userId: string): Promise<void> {
    try {
      const cachedOrders = (await CacheManager.get<any[]>(CacheKeys.RECENT_ORDERS, CacheNamespace.ORDERS, userId)) || [];
      const eventType = payload.eventType;
      const record = payload.new || payload.old;

      if (!record?.id) {
        await CacheManager.invalidate(CacheKeys.RECENT_ORDERS, CacheNamespace.ORDERS, userId);
        return;
      }

      let updatedList = [...cachedOrders];

      if (eventType === 'INSERT') {
        const exists = updatedList.some((o) => o.id === record.id);
        if (!exists) {
          updatedList.unshift(record);
        }
      } else if (eventType === 'UPDATE') {
        updatedList = updatedList.map((o) => (o.id === record.id ? { ...o, ...record } : o));
      } else if (eventType === 'DELETE') {
        updatedList = updatedList.filter((o) => o.id !== record.id);
      }

      await CacheManager.set(
        CacheKeys.RECENT_ORDERS,
        updatedList,
        CacheNamespace.ORDERS,
        undefined,
        undefined,
        userId,
        record.updated_at || Date.now()
      );
    } catch (e) {
      console.warn('[RealtimeManager] Error updating cached orders surgically:', e);
      await CacheManager.invalidate(CacheKeys.RECENT_ORDERS, CacheNamespace.ORDERS, userId);
    }
  }

  /**
   * Cleanup user subscriptions on logout or user switch
   */
  public cleanupUserSubscriptions(): void {
    this.activeUserChannels.forEach((ch) => {
      try {
        supabase.removeChannel(ch);
      } catch (_) {}
    });
    this.activeUserChannels = [];
    this.activeUserId = null;
  }

  /**
   * Tear down all subscriptions cleanly
   */
  public cleanup(): void {
    this.cleanupUserSubscriptions();
    this.activeStoreChannels.forEach((ch) => {
      try {
        supabase.removeChannel(ch);
      } catch (_) {}
    });
    this.activeStoreChannels = [];
    this.isStoreSubscribed = false;
  }
}

export const RealtimeManager = MasterRealtimeManager.getInstance();

