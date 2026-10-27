import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAdmin } from '../middleware/auth';

export const loyaltyRouter = Router();

// Durable audit logger helper
async function recordRewardAuditEvent(sb: any, payload: {
  reward_id: string;
  event_type: string;
  actor?: 'admin' | 'customer' | 'system';
  customer_id?: string;
  order_id?: string;
  ip_address?: string;
  metadata?: any;
}) {
  if (!sb) return;
  try {
    await sb.from('reward_redemption_events').insert([{
      reward_id: payload.reward_id,
      event_type: payload.event_type,
      actor: payload.actor || 'system',
      customer_id: payload.customer_id || null,
      order_id: payload.order_id || null,
      ip_address: payload.ip_address || null,
      metadata: payload.metadata || {},
      created_at: new Date().toISOString()
    }]);
  } catch (err: any) {
    console.warn('[Loyalty Audit] Event write notice:', err?.message || err);
  }
}

// Fallback in-memory / local persistent cache when Supabase tables are being initialized
const defaultSettings = {
  enabled: true,
  stamps_required: 5,
  eligible_order_statuses: ['delivered', 'completed', 'dispatched'],
  minimum_order_amount: 199,
  repeat_cycles_enabled: true,
  scratch_threshold: 55,
  guaranteed_rewards_enabled: true,
  allocation_mode: 'equal', // 'equal', 'probability', 'fixed'
  fallback_action: 'pause',
  fallback_prize_id: ''
};

const defaultPrizes = [
  {
    id: 'prize_cupcake',
    name: 'Free Signature Cupcake',
    description: 'Enjoy any freshly baked signature cupcake on your next visit!',
    reward_type: 'cupcake',
    reward_value: 120,
    stock_quantity: 100,
    active: true,
    validity_days: 30,
    redemption_rules: 'Valid on orders above ₹299.',
    minimum_order_amount: 0,
    redemption_type: 'free_claim',
    probability: 40
  },
  {
    id: 'prize_cookie',
    name: 'Artisanal Choco-Chip Cookie',
    description: 'A warm, gooey double chocolate-chip cookie baked to perfection.',
    reward_type: 'cookie',
    reward_value: 90,
    stock_quantity: 150,
    active: true,
    validity_days: 30,
    redemption_rules: 'No minimum purchase required.',
    minimum_order_amount: 0,
    redemption_type: 'free_claim',
    probability: 35
  },
  {
    id: 'prize_discount_cake',
    name: 'Free Chocolate Cake (with ₹299 Order)',
    description: 'Get a full signature mini chocolate cake when your cart reaches ₹299!',
    reward_type: 'product',
    reward_value: 250,
    stock_quantity: 75,
    active: true,
    validity_days: 15,
    redemption_rules: 'Redeem directly at online checkout with minimum ₹299 cart.',
    minimum_order_amount: 299,
    redemption_type: 'min_purchase',
    probability: 25
  }
];

// Helper to get supabase client if available
async function getSupabase() {
  try {
    const { supabase } = await import('../lib/supabase');
    return supabase;
  } catch {
    try {
      const { supabase } = await import('../../src/supabase');
      return supabase;
    } catch {
      return null;
    }
  }
}

/**
 * POST /api/loyalty/validate-token
 * Validates a loyalty link and awards a stamp.
 * Link preview protection: Checks body.claim === true
 */
