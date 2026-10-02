import express, { Request, Response, NextFunction } from 'express';
import { SmsGatewayService } from '../services/smsGateway.service';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * Authentication middleware for the physical Android SMS Gateway device.
 * Validates 'X-API-Key' and 'X-Device-ID'.
 * Incorporates temporary SAFE diagnostics without logging secrets.
 */
export const requireGatewayAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKeyHeader = (req.headers['x-api-key'] || req.headers['x-gateway-key'] || req.headers['x-sms-key']) as string | undefined;
  const authHeader = req.headers.authorization;
  const bodyApiKey = req.body?.apiKey;

  let providedKey: string | undefined = undefined;
  if (apiKeyHeader) {
    providedKey = String(apiKeyHeader).trim();
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.split('Bearer ')[1]?.trim();
  } else if (bodyApiKey) {
    providedKey = String(bodyApiKey).trim();
  }

  const incomingDeviceId = ((req.headers['x-device-id'] as string) || req.body?.deviceId || '').trim();
  const expectedKey = process.env.SMS_GATEWAY_API_KEY || process.env.FROSTY_SMS_GATEWAY_KEY;
  const expectedDeviceId = (process.env.SMS_GATEWAY_DEVICE_ID || '').trim();

  const isServerKeyConfigured = !!expectedKey;
  const isReceivedKeyPresent = !!providedKey;
  const receivedKeyLength = providedKey ? providedKey.length : 0;
  const deviceIdToLog = incomingDeviceId || 'not-provided';

  // 1. Validate API Key
  const isKeyValid = SmsGatewayService.validateApiKey(providedKey);

  if (!isKeyValid) {
    console.warn(`[SMS Gateway Auth] API key configured: ${isServerKeyConfigured ? 'YES' : 'NO'} | Received API key present: ${isReceivedKeyPresent ? 'YES' : 'NO'} | Received key length: ${receivedKeyLength} | Device ID: ${deviceIdToLog} | HTTP status: 401`);
    
    SmsGatewayService.addLog('AUTH_FAILURE', 'Gateway request rejected (invalid or missing API key)', {
      apiKeyConfigured: isServerKeyConfigured ? 'YES' : 'NO',
      receivedApiKeyPresent: isReceivedKeyPresent ? 'YES' : 'NO',
      receivedKeyLength,
      deviceId: deviceIdToLog,
      httpStatus: 401
    });

    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
      message: 'Invalid or missing SMS Gateway API key',
      diagnostics: {
        serverApiKeyConfigured: isServerKeyConfigured ? 'YES' : 'NO',
        receivedApiKeyPresent: isReceivedKeyPresent ? 'YES' : 'NO',
        receivedKeyLength,
        deviceId: deviceIdToLog,
        httpStatus: 401
      }
    });
  }

  // 2. Validate Device ID (if configured on server)
  if (expectedDeviceId && incomingDeviceId && incomingDeviceId !== expectedDeviceId) {
    console.warn(`[SMS Gateway Auth] API key configured: YES | Received API key present: YES | Received key length: ${receivedKeyLength} | Device ID: ${incomingDeviceId} | HTTP status: 403 (Expected: ${expectedDeviceId})`);

    SmsGatewayService.addLog('AUTH_FAILURE', `Gateway request rejected: Device ID mismatch (Expected: ${expectedDeviceId}, Received: ${incomingDeviceId})`, {
      apiKeyConfigured: 'YES',
      receivedApiKeyPresent: 'YES',
      receivedKeyLength,
      deviceId: incomingDeviceId,
      expectedDeviceId,
      httpStatus: 403
    });

    return res.status(403).json({
      ok: false,
      error: 'Forbidden',
      message: 'Device ID mismatch',
      diagnostics: {
        serverApiKeyConfigured: 'YES',
        receivedApiKeyPresent: 'YES',
        receivedKeyLength,
        deviceId: incomingDeviceId,
        httpStatus: 403
      }
    });
  }

  console.log(`[SMS Gateway Auth] API key configured: YES | Received API key present: YES | Received key length: ${receivedKeyLength} | Device ID: ${incomingDeviceId || expectedDeviceId || 'default'} | HTTP status: 200`);
  next();
};

/**
 * Authentication middleware for Queue creation.
 * Accepts either physical Gateway credentials (X-API-Key) or Admin Bearer Token.
 * Never allows unauthenticated requests.
 */
export const requireGatewayOrAdminAuth = (req: Request, res: Response, next: NextFunction) => {
  const hasGatewayKey = !!(
    req.headers['x-api-key'] ||
    req.headers['x-gateway-key'] ||
    req.headers['x-sms-key'] ||
    req.body?.apiKey
  );

  const authHeader = req.headers.authorization;

  if (hasGatewayKey) {
    return requireGatewayAuth(req, res, next);
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return requireAdmin(req, res, next);
  }

  return requireGatewayAuth(req, res, next);
};

/**
 * 1. Android SMS Gateway Heartbeat Endpoint
 * POST /api/sms-gateway/heartbeat
 * Called periodically (e.g. every 15-30s) by the Android phone application.
 */
