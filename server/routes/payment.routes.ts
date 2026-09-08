import express, { Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { supabase } from '../lib/supabase';
import { ADMIN_EMAILS } from '../middleware/auth';

const router = express.Router();

// Helper function to thoroughly sanitize order IDs (strips URL encoding, trailing noise like 'in', spaces, etc.)
export function cleanOrderIdString(rawOrderId?: string | null): string {
  if (!rawOrderId || typeof rawOrderId !== 'string') return '';
  let cleaned = rawOrderId.trim();
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch (e) {}
  cleaned = cleaned.trim();
  if (cleaned.includes(' ')) {
    cleaned = cleaned.split(/\s+/)[0];
  }
  cleaned = cleaned.replace(/[^a-zA-Z0-9_-]+$/, '');
  return cleaned;
}

// Rate limiting for payment device event ingestion
const paymentDeviceEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  },
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded for payment device events. Please slow down.'
  }
});

// Rate limiting for creating payment attempts
const paymentCreateAttemptLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  },
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded for creating payment attempts. Please try again later.'
  }
});

// Rate limiting for customer status checks
const paymentStatusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
  },
  message: {
    error: 'Too Many Requests',
    message: 'Status check rate limit exceeded. Please slow down.'
  }
});

/**
 * Constant-time bearer token comparison against FROSTYPAY_DEVICE_TOKEN.
 */
function authenticateDeviceToken(req: Request, res: Response): boolean {
  const expectedToken = process.env.FROSTYPAY_DEVICE_TOKEN;

  if (!expectedToken || typeof expectedToken !== 'string' || expectedToken.trim() === '') {
    console.error('[PaymentDeviceEvent] FROSTYPAY_DEVICE_TOKEN is missing or not configured on server');
    res.status(500).json({
      error: 'Server Configuration Error',
      message: 'Payment device authentication is not configured on the server.'
    });
    return false;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    console.warn('[PaymentDeviceEvent] Unauthorized: missing or invalid authorization header prefix. Received:', authHeader ? 'Present (Invalid format)' : 'None');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header.'
    });
    return false;
  }

  const providedToken = authHeader.slice(7).trim();
  if (!providedToken) {
    console.warn('[PaymentDeviceEvent] Unauthorized: missing device token in Bearer header');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing device token.'
    });
    return false;
  }

  const providedBuf = Buffer.from(providedToken);
  const expectedBuf = Buffer.from(expectedToken.trim());

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    console.warn('[PaymentDeviceEvent] Unauthorized: timing check or length mismatch. Provided length:', providedBuf.length, 'Expected length:', expectedBuf.length);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid device token.'
    });
    return false;
  }

  console.log('[PaymentDeviceEvent] Client request successfully authenticated via expected FROSTYPAY_DEVICE_TOKEN');
  return true;
}

/**
 * Normalizes payment methods to identify Cash on Delivery / Cash payments that must never be auto-settled.
 */
function isCodOrCashPaymentMethod(paymentMethod?: string | null): boolean {
  if (!paymentMethod) return false;
  const normalized = paymentMethod.trim().toLowerCase();
  return (
    normalized === 'cod' ||
    normalized === 'cash' ||
    normalized === 'cash on delivery' ||
    normalized === 'cash_on_delivery' ||
    normalized === 'cashondelivery' ||
    normalized === 'pay on delivery' ||
    normalized === 'pay_on_delivery'
  );
}

/**
 * Normalizes payment methods to identify digital / online / UPI payments.
 */
function isUpiOrOnlinePaymentMethod(paymentMethod?: string | null): boolean {
  if (!paymentMethod) return false;
  const normalized = paymentMethod.trim().toLowerCase();
  return (
    normalized === 'upi' ||
    normalized === 'online' ||
    normalized === 'upi_qr' ||
    normalized === 'qr' ||
    normalized === 'gpay' ||
    normalized === 'phonepe' ||
    normalized === 'paytm'
  );
}

/**
 * POST /api/payment/create-attempt
 * Authoritatively creates or returns an existing active payment attempt for an order.
 */
