import { BaseRepository } from './BaseRepository';
import { supabase } from '../supabase';
import { CacheKeys, CacheNamespace } from '../core/cache/CacheKeys';
import { CacheManager } from '../core/cache/CacheManager';

export interface CouponRecord {
  id: string;
  code: string;
  discount_amount?: number;
  discount_percentage?: number;
  usage_count?: number;
  is_active?: boolean;
  [key: string]: any;
}

class CouponsRepositoryImpl extends BaseRepository {
  /**
   * Fetch all active coupons via CacheOrchestrator
   */
  async getCoupons(): Promise<CouponRecord[]> {
    return this.fetchWithCache<CouponRecord[]>(
      CacheKeys.COUPONS,
      async () => {
        const { data, error } = await supabase
          .from('coupons')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      },
      {
        namespace: CacheNamespace.STORE,
        fallbackData: [],
      }
    );
  }

  /**
   * Fetch a single coupon by ID
   */
  async getCouponById(couponId: string): Promise<CouponRecord | null> {
    const coupons = await this.getCoupons();
    const found = coupons.find((c) => c.id === couponId);
    if (found) return found;

    return this.deduplicate(`coupon_${couponId}`, async () => {
      try {
        const { data, error } = await supabase
          .from('coupons')
          .select('*')
          .eq('id', couponId)
          .single();
        if (error || !data) return null;
        return data;
      } catch {
        return null;
      }
    });
  }

  /**
   * Increment coupon usage count safely and invalidate coupon cache
   */
  async incrementUsageCount(couponId: string): Promise<void> {
    if (!couponId) return;

    return this.deduplicate(`increment_coupon_${couponId}`, async () => {
      try {
        const { data: currentCoupon } = await supabase
          .from('coupons')
          .select('usage_count')
          .eq('id', couponId)
          .single();

        const newCount = (currentCoupon?.usage_count || 0) + 1;
        await supabase
          .from('coupons')
          .update({ usage_count: newCount })
          .eq('id', couponId);

        // Invalidate coupon cache across orchestrator
        await CacheManager.invalidate(CacheKeys.COUPONS, CacheNamespace.STORE);
      } catch (err) {
        console.error('[CouponsRepository] Failed to increment coupon usage count:', err);
      }
    });
  }
}

export const CouponsRepository = new CouponsRepositoryImpl();