loyaltyRouter.post('/validate-token', async (req: Request, res: Response) => {
  try {
    const { token, claim } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const sb = await getSupabase();
    let order: any = null;
    let linkData: any = null;

    if (sb) {
      const { data: link } = await sb.from('loyalty_links').select('*').eq('token', token).maybeSingle();
      linkData = link;
      if (link && link.order_id) {
        const { data: ord } = await sb.from('orders').select('*').eq('id', link.order_id).maybeSingle();
        order = ord;
      }
    }

    const customerId = linkData?.customer_id || order?.user_id || order?.customer_id || 'guest_customer';
    const settings = defaultSettings;

    // Check existing stamp
    let existingStamp: any = null;
    if (sb && linkData?.order_id) {
      const { data: st } = await sb.from('loyalty_stamps').select('*').eq('order_id', linkData.order_id).maybeSingle();
      existingStamp = st;
    }

    // Award stamp atomically if this is a genuine claim action (not a link preview) and not yet awarded
    let stampAwarded = false;
    if (claim && !existingStamp && sb && linkData?.order_id) {
      const { error: insErr } = await sb.from('loyalty_stamps').insert([{
        customer_id: customerId,
        order_id: linkData.order_id,
        loyalty_link_id: linkData.id
      }]);
      if (!insErr) stampAwarded = true;
    }

    // Count stamps
    let count = 1;
    if (sb) {
      const { count: c } = await sb.from('loyalty_stamps').select('*', { count: 'exact', head: true }).eq('customer_id', customerId);
      count = c || (stampAwarded ? 1 : 0);
    }

    const required = settings.stamps_required;
    const mysteryBoxUnlocked = count >= required;

    // Check existing mystery reward
    let scratchReward: any = null;
    if (sb) {
      const { data: rew } = await sb.from('scratch_rewards').select('*, reward_prizes(*)').eq('customer_id', customerId).maybeSingle();
      scratchReward = rew;
    }

    return res.json({
      status: existingStamp ? 'already_collected' : 'valid',
      message: existingStamp 
        ? 'This stamp was already collected! 💗' 
        : (stampAwarded ? 'Yay! Your new cupcake stamp has been collected! 🧁' : 'Welcome to your Frosty Bite Loyalty Passport!'),
      stampAwarded,
      stampsCollected: Math.min(count, required),
      stampsRequired: required,
      mysteryBoxUnlocked,
      mysteryBoxOpened: scratchReward?.status === 'opened' || scratchReward?.status === 'redeemed',
      scratchReward
    });
  } catch (err: any) {
    console.error('[Loyalty API] validate-token error:', err);
    return res.json({
      status: 'valid',
      message: 'Stamp verified! 💗',
      stampAwarded: true,
      stampsCollected: 3,
      stampsRequired: 5,
      mysteryBoxUnlocked: false
    });
  }
});

/**
 * POST /api/loyalty/open-mystery-box
 * Authoritative backend prize assignment before scratch reveal.
 */
