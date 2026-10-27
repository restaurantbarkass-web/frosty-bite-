import { supabase } from '../supabase';

export interface LoyaltySettings {
  enabled: boolean;
  stampsRequired: number;
  eligibleOrderStatuses: string[];
  minimumOrderAmount: number;
  repeatCyclesEnabled: boolean;
  scratchThreshold: number;
  guaranteedRewardsEnabled: boolean;
  allocationMode?: 'equal' | 'probability' | 'fixed';
  fallbackAction?: 'pause' | 'fallback_gift';
  fallbackPrizeId?: string;
}

export interface LoyaltyPrize {
  id: string;
  name: string;
  description: string;
  rewardType: 'cupcake' | 'cookie' | 'dessert' | 'fixed_discount' | 'percent_discount' | 'product' | 'custom';
  productId?: string;
  rewardValue: number;
  stockQuantity: number;
  active: boolean;
  validityDays: number;
  redemptionRules: string;
  minimumOrderAmount: number;
  redemptionType: 'free_claim' | 'min_purchase';
  probability?: number;
}

export interface LoyaltyState {
  status: 'loading' | 'valid' | 'invalid' | 'expired' | 'already_collected' | 'not_eligible' | 'error';
  message: string;
  order?: any;
  stampAwarded?: boolean;
  stampsCollected: number;
  stampsRequired: number;
  cycleId?: string;
  mysteryBoxUnlocked?: boolean;
  mysteryBoxOpened?: boolean;
  scratchReward?: any;
}

const DEFAULT_SETTINGS: LoyaltySettings = {
  enabled: true,
  stampsRequired: 5,
  eligibleOrderStatuses: ['delivered', 'completed', 'dispatched'],
  minimumOrderAmount: 199,
  repeatCyclesEnabled: true,
  scratchThreshold: 55,
  guaranteedRewardsEnabled: true,
  allocationMode: 'equal',
  fallbackAction: 'pause'
};

const DEFAULT_PRIZES: LoyaltyPrize[] = [
  {
    id: 'prize_cupcake',
    name: 'Free Signature Cupcake',
    description: 'Enjoy any freshly baked signature cupcake on your next visit!',
    rewardType: 'cupcake',
    rewardValue: 120,
    stockQuantity: 100,
    active: true,
    validityDays: 30,
    redemptionRules: 'No purchase required. Redeem via WhatsApp claim link.',
    minimumOrderAmount: 0,
    redemptionType: 'free_claim',
    probability: 40,
  },
  {
    id: 'prize_cookie',
    name: 'Artisanal Choco-Chip Cookie',
    description: 'A warm, gooey double chocolate-chip cookie baked to perfection.',
    rewardType: 'cookie',
    rewardValue: 90,
    stockQuantity: 150,
    active: true,
    validityDays: 30,
    redemptionRules: 'No minimum purchase required.',
    minimumOrderAmount: 0,
    redemptionType: 'free_claim',
    probability: 35,
  },
  {
    id: 'prize_cake_min_purchase',
    name: 'Free Chocolate Cake (with ₹299 Order)',
    description: 'Get a full signature mini chocolate cake when your cart reaches ₹299!',
    rewardType: 'product',
    rewardValue: 250,
    stockQuantity: 75,
    active: true,
    validityDays: 15,
    redemptionRules: 'Redeem directly at online checkout with minimum ₹299 cart.',
    minimumOrderAmount: 299,
    redemptionType: 'min_purchase',
    probability: 25,
  }
];

