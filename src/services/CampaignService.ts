import { PromotionalCampaign, CampaignStatus, FoodItem } from '../types';
import { supabase } from '../supabase';
import { safeFetchJson } from '../utils/safeFetch';

const STORE_KEY = 'promotional_campaigns_store';
const LOCAL_CACHE_KEY = 'frostybite_campaigns_cache';

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  discountAmount?: number;
  eligibleSubtotal?: number;
  totalSubtotal?: number;
  isCampaignOnly?: boolean;
  campaignId?: string;
  campaignTitle?: string;
  eligibleProductIds?: string[];
  coupon?: {
    id: string;
    code: string;
    type: 'percentage' | 'fixed' | 'free_item';
    value: number;
    min_order?: number;
    free_item_id?: string;
    free_item_quantity?: number;
    gift_url?: string;
  };
}

export class CampaignService {
  /**
   * Helper to dynamically evaluate status based on time
   */
  static computeStatus(campaign: PromotionalCampaign): CampaignStatus {
    if (campaign.status === 'inactive') return 'inactive';
    const now = new Date();
    const start = new Date(campaign.start_at);
    const end = new Date(campaign.end_at);

    if (!isNaN(end.getTime()) && now > end) {
      return 'expired';
    }
    if (!isNaN(start.getTime()) && now < start) {
      return 'scheduled';
    }
    return 'active';
  }

  /**
   * Fetch all campaigns with cache and server sync
   * @param onUpdate Optional callback for real-time updates
   * @param includeAll Set to true for admin panel to fetch all scheduled, expired, and inactive campaigns
   */
  static async getCampaigns(onUpdate?: (campaigns: PromotionalCampaign[]) => void, includeAll = false): Promise<PromotionalCampaign[]> {
    // 1. Try local cache first for instant UI response (only if not admin full list)
    let cachedList: PromotionalCampaign[] = [];
    try {
      const cached = localStorage.getItem(LOCAL_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          cachedList = parsed.map(c => ({
            ...c,
            status: this.computeStatus(c)
          }));
        }
      }
    } catch (_) {}