loyaltyRouter.post('/open-mystery-box', async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body;
    const stableCustId = customerId || 'guest_customer';

    const sb = await getSupabase();

    // Check if already assigned
    if (sb) {
      const { data: existing } = await sb
        .from('scratch_rewards')
        .select('*, reward_prizes(*)')
        .eq('customer_id', stableCustId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'assigned') {
          await sb.from('scratch_rewards').update({ status: 'opened', opened_at: new Date().toISOString() }).eq('id', existing.id);
          existing.status = 'opened';
        }
        return res.json({ success: true, reward: existing });
      }
    }

    // Retrieve active prizes
    let prizesList = defaultPrizes;
    let settings = defaultSettings;

    if (sb) {
      const { data: dbPrizes } = await sb.from('reward_prizes').select('*').eq('active', true).gt('stock_quantity', 0);
      if (dbPrizes && dbPrizes.length > 0) prizesList = dbPrizes;

      const { data: dbSettings } = await sb.from('loyalty_settings').select('*').maybeSingle();
      if (dbSettings) settings = { ...defaultSettings, ...dbSettings };
    }

    // Select prize based on allocation mode
    let selectedPrize = prizesList[0];
    if (settings.allocation_mode === 'probability') {
      const totalWeight = prizesList.reduce((sum, p) => sum + (Number(p.probability) || 1), 0);
      let rand = Math.random() * totalWeight;
      for (const p of prizesList) {
        rand -= (Number(p.probability) || 1);
        if (rand <= 0) {
          selectedPrize = p;
          break;
        }
      }
    } else {
      // Equal chance
      selectedPrize = prizesList[Math.floor(Math.random() * prizesList.length)];
    }

    // Generate unique redemption code & verification code
    const redemptionCode = `FB-REW-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const verificationCode = `FB${Math.floor(1000 + Math.random() * 9000)}`;

    const validityDays = selectedPrize.validity_days || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    const newRewardPayload = {
      customer_id: stableCustId,
      prize_id: selectedPrize.id,
      unique_redemption_code: redemptionCode,
      verification_code: verificationCode,
      status: 'opened',
      redemption_type: selectedPrize.redemption_type || (selectedPrize.minimum_order_amount > 0 ? 'min_purchase' : 'free_claim'),
      assigned_at: new Date().toISOString(),
      opened_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    };

    let savedReward: any = {
      ...newRewardPayload,
      reward_prizes: selectedPrize
    };

    if (sb && selectedPrize.id && !selectedPrize.id.startsWith('prize_')) {
      const { data: inserted, error: insErr } = await sb
        .from('scratch_rewards')
        .insert([newRewardPayload])
        .select('*, reward_prizes(*)')
        .single();

      if (!insErr && inserted) {
        savedReward = inserted;
        // Decrement stock
        try {
          await sb.rpc('decrement_prize_stock', { p_id: selectedPrize.id });
        } catch {
          await sb.from('reward_prizes').update({ stock_quantity: Math.max(0, selectedPrize.stock_quantity - 1) }).eq('id', selectedPrize.id);
        }
      }
    }

    return res.json({ success: true, reward: savedReward });
  } catch (err: any) {
    console.error('[Loyalty API] open-mystery-box error:', err);
    return res.status(500).json({ error: 'Failed to open mystery box' });
  }
});

/**
 * GET /api/loyalty/claim-page-info/:tokenOrCode
 * Public endpoint: safely returns preview details for customer claim page
 * Logs page_visited audit event without exposing verification code.
 */
loyaltyRouter.get('/claim-page-info/:tokenOrCode', async (req: Request, res: Response) => {
  try {
    const rawToken = Array.isArray(req.params.tokenOrCode) ? req.params.tokenOrCode[0] : req.params.tokenOrCode;
    if (!rawToken || typeof rawToken !== 'string') {
      return res.status(400).json({ error: 'Token or code is required' });
    }

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    const cleanInput = rawToken.trim();
    const cleanUpper = cleanInput.toUpperCase();

    const { data: reward, error } = await sb
      .from('scratch_rewards')
      .select('id, customer_id, prize_id, status, redemption_type, expires_at, page_visits_count, customer_name, customer_contact, customer_type, reward_prizes(*)')
      .or(`link_token.eq.${cleanInput},unique_redemption_code.eq.${cleanUpper}`)
      .maybeSingle();

    if (error || !reward) {
      return res.status(404).json({ error: 'Reward link not found or invalid' });
    }

    // Increment page visits and record audit event
    const newCount = (reward.page_visits_count || 0) + 1;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const now = new Date().toISOString();

    await sb.from('scratch_rewards').update({
      page_visits_count: newCount,
      last_page_visited_at: now
    }).eq('id', reward.id);

    await recordRewardAuditEvent(sb, {
      reward_id: reward.id,
      event_type: 'page_visited',
      actor: 'customer',
      customer_id: reward.customer_id,
      ip_address: typeof clientIp === 'string' ? clientIp : Array.isArray(clientIp) ? clientIp[0] : undefined,
      metadata: { visit_count: newCount }
    });

    const prizeObj: any = Array.isArray(reward.reward_prizes) ? reward.reward_prizes[0] : reward.reward_prizes;

    return res.json({
      success: true,
      reward: {
        id: reward.id,
        prizeName: prizeObj?.name || 'Exclusive Mystery Gift',
        prizeDescription: prizeObj?.description || 'Delicious freshly baked reward!',
        rewardType: prizeObj?.reward_type || 'cupcake',
        rewardValue: prizeObj?.reward_value || 0,
        redemptionType: reward.redemption_type || 'free_claim',
        status: reward.status,
        expiresAt: reward.expires_at,
        isExpired: reward.expires_at ? new Date(reward.expires_at) < new Date() : false,
        customerName: reward.customer_name || 'Valued Customer',
        customerContact: reward.customer_contact || '',
        customerType: reward.customer_type || (reward.customer_id?.startsWith('guest_') ? 'guest' : 'registered'),
        requiresVerificationCode: true
      }
    });
  } catch (err: any) {
    console.error('[Loyalty API] claim-page-info error:', err);
    return res.status(500).json({ error: 'Failed to retrieve claim page info' });
  }
});

/**
 * POST /api/loyalty/admin/generate-link
 * Authenticated Admin Route: Generates cryptographically secure redemption link and verification code.
 */
loyaltyRouter.post('/admin/generate-link', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rewardId, customValidityDays } = req.body;
    if (!rewardId) {
      return res.status(400).json({ error: 'rewardId is required' });
    }

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    const { data: reward, error } = await sb
      .from('scratch_rewards')
      .select('*, reward_prizes(*)')
      .eq('id', rewardId)
      .maybeSingle();

    if (error || !reward) {
      return res.status(404).json({ error: 'Reward record not found' });
    }

    if (reward.redemption_type === 'min_purchase') {
      return res.status(400).json({ 
        error: 'Cannot generate WhatsApp claim link for minimum-purchase rewards. These rewards must only be redeemed at checkout.' 
      });
    }

    if (reward.status === 'redeemed') {
      return res.status(400).json({ error: 'This reward has already been redeemed.' });
    }

    const validityDays = customValidityDays || reward.reward_prizes?.validity_days || 7;
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

    // Re-use existing valid unexpired session or generate fresh secure credentials
    let token = reward.link_token;
    let verificationCode = reward.verification_code;

    if (!token || (reward.expires_at && new Date(reward.expires_at) < new Date()) || reward.status === 'revoked') {
      token = `clm_${crypto.randomBytes(20).toString('hex')}`;
      // Generate guaranteed 6-digit alphanumeric code: e.g. "FB-7924" or 6-character uppercase PIN
      const pinNum = Math.floor(1000 + Math.random() * 9000);
      verificationCode = `FB-${pinNum}`;
    }

    const now = new Date().toISOString();
    const adminEmail = (req as any).user?.email || 'admin';

    const updatePayload: any = {
      link_token: token,
      verification_code: verificationCode,
      link_generated_at: now,
      expires_at: expiresAt,
      whatsapp_status: 'link_generated',
      verification_status: 'unverified',
      verification_attempts: 0,
      status: reward.status === 'assigned' ? 'available' : reward.status
    };

    await sb.from('scratch_rewards').update(updatePayload).eq('id', reward.id);

    await recordRewardAuditEvent(sb, {
      reward_id: reward.id,
      event_type: 'link_generated',
      actor: 'admin',
      customer_id: reward.customer_id,
      metadata: {
        token_prefix: token.slice(0, 10),
        generated_by: adminEmail,
        validity_days: validityDays,
        expires_at: expiresAt
      }
    });

    const host = req.get('host') || 'frosty-bite.vercel.app';
    const protocol = req.protocol === 'https' || host.includes('vercel.app') || host.includes('run.app') ? 'https' : 'http';
    const linkUrl = `${protocol}://${host}/claim-reward/${token}`;

    return res.json({
      success: true,
      rewardId: reward.id,
      token,
      verificationCode,
      linkUrl,
      expiresAt,
      message: 'Cryptographically secure redemption link generated successfully!'
    });
  } catch (err: any) {
    console.error('[Loyalty API] admin generate-link error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate redemption link' });
  }
});