router.post('/heartbeat', requireGatewayAuth, async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;
    const headerDeviceId = (req.headers['x-device-id'] as string | undefined)?.trim();
    if (headerDeviceId && !payload.deviceId) {
      payload.deviceId = headerDeviceId;
    }

    const result = await SmsGatewayService.processHeartbeat(payload, clientIp);

    if (!result.ok) {
      const statusCode = result.message?.toLowerCase().includes('device id mismatch') ? 403 : 400;
      return res.status(statusCode).json(result);
    }

    return res.status(200).json({
      ok: true,
      service: 'frosty-bite-sms-server',
      serverTime: new Date().toISOString(),
      status: 'acknowledged',
      gatewayState: result.gatewayState,
      pendingMessages: 0
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
 * 2. Public / Lightweight Server Reachability Ping for Android App
 * GET /api/sms-gateway/ping
 * Note: Only proves server reachability. Does NOT prove authenticated gateway communication.
 */
router.get('/ping', (req: Request, res: Response) => {
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
 * 3. Connection Status Endpoint (Admin Only)
 * GET /api/sms-gateway/status
 * Returns server connection status, Android gateway health, last heartbeat, and telemetry.
 */
router.get('/status', requireAdmin, (req: Request, res: Response) => {
  try {
    const status = SmsGatewayService.getStatus();
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
 * 4. Test Connection Endpoint
 * POST /api/sms-gateway/test-connection
 * Can be called by:
 * - Android SMS Gateway: uses X-API-Key and X-Device-ID (EXACT same authentication as heartbeat)
 * - Admin Web UI: uses Authorization: Bearer <token>
 */
router.post('/test-connection', async (req: Request, res: Response) => {
  const hasGatewayApiKey = !!(
    req.headers['x-api-key'] ||
    req.headers['x-gateway-key'] ||
    req.headers['x-sms-key'] ||
    req.body?.apiKey
  );

  // If called by Android Gateway with API Key (or gateway headers)
  if (hasGatewayApiKey) {
    return requireGatewayAuth(req, res, () => {
      const incomingDeviceId = ((req.headers['x-device-id'] as string) || req.body?.deviceId || 'frosty-sms-gateway-01').trim();
      return res.status(200).json({
        ok: true,
        service: 'frosty-bite-sms-server',
        status: 'CONNECTED',
        auth: 'PASS',
        message: 'PING: PASS\nAUTHENTICATION: PASS\nSERVER: CONNECTED',
        deviceId: incomingDeviceId,
        serverTime: new Date().toISOString(),
        diagnostics: {
          serverApiKeyConfigured: 'YES',
          receivedApiKeyPresent: 'YES',
          deviceId: incomingDeviceId,
          httpStatus: 200
        }
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
        device: null,
        message: `Diagnostic test error: ${err.message || 'Unknown error'}`
      });
    }
  });
});

/**
 * 5. Create SMS Job in Queue
 * POST /api/sms-gateway/queue
 * Requires Gateway API Key or Admin Token.
 */
router.post('/queue', requireGatewayOrAdminAuth, async (req: Request, res: Response) => {
  try {
    const { to, message, type, orderId, priority } = req.body || {};

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: 'Missing recipient phone number'
      });
    }

    if (!message || (typeof message === 'string' && message.trim().length === 0)) {
      return res.status(400).json({
        ok: false,
        error: 'Message content cannot be empty'
      });
    }

    const result = await SmsGatewayService.createSmsJob({
      to,
      message,
      type,
      orderId,
      priority
    });

    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        error: result.error || 'Failed to queue SMS job'
      });
    }

    return res.status(200).json({
      ok: true,
      job: result.job
    });
  } catch (err: any) {
    console.error('[SMS Gateway] Error queuing SMS job:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: err.message || 'Failed to queue SMS'
    });
  }
});

/**
 * 6. Poll for Next Eligible SMS Job
 * GET /api/sms-gateway/poll
 * POST /api/sms-gateway/poll (supported for Android Gateway client compatibility)
 * Requires X-API-Key and X-Device-ID.
 */
const handlePoll = async (req: Request, res: Response) => {
  try {
    const incomingDeviceId = ((req.headers['x-device-id'] as string) || req.body?.deviceId || 'frosty-sms-gateway-01').trim();
    const result = await SmsGatewayService.pollNextJob(incomingDeviceId);

    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: 'Failed to poll SMS queue'
      });
    }

    const job = result.job;

    // Return hybrid response compatible with BOTH Android (messages array)
    // AND test/admin clients (job object)
    if (!job) {
      return res.status(200).json({
        ok: true,
        job: null,
        messages: []
      });
    }

    return res.status(200).json({
      ok: true,
      job: {
        id: job.id,
        to: job.to,
        message: job.message,
        type: job.type,
        orderId: job.orderId,
        attempts: job.attempts
      },
      messages: [
        {
          id: job.id,
          phoneNumber: job.to,
          message: job.message
        }
      ]
    });
  } catch (err: any) {
    console.error('[SMS Gateway] Error polling SMS job:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: err.message || 'Failed to poll queue'
    });
  }
};

router.get('/poll', requireGatewayAuth, handlePoll);
router.post('/poll', requireGatewayAuth, handlePoll);

/**
 * 7. Report SMS Delivery Result
 * POST /api/sms-gateway/report
 * Handled by Android Gateway after attempting SMS dispatch.
 * Requires X-API-Key and X-Device-ID.
 */
router.post('/report', requireGatewayAuth, async (req: Request, res: Response) => {
  try {
    const { jobId, messageId, status, details, errorCode, errorMessage } = req.body || {};
    const targetId = jobId || messageId;

    if (!targetId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing jobId or messageId'
      });
    }

    if (!status || !['SENT', 'FAILED'].includes(String(status).toUpperCase())) {
      return res.status(400).json({
        ok: false,
        error: "Invalid status. Must be 'SENT' or 'FAILED'"
      });
    }

    const deviceId = details?.deviceId || req.body?.deviceId || (req.headers['x-device-id'] as string) || 'frosty-sms-gateway-01';

    const result = await SmsGatewayService.reportJobResult({
      jobId: targetId,
      status: String(status).toUpperCase() as 'SENT' | 'FAILED',
      deviceId: String(deviceId).trim(),
      errorCode,
      errorMessage
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[SMS Gateway] Error reporting SMS result:', err);
    return res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: err.message || 'Failed to process SMS report'
    });
  }
});

export default router;