    // 2. Fetch fresh from backend API or Supabase promotional_campaigns / app_settings
    try {
      let freshData: PromotionalCampaign[] | null = null;

      // Try server endpoint first
      try {
        const endpoint = includeAll ? '/api/campaigns?all=true' : '/api/campaigns';
        const res = await safeFetchJson<PromotionalCampaign[]>(endpoint);
        if (Array.isArray(res.data)) {
          freshData = res.data;
        }
      } catch (_) {}

      // Fallback 1: direct Supabase query on promotional_campaigns table
      if (!freshData) {
        try {
          const { data: dbData, error: dbErr } = await supabase
            .from('promotional_campaigns')
            .select(`
              *,
              campaign_products (
                id,
                campaign_id,
                product_id,
                campaign_price,
                custom_image,
                custom_name
              )
            `)
            .order('priority', { ascending: false });

          if (!dbErr && Array.isArray(dbData) && dbData.length > 0) {
            freshData = dbData.map(r => {
              const cProds = Array.isArray(r.campaign_products) ? r.campaign_products : [];
              return {
                id: r.id,
                title: r.title,
                description: r.description || '',
                banner_image: r.banner_image,
                start_at: r.start_at,
                end_at: r.end_at,
                status: this.computeStatus({
                  status: r.status || 'active',
                  start_at: r.start_at,
                  end_at: r.end_at
                } as any),
                product_ids: cProds.map((cp: any) => cp.product_id).filter(Boolean),
                campaign_products: cProds,
                coupon: r.coupon_code ? {
                  code: r.coupon_code,
                  type: r.coupon_type || 'percentage',
                  value: Number(r.coupon_value) || 0,
                  min_order: Number(r.coupon_min_order) || 0,
                  auto_apply: !!r.coupon_auto_apply,
                  free_item_id: r.coupon_free_item_id,
                  free_item_quantity: r.coupon_free_item_quantity,
                  gift_url: r.coupon_gift_url
                } : null,
                is_flash_deal: !!r.is_flash_deal,
                priority: Number(r.priority) || 1,
                created_at: r.created_at,
                updated_at: r.updated_at
              };
            });
          }
        } catch (_) {}
      }

      // Fallback 2: direct Supabase query on app_settings
      if (!freshData) {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('id', STORE_KEY)
          .maybeSingle();

        if (!error && data && data.value) {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (Array.isArray(parsed)) {
            freshData = parsed;
          }
        }
      }

      if (Array.isArray(freshData)) {
        let resolved = freshData.map(c => ({
          ...c,
          status: this.computeStatus(c)
        }));

        if (!includeAll) {
          resolved = resolved.filter(c => c.status === 'active');
        }

        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(resolved));
        if (onUpdate) onUpdate(resolved);
        return resolved;
      }
    } catch (err) {
      console.warn('[CampaignService] Error loading fresh campaigns:', err);
    }

    return includeAll ? cachedList : cachedList.filter(c => c.status === 'active');
  }

  /**
   * Get only currently active, non-expired campaigns
   */
  static async getActiveCampaigns(): Promise<PromotionalCampaign[]> {
    return this.getCampaigns(undefined, false);
  }

  /**
   * Get all campaigns including scheduled, inactive, and expired (for Admin dashboard)
   */
  static async getAllCampaigns(): Promise<PromotionalCampaign[]> {
    return this.getCampaigns(undefined, true);
  }

  /**
   * Toggle active status of a campaign
   */
  static async toggleCampaignStatus(id: string, isActive: boolean): Promise<boolean> {
    const all = await this.getAllCampaigns();
    const target = all.find(c => c.id === id);
    if (!target) return false;

    const updated: PromotionalCampaign = {
      ...target,
      status: isActive ? 'active' : 'inactive',
      is_active: isActive
    };
    await this.saveCampaign(updated);
    return true;
  }

  /**
   * Get single campaign by ID with resolved products (including custom campaign price and images)
   */
  static async getCampaignById(id: string): Promise<{ campaign: PromotionalCampaign; products: FoodItem[] } | null> {
    // Try server endpoint first to get fully resolved products with campaign pricing/images
    try {
      const res = await safeFetchJson<any>(`/api/campaigns/${id}`);
      if (res.data && res.data.id) {
        const { products, ...campData } = res.data;
        return {
          campaign: {
            ...campData,
            status: this.computeStatus(campData)
          },
          products: products || []
        };
      }
    } catch (serverErr) {
      console.warn('[CampaignService] Server fetch failed for campaign by id:', serverErr);
    }

    const all = await this.getCampaigns(undefined, true);
    const campaign = all.find(c => c.id === id);
    if (!campaign) return null;

    let products: FoodItem[] = [];
    if (campaign.product_ids && campaign.product_ids.length > 0) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .in('id', campaign.product_ids);

        if (!error && data) {
          const cProds = campaign.campaign_products || [];
          products = data.map(p => {
            const customConfig = cProds.find(cp => cp.product_id === p.id);
            const campaignPrice = customConfig?.campaign_price != null ? Number(customConfig.campaign_price) : undefined;
            const customImage = customConfig?.custom_image || undefined;
            const customName = customConfig?.custom_name || undefined;

            return {
              ...p,
              original_price: p.price,
              campaign_price: campaignPrice,
              custom_image: customImage,
              name: customName || p.name,
              image: customImage || p.image,
              price: campaignPrice != null ? campaignPrice : p.price
            };
          });
        }
      } catch (err) {
        console.warn('[CampaignService] Error resolving campaign products:', err);
      }
    }

    return {
      campaign: {
        ...campaign,
        status: this.computeStatus(campaign)
      },
      products
    };
  }

  /**
   * Save or update a campaign
   */
  static async saveCampaign(campaign: PromotionalCampaign): Promise<PromotionalCampaign> {
    const payload = {
      ...campaign,
      status: campaign.status || 'active',
      updated_at: new Date().toISOString()
    };

    // 1. Try server endpoint
    try {
      const res = await safeFetchJson<{ success: boolean; campaign: PromotionalCampaign }>('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.data?.campaign) {
        await this.getCampaigns(); // refresh cache
        return res.data.campaign;
      }
    } catch (serverErr) {
      console.warn('[CampaignService] Server save failed, falling back to direct Supabase:', serverErr);
    }

    // 2. Fallback: direct Supabase upsert into app_settings + banners + coupons
    const existing = await this.getCampaigns();
    const idx = existing.findIndex(c => c.id === campaign.id);
    let updatedList = [...existing];
    if (idx >= 0) {
      updatedList[idx] = payload;
    } else {
      updatedList.push(payload);
    }

    await supabase.from('app_settings').upsert({
      id: STORE_KEY,
      value: JSON.stringify(updatedList),
      updated_at: new Date().toISOString()
    });

    // Sync banner
    try {
      await supabase.from('banners').upsert({
        id: `banner-${payload.id}`,
        title: payload.title,
        image_url: payload.banner_image,
        redirect_url: `/campaign/${payload.id}`,
        priority: (payload.priority || 1) + 10,
        is_active: payload.status === 'active',
        is_flash_deal: payload.is_flash_deal || false,
        start_date: payload.start_at,
        end_date: payload.end_at,
        created_at: payload.created_at,
        auto_apply_coupon: payload.coupon?.code || null
      });
    } catch (_) {}

    // Sync coupon
    if (payload.coupon?.code) {
      try {
        await supabase.from('coupons').upsert({
          id: `coupon-camp-${payload.id}`,
          code: payload.coupon.code.toUpperCase(),
          type: payload.coupon.type,
          value: payload.coupon.value,
          min_order: payload.coupon.min_order || 0,
          expiry_date: payload.end_at.split('T')[0],
          usage_limit: 10000,
          usage_count: 0,
          status: payload.status === 'active' ? 'active' : 'disabled',
          created_at: payload.created_at,
          free_item_id: payload.coupon.free_item_id || null,
          free_item_quantity: payload.coupon.free_item_quantity || 1,
          gift_url: payload.coupon.gift_url || null,
          is_hidden: false
        });
      } catch (_) {}
    }

    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(updatedList));
    return payload;
  }

  /**
   * Delete a campaign
   */
  static async deleteCampaign(id: string): Promise<boolean> {
    try {
      await safeFetchJson(`/api/campaigns/${id}`, { method: 'DELETE' });
    } catch (_) {}

    // Ensure removed from Supabase and local cache
    const existing = await this.getCampaigns();
    const updated = existing.filter(c => c.id !== id);
    await supabase.from('app_settings').upsert({
      id: STORE_KEY,
      value: JSON.stringify(updated),
      updated_at: new Date().toISOString()
    });

    try {
      await supabase.from('banners').delete().eq('id', `banner-${id}`);
      await supabase.from('coupons').delete().eq('id', `coupon-camp-${id}`);
    } catch (_) {}

    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(updated));
    return true;
  }

  /**
   * Server-side coupon validation
   */
  static async validateCoupon(
    code: string,
    cartItems: Array<{ id: string; price: number; quantity: number }>
  ): Promise<CouponValidationResult> {
    const cleanCode = code.trim().toUpperCase();

    try {
      const res = await safeFetchJson<CouponValidationResult>('/api/campaigns/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          cartItems
        })
      });

      if (res.data) {
        return res.data;
      }
    } catch (err: any) {
      console.warn('[CampaignService] Server coupon validation error, using local verification:', err);
    }

    // Local fallback validation
    const campaigns = await this.getCampaigns();
    const matchedCampaign = campaigns.find(
      c => c.coupon && c.coupon.code.toUpperCase() === cleanCode
    );

    if (matchedCampaign) {
      const dynamicStatus = this.computeStatus(matchedCampaign);
      if (dynamicStatus === 'expired') {
        return { valid: false, message: `The campaign "${matchedCampaign.title}" has ended.` };
      }
      if (dynamicStatus === 'inactive') {
        return { valid: false, message: `The campaign "${matchedCampaign.title}" is currently inactive.` };
      }

      const eligibleSet = new Set(matchedCampaign.product_ids || []);
      const eligibleItems = cartItems.filter(i => eligibleSet.has(i.id));
      const eligibleSubtotal = eligibleItems.reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1),
        0
      );

      if (eligibleItems.length === 0 || eligibleSubtotal <= 0) {
        return {
          valid: false,
          message: `Coupon "${cleanCode}" is valid only for items in the "${matchedCampaign.title}" campaign. Add eligible items to your cart.`,
          campaignTitle: matchedCampaign.title,
          eligibleProductIds: matchedCampaign.product_ids
        };
      }

      const coupon = matchedCampaign.coupon!;
      const minOrder = coupon.min_order || 0;
      if (minOrder > 0 && eligibleSubtotal < minOrder) {
        return {
          valid: false,
          message: `Minimum order of ₹${minOrder} in eligible campaign items required. (Current: ₹${eligibleSubtotal})`
        };
      }

      let discount = 0;
      if (coupon.type === 'percentage') {
        discount = Math.round((eligibleSubtotal * coupon.value) / 100);
      } else if (coupon.type === 'fixed') {
        discount = Math.min(eligibleSubtotal, coupon.value);
      }

      return {
        valid: true,
        discountAmount: discount,
        eligibleSubtotal,
        isCampaignOnly: true,
        campaignId: matchedCampaign.id,
        campaignTitle: matchedCampaign.title,
        eligibleProductIds: matchedCampaign.product_ids,
        coupon: {
          id: `camp-${matchedCampaign.id}`,
          code: cleanCode,
          type: coupon.type,
          value: coupon.value,
          min_order: coupon.min_order,
          free_item_id: coupon.free_item_id,
          free_item_quantity: coupon.free_item_quantity,
          gift_url: coupon.gift_url
        }
      };
    }

    // Direct fallback check in Supabase coupons table for general admin coupons
    try {
      const { data: dbCoupons } = await supabase
        .from('coupons')
        .select('*')
        .ilike('code', cleanCode)
        .eq('status', 'active')
        .limit(1);

      if (dbCoupons && dbCoupons.length > 0) {
        const couponData = dbCoupons[0];

        // Check expiry
        if (couponData.expiry_date) {
          const exp = new Date(couponData.expiry_date);
          exp.setHours(23, 59, 59, 999);
          if (exp.getTime() < Date.now()) {
            return { valid: false, message: 'This coupon has expired.' };
          }
        }

        // Check usage limits
        if (couponData.usage_limit > 0 && (couponData.usage_count || 0) >= couponData.usage_limit) {
          return { valid: false, message: 'This coupon has reached its maximum usage limit.' };
        }

        const totalSubtotal = cartItems.reduce(
          (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1),
          0
        );

        // Check min order
        const minOrder = Number(couponData.min_order) || 0;
        if (minOrder > 0 && totalSubtotal < minOrder) {
          return {
            valid: false,
            message: `Minimum order of ₹${minOrder} required for coupon "${cleanCode}".`
          };
        }

        let discount = 0;
        if (couponData.type === 'percentage') {
          discount = Math.round((totalSubtotal * (Number(couponData.value) || 0)) / 100);
        } else if (couponData.type === 'fixed') {
          discount = Math.min(totalSubtotal, Number(couponData.value) || 0);
        }

        return {
          valid: true,
          discountAmount: discount,
          eligibleSubtotal: totalSubtotal,
          totalSubtotal,
          isCampaignOnly: false,
          coupon: {
            id: couponData.id,
            code: couponData.code.toUpperCase(),
            type: couponData.type,
            value: Number(couponData.value) || 0,
            min_order: minOrder,
            free_item_id: couponData.free_item_id,
            free_item_quantity: couponData.free_item_quantity,
            gift_url: couponData.gift_url
          }
        };
      }
    } catch (dbErr) {
      console.warn('[CampaignService] Supabase fallback coupon query failed:', dbErr);
    }

    return { valid: false, message: 'Invalid or expired coupon code.' };
  }

  /**
   * Subscribe to real-time changes
   */
  static subscribeToCampaigns(onChange: (campaigns: PromotionalCampaign[]) => void) {
    const channel = supabase
      .channel('promotional_campaigns_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: `id=eq.${STORE_KEY}` },
        () => {
          this.getCampaigns(onChange);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
