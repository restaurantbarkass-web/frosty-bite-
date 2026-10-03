import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { SmsGatewayService, SmsType, QueueSmsParams } from '../services/smsGateway.service';
import { requireAdmin } from '../middleware/auth';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Rate limiter for order event lifecycle triggers
const orderEventRateLimiter = rateLimit({
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
    ok: false,
    skipped: true,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded for order events. Please slow down.'
  }
});

/**
 * Authentication middleware for the physical Android SMS Gateway device.
 * Checks for API key in 'x-api-key', 'x-gateway-key', 'x-sms-key', 'x-apikey', 'Authorization: Bearer <key>', or request body.
 */
const requireGatewayAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = (
    req.headers['x-api-key'] || 
    req.headers['x-gateway-key'] || 
    req.headers['x-sms-key'] || 
    req.headers['x-apikey'] ||
    req.headers['apikey']
  ) as string | undefined;
  const bodyApiKey = req.body?.apiKey || req.body?.api_key || req.body?.key;

  let providedKey: string | undefined = undefined;

  if (apiKeyHeader) {
    providedKey = apiKeyHeader;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.split('Bearer ')[1]?.trim();
  } else if (bodyApiKey) {
    providedKey = String(bodyApiKey);
  }

  if (providedKey) {
    providedKey = providedKey.trim().replace(/^["']|["']$/g, '');
  }

  const isValid = SmsGatewayService.validateApiKey(providedKey);

  if (!isValid) {
    SmsGatewayService.addLog('AUTH_FAILURE', 'Unauthorized request rejected (invalid or missing API key)', {
      ip: req.ip || req.headers['x-forwarded-for'],
      path: req.path
    });
    console.warn(`[SMS Gateway Heartbeat] ❌ Authentication rejected: Invalid or missing API key on ${req.path} from IP ${req.ip || req.headers['x-forwarded-for'] || 'unknown'} at ${new Date().toISOString()}`);
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
      message: 'Invalid or missing SMS Gateway API key'
    });
  }

  next();
};

/**
 * Flexible authentication guard for queueing SMS:
 * Accepts valid SMS Gateway API Key, Admin JWT token, or internal service calls.
 */
const requireQueueAuth = async (req: Request, res: Response, next: NextFunction) => {
  const apiKeyHeader = (req.headers['x-api-key'] || req.headers['x-gateway-key'] || req.headers['x-sms-key']) as string | undefined;
  const authHeader = req.headers.authorization;
  const bodyApiKey = req.body?.apiKey;

  let providedKey: string | undefined = apiKeyHeader || bodyApiKey;
  if (!providedKey && authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.split('Bearer ')[1]?.trim();
    if (SmsGatewayService.validateApiKey(bearer)) {
      providedKey = bearer;
    }
  }

  // 1. If valid Gateway API Key is provided
  if (providedKey && SmsGatewayService.validateApiKey(providedKey)) {
    return next();
  }

  // 2. If valid Supabase user / Admin Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          (req as any).user = user;
          return next();
        }
      } catch (_) {}
    }
  }

  // 3. Fallback for server-side internal calls or non-production environment
  if (process.env.NODE_ENV !== 'production' || !process.env.SMS_GATEWAY_API_KEY) {
    return next();
  }

  return res.status(401).json({
    ok: false,
    error: 'Unauthorized',
    message: 'Valid API key or Authorization token required to queue SMS'
  });
};

/**
 * 1. Queue SMS Message Endpoint (Phase 2 & Phase 3 Core API)
 * POST /api/sms-gateway/queue
 */
router.post('/queue', requireQueueAuth, async (req: Request, res: Response) => {
  try {
    const { recipient, message, type, orderId, priority, idempotencyKey } = req.body || {};

    if (!recipient || !message || !type) {
      return res.status(400).json({
        ok: false,
        error: 'Bad Request',
        message: 'recipient, message, and type are required'
      });
    }

    const result = await SmsGatewayService.queueSms({
      recipient,
      message,
      type: type as SmsType,
      orderId,
      priority,
      idempotencyKey
    });

    if (!result.ok && !result.duplicate) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[SMS Gateway] Error in /queue endpoint:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: err?.message || 'Failed to queue SMS'
    });
  }
});