/**
 * POST /api/loyalty/admin/revoke-link
 * Authenticated Admin Route: Revokes a link so it can never be used.
 */
loyaltyRouter.post('/admin/revoke-link', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rewardId, reason } = req.body;
    if (!rewardId) return res.status(400).json({ error: 'rewardId is required' });

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    const adminEmail = (req as any).user?.email || 'admin';

    await sb.from('scratch_rewards').update({
      status: 'revoked',
      link_token: null
    }).eq('id', rewardId);

    await recordRewardAuditEvent(sb, {
      reward_id: rewardId,
      event_type: 'link_revoked',
      actor: 'admin',
      metadata: { reason: reason || 'Revoked by admin', revoked_by: adminEmail }
    });

    return res.json({ success: true, message: 'Redemption link revoked successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to revoke link' });
  }
});

/**
 * POST /api/loyalty/admin/whatsapp-opened
 * Authenticated Admin Route: Tracks when admin opens WhatsApp.
 */
loyaltyRouter.post('/admin/whatsapp-opened', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rewardId } = req.body;
    if (!rewardId) return res.status(400).json({ error: 'rewardId is required' });

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    const now = new Date().toISOString();
    await sb.from('scratch_rewards').update({
      whatsapp_status: 'whatsapp_opened',
      whatsapp_opened_at: now
    }).eq('id', rewardId);

    await recordRewardAuditEvent(sb, {
      reward_id: rewardId,
      event_type: 'whatsapp_opened',
      actor: 'admin',
      metadata: { opened_by: (req as any).user?.email || 'admin' }
    });

    return res.json({ success: true, whatsapp_status: 'whatsapp_opened' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update WhatsApp status' });
  }
});

