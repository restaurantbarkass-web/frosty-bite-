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
    console.warn('[SMS Gateway] Request rejected: Invalid or missing API key on ' + req.path);
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
      message: 'Invalid or missing SMS Gateway API key'
    });
  }

  const incomingDeviceId = ((req.headers['x-device-id'] as string) || req.body?.deviceId || req.body?.device_id || '').trim();
  const expectedDeviceId = (process.env.SMS_GATEWAY_DEVICE_ID || '').trim();

  // 2. Validate Device ID (if configured on server)
  if (expectedDeviceId && incomingDeviceId && incomingDeviceId !== expectedDeviceId) {
    SmsGatewayService.addLog('AUTH_FAILURE', `Gateway request rejected: Device ID mismatch (Expected: ${expectedDeviceId}, Received: ${incomingDeviceId})`, {
      ip: req.ip || req.headers['x-forwarded-for'],
      deviceId: incomingDeviceId,
      expectedDeviceId,
      httpStatus: 403
    });
    return res.status(403).json({
      ok: false,
      error: 'Forbidden',
      message: 'Device ID mismatch'
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
 * 3. Retrieve Pending SMS Jobs for Android Device Dispatch
 * Phase 2 standard: GET /api/sms-gateway/poll, POST /api/sms-gateway/poll
 * Phase 3 aliases: GET /api/sms-gateway/pending-jobs, GET /api/sms-gateway/queue
 */
const handleGetPendingJobs = (req: Request, res: Response) => {
  try {
    const jobs = SmsGatewayService.getPendingJobs();
    return res.status(200).json({
      ok: true,
      count: jobs.length,
      jobs,
      data: jobs
    });
  } catch (err: any) {
    console.error('[SMS Gateway] Error fetching pending jobs:', err);
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
  try {
    const payload = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    const result = await SmsGatewayService.processHeartbeat(payload, clientIp, req.headers);

    if (!result.ok) {
      return res.status(400).json(result);
    }

    const pendingJobs = SmsGatewayService.getPendingJobs();

    return res.status(200).json({
      ok: true,
      service: 'frosty-bite-sms-server',
      serverTime: new Date().toISOString(),
      status: 'acknowledged',
      gatewayState: result.gatewayState,
      pendingMessages: pendingJobs.length
    });
  } catch (err: any) {
    console.error('[SMS Gateway] Error processing heartbeat:', err);
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
  const configuredKey = process.env.SMS_GATEWAY_API_KEY || process.env.FROSTY_SMS_GATEWAY_KEY;
  return res.status(200).json({
    ok: true,
    service: 'frosty-bite-sms-server',
    status: 'CONNECTED',
    serverTime: new Date().toISOString(),
    diagnostics: {
      serverApiKeyConfigured: configuredKey ? 'YES' : 'NO',
      serverApiKeyLength: configuredKey ? configuredKey.trim().length : 0,
      serverDeviceId: process.env.SMS_GATEWAY_DEVICE_ID || 'frosty-sms-gateway-01',
      serverGatewayUrlConfigured: process.env.SMS_GATEWAY_URL ? 'YES' : 'NO'
    }
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
 * 8. Diagnostic Test Connection Endpoint
 * POST /api/sms-gateway/test-connection
 * Can be called by:
 * - Android SMS Gateway: uses X-API-Key and X-Device-ID (same auth as heartbeat)
 * - Admin Web UI: uses Authorization: Bearer <token>
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  const hasGatewayApiKey = !!(
    req.headers['x-api-key'] ||
    req.headers['x-gateway-key'] ||
    req.headers['x-sms-key'] ||
    req.headers['x-apikey'] ||
    req.headers['apikey'] ||
    req.body?.apiKey ||
    req.body?.api_key ||
    req.body?.key
  );

  // If called by Android Gateway with API Key (or gateway headers)
  if (hasGatewayApiKey) {
    return requireGatewayAuth(req, res, () => {
      const incomingDeviceId = ((req.headers['x-device-id'] as string) || req.body?.deviceId || req.body?.device_id || 'frosty-sms-gateway-01').trim();
      return res.status(200).json({
        ok: true,
        service: 'frosty-bite-sms-server',
        status: 'CONNECTED',
        auth: 'PASS',
        message: 'PING: PASS\nAUTHENTICATION: PASS\nSERVER: CONNECTED',
        deviceId: incomingDeviceId,
        serverTime: new Date().toISOString()
      });
    });
  }

  // Otherwise, Admin Web UI diagnostic call
  return requireAdmin(req, res, async () => {
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
});

export default router;