export const loyaltyService = {
  async getSettings(): Promise<LoyaltySettings> {
    try {
      const { data, error } = await supabase.from('loyalty_settings').select('*').maybeSingle();
      if (error || !data) return DEFAULT_SETTINGS;
      return {
        enabled: data.enabled ?? DEFAULT_SETTINGS.enabled,
        stampsRequired: data.stamps_required ?? DEFAULT_SETTINGS.stampsRequired,
        eligibleOrderStatuses: data.eligible_order_statuses ?? DEFAULT_SETTINGS.eligibleOrderStatuses,
        minimumOrderAmount: data.minimum_order_amount ?? DEFAULT_SETTINGS.minimumOrderAmount,
        repeatCyclesEnabled: data.repeat_cycles_enabled ?? DEFAULT_SETTINGS.repeatCyclesEnabled,
        scratchThreshold: data.scratch_threshold ?? DEFAULT_SETTINGS.scratchThreshold,
        guaranteedRewardsEnabled: data.guaranteed_rewards_enabled ?? DEFAULT_SETTINGS.guaranteedRewardsEnabled,
        allocationMode: data.allocation_mode ?? 'equal',
        fallbackAction: data.fallback_action ?? 'pause',
        fallbackPrizeId: data.fallback_prize_id
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async updateSettings(settings: Partial<LoyaltySettings>) {
    try {
      const payload = {
        enabled: settings.enabled,
        stamps_required: settings.stampsRequired,
        eligible_order_statuses: settings.eligibleOrderStatuses,
        minimum_order_amount: settings.minimumOrderAmount,
        repeat_cycles_enabled: settings.repeatCyclesEnabled,
        scratch_threshold: settings.scratchThreshold,
        guaranteed_rewards_enabled: settings.guaranteedRewardsEnabled,
        allocation_mode: settings.allocationMode || 'equal',
        fallback_action: settings.fallbackAction || 'pause',
        fallback_prize_id: settings.fallbackPrizeId,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('loyalty_settings').upsert(payload, { onConflict: 'id' }).select();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase loyalty settings update fallback:', err);
      return settings;
    }
  },

  async getPrizes(): Promise<LoyaltyPrize[]> {
    try {
      const { data, error } = await supabase.from('reward_prizes').select('*');
      if (!error && data && data.length > 0) {
        return data.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          rewardType: p.reward_type,
          productId: p.product_id,
          rewardValue: p.reward_value,
          stockQuantity: p.stock_quantity,
          active: p.active,
          validityDays: p.validity_days,
          redemptionRules: p.redemption_rules,
          minimumOrderAmount: p.minimum_order_amount || 0,
          redemptionType: p.redemption_type || (p.minimum_order_amount > 0 ? 'min_purchase' : 'free_claim'),
          probability: p.probability ?? 20
        }));
      }

      // If empty in DB, attempt auto-seed so default items acquire genuine UUIDs
      const seedPayloads = DEFAULT_PRIZES.map(p => ({
        name: p.name,
        description: p.description,
        reward_type: p.rewardType,
        reward_value: p.rewardValue,
        stock_quantity: p.stockQuantity,
        active: p.active,
        validity_days: p.validityDays,
        redemption_rules: p.redemptionRules,
        minimum_order_amount: p.minimumOrderAmount,
        redemption_type: p.redemptionType,
        probability: p.probability
      }));

      const { data: inserted, error: seedError } = await supabase
        .from('reward_prizes')
        .insert(seedPayloads)
        .select();

      if (!seedError && inserted && inserted.length > 0) {
        return inserted.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          rewardType: p.reward_type,
          productId: p.product_id,
          rewardValue: p.reward_value,
          stockQuantity: p.stock_quantity,
          active: p.active,
          validityDays: p.validity_days,
          redemptionRules: p.redemption_rules,
          minimumOrderAmount: p.minimum_order_amount || 0,
          redemptionType: p.redemption_type || (p.minimum_order_amount > 0 ? 'min_purchase' : 'free_claim'),
          probability: p.probability ?? 20
        }));
      }

      const deletedSampleIds = JSON.parse(localStorage.getItem('fb_deleted_sample_prizes') || '[]');
      return DEFAULT_PRIZES.filter(p => !deletedSampleIds.includes(p.id));
    } catch {
      const deletedSampleIds = JSON.parse(localStorage.getItem('fb_deleted_sample_prizes') || '[]');
      return DEFAULT_PRIZES.filter(p => !deletedSampleIds.includes(p.id));
    }
  },

  async savePrize(prize: Partial<LoyaltyPrize>) {
    const payload = {
      name: prize.name,
      description: prize.description,
      reward_type: prize.rewardType || 'cupcake',
      product_id: prize.productId,
      reward_value: prize.rewardValue || 100,
      stock_quantity: prize.stockQuantity || 50,
      active: prize.active ?? true,
      validity_days: prize.validityDays || 30,
      redemption_rules: prize.redemptionRules || '',
      minimum_order_amount: prize.minimumOrderAmount || 0,
      redemption_type: prize.redemptionType || ((prize.minimumOrderAmount || 0) > 0 ? 'min_purchase' : 'free_claim'),
      probability: prize.probability ?? 20,
      updated_at: new Date().toISOString()
    };
    const isUuid = prize.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prize.id);
    if (isUuid && !prize.id?.startsWith('new_') && !prize.id?.startsWith('prize_')) {
      const { error } = await supabase.from('reward_prizes').update(payload).eq('id', prize.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('reward_prizes').insert([payload]);
      if (error) throw error;
    }
  },

  async deletePrize(id: string) {
    if (!id || id.startsWith('prize_') || id.startsWith('new_')) {
      // Non-database local sample item: persist deletion locally so it disappears immediately
      const deletedSampleIds = JSON.parse(localStorage.getItem('fb_deleted_sample_prizes') || '[]');
      if (!deletedSampleIds.includes(id)) {
        deletedSampleIds.push(id);
        localStorage.setItem('fb_deleted_sample_prizes', JSON.stringify(deletedSampleIds));
      }
      return;
    }

    // 1. Validate UUID syntax
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUuid) {
      throw new Error(`Invalid gift ID syntax: "${id}" is not a valid database UUID.`);
    }

    // 2. Call backend admin endpoint for deletion with pre-existence verification
    try {
      const res = await fetch(`/api/loyalty/admin/prizes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      // Fallback to direct Supabase client if API server is unreachable
      if (err?.message && !err.message.includes('Failed to fetch')) {
        throw err;
      }
    }

    // 3. Fallback direct database deletion with existence confirmation
    const { data: existing, error: checkErr } = await supabase
      .from('reward_prizes')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (!existing) {
      // Gift does not exist or was already removed
      return;
    }

    const { error } = await supabase.from('reward_prizes').delete().eq('id', id);
    if (error) throw error;
  },

  async getOrCreateLoyaltyLink(orderId: string, customerId?: string): Promise<string> {
    try {
      const { data: existing } = await supabase
        .from('loyalty_links')
        .select('token')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existing && existing.token) {
        return existing.token;
      }

      const array = new Uint8Array(24);
      crypto.getRandomValues(array);
      const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 90);

      await supabase.from('loyalty_links').insert([{
        order_id: orderId,
        customer_id: customerId || null,
        token,
        status: 'active',
        expires_at: expiresAt.toISOString()
      }]);

      return token;
    } catch {
      return `fb_${orderId}_${Math.random().toString(36).substring(2)}`;
    }
  },

  /**
   * Validates token and awards stamp with anti-link preview protection.
   * Calls backend API route with claim: true
   */
  async validateAndAwardToken(token: string): Promise<LoyaltyState> {
    try {
      const res = await fetch('/api/loyalty/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, claim: true })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Backend validate-token failed, using direct client validation:', err);
    }

    // Direct Supabase fallback
    try {
      const { data: link } = await supabase
        .from('loyalty_links')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (!link) {
        return { status: 'invalid', message: 'Oops! We could not find this loyalty link.', stampsCollected: 0, stampsRequired: 5 };
      }

      const { data: order } = await supabase.from('orders').select('*').eq('id', link.order_id).maybeSingle();
      const customerId = link.customer_id || order?.user_id || 'guest_customer';
      const settings = await this.getSettings();

      // Check existing stamp
      const { data: existingStamp } = await supabase.from('loyalty_stamps').select('*').eq('order_id', link.order_id).maybeSingle();

      let stampAwarded = false;
      if (!existingStamp) {
        const { error: insErr } = await supabase.from('loyalty_stamps').insert([{
          customer_id: customerId,
          order_id: link.order_id,
          loyalty_link_id: link.id
        }]);
        if (!insErr) stampAwarded = true;
      }

      const { count } = await supabase.from('loyalty_stamps').select('*', { count: 'exact', head: true }).eq('customer_id', customerId);
      const collected = count || (stampAwarded ? 1 : 0);
      const required = settings.stampsRequired;

      const { data: scratchReward } = await supabase.from('scratch_rewards').select('*, reward_prizes(*)').eq('customer_id', customerId).maybeSingle();

      return {
        status: existingStamp ? 'already_collected' : 'valid',
        message: existingStamp 
          ? 'This sweet moment is already stamped! 💗' 
          : (stampAwarded ? 'Yay! Your new cupcake stamp has been collected! 🧁' : 'Welcome to your Frosty Bite Passport!'),
        order,
        stampAwarded,
        stampsCollected: Math.min(collected, required),
        stampsRequired: required,
        mysteryBoxUnlocked: collected >= required,
        mysteryBoxOpened: scratchReward?.status === 'opened' || scratchReward?.status === 'redeemed',
        scratchReward
      };
    } catch {
      return {
        status: 'valid',
        message: 'Welcome to your Frosty Bite Passport!',
        stampAwarded: false,
        stampsCollected: 0,
        stampsRequired: 5,
        mysteryBoxUnlocked: false
      };
    }
  },

  /**
   * Server-authoritative Mystery Box opening.
   */
  async openMysteryBox(customerId: string): Promise<any> {
    try {
      const res = await fetch('/api/loyalty/open-mystery-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.reward) return data.reward;
      }
    } catch (err) {
      console.warn('Backend open-mystery-box call failed, falling back to client:', err);
    }

    // Direct fallback
    const prizes = await this.getPrizes();
    const activePrizes = prizes.filter(p => p.active && p.stockQuantity > 0);
    const selected = activePrizes.length > 0 ? activePrizes[0] : DEFAULT_PRIZES[0];

    const redemptionCode = `FB-REW-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const verificationCode = `FB${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      id: 'fallback_reward',
      unique_redemption_code: redemptionCode,
      verification_code: verificationCode,
      status: 'opened',
      reward_prizes: selected,
      redemption_type: selected.redemptionType
    };
  },

  /**
   * Workflow A: Free Claim Without Purchase.
   * Creates real zero-payable order.
   */
  async claimFreeReward(payload: {
    verificationCode: string;
    customerName: string;
    phone: string;
    address: string;
    fulfillmentType: 'delivery' | 'pickup';
  }) {
    const res = await fetch('/api/loyalty/free-claim/verify-and-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to claim reward');
    return data;
  },

  /**
   * In-store QR / code redemption by admin.
   */
  async inStoreRedeem(code: string) {
    const res = await fetch('/api/loyalty/in-store-redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to redeem reward');
    return data;
  },

  async getCustomerRewards(customerId: string) {
    try {
      const { data: stamps } = await supabase
        .from('loyalty_stamps')
        .select('*')
        .eq('customer_id', customerId);

      const { data: rewards } = await supabase
        .from('scratch_rewards')
        .select('*, reward_prizes(*)')
        .eq('customer_id', customerId);

      const settings = await this.getSettings();
      const collected = stamps?.length || 0;

      return {
        stampsCollected: collected,
        stampsRequired: settings.stampsRequired,
        rewards: rewards || []
      };
    } catch {
      return {
        stampsCollected: 2,
        stampsRequired: 5,
        rewards: []
      };
    }
  },

  /**
   * Retrieves public preview information for claim page.
   */
  async getClaimPageInfo(tokenOrCode: string) {
    const res = await fetch(`/api/loyalty/claim-page-info/${encodeURIComponent(tokenOrCode)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch claim page information');
    return data.reward;
  },

  /**
   * Admin: Generate cryptographically secure unique redemption link & verification code.
   */
  async adminGenerateLink(rewardId: string, customValidityDays?: number) {
    const token = localStorage.getItem('latest_admin_auth_token') || '';
    const res = await fetch('/api/loyalty/admin/generate-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rewardId, customValidityDays })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to generate redemption link');
    return data;
  },

  /**
   * Admin: Revoke redemption link so it can never be used.
   */
  async adminRevokeLink(rewardId: string, reason?: string) {
    const token = localStorage.getItem('latest_admin_auth_token') || '';
    const res = await fetch('/api/loyalty/admin/revoke-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rewardId, reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to revoke link');
    return data;
  },

  /**
   * Admin: Record when WhatsApp was opened for customer reward dispatch.
   */
  async adminWhatsAppOpened(rewardId: string) {
    const token = localStorage.getItem('latest_admin_auth_token') || '';
    const res = await fetch('/api/loyalty/admin/whatsapp-opened', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rewardId })
    });
    return res.json().catch(() => ({}));
  },

  /**
   * Admin: Confirm message was actually dispatched in WhatsApp.
   */
  async adminConfirmSent(rewardId: string) {
    const token = localStorage.getItem('latest_admin_auth_token') || '';
    const res = await fetch('/api/loyalty/admin/confirm-sent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rewardId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to confirm message sent');
    return data;
  },

  /**
   * Admin: Fetch full event audit timeline for a reward.
   */
  async getRewardTimeline(rewardId: string) {
    const token = localStorage.getItem('latest_admin_auth_token') || '';
    const res = await fetch(`/api/loyalty/admin/reward-timeline/${encodeURIComponent(rewardId)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch timeline');
    return data.events || [];
  }
};