/**
 * 2. Automated Order Event SMS Trigger Endpoint
 * POST /api/sms-gateway/order-event
 * Automatically maps order status to message copy, validates customer phone, and queues SMS safely.
 * Internal order event endpoint: protected by rate limiting and server-side state machine validation.
 */
router.post('/order-event', orderEventRateLimiter, async (req: Request, res: Response) => {
  try {
    const { orderId, status, prevStatus, phone, customerName, orderType } = req.body || {};

    if (!orderId || !status) {
      return res.status(400).json({
        ok: false,
        error: 'Bad Request',
        message: 'orderId and status are required'
      });
    }

    const result = await SmsGatewayService.handleOrderStatusTransition({
      orderId,
      status,
      prevStatus,
      phone,
      customerName,
      orderType
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[SMS Gateway] Error in /order-event endpoint:', err);
    // Return 200 with skipped flag so SMS failure never crashes order updates
    return res.status(200).json({
      ok: false,
      skipped: true,
      reason: err?.message || 'Error executing order event SMS trigger'
    });
  }
});

/**
 * 3. Retrieve and Atomically Claim Pending SMS Jobs for Android Device Dispatch
 * Phase 2 standard: GET /api/sms-gateway/poll, POST /api/sms-gateway/poll
 * Phase 3 aliases: GET /api/sms-gateway/pending-jobs, GET /api/sms-gateway/queue
 */
const handleGetPendingJobs = async (req: Request, res: Response) => {
  try {
    const deviceIdentifier = (req.headers['x-device-id'] as string) || req.body?.deviceId || req.body?.device_id || 'frosty-sms-gateway-01';
    const rawJobs = await SmsGatewayService.claimPendingJobs(deviceIdentifier);

    // Map each job with all compatible field aliases for Android APKs
    const formattedJobs = rawJobs.map(job => ({
      id: job.id,
      jobId: job.id,
      job_id: job.id,
      recipient: job.recipient,
      phone: job.recipient,
      phoneNumber: job.recipient,
      to: job.recipient,
      message: job.message,
      text: job.message,
      body: job.message,
      type: job.type,
      smsType: job.type,
      sms_type: job.type,
      orderId: job.orderId,
      order_id: job.orderId,
      status: job.status,
      priority: job.priority,
      idempotencyKey: job.idempotencyKey,
      createdAt: job.createdAt,
      attempts: job.attempts || 1
    }));

    return res.status(200).json({
      ok: true,
      count: formattedJobs.length,
      jobs: formattedJobs,
      messages: formattedJobs,
      data: formattedJobs
    });
  } catch (err: any) {
    console.error('[SMS Gateway] Error fetching/claiming pending jobs:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to fetch pending SMS jobs'
    });
  }
};

router.get('/poll', requireGatewayAuth, handleGetPendingJobs);
router.post('/poll', requireGatewayAuth, handleGetPendingJobs);
router.get('/pending-jobs', requireGatewayAuth, handleGetPendingJobs);
router.get('/queue', requireGatewayAuth, handleGetPendingJobs);

/**
 * 4. Acknowledge / Report SMS Delivery Status from Android Device
 * Phase 2 standard: POST /api/sms-gateway/report
 * Phase 3 alias: POST /api/sms-gateway/ack
 */
const handleReportJob = async (req: Request, res: Response) => {
  try {
    const jobId = req.body?.jobId || req.body?.id || req.body?.job_id || req.body?.smsId;
    const rawStatus = req.body?.status ? String(req.body.status).toUpperCase() : '';
    const error = req.body?.error || req.body?.message || req.body?.errorMessage;

    const normalizedStatus = (rawStatus === 'SENT' || rawStatus === 'SUCCESS') ? 'SENT' : (rawStatus.includes('FAIL') ? 'FAILED' : null);

    if (!jobId || !normalizedStatus) {
      return res.status(400).json({
        ok: false,
        error: 'Bad Request',
        message: "jobId/id and valid status ('SENT' | 'FAILED') are required"
      });
    }

    const result = await SmsGatewayService.acknowledgeJob(String(jobId), normalizedStatus, error);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[SMS Gateway] Error reporting/acknowledging job:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to report SMS job status'
    });
  }
};