router.post(['/create-attempt', '/api/payment/create-attempt'], paymentCreateAttemptLimiter, async (req: Request, res: Response) => {
  try {
    const rawOrderId = req.body?.order_id || req.body?.orderId || req.body?.id;
    const cleanOrderId = cleanOrderIdString(rawOrderId);

    if (!cleanOrderId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'order_id is required and must be a non-empty string.'
      });
    }
    if (cleanOrderId.length > 100) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'order_id exceeds maximum permitted length.'
      });
    }

    const withoutPrefix = cleanOrderId.replace(/^FB-/i, '');
    const withPrefix = cleanOrderId.startsWith('FB-') ? cleanOrderId : `FB-${cleanOrderId}`;

    // Step 1: Authoritative Order Lookup in database ONLY (No client-side faking or upserting missing orders)
    const { data: orders, error: orderFetchError } = await supabase
      .from('orders')
      .select('id, total, status, payment_status, payment_method, user_id, email, phone')
      .or(`id.ilike.${cleanOrderId},id.ilike.${withPrefix},id.ilike.${withoutPrefix}`)
      .limit(1);

    if (orderFetchError) {
      console.error('[CreatePaymentAttempt] Error fetching order:', orderFetchError.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to look up order details.'
      });
    }

    const order = orders && orders[0];
    if (!order) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Order #${cleanOrderId} not found.`
      });
    }

    // Step 2: Validate Order Status
    const normalizedStatus = (order.status || '').trim().toLowerCase();
    if (normalizedStatus === 'cancelled') {
      return res.status(400).json({
        error: 'Invalid Order State',
        message: 'Order is cancelled.'
      });
    }
    if (normalizedStatus === 'delivered') {
      return res.status(400).json({
        error: 'Invalid Order State',
        message: 'Order is already delivered.'
      });
    }

    // Step 3: Validate Payment Status
    const normalizedPaymentStatus = (order.payment_status || '').trim().toLowerCase();
    if (normalizedPaymentStatus === 'paid' || normalizedStatus === 'confirmed') {
      return res.status(400).json({
        error: 'Invalid Order State',
        message: 'Order is already paid.'
      });
    }

    // Step 4: Strict Payment Method Check (COD protection) - NEVER mutate orders.payment_method
    if (!isUpiOrOnlinePaymentMethod(order.payment_method) || isCodOrCashPaymentMethod(order.payment_method)) {
      return res.status(400).json({
        error: 'Invalid Order State',
        message: 'Payment attempts are only allowed for online/UPI payments.'
      });
    }

    // Step 5: Derive authoritative amount in paise strictly from order.total
    const totalAmount = Number(order.total);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid Order Amount',
        message: 'Order total amount is invalid.'
      });
    }

    const amount_paise = Math.round(totalAmount * 100);

    // Step 6: Authorization Verification
    const authHeader = req.headers.authorization;
    const guestSessionHeader = req.headers['x-guest-session'] || req.body?.guest_session_id;
    const isRegisteredOrder = !!(order.user_id && !order.user_id.startsWith('guest_'));

    if (isRegisteredOrder) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required for registered customer order.'
        });
      }

      const token = authHeader.slice(7).trim();
      if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or missing bearer token.'
        });
      }

      let authEmail: string | null = null;
      let authUserUid: string | null = null;
      let isTokenValid = false;

      // A. Try Supabase Auth verification
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser(token);
        if (!authErr && authData?.user) {
          authEmail = authData.user.email?.toLowerCase() || null;
          authUserUid = authData.user.id;
          isTokenValid = true;
        }
      } catch (sbErr) {
        console.warn('[PaymentRoutes] Supabase user check failed:', sbErr);
      }

      // B. Try Firebase ID Token parsing fallback
      if (!isTokenValid) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payloadJson = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
            const payload = JSON.parse(payloadJson);
            if (payload.email) {
              authEmail = payload.email.toLowerCase();
              authUserUid = payload.sub || payload.uid || payload.user_id || null;
              isTokenValid = true;
            }
          }
        } catch (jwtErr) {
          console.warn('[PaymentRoutes] Firebase JWT fallback parse failed:', jwtErr);
        }
      }

      if (!isTokenValid || !authEmail) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired authentication token.'
        });
      }

      const isUserAdmin = ADMIN_EMAILS.includes(authEmail);

      if (!isUserAdmin) {
        // Fetch the order owner's profile to see if firebase_uid, supabase_uid, or email matches the authenticated token
        let isMatch = false;
        if (order.user_id) {
          const { data: ownerProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', order.user_id)
            .maybeSingle();

          if (ownerProfile) {
            const ownerEmail = ownerProfile.email?.toLowerCase();
            const ownerSbUid = ownerProfile.supabase_uid;
            const ownerFbUid = ownerProfile.firebase_uid;

            if (
              (authUserUid && (authUserUid === ownerSbUid || authUserUid === ownerFbUid || authUserUid === ownerProfile.id)) ||
              (authEmail && (authEmail === ownerEmail || authEmail === order.email?.toLowerCase()))
            ) {
              isMatch = true;
            }
          }
        }

        // Fallback email comparison directly with order email if user profile not found or doesn't match
        if (!isMatch && order.email && authEmail === order.email.toLowerCase()) {
          isMatch = true;
        }

        if (!isMatch) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You are not authorized to create a payment attempt for this order.'
          });
        }
      }
    }

    // Step 7: Idempotency Check - Active waiting attempt
    const nowMs = Date.now();
    const { data: existingAttempts, error: attemptFetchError } = await supabase
      .from('payment_attempts')
      .select('id, order_id, amount_paise, status, expires_at, created_at')
      .or(`order_id.eq.${order.id},order_id.eq.${withPrefix},order_id.eq.${withoutPrefix}`)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (attemptFetchError) {
      console.error('[CreatePaymentAttempt] Error querying existing attempts:', attemptFetchError.message);
    }

    const activeAttempt = (existingAttempts || []).find((att) => {
      if (!att.expires_at) return true;
      return new Date(att.expires_at).getTime() > nowMs;
    });

    if (activeAttempt) {
      return res.status(200).json({
        success: true,
        payment_attempt: {
          id: activeAttempt.id,
          order_id: activeAttempt.order_id,
          amount_paise: Number(activeAttempt.amount_paise),
          status: activeAttempt.status,
          created_at: activeAttempt.created_at,
          expires_at: activeAttempt.expires_at,
          transaction_reference: (activeAttempt.id || '').replace(/-/g, '').slice(0, 35)
        },
        order: {
          id: order.id,
          total: Number(order.total),
          status: order.status,
          payment_status: order.payment_status,
          user_id: order.user_id,
          email: order.email,
          phone: order.phone
        }
      });
    }

    // Mark any stale waiting attempts as expired in DB so unique constraint does not block new attempt creation
    const expiredAttemptIds = (existingAttempts || [])
      .filter((att) => att.expires_at && new Date(att.expires_at).getTime() <= nowMs)
      .map((att) => att.id);

    if (expiredAttemptIds.length > 0) {
      await supabase
        .from('payment_attempts')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .in('id', expiredAttemptIds);
    }

    // Step 8: Create fresh payment attempt (expires in 6 minutes)
    const createdAtDate = new Date();
    const expiresAtDate = new Date(createdAtDate.getTime() + 6 * 60 * 1000);

    const newAttemptObj = {
      order_id: order.id,
      amount_paise,
      status: 'waiting',
      expires_at: expiresAtDate.toISOString(),
      created_at: createdAtDate.toISOString(),
      updated_at: createdAtDate.toISOString()
    };

    const { data: insertedAttempt, error: insertError } = await supabase
      .from('payment_attempts')
      .insert(newAttemptObj)
      .select('id, order_id, amount_paise, status, expires_at, created_at')
      .single();

    if (insertError) {
      // Check if another concurrent request created the attempt
      const { data: raceAttempt } = await supabase
        .from('payment_attempts')
        .select('id, order_id, amount_paise, status, expires_at, created_at')
        .or(`order_id.ilike.${cleanOrderId},order_id.ilike.${withPrefix},order_id.ilike.${withoutPrefix}`)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (raceAttempt && raceAttempt.expires_at && new Date(raceAttempt.expires_at).getTime() > Date.now()) {
        return res.status(200).json({
          success: true,
          payment_attempt: {
            id: raceAttempt.id,
            order_id: raceAttempt.order_id,
            amount_paise: Number(raceAttempt.amount_paise),
            status: raceAttempt.status,
            created_at: raceAttempt.created_at,
            expires_at: raceAttempt.expires_at,
            transaction_reference: (raceAttempt.id || '').replace(/-/g, '').slice(0, 35)
          },
          order: {
            id: order.id,
            total: Number(order.total),
            status: order.status,
            payment_status: order.payment_status,
            user_id: order.user_id,
            email: order.email,
            phone: order.phone
          }
        });
      }

      console.error('[CreatePaymentAttempt] Error inserting payment attempt:', insertError.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to create payment attempt.'
      });
    }

    return res.status(200).json({
      success: true,
      payment_attempt: {
        id: insertedAttempt.id,
        order_id: insertedAttempt.order_id,
        amount_paise: Number(insertedAttempt.amount_paise),
        status: insertedAttempt.status,
        created_at: insertedAttempt.created_at,
        expires_at: insertedAttempt.expires_at,
        transaction_reference: (insertedAttempt.id || '').replace(/-/g, '').slice(0, 35)
      },
      order: {
        id: order.id,
        total: Number(order.total),
        status: order.status,
        payment_status: order.payment_status,
        user_id: order.user_id,
        email: order.email,
        phone: order.phone
      }
    });
  } catch (err: any) {
    console.error('[CreatePaymentAttempt] Unexpected error:', err?.message || err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while creating payment attempt.'
    });
  }
});

