import express, { Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Basic rate limiting to protect the device event endpoint against flooding in serverless and proxy environments
const paymentDeviceEventLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 60, // Maximum 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Prevent rate-limit proxy validation errors on Vercel
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

const paymentCreateAttemptLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // Maximum 30 requests per minute per IP
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

/**
 * Constant-time bearer token comparison against FROSTYPAY_DEVICE_TOKEN.
 * Note: A future version may replace this shared token with per-device asymmetric signatures or individual device credentials.
 */
function authenticateDeviceToken(req: Request, res: Response): boolean {
  console.log('[PaymentDeviceEvent] authentication started');
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
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header.'
    });
    return false;
  }

  const providedToken = authHeader.slice(7).trim();
  if (!providedToken) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing device token.'
    });
    return false;
  }

  const providedBuf = Buffer.from(providedToken);
  const expectedBuf = Buffer.from(expectedToken.trim());

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid device token.'
    });
    return false;
  }

  return true;
}

/**
 * Normalizes payment methods to identify Cash on Delivery / Cash payments that must never be auto-settled.
 */
function isCodOrCashPaymentMethod(paymentMethod?: string | null): boolean {
  if (!paymentMethod) return false;
  const normalized = paymentMethod.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return ['cod', 'cash', 'cashondelivery', 'payondelivery'].includes(normalized);
}

/**
 * POST /api/payment/create-attempt
 * Creates or retrieves an active payment attempt for an order securely on the server side.
 */
