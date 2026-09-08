import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();
const STORE_ID = 'promotional_campaigns_store';

export interface CampaignProductDbRow {
  id?: string;
  campaign_id?: string;
  product_id: string;
  campaign_price?: number | null;
  custom_image?: string | null;
  custom_name?: string | null;
}

export interface CampaignData {
  id: string;
  title: string;
  description: string;
  banner_image: string;
  start_at: string;
  end_at: string;
  status: 'active' | 'inactive' | 'scheduled' | 'expired';
  product_ids: string[];
  campaign_products?: CampaignProductDbRow[];
  coupon?: {
    code: string;
    type: 'percentage' | 'fixed' | 'free_item';
    value: number;
    min_order?: number;
    auto_apply?: boolean;
    free_item_id?: string;
    free_item_quantity?: number;
    gift_url?: string;
  } | null;
  is_flash_deal?: boolean;
  priority?: number;
  created_at: string;
  updated_at?: string;
}

// Compute active/scheduled/expired status dynamically based on current server time
function computeDynamicStatus(campaign: {
  status?: string;
  start_at: string;
  end_at: string;
}): 'active' | 'inactive' | 'scheduled' | 'expired' {
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

// Helper: load all campaigns from Supabase (relational promotional_campaigns first, falling back to app_settings)
async function loadCampaignsFromDb(): Promise<CampaignData[]> {
  // 1. Try relational promotional_campaigns table with campaign_products join
  try {
    const { data: dbRows, error: dbErr } = await supabase
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

    if (!dbErr && Array.isArray(dbRows) && dbRows.length > 0) {
      return dbRows.map(r => {
        const cProds: CampaignProductDbRow[] = Array.isArray(r.campaign_products) ? r.campaign_products : [];
        const pIds = cProds.map(cp => cp.product_id).filter(Boolean);
        return {
          id: r.id,
          title: r.title,
          description: r.description || '',
          banner_image: r.banner_image,
          start_at: r.start_at,
          end_at: r.end_at,
          status: computeDynamicStatus({
            status: r.status || 'active',
            start_at: r.start_at,
            end_at: r.end_at
          }),
          product_ids: pIds,
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
  } catch (err) {
    console.warn('[Campaigns Router] Falling back from relational query to app_settings:', err);
  }

  // 2. Fallback to app_settings store
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('id', STORE_ID)
      .maybeSingle();

    if (error) {
      console.warn('[Campaigns Router] Error loading campaigns from app_settings:', error.message);
      return [];
    }

    if (!data || !data.value) return [];
    const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (Array.isArray(parsed)) {
      return parsed.map((c: CampaignData) => ({
        ...c,
        status: computeDynamicStatus(c)
      }));
    }
    return [];
  } catch (err: any) {
    console.error('[Campaigns Router] Parse error loading campaigns:', err);
    return [];
  }
}

// Helper: save all campaigns to Supabase app_settings
async function saveCampaignsToDb(campaigns: CampaignData[]): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      id: STORE_ID,
      value: JSON.stringify(campaigns),
      updated_at: new Date().toISOString()
    });

  if (error) {
    throw error;
  }
}

/**
 * GET /api/campaigns
 * Server-side requirement: strictly ensures ONLY active, non-expired campaigns
 * are returned by default.
 * Admin query params: ?all=true or ?status=... allows inspecting full catalog.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const campaigns = await loadCampaignsFromDb();
    const filterStatus = req.query.status as string;
    const includeAll = req.query.all === 'true' || req.query.includeAll === 'true';

    let result = campaigns;

    if (!includeAll && !filterStatus) {
      // STRICT SERVER-SIDE GUARANTEE:
      // Return ONLY active, non-expired campaigns!
      const now = new Date();
      result = campaigns.filter(c => {
        if (c.status === 'inactive') return false;
        const start = new Date(c.start_at);
        const end = new Date(c.end_at);
        if (!isNaN(start.getTime()) && now < start) return false;
        if (!isNaN(end.getTime()) && now > end) return false;
        return true;
      });
    } else if (filterStatus && filterStatus !== 'all') {
      result = campaigns.filter(c => c.status === filterStatus);
    }

    // Sort by priority descending, then created_at descending
    result.sort((a, b) => {
      const pDiff = (b.priority || 0) - (a.priority || 0);
      if (pDiff !== 0) return pDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    res.json(result);
  } catch (err: any) {
    console.error('[Campaigns Router] GET / error:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns', message: err.message });
  }
});

/**
 * GET /api/campaigns/:id
 * Fetches campaign with resolved product objects including custom promotional
 * prices and custom uploaded images.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaigns = await loadCampaignsFromDb();
    const campaign = campaigns.find(c => c.id === id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Fetch matching products from Supabase products table
    let products: any[] = [];
    if (campaign.product_ids && campaign.product_ids.length > 0) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', campaign.product_ids);

      if (!error && data) {
        // Merge with custom campaign_products configurations (custom price and custom image)
        const cProds = campaign.campaign_products || [];
        products = data.map((prod: any) => {
          const customConfig = cProds.find(cp => cp.product_id === prod.id);
          const campaignPrice = customConfig?.campaign_price != null ? Number(customConfig.campaign_price) : undefined;
          const customImage = customConfig?.custom_image || undefined;
          const customName = customConfig?.custom_name || undefined;

          return {
            ...prod,
            original_price: prod.price,
            campaign_price: campaignPrice,
            custom_image: customImage,
            name: customName || prod.name,
            // If custom campaign price or image provided, provide them at top-level for instant rendering
            image: customImage || prod.image,
            price: campaignPrice != null ? campaignPrice : prod.price
          };
        });
      }
    }

    res.json({
      ...campaign,
      products
    });
  } catch (err: any) {
    console.error('[Campaigns Router] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to fetch campaign', message: err.message });
  }
});

/**
 * POST /api/campaigns
 * Admin: Create or update a campaign with support for custom product pricing & image uploads
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<CampaignData> & {
      campaign_items?: CampaignProductDbRow[];
    };
    if (!body.title || !body.banner_image) {
      return res.status(400).json({ error: 'Campaign title and banner_image are required' });
    }

    const campaigns = await loadCampaignsFromDb();
    const id = body.id || `camp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // Reconcile product IDs and items
    const rawItems: CampaignProductDbRow[] = Array.isArray(body.campaign_products)
      ? body.campaign_products
      : Array.isArray(body.campaign_items)
      ? body.campaign_items
      : [];

    const productIdsSet = new Set<string>();
    if (Array.isArray(body.product_ids)) {
      body.product_ids.forEach(pid => productIdsSet.add(pid));
    }
    rawItems.forEach(item => {
      if (item.product_id) productIdsSet.add(item.product_id);
    });

    const finalProductIds = Array.from(productIdsSet);
    const finalCampaignProducts: CampaignProductDbRow[] = finalProductIds.map(pid => {
      const match = rawItems.find(item => item.product_id === pid);
      return {
        campaign_id: id,
        product_id: pid,
        campaign_price: match?.campaign_price != null ? Number(match.campaign_price) : null,
        custom_image: match?.custom_image || null,
        custom_name: match?.custom_name || null
      };
    });

    const campaignRecord: CampaignData = {
      id,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      banner_image: body.banner_image.trim(),
      start_at: body.start_at || now,
      end_at: body.end_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: body.status || 'active',
      product_ids: finalProductIds,
      campaign_products: finalCampaignProducts,
      coupon: body.coupon ? {
        code: body.coupon.code.trim().toUpperCase(),
        type: body.coupon.type || 'percentage',
        value: Number(body.coupon.value) || 0,
        min_order: Number(body.coupon.min_order) || 0,
        auto_apply: !!body.coupon.auto_apply,
        free_item_id: body.coupon.free_item_id,
        free_item_quantity: body.coupon.free_item_quantity,
        gift_url: body.coupon.gift_url
      } : null,
      is_flash_deal: !!body.is_flash_deal,
      priority: Number(body.priority) || 1,
      created_at: body.created_at || now,
      updated_at: now
    };

    // 1. Relational persistence into promotional_campaigns and campaign_products
    try {
      const { error: relCampErr } = await supabase.from('promotional_campaigns').upsert({
        id: campaignRecord.id,
        title: campaignRecord.title,
        description: campaignRecord.description,
        banner_image: campaignRecord.banner_image,
        start_at: campaignRecord.start_at,
        end_at: campaignRecord.end_at,
        status: campaignRecord.status,
        is_flash_deal: campaignRecord.is_flash_deal,
        priority: campaignRecord.priority,
        coupon_code: campaignRecord.coupon?.code || null,
        coupon_type: campaignRecord.coupon?.type || 'percentage',
        coupon_value: campaignRecord.coupon?.value || 0,
        coupon_min_order: campaignRecord.coupon?.min_order || 0,
        coupon_auto_apply: campaignRecord.coupon?.auto_apply || false,
        coupon_free_item_id: campaignRecord.coupon?.free_item_id || null,
        coupon_free_item_quantity: campaignRecord.coupon?.free_item_quantity || 1,
        coupon_gift_url: campaignRecord.coupon?.gift_url || null,
        updated_at: now
      });

      if (!relCampErr) {
        // Sync campaign_products without touching main products table
        // Deleting from campaign_products only removes junction records;
        // it NEVER deletes anything from public.products!
        await supabase
          .from('campaign_products')
          .delete()
          .eq('campaign_id', campaignRecord.id);

        if (finalCampaignProducts.length > 0) {
          const insertRows = finalCampaignProducts.map(cp => ({
            campaign_id: campaignRecord.id,
            product_id: cp.product_id,
            campaign_price: cp.campaign_price != null ? Number(cp.campaign_price) : null,
            custom_image: cp.custom_image || null,
            custom_name: cp.custom_name || null
          }));
          await supabase.from('campaign_products').insert(insertRows);
        }
      }
    } catch (relErr) {
      console.warn('[Campaigns Router] Relational sync warning:', relErr);
    }

    // 2. Mirror into app_settings for dual-mode stability
    const existingIndex = campaigns.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
      campaigns[existingIndex] = campaignRecord;
    } else {
      campaigns.push(campaignRecord);
    }
    await saveCampaignsToDb(campaigns);

    // 3. Sync banner into banners table so existing hero carousel and real-time subscribers pick it up
    try {
      await supabase.from('banners').upsert({
        id: `banner-${id}`,
        title: campaignRecord.title,
        image_url: campaignRecord.banner_image,
        redirect_url: `/campaign/${id}`,
        priority: (campaignRecord.priority || 1) + 10,
        is_active: campaignRecord.status === 'active',
        is_flash_deal: campaignRecord.is_flash_deal || false,
        start_date: campaignRecord.start_at,
        end_date: campaignRecord.end_at,
        created_at: campaignRecord.created_at,
        auto_apply_coupon: campaignRecord.coupon?.code || null
      });
    } catch (bannerSyncErr) {
      console.warn('[Campaigns Router] Could not sync banner table:', bannerSyncErr);
    }

    // 4. Sync coupon into coupons table if coupon configured
    if (campaignRecord.coupon?.code) {
      try {
        await supabase.from('coupons').upsert({
          id: `coupon-camp-${id}`,
          code: campaignRecord.coupon.code,
          type: campaignRecord.coupon.type,
          value: campaignRecord.coupon.value,
          min_order: campaignRecord.coupon.min_order || 0,
          expiry_date: campaignRecord.end_at.split('T')[0],
          usage_limit: 10000,
          usage_count: 0,
          status: campaignRecord.status === 'active' ? 'active' : 'disabled',
          created_at: now,
          free_item_id: campaignRecord.coupon.free_item_id || null,
          free_item_quantity: campaignRecord.coupon.free_item_quantity || 1,
          gift_url: campaignRecord.coupon.gift_url || null,
          is_hidden: false
        });
      } catch (couponSyncErr) {
        console.warn('[Campaigns Router] Could not sync coupons table:', couponSyncErr);
      }
    }

    res.json({ success: true, campaign: campaignRecord });
  } catch (err: any) {
    console.error('[Campaigns Router] POST / error:', err);
    res.status(500).json({ error: 'Failed to save campaign', message: err.message });
  }
});

/**
 * DELETE /api/campaigns/:id
 * Admin: Delete a campaign.
 * Non-cascading product integrity: deleting a campaign removes campaign_products
 * junction entries, but strictly retains all catalog products in public.products!
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Delete from relational tables
    try {
      // Because campaign_products has ON DELETE CASCADE on campaign_id,
      // its junction rows are removed automatically, while ON DELETE RESTRICT on product_id
      // ensures public.products is 100% protected and untouched!
      await supabase.from('promotional_campaigns').delete().eq('id', id);
    } catch (relDeleteErr) {
      console.warn('[Campaigns Router] Relational delete warning:', relDeleteErr);
    }

    // 2. Delete from app_settings
    let campaigns = await loadCampaignsFromDb();
    const toDelete = campaigns.find(c => c.id === id);
    campaigns = campaigns.filter(c => c.id !== id);
    await saveCampaignsToDb(campaigns);

    // 3. Remove linked banner
    try {
      await supabase.from('banners').delete().eq('id', `banner-${id}`);
    } catch (_) {}

    // 4. Remove linked coupon
    if (toDelete?.coupon?.code) {
      try {
        await supabase.from('coupons').delete().eq('id', `coupon-camp-${id}`);
      } catch (_) {}
    }

    res.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (err: any) {
    console.error('[Campaigns Router] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete campaign', message: err.message });
  }
});

/**
 * POST /api/campaigns/validate-coupon
 * Strict server-side coupon validation against campaign-assigned products.
 *
 * Request body:
 * {
 *   code: string;
 *   cartItems: Array<{ id: string; price: number; quantity: number }>;
 * }
 */
router.post('/validate-coupon', async (req: Request, res: Response) => {
  try {
    const { code, cartItems } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, message: 'Coupon code is required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const items: Array<{ id: string; price: number; quantity: number }> = Array.isArray(cartItems) ? cartItems : [];
    const totalSubtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

    // 1. Check if this code belongs to any active promotional campaign
    const campaigns = await loadCampaignsFromDb();
    const matchedCampaign = campaigns.find(
      c => c.coupon && c.coupon.code.toUpperCase() === cleanCode
    );

    if (matchedCampaign) {
      const dynamicStatus = computeDynamicStatus(matchedCampaign);
      if (dynamicStatus === 'expired') {
        return res.status(400).json({
          valid: false,
          message: `The promotional campaign "${matchedCampaign.title}" has ended.`
        });
      }
      if (dynamicStatus === 'inactive') {
        return res.status(400).json({
          valid: false,
          message: `The promotional campaign "${matchedCampaign.title}" is currently not active.`
        });
      }
      if (dynamicStatus === 'scheduled') {
        return res.status(400).json({
          valid: false,
          message: `The campaign "${matchedCampaign.title}" starts soon on ${new Date(matchedCampaign.start_at).toLocaleDateString()}.`
        });
      }

      // 2. Strict product eligibility check
      const eligibleIds = new Set(matchedCampaign.product_ids || []);
      const eligibleItems = items.filter(item => eligibleIds.has(item.id));
      const eligibleSubtotal = eligibleItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      );

      if (eligibleItems.length === 0 || eligibleSubtotal <= 0) {
        return res.status(400).json({
          valid: false,
          message: `Coupon "${cleanCode}" is valid ONLY for items in the "${matchedCampaign.title}" campaign. Please add eligible campaign items to your cart.`,
          campaignTitle: matchedCampaign.title,
          eligibleProductIds: matchedCampaign.product_ids
        });
      }

      // Check min order for eligible campaign items
      const minOrder = matchedCampaign.coupon?.min_order || 0;
      if (minOrder > 0 && eligibleSubtotal < minOrder) {
        return res.status(400).json({
          valid: false,
          message: `A minimum order of ₹${minOrder} in eligible campaign items is required to use this coupon. (Current: ₹${eligibleSubtotal})`,
          campaignTitle: matchedCampaign.title
        });
      }

      // 3. Compute discount ONLY on eligible items
      let discountAmount = 0;
      const coupon = matchedCampaign.coupon!;
      if (coupon.type === 'percentage') {
        discountAmount = Math.round((eligibleSubtotal * coupon.value) / 100);
      } else if (coupon.type === 'fixed') {
        discountAmount = Math.min(eligibleSubtotal, coupon.value);
      } else if (coupon.type === 'free_item') {
        discountAmount = 0;
      }

      return res.json({
        valid: true,
        discountAmount,
        eligibleSubtotal,
        totalSubtotal,
        isCampaignOnly: true,
        campaignId: matchedCampaign.id,
        campaignTitle: matchedCampaign.title,
        eligibleProductIds: matchedCampaign.product_ids,
        coupon: {
          id: `camp-${matchedCampaign.id}`,
          code: cleanCode,
          type: coupon.type,
          value: coupon.value,
          min_order: coupon.min_order || 0,
          free_item_id: coupon.free_item_id,
          free_item_quantity: coupon.free_item_quantity,
          gift_url: coupon.gift_url
        }
      });
    }

    // 4. If not a campaign coupon, check standard coupons table in Supabase
    const { data: dbCoupons, error } = await supabase
      .from('coupons')
      .select('*')
      .ilike('code', cleanCode)
      .eq('status', 'active')
      .limit(1);

    if (error || !dbCoupons || dbCoupons.length === 0) {
      return res.status(400).json({ valid: false, message: 'Invalid or expired coupon code.' });
    }

    const couponData = dbCoupons[0];

    // Check expiry
    if (couponData.expiry_date) {
      const expiry = new Date(couponData.expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!isNaN(expiry.getTime()) && expiry < today) {
        return res.status(400).json({ valid: false, message: 'This coupon has expired.' });
      }
    }

    // Check min order
    const minOrder = Number(couponData.min_order) || 0;
    if (minOrder > 0 && totalSubtotal < minOrder) {
      return res.status(400).json({
        valid: false,
        message: `Minimum order of ₹${minOrder} required for coupon "${cleanCode}".`
      });
    }

    // Check usage limit
    if (couponData.usage_limit > 0 && couponData.usage_count >= couponData.usage_limit) {
      return res.status(400).json({ valid: false, message: 'This coupon has reached its usage limit.' });
    }

    let discountAmount = 0;
    if (couponData.type === 'percentage') {
      discountAmount = Math.round((totalSubtotal * (Number(couponData.value) || 0)) / 100);
    } else if (couponData.type === 'fixed') {
      discountAmount = Math.min(totalSubtotal, Number(couponData.value) || 0);
    }

    return res.json({
      valid: true,
      discountAmount,
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
    });
  } catch (err: any) {
    console.error('[Campaigns Router] validate-coupon error:', err);
    res.status(500).json({ valid: false, message: 'Failed to validate coupon', error: err.message });
  }
});

export default router;