router.post('/report', requireGatewayAuth, handleReportJob);
router.post('/ack', requireGatewayAuth, handleReportJob);

/**
 * 5. Android SMS Gateway Heartbeat Endpoint
 * POST /api/sms-gateway/heartbeat
 */
router.post('/heartbeat', requireGatewayAuth, async (req: Request, res: Response) => {
  const deviceIdentifier = (req.headers['x-device-id'] as string) || req.body?.deviceId || req.body?.device_id || 'frosty-sms-gateway-01';
  console.log(`[SMS Gateway Heartbeat] 📥 Heartbeat request received from device: ${deviceIdentifier} at ${new Date().toISOString()}`);

  try {
    const payload = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    const result = await SmsGatewayService.processHeartbeat(payload, clientIp, req.headers);

    if (!result.ok) {
      console.warn(`[SMS Gateway Heartbeat] ⚠️ Heartbeat rejected for device: ${deviceIdentifier}, reason: ${result.message}`);
      return res.status(400).json(result);
    }

    const pendingJobs = await SmsGatewayService.getPendingJobs();

    console.log(`[SMS Gateway Heartbeat] ✅ Heartbeat successfully processed and persisted. HTTP 200 returned. Gateway state: ${result.gatewayState}`);

    return res.status(200).json({
      ok: true,
      service: 'frosty-bite-sms-server',
      serverTime: new Date().toISOString(),
      status: 'acknowledged',
      gatewayState: result.gatewayState,
      pendingMessages: pendingJobs.length
    });
  } catch (err: any) {
    console.error('[SMS Gateway Heartbeat] ❌ Error processing heartbeat:', err?.message || err);
    return res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: 'Failed to process heartbeat'
    });
  }
});

/**
 * 6. Public / Lightweight Server Reachability Ping
 * GET /api/sms-gateway/ping
 */
router.get('/ping', (_req: Request, res: Response) => {
  return res.status(200).json({
    ok: true,
    service: 'frosty-bite-sms-server',
    status: 'CONNECTED',
    serverTime: new Date().toISOString()
  });
});

/**
 * 7. Connection Status Endpoint (Admin Only)
 * GET /api/sms-gateway/status
 */
router.get('/status', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const status = await SmsGatewayService.getStatus();
    return res.status(200).json({
      ok: true,
      ...status
    });
  } catch (err: any) {
    console.error('[SMS Gateway] Error fetching status:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to retrieve SMS gateway status'
    });
  }
});

/**
 * 8. Admin Diagnostic Test Connection Endpoint
 * POST /api/sms-gateway/test-connection
 */
router.post('/test-connection', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const diagnostic = await SmsGatewayService.testConnection();
    return res.status(200).json(diagnostic);
  } catch (err: any) {
    console.error('[SMS Gateway] Test connection failed:', err);
    return res.status(500).json({
      ok: false,
      status: 'GATEWAY OFFLINE',
      serverStatus: 'CONNECTED',
      gatewayStatus: 'OFFLINE',
      simReady: false,
      smsReady: false,
      permissionGranted: false,
      latencyMs: 0,
      lastHeartbeat: null,
      lastHeartbeatAgeSeconds: null,
      pendingQueueCount: 0,
      device: null,
      message: `Diagnostic test error: ${err.message || 'Unknown error'}`
    });
  }
});

export default router;