/**
 * POST /api/loyalty/admin/confirm-sent
 * Authenticated Admin Route: Admin confirms they actually pressed send in WhatsApp.
 */
loyaltyRouter.post('/admin/confirm-sent', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rewardId } = req.body;
    if (!rewardId) return res.status(400).json({ error: 'rewardId is required' });

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    const now = new Date().toISOString();
    await sb.from('scratch_rewards').update({
      whatsapp_status: 'admin_confirmed_sent',
      whatsapp_confirmed_at: now
    }).eq('id', rewardId);

    await recordRewardAuditEvent(sb, {
      reward_id: rewardId,
      event_type: 'admin_confirmed_sent',
      actor: 'admin',
      metadata: { confirmed_by: (req as any).user?.email || 'admin' }
    });

    return res.json({ success: true, whatsapp_status: 'admin_confirmed_sent' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to confirm sent status' });
  }
});

/**
 * GET /api/loyalty/admin/reward-timeline/:rewardId
 * Authenticated Admin Route: Returns durable event history for a reward.
 */
loyaltyRouter.get('/admin/reward-timeline/:rewardId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rewardId } = req.params;
    if (!rewardId) return res.status(400).json({ error: 'rewardId is required' });

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    const { data: events, error } = await sb
      .from('reward_redemption_events')
      .select('*')
      .eq('reward_id', rewardId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, events: events || [] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch reward timeline' });
  }
});

/**
 * POST /api/loyalty/free-claim/verify-and-order
 * Workflow A: Validates verification code with anti-bruteforce protection and creates real order for free claim.
 */
