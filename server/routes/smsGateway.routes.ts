import express, { Request, Response, NextFunction } from 'express';
import { SmsGatewayService } from '../services/smsGateway.service';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * Authentication middleware for the physical Android SMS Gateway device.
 * Checks for API key in 'x-api-key', 'x-gateway-key', 'Authorization: Bearer <key>', or request body.
 */
const requireGatewayAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = (req.headers['x-api-key'] || req.headers['x-gateway-key'] || req.headers['x-sms-key']) as string | undefined;
  const bodyApiKey = req.body?.apiKey;

  let providedKey: string | undefined = undefined;

  if (apiKeyHeader) {
    providedKey = apiKeyHeader;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.split('Bearer ')[1]?.trim();
  } else if (bodyApiKey) {
    providedKey = String(bodyApiKey);
  }

  const isValid = SmsGatewayService.validateApiKey(providedKey);

  if (!isValid) {
    SmsGatewayService.addLog('AUTH_FAILURE', 'Unauthorized heartbeat request rejected (invalid or missing API key)', {
      ip: req.ip || req.headers['x-forwarded-for']
    });
    console.warn('[SMS Gateway] Heartbeat rejected: Invalid or missing API key');
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
      message: 'Invalid or missing SMS Gateway API key'
    });
  }

  next();
};

/**
 * 1. Android SMS Gateway Heartbeat Endpoint
 * Called periodically (e.g. every 15-30s) by the Android phone application.
 */
router.post('/heartbeat', requireGatewayAuth, async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

    const result = await SmsGatewayService.processHeartbeat(payload, clientIp);

    if (!result.ok) {
      return res.status(400).json(result);
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
 */
router.get('/ping', (req: Request, res: Response) => {
  return res.status(200).json({
    ok: true,
    service: 'frosty-bite-sms-server',
    status: 'CONNECTED',
    serverTime: new Date().toISOString()
  });
});

/**
 * 3. Connection Status Endpoint (Admin Only)
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
 * 4. Admin Diagnostic Test Connection Endpoint
 * Verifies end-to-end communication with the Android SMS Gateway without triggering any SMS.
 */
router.post('/test-connection', requireAdmin, async (req: Request, res: Response) => {
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

export default router;