router.post(['/create-attempt', '/api/payment/create-attempt'], paymentCreateAttemptLimiter, async (req: Request, res: Response) => {
  try {
    console.log('[CreatePaymentAttempt] route entered');

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object.'
      });
    }

    const rawOrderId = req.body.order_id || req.body.orderId;
    if (typeof rawOrderId !== 'string' || rawOrderId.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'order_id is required.'
      });
    }

    const cleanOrderId = rawOrderId.trim();
    const withoutPrefix = cleanOrderId.replace(/^FB-/i, '');
    const withPrefix = cleanOrderId.startsWith('FB-') ? cleanOrderId : `FB-${cleanOrderId}`;

    // Retrieve authoritative order from server-side Supabase client (bypasses RLS safely)
    let { data: orderList, error: orderFetchError } = await supabase
      .from('orders')
      .select('id, total, status, payment_status, payment_method, user_id, email, phone')
      .or(`id.eq.${cleanOrderId},id.eq.${withPrefix},id.eq.${withoutPrefix}`);

    let order = orderList && orderList[0];

    // Fallback: If order not found in DB but order_details is provided in req.body
    if (!order && req.body.order_details) {
      const details = req.body.order_details;
      const fallbackTotal = Number(details.totalPrice || details.total || req.body.amount || 0);
      if (fallbackTotal > 0) {
        const newOrderObj = {
          id: cleanOrderId,
          total: fallbackTotal,
          customer_name: details.name || details.customer_name || 'Customer',
          phone: details.phone || '',
          address: details.address || '',
          payment_method: 'upi',
          status: 'awaiting_payment',
          payment_status: 'pending',
          created_at: new Date().toISOString()
        };
        const { data: insertedOrder, error: insertErr } = await supabase
          .from('orders')
          .upsert(newOrderObj)
          .select('id, total, status, payment_status, payment_method, user_id, email, phone')
          .maybeSingle();

        if (!insertErr && insertedOrder) {
          order = insertedOrder;
        } else if (insertErr) {
          console.warn('[CreatePaymentAttempt] Server upsert fallback warning:', insertErr.message);
        }
      }
    }

    if (orderFetchError) {
      console.error('[CreatePaymentAttempt] Error fetching order:', orderFetchError.message);
    }

    if (!order) {
      const reqAmount = Number(req.body.amount || req.body.total || req.body.totalPrice);
      if (!isNaN(reqAmount) && reqAmount > 0) {
        order = {
          id: cleanOrderId,
          total: reqAmount,
          status: 'awaiting_payment',
          payment_status: 'pending',
          payment_method: 'upi',
          user_id: null,
          email: null,
          phone: null
        };
      } else {
        return res.status(404).json({
          error: 'Not Found',
          message: `Order #${cleanOrderId} not found.`
        });
      }
    }

    // Validation 1: Order status checks
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

    // Validation 2: Payment status check
    const normalizedPaymentStatus = (order.payment_status || '').trim().toLowerCase();
    if (normalizedPaymentStatus === 'paid' || normalizedStatus === 'confirmed') {
      return res.status(400).json({
        error: 'Invalid Order State',
        message: 'Order is already paid.'
      });
    }

    // Validation 3: Payment method check (must not be COD / Cash)
    if (isCodOrCashPaymentMethod(order.payment_method)) {
      return res.status(400).json({
        error: 'Invalid Payment Method',
        message: 'Payment attempts are only allowed for online/UPI payments.'
      });
    }

    // Validation 4: Derive authoritative amount in paise from orders.total
    const totalAmount = Number(order.total);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid Order Amount',
        message: 'Order total amount is invalid.'
      });
    }

    const amount_paise = Math.round(totalAmount * 100);

    // Authorization check: If a bearer token is present in headers, verify user matches order.user_id (if set)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token && token.length > 10) {
        try {
          const { data: authData } = await supabase.auth.getUser(token);
          if (authData?.user) {
            const authUserId = authData.user.id;
            const authEmail = authData.user.email;
            if (order.user_id && !order.user_id.startsWith('guest_') && order.user_id !== authUserId && order.email !== authEmail) {
              return res.status(403).json({
                error: 'Forbidden',
                message: 'You are not authorized to create a payment attempt for this order.'
              });
            }
          }
        } catch (authErr) {
          console.warn('[CreatePaymentAttempt] Token verification warning:', authErr);
        }
      }
    }

    // Step 5: Check for existing active waiting attempt (Idempotency)
    const nowMs = Date.now();
    const { data: existingAttempts, error: attemptFetchError } = await supabase
      .from('payment_attempts')
      .select('id, order_id, amount_paise, status, expires_at, created_at')
      .eq('order_id', cleanOrderId)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (attemptFetchError) {
      console.error('[CreatePaymentAttempt] Error fetching existing attempts:', attemptFetchError.message);
    }

    const activeAttempt = (existingAttempts || []).find((att) => {
      if (!att.expires_at) return true;
      return new Date(att.expires_at).getTime() > nowMs;
    });

    if (activeAttempt) {
      console.log(`[CreatePaymentAttempt] Returning existing active waiting attempt ${activeAttempt.id} for order ${cleanOrderId}`);
      return res.status(200).json({
        success: true,
        payment_attempt: {
          id: activeAttempt.id,
          order_id: activeAttempt.order_id,
          amount_paise: Number(activeAttempt.amount_paise),
          status: activeAttempt.status,
          created_at: activeAttempt.created_at,
          expires_at: activeAttempt.expires_at
        }
      });
    }

    // Step 6: Create fresh payment attempt (expires in 6 minutes)
    const createdAtDate = new Date();
    const expiresAtDate = new Date(createdAtDate.getTime() + 6 * 60 * 1000);

    const newAttemptObj = {
      order_id: cleanOrderId,
      amount_paise,
      status: 'waiting',
      created_at: createdAtDate.toISOString(),
      expires_at: expiresAtDate.toISOString()
    };

    const { data: createdAttempt, error: createError } = await supabase
      .from('payment_attempts')
      .insert(newAttemptObj)
      .select('id, order_id, amount_paise, status, created_at, expires_at')
      .single();

    if (createError) {
      console.error('[CreatePaymentAttempt] Error inserting payment attempt:', createError.message);

      // Handle race condition: check again if a waiting attempt was created concurrently
      if (createError.code === '23505' || createError.message?.includes('unique') || createError.message?.includes('duplicate')) {
        const { data: raceAttempt } = await supabase
          .from('payment_attempts')
          .select('id, order_id, amount_paise, status, created_at, expires_at')
          .eq('order_id', cleanOrderId)
          .eq('status', 'waiting')
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (raceAttempt) {
          return res.status(200).json({
            success: true,
            payment_attempt: {
              id: raceAttempt.id,
              order_id: raceAttempt.order_id,
              amount_paise: Number(raceAttempt.amount_paise),
              status: raceAttempt.status,
              created_at: raceAttempt.created_at,
              expires_at: raceAttempt.expires_at
            }
          });
        }
      }

      return res.status(500).json({
        error: 'Unable to create payment attempt'
      });
    }

    console.log(`[CreatePaymentAttempt] Successfully created attempt ${createdAttempt.id} for order ${cleanOrderId}`);
    return res.status(200).json({
      success: true,
      payment_attempt: {
        id: createdAttempt.id,
        order_id: createdAttempt.order_id,
        amount_paise: Number(createdAttempt.amount_paise),
        status: createdAttempt.status,
        created_at: createdAttempt.created_at,
        expires_at: createdAttempt.expires_at
      }
    });
  } catch (err: any) {
    console.error('[CreatePaymentAttempt] Unexpected error:', err?.message || String(err));
    return res.status(500).json({
      error: 'Unable to create payment attempt'
    });
  }
});

/**
 * POST /api/payment/device-event
 * Receives payment detection notifications from the FrostyPay Android Verifier and performs server-side matching against eligible orders.
 */