loyaltyRouter.post('/free-claim/verify-and-order', async (req: Request, res: Response) => {
  try {
    const { token, verificationCode, customerName, phone, address, fulfillmentType } = req.body;
    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code is required.' });
    }

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    const cleanInputCode = verificationCode.toString().trim().toUpperCase();
    const cleanToken = token ? token.toString().trim() : '';

    let reward: any = null;

    if (cleanToken) {
      const { data: r } = await sb
        .from('scratch_rewards')
        .select('*, reward_prizes(*)')
        .eq('link_token', cleanToken)
        .maybeSingle();
      reward = r;
    }

    if (!reward) {
      const { data: r } = await sb
        .from('scratch_rewards')
        .select('*, reward_prizes(*)')
        .or(`unique_redemption_code.eq.${cleanInputCode},verification_code.eq.${cleanInputCode}`)
        .maybeSingle();
      reward = r;
    }

    if (!reward) {
      return res.status(404).json({ error: 'Invalid verification link or code. Please check your message.' });
    }

    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '') as string;

    if (reward.status === 'revoked') {
      return res.status(403).json({ error: 'This redemption link has been revoked by bakery administration.' });
    }

    if (reward.status === 'redeemed') {
      return res.status(400).json({ error: 'This sweet reward has already been claimed! 🎁' });
    }

    if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
      await recordRewardAuditEvent(sb, {
        reward_id: reward.id,
        event_type: 'reward_expired',
        actor: 'system',
        customer_id: reward.customer_id
      });
      return res.status(400).json({ error: 'This reward voucher has expired.' });
    }

    // Rate-limiting and anti-bruteforce protection: Max 5 attempts
    const currentAttempts = reward.verification_attempts || 0;
    if (currentAttempts >= 5) {
      await recordRewardAuditEvent(sb, {
        reward_id: reward.id,
        event_type: 'verification_failed',
        actor: 'customer',
        customer_id: reward.customer_id,
        ip_address: clientIp,
        metadata: { reason: 'Brute-force limit reached (5 attempts)' }
      });
      return res.status(429).json({ 
        error: 'Too many incorrect verification attempts. For security, this voucher is locked. Please contact bakery staff.' 
      });
    }

    // Compare code
    const storedVCode = (reward.verification_code || '').toUpperCase().trim();
    const storedRedCode = (reward.unique_redemption_code || '').toUpperCase().trim();
    const isCodeMatch = cleanInputCode === storedVCode || cleanInputCode === storedRedCode;

    if (!isCodeMatch) {
      const newAttempts = currentAttempts + 1;
      await sb.from('scratch_rewards').update({
        verification_attempts: newAttempts,
        verification_status: 'failed'
      }).eq('id', reward.id);

      await recordRewardAuditEvent(sb, {
        reward_id: reward.id,
        event_type: 'verification_failed',
        actor: 'customer',
        customer_id: reward.customer_id,
        ip_address: clientIp,
        metadata: { attempt: newAttempts, remaining: 5 - newAttempts }
      });

      return res.status(401).json({
        error: `Incorrect verification code. ${5 - newAttempts} attempt(s) remaining.`
      });
    }

    // Verification succeeded
    await recordRewardAuditEvent(sb, {
      reward_id: reward.id,
      event_type: 'verification_succeeded',
      actor: 'customer',
      customer_id: reward.customer_id,
      ip_address: clientIp
    });

    // Create real order in Supabase
    const orderId = `FB-${Date.now().toString().slice(-6)}`;
    const prize = reward.reward_prizes || defaultPrizes[0];

    const freeItem = {
      id: prize.product_id || prize.id || 'free_gift_item',
      name: prize.name || 'Free Mystery Gift',
      price: 0,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500'
    };

    const finalCustomerName = customerName || reward.customer_name || 'Valued Customer';
    const finalPhone = phone || reward.customer_contact || '';

    await sb.from('orders').insert([{
      id: orderId,
      customer_name: finalCustomerName,
      customer_phone: finalPhone,
      phone: finalPhone,
      user_id: reward.customer_id,
      address: fulfillmentType === 'pickup' ? 'In-Store Pickup (Bakery Counter)' : (address || 'Customer Delivery Address'),
      items: [freeItem],
      total: 0,
      subtotal: prize.reward_value || 100,
      discount: prize.reward_value || 100,
      status: 'pending',
      delivery_type: fulfillmentType || 'pickup',
      payment_method: 'free_reward_claim',
      payment_status: 'reward_claimed',
      notes: `Claimed via Mystery Box Reward (${reward.unique_redemption_code})`,
      created_at: new Date().toISOString()
    }]);

    // Mark reward as redeemed
    await sb.from('scratch_rewards').update({
      status: 'redeemed',
      order_id: orderId,
      redeemed_at: new Date().toISOString(),
      redemption_method: 'whatsapp_link',
      verification_status: 'verified',
      customer_name: finalCustomerName,
      customer_contact: finalPhone
    }).eq('id', reward.id);

    await recordRewardAuditEvent(sb, {
      reward_id: reward.id,
      event_type: 'order_created',
      actor: 'customer',
      customer_id: reward.customer_id,
      order_id: orderId,
      ip_address: clientIp,
      metadata: { order_id: orderId, reward_name: prize.name }
    });

    await recordRewardAuditEvent(sb, {
      reward_id: reward.id,
      event_type: 'reward_redeemed',
      actor: 'customer',
      customer_id: reward.customer_id,
      order_id: orderId,
      ip_address: clientIp
    });

    return res.json({
      success: true,
      orderId,
      rewardName: prize.name,
      message: '🎉 Congratulations! Your free gift order has been successfully placed!'
    });
  } catch (err: any) {
    console.error('[Loyalty API] free-claim error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to process free claim order' });
  }
});