/**
 * POST /api/payment/device-event
 * Ingests incoming Android FrostyPay payment notification detection events.
 */
router.post(['/device-event', '/api/payment/device-event'], paymentDeviceEventLimiter, async (req: Request, res: Response) => {
  try {
    // Step 1: Authenticate with constant-time token comparison
    if (!authenticateDeviceToken(req, res)) {
      return;
    }

    // Step 2: Validate payload fields
    const {
      amount_paise,
      event_id,
      device_id,
      source_type,
      upi_reference,
      source_package,
      transaction_time
    } = req.body || {};

    console.log('[PaymentDeviceEvent] Ingest request validated. Body fields present:', {
      amount_paise,
      eventId: event_id,
      deviceId: device_id,
      sourceType: source_type,
      upiRefMasked: upi_reference ? '***' + String(upi_reference).slice(-4) : undefined,
      sourcePackage: source_package,
      transactionTime: transaction_time
    });

    if (
      amount_paise === undefined ||
      typeof amount_paise !== 'number' ||
      !Number.isInteger(amount_paise) ||
      amount_paise <= 0
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'amount_paise must be a positive integer.'
      });
    }

    if (!event_id || typeof event_id !== 'string' || !event_id.trim() || event_id.trim().length > 128) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'event_id is required and must be a string with maximum 128 characters.'
      });
    }

    if (!device_id || typeof device_id !== 'string' || !device_id.trim() || device_id.trim().length > 128) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'device_id is required and must be a string with maximum 128 characters.'
      });
    }

    if (!source_type || typeof source_type !== 'string' || !source_type.trim() || source_type.trim().length > 64) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'source_type is required and must be a string with maximum 64 characters.'
      });
    }

    let trimmedUpi: string | null = null;
    if (upi_reference !== undefined && upi_reference !== null) {
      if (typeof upi_reference !== 'string' || upi_reference.trim().length > 128) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'upi_reference must be a string with maximum 128 characters.'
        });
      }
      trimmedUpi = upi_reference.trim() || null;
    }

    let trimmedSourcePkg: string | null = null;
    if (source_package !== undefined && source_package !== null) {
      if (typeof source_package !== 'string' || source_package.trim().length > 256) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'source_package must be a string with maximum 256 characters.'
        });
      }
      trimmedSourcePkg = source_package.trim() || null;
    }

    let transactionTimeIso: string = new Date().toISOString();
    if (transaction_time !== undefined && transaction_time !== null) {
      if (typeof transaction_time !== 'string') {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'transaction_time must be an ISO date string.'
        });
      }
      const parsedTime = Date.parse(transaction_time);
      if (isNaN(parsedTime)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'transaction_time is not a valid date format.'
        });
      }
      transactionTimeIso = new Date(parsedTime).toISOString();
    }

    const cleanEventId = event_id.trim();
    const cleanDeviceId = device_id.trim();
    const cleanSourceType = source_type.trim();

    // Step 3: Idempotency check on event_id
    const { data: existingEvent, error: eventCheckError } = await supabase
      .from('payment_verification_events')
      .select('id, event_id')
      .eq('event_id', cleanEventId)
      .maybeSingle();

    if (eventCheckError) {
      console.error('[PaymentDeviceEvent] Error querying event_id:', eventCheckError.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to verify event idempotency.'
      });
    }

    if (existingEvent) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        matched: false
      });
    }

    // Step 4: Idempotency check on upi_reference
    if (trimmedUpi) {
      const { data: existingUpi, error: upiCheckError } = await supabase
        .from('payment_verification_events')
        .select('id, upi_reference')
        .eq('upi_reference', trimmedUpi)
        .maybeSingle();

      if (upiCheckError) {
        console.error('[PaymentDeviceEvent] Error querying upi_reference:', upiCheckError.message);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to verify UPI reference idempotency.'
        });
      }

      if (existingUpi) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          matched: false,
          reason: 'upi_reference_already_processed'
        });
      }
    }

    // Step 5: Find eligible payment attempts with status = 'waiting' and exact amount_paise
    const { data: waitingAttempts, error: attemptsError } = await supabase
      .from('payment_attempts')
      .select('id, order_id, amount_paise, status, expires_at, created_at')
      .eq('status', 'waiting')
      .eq('amount_paise', amount_paise);

    if (attemptsError) {
      console.error('[PaymentDeviceEvent] Error querying payment_attempts:', attemptsError.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to query payment attempts.'
      });
    }

    const now = Date.now();
    const activeAttempts = (waitingAttempts || []).filter((att) => {
      if (!att.expires_at) return true;
      return new Date(att.expires_at).getTime() > now;
    });

    const expiredAttempts = (waitingAttempts || []).filter((att) => {
      if (!att.expires_at) return false;
      return new Date(att.expires_at).getTime() <= now;
    });

    if (activeAttempts.length === 0) {
      const matchReason = expiredAttempts.length > 0 ? 'verification_expired' : 'no_eligible_order';

      await supabase.from('payment_verification_events').insert({
        event_id: cleanEventId,
        amount_paise,
        upi_reference: trimmedUpi,
        source_package: trimmedSourcePkg,
        source_type: cleanSourceType,
        transaction_time: transactionTimeIso,
        device_id: cleanDeviceId,
        matched: false,
        processed: true,
        match_reason: matchReason
      });

      return res.status(200).json({
        success: true,
        matched: false,
        reason: matchReason,
        diagnostics: {
          CandidateCount: 0,
          AmbiguousReason: matchReason
        }
      });
    }

    // Step 6: Fetch candidate orders and perform strict monetary and status validation
    const candidateOrderIds = Array.from(new Set(activeAttempts.map((a) => a.order_id).filter(Boolean)));

    if (candidateOrderIds.length === 0) {
      await supabase.from('payment_verification_events').insert({
        event_id: cleanEventId,
        amount_paise,
        upi_reference: trimmedUpi,
        source_package: trimmedSourcePkg,
        source_type: cleanSourceType,
        transaction_time: transactionTimeIso,
        device_id: cleanDeviceId,
        matched: false,
        processed: true,
        match_reason: 'no_eligible_order'
      });

      return res.status(200).json({
        success: true,
        matched: false,
        reason: 'no_eligible_order',
        diagnostics: {
          CandidateCount: 0,
          AmbiguousReason: 'no_eligible_order'
        }
      });
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total, status, payment_method, payment_status, utr, refund_status, created_at, updated_at')
      .in('id', candidateOrderIds);

    if (ordersError) {
      console.error('[PaymentDeviceEvent] Error querying candidate orders:', ordersError.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to query matching orders.'
      });
    }

    interface CandidateMatch {
      attempt: (typeof activeAttempts)[0];
      order: (typeof orders)[0];
    }

    const orderMap = new Map<string, (typeof orders)[0]>();
    (orders || []).forEach((o) => orderMap.set(o.id, o));

    const validCandidates: CandidateMatch[] = [];

    for (const attempt of activeAttempts) {
      if (!attempt.order_id) continue;
      const order = orderMap.get(attempt.order_id);
      if (!order) continue;

      // 1. Payment status protection: must NOT already be paid
      if (order.payment_status?.toLowerCase() === 'paid') {
        continue;
      }

      // 2. Order status protection: must NOT be cancelled or delivered
      const currentOrderStatus = order.status?.toLowerCase();
      if (currentOrderStatus === 'cancelled' || currentOrderStatus === 'delivered') {
        continue;
      }

      // 3. COD / Cash protection: COD orders must NEVER be auto-settled by incoming events
      if (isCodOrCashPaymentMethod(order.payment_method)) {
        continue;
      }

      // 4. Exact monetary match: Convert order total to paise safely (orders.total * 100)
      const orderTotalPaise = Math.round(Number(order.total) * 100);
      if (orderTotalPaise !== amount_paise) {
        continue;
      }

      validCandidates.push({ attempt, order });
    }

    // Case A: No valid eligible candidate orders
    if (validCandidates.length === 0) {
      const matchReason = expiredAttempts.length > 0 ? 'verification_expired' : 'no_eligible_order';

      await supabase.from('payment_verification_events').insert({
        event_id: cleanEventId,
        amount_paise,
        upi_reference: trimmedUpi,
        source_package: trimmedSourcePkg,
        source_type: cleanSourceType,
        transaction_time: transactionTimeIso,
        device_id: cleanDeviceId,
        matched: false,
        processed: true,
        match_reason: matchReason
      });

      return res.status(200).json({
        success: true,
        matched: false,
        reason: matchReason,
        diagnostics: {
          CandidateCount: 0,
          AmbiguousReason: matchReason
        }
      });
    }

    // Case B: Ambiguous amount — more than one eligible order has the exact same waiting amount
    const uniqueOrderIds = new Set(validCandidates.map((c) => c.order.id));

    if (uniqueOrderIds.size > 1) {
      console.warn(`[PaymentDeviceEvent] Ambiguous payment amount ${amount_paise} paise matched ${uniqueOrderIds.size} different orders. Halting automated assignment.`);

      await supabase.from('payment_verification_events').insert({
        event_id: cleanEventId,
        amount_paise,
        upi_reference: trimmedUpi,
        source_package: trimmedSourcePkg,
        source_type: cleanSourceType,
        transaction_time: transactionTimeIso,
        device_id: cleanDeviceId,
        matched: false,
        processed: false,
        match_reason: 'ambiguous_amount'
      });

      return res.status(200).json({
        success: true,
        matched: false,
        reason: 'ambiguous_amount',
        diagnostics: {
          CandidateCount: validCandidates.length,
          CandidateOrderIdsMasked: Array.from(uniqueOrderIds).map(id => '***' + id.slice(-4)),
          AmbiguousReason: 'multiple_orders_same_amount'
        }
      });
    }

    // Case C: Unique unambiguous match (or multiple attempts for the SAME order)
    const matchedCandidate = validCandidates[0]; // Pick the most recent attempt if multiple exist for the same order
    const nowIso = new Date().toISOString();

    // Atomic status transition from 'waiting' -> 'matched' on the payment attempt
    const { data: updatedAttempt, error: attemptUpdateError } = await supabase
      .from('payment_attempts')
      .update({
        status: 'matched',
        matched_at: nowIso,
        updated_at: nowIso
      })
      .eq('id', matchedCandidate.attempt.id)
      .eq('status', 'waiting')
      .select()
      .maybeSingle();

    if (attemptUpdateError || !updatedAttempt) {
      console.warn(`[PaymentDeviceEvent] Attempt ${matchedCandidate.attempt.id} was already updated by another concurrent process.`);

      await supabase.from('payment_verification_events').insert({
        event_id: cleanEventId,
        order_id: matchedCandidate.order.id,
        amount_paise,
        upi_reference: trimmedUpi,
        source_package: trimmedSourcePkg,
        source_type: cleanSourceType,
        transaction_time: transactionTimeIso,
        device_id: cleanDeviceId,
        matched: false,
        processed: true,
        match_reason: 'attempt_already_transitioned'
      });

      return res.status(200).json({
        success: true,
        matched: false,
        reason: 'no_eligible_order'
      });
    }

    // Update public.orders with payment_status = 'paid', status = 'confirmed', utr = upi_reference
    const orderUpdates: any = {
      payment_status: 'paid',
      status: 'confirmed',
      updated_at: nowIso
    };
    if (trimmedUpi) {
      orderUpdates.utr = trimmedUpi;
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update(orderUpdates)
      .eq('id', matchedCandidate.order.id);

    if (orderUpdateError) {
      console.error('[PaymentDeviceEvent] Error updating order status to paid:', orderUpdateError.message);

      await supabase.from('payment_verification_events').insert({
        event_id: cleanEventId,
        order_id: matchedCandidate.order.id,
        amount_paise,
        upi_reference: trimmedUpi,
        source_package: trimmedSourcePkg,
        source_type: cleanSourceType,
        transaction_time: transactionTimeIso,
        device_id: cleanDeviceId,
        matched: true,
        processed: false,
        match_reason: 'order_update_failed'
      });

      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to update order status.'
      });
    }

    // Record the successful verification event
    await supabase.from('payment_verification_events').insert({
      event_id: cleanEventId,
      order_id: matchedCandidate.order.id,
      amount_paise,
      upi_reference: trimmedUpi,
      source_package: trimmedSourcePkg,
      source_type: cleanSourceType,
      transaction_time: transactionTimeIso,
      device_id: cleanDeviceId,
      matched: true,
      processed: true,
      match_reason: 'matched_single_order'
    });

    return res.status(200).json({
      success: true,
      matched: true,
      order_id: matchedCandidate.order.id,
      status: 'paid',
      diagnostics: {
        CandidateCount: validCandidates.length,
        SelectedAttempt: matchedCandidate.attempt.id,
        AmbiguousReason: 'none'
      }
    });
  } catch (err: any) {
    console.error('[PaymentDeviceEvent] Error occurred:', err?.name || 'Error', err?.message || String(err));
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing the payment device event.'
      });
    }
  }
});

