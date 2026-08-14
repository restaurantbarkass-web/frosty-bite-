import { supabase } from '../supabase';
import { CacheManager } from '../core/cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../core/cache/CacheKeys';
import { CacheOrchestrator } from '../core/orchestrator/CacheOrchestrator';

export class OrderService {
  /**
   * Get cached recent orders for a user with background refresh
   */
  static async getOrdersForUser(userId: string, onUpdate?: (orders: any[]) => void): Promise<any[]> {
    if (!userId) return [];

    return await CacheOrchestrator.fetch<any[]>(
      CacheKeys.RECENT_ORDERS,
      async () => {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      },
      {
        namespace: CacheNamespace.ORDERS,
        userId,
        onUpdate,
      }
    );
  }

  /**
   * Optimistically prepend a newly placed order to local cache
   */
  static async recordPlacedOrder(order: any): Promise<void> {
    if (!order?.user_id) return;
    const existing = (await CacheManager.get<any[]>(CacheKeys.RECENT_ORDERS, CacheNamespace.ORDERS, order.user_id)) || [];
    const updated = [order, ...existing.filter((o) => o.id !== order.id)];
    await CacheManager.set(CacheKeys.RECENT_ORDERS, updated, CacheNamespace.ORDERS, undefined, undefined, order.user_id);
  }
}