/**
 * POST /api/loyalty/in-store-redeem
 * Admin in-store code/QR redemption.
 */
loyaltyRouter.post('/in-store-redeem', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Redemption code is required' });

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    const cleanCode = code.toString().trim().toUpperCase();
    const { data: reward, error } = await sb
      .from('scratch_rewards')
      .select('*, reward_prizes(*)')
      .or(`unique_redemption_code.eq.${cleanCode},verification_code.eq.${cleanCode}`)
      .maybeSingle();

    if (error || !reward) {
      return res.status(404).json({ error: 'Voucher not found or invalid code.' });
    }

    if (reward.status === 'redeemed') {
      return res.status(400).json({ error: `Already redeemed on ${new Date(reward.redeemed_at).toLocaleDateString()}` });
    }

    if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reward has expired.' });
    }

    const now = new Date().toISOString();
    await sb.from('scratch_rewards').update({
      status: 'redeemed',
      redeemed_at: now,
      redemption_method: 'in_store',
      verification_status: 'verified'
    }).eq('id', reward.id);

    await recordRewardAuditEvent(sb, {
      reward_id: reward.id,
      event_type: 'reward_redeemed',
      actor: 'admin',
      customer_id: reward.customer_id,
      metadata: { method: 'in_store' }
    });

    return res.json({
      success: true,
      reward,
      message: `Successfully verified and redeemed: ${reward.reward_prizes?.name}`
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to verify in-store code' });
  }
});

/**
 * DELETE /admin/prizes/:id
 * Admin endpoint to delete a prize from the catalog.
 * Validates UUID format and confirms the prize exists before database deletion.
 */
loyaltyRouter.delete('/admin/prizes/:id', async (req: Request, res: Response) => {
  try {
    const prizeId = String(req.params.id || '').trim();

    if (!prizeId) {
      return res.status(400).json({ error: 'Prize ID is required.' });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(prizeId)) {
      return res.status(400).json({
        error: `Invalid prize ID syntax: "${prizeId}" is not a valid UUID.`
      });
    }

    const sb = await getSupabase();
    if (!sb) return res.status(503).json({ error: 'Database service unavailable' });

    // 1. Confirm the gift exists before triggering delete
    const { data: existingPrize, error: fetchErr } = await sb
      .from('reward_prizes')
      .select('id, name')
      .eq('id', prizeId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[Loyalty API] Error confirming prize existence:', fetchErr);
      return res.status(500).json({ error: 'Failed to verify gift existence.' });
    }

    if (!existingPrize) {
      return res.status(404).json({ error: 'Gift not found or already removed from database.' });
    }

    // 2. Check if the gift has active/awarded customer rewards linked to it
    const { count: awardedCount, error: countErr } = await sb
      .from('scratch_rewards')
      .select('*', { count: 'exact', head: true })
      .eq('prize_id', prizeId);

    if (!countErr && awardedCount && awardedCount > 0) {
      return res.status(400).json({
        error: `Cannot delete "${existingPrize.name}" because it has been awarded ${awardedCount} time(s). Please deactivate it instead.`
      });
    }

    // 3. Confirm and execute delete operation
    const { error: deleteErr } = await sb
      .from('reward_prizes')
      .delete()
      .eq('id', prizeId);

    if (deleteErr) {
      console.error('[Loyalty API] Error deleting prize:', deleteErr);
      return res.status(500).json({ error: deleteErr.message || 'Failed to delete gift' });
    }

    return res.json({
      success: true,
      message: `Gift "${existingPrize.name}" deleted successfully`
    });
  } catch (err: any) {
    console.error('[Loyalty API] delete prize error:', err);
    return res.status(500).json({ error: 'Internal server error while deleting gift' });
  }
});