router.post(['/device-event', '/api/payment/device-event'], paymentDeviceEventLimiter, async (req: Request, res: Response) => {
  try {
    console.log('[PaymentDeviceEvent] route entered');

    // Step 1: Validate Device Authentication Token
    if (!authenticateDeviceToken(req, res)) {
      return;
    }

    // Step 2: Validate Input Structure and Types
    console.log('[PaymentDeviceEvent] validation started');
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object.'
      });
    }

    const {
      amount_paise,
      upi_reference,
      transaction_time,
      source_package,
      source_type,
      device_id,
      event_id
    } = req.body;

    // Validate amount_paise: required integer > 0
    if (typeof amount_paise !== 'number' || !Number.isInteger(amount_paise) || amount_paise <= 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'amount_paise is required and must be a positive integer.'
      });
    }

    // Validate device_id: required string <= 128
    if (typeof device_id !== 'string' || device_id.trim().length === 0 || device_id.trim().length > 128) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'device_id is required (string, max 128 characters).'
      });
    }

    // Validate source_type: required string <= 64
    if (typeof source_type !== 'string' || source_type.trim().length === 0 || source_type.trim().length > 64) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'source_type is required (string, max 64 characters).'
      });
    }

    // Validate event_id: required unique string <= 128
    if (typeof event_id !== 'string' || event_id.trim().length === 0 || event_id.trim().length > 128) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'event_id is required (string, max 128 characters).'
      });
    }

    // Validate upi_reference (optional string <= 128)
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

    // Validate source_package (optional string <= 256)
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

    // Validate transaction_time (optional valid ISO date)
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

    console.log('[PaymentDeviceEvent] Supabase lookup started');

    // Step 3: Idempotency check on event_id
    const { data: existingEvent, error: eventCheckError } = await supabase
      .from('payment_verification_events')
      .select('id, event_id')
      .eq('event_id', cleanEventId)
      .maybeSingle();

    if (eventCheckError) {
      console.error('[PaymentDeviceEvent] Error querying payment_verification_events for event_id:', eventCheckError.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to verify event idempotency.'
      });
    }

    if (existingEvent) {
      console.log('[PaymentDeviceEvent] completed');
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
        console.error('[PaymentDeviceEvent] Error querying payment_verification_events for upi_reference:', upiCheckError.message);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to verify UPI reference idempotency.'
        });
      }

      if (existingUpi) {
        console.log('[PaymentDeviceEvent] completed');
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

    // If no active attempts exist, check whether there were expired attempts or none at all
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

      console.log('[PaymentDeviceEvent] completed');
      return res.status(200).json({
        success: true,
        matched: false,
        reason: matchReason
      });
    }

    // Step 6 & 7: Fetch candidate orders and perform strict monetary and status validation
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

      console.log('[PaymentDeviceEvent] completed');
      return res.status(200).json({
        success: true,
        matched: false,
        reason: 'no_eligible_order'
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

    // Step 8: Evaluate Candidate Matches

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

      console.log('[PaymentDeviceEvent] completed');
      return res.status(200).json({
        success: true,
        matched: false,
        reason: matchReason
      });
    }

    // Case B: Ambiguous amount — more than one eligible order has the exact same waiting amount
    if (validCandidates.length > 1) {
      console.warn(`[PaymentDeviceEvent] Ambiguous payment amount ${amount_paise} paise matched ${validCandidates.length} orders. Halting automated assignment.`);

      await supabase.from('payment_verification_events').insert({
        event_id: cleanEventId,
        amount_paise,
        upi_reference: trimmedUpi,
        source_package: trimmedSourcePkg,
        source_type: cleanSourceType,
        transaction_time: transactionTimeIso,
        device_id: cleanDeviceId,
        matched: false,
        processed: false, // Mark processed=false for audit and potential manual administrative review
        match_reason: 'ambiguous_amount'
      });

      console.log('[PaymentDeviceEvent] completed');
      return res.status(200).json({
        success: true,
        matched: false,
        reason: 'ambiguous_amount'
      });
    }

    // Case C: Unique unambiguous match
    const matchedCandidate = validCandidates[0];
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
      .eq('status', 'waiting') // Concurrency guard
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

      console.log('[PaymentDeviceEvent] completed');
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

    console.log('[PaymentDeviceEvent] completed');

    return res.status(200).json({
      success: true,
      matched: true,
      order_id: matchedCandidate.order.id,
      status: 'paid'
    });
  } catch (err: any) {
    console.error('[PaymentDeviceEvent] Error occurred:', err?.name || 'Error', err?.message || String(err));
    if (err?.stack) {
      console.error('[PaymentDeviceEvent] Stack trace:', err.stack);
    }
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing the payment device event.'
      });
    }
  }
});

export default router;