/**
 * GET /api/payment/status/:orderId
 * Safe customer payment status endpoint.
 */
router.get(['/status/:orderId', '/api/payment/status/:orderId'], paymentStatusLimiter, async (req: Request, res: Response) => {
  try {
    // Set explicit headers to completely bypass caching proxies and browser caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const rawParam = req.params.orderId;
    const rawOrderId = Array.isArray(rawParam) ? rawParam[0] : (rawParam as string);
    const cleanOrderId = cleanOrderIdString(rawOrderId);

    if (!cleanOrderId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing or invalid orderId parameter.'
      });
    }

    const withoutPrefix = cleanOrderId.replace(/^FB-/i, '');
    const withPrefix = cleanOrderId.startsWith('FB-') ? cleanOrderId : `FB-${cleanOrderId}`;

    const { data: orders, error: orderErr } = await supabase
      .from('orders')
      .select('id, total, status, payment_status, updated_at, user_id, payment_method')
      .or(`id.ilike.${cleanOrderId},id.ilike.${withPrefix},id.ilike.${withoutPrefix}`)
      .limit(1);

    if (orderErr) {
      console.error('[PaymentStatus] Database error fetching order:', orderErr.message);
    }

    const order = orders && orders[0];

    const { data: attempt } = await supabase
      .from('payment_attempts')
      .select('id, status, expires_at, matched_at, amount_paise')
      .or(`order_id.ilike.${cleanOrderId},order_id.ilike.${withPrefix},order_id.ilike.${withoutPrefix}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order && !attempt) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Order #${cleanOrderId} not found.`
      });
    }

    // Authorization check for registered non-guest user orders
    if (order && order.user_id && !order.user_id.startsWith('guest_')) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        let authEmail: string | null = null;
        let authUserUid: string | null = null;
        let isTokenValid = false;

        // A. Try Supabase Auth verification
        try {
          const { data: authData, error: authErr } = await supabase.auth.getUser(token);
          if (!authErr && authData?.user) {
            authEmail = authData.user.email?.toLowerCase() || null;
            authUserUid = authData.user.id;
            isTokenValid = true;
          }
        } catch (sbErr) {
          console.warn('[PaymentRoutes] Supabase user check failed in check-status:', sbErr);
        }

        // B. Try Firebase ID Token parsing fallback
        if (!isTokenValid) {
          try {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payloadJson = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
              const payload = JSON.parse(payloadJson);
              if (payload.email) {
                authEmail = payload.email.toLowerCase();
                authUserUid = payload.sub || payload.uid || payload.user_id || null;
                isTokenValid = true;
              }
            }
          } catch (jwtErr) {
            console.warn('[PaymentRoutes] Firebase JWT fallback parse failed in check-status:', jwtErr);
          }
        }

        if (!isTokenValid || !authEmail) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired authentication token.'
          });
        }

        const isUserAdmin = ADMIN_EMAILS.includes(authEmail);

        if (!isUserAdmin) {
          let isMatch = false;
          if (order.user_id) {
            const { data: ownerProfile } = await supabase
              .from('users')
              .select('*')
              .eq('id', order.user_id)
              .maybeSingle();

            if (ownerProfile) {
              const ownerEmail = ownerProfile.email?.toLowerCase();
              const ownerSbUid = ownerProfile.supabase_uid;
              const ownerFbUid = ownerProfile.firebase_uid;

              if (
                (authUserUid && (authUserUid === ownerSbUid || authUserUid === ownerFbUid || authUserUid === ownerProfile.id)) ||
                (authEmail && (authEmail === ownerEmail || authEmail === order.email?.toLowerCase()))
              ) {
                isMatch = true;
              }
            }
          }

          if (!isMatch && order.email && authEmail === order.email.toLowerCase()) {
            isMatch = true;
          }

          if (!isMatch) {
            return res.status(403).json({
              success: false,
              error: 'Forbidden',
              message: 'You are not authorized to check status for this order.'
            });
          }
        }
      } else {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required to check status of registered customer order.'
        });
      }
    }

    const orderStatus = order?.status || 'pending';
    const orderPaymentStatus = order?.payment_status || 'pending';
    let attemptStatus = attempt?.status || 'waiting';

    if (attemptStatus === 'waiting' && attempt?.expires_at) {
      if (new Date(attempt.expires_at).getTime() <= Date.now()) {
        attemptStatus = 'expired';
        supabase
          .from('payment_attempts')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', attempt.id)
          .then(() => {})
          .catch(() => {});
      }
    }

    const isPaid = orderPaymentStatus === 'paid' || orderStatus === 'confirmed' || attemptStatus === 'matched';

    return res.json({
      success: true,
      order_id: order?.id || cleanOrderId,
      total: order ? Number(order.total) : (attempt?.amount_paise ? Number(attempt.amount_paise) / 100 : 0),
      payment_status: isPaid ? 'paid' : orderPaymentStatus,
      status: isPaid ? 'confirmed' : orderStatus,
      updated_at: order?.updated_at || new Date().toISOString(),
      verified: isPaid,
      attempt_status: attemptStatus,
      expires_at: attempt?.expires_at || null
    });
  } catch (err: any) {
    console.error('[PaymentStatus] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to retrieve payment status.'
    });
  }
});

export default router;
