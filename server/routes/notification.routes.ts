import express, { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import admin, { getAdminDb } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';

const router = express.Router();

/**
 * Authorization Guard Middleware for Protected Notification Trigger Endpoints
 * Verifies Bearer Auth tokens or API Keys when configured.
 */
const requireNotificationAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] || req.headers['x-notification-secret'];
  const expectedSecret = process.env.NOTIFICATION_SECRET_KEY || process.env.INTERNAL_API_KEY;

  // 1. If explicit API key / secret header matches environment
  if (expectedSecret && apiKey === expectedSecret) {
    return next();
  }

  // 2. If Bearer Token provided, verify with Supabase Auth
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        (req as any).user = user;
        return next();
      }
    } catch (_) {}
  }

  // 3. Fallback for non-enforced development & preview sandbox environments
  if (process.env.NODE_ENV !== 'production' || !expectedSecret) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Protected notification trigger endpoint requires valid auth token or API key' });
};

/**
 * Register a device / browser push token
 */
router.post('/register-token', async (req, res) => {
  try {
    const { token, userId, guestSessionId, platform, browser, deviceName, endpoint } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing device token' });
    }

    const result = await NotificationService.registerToken({
      token,
      userId,
      guestSessionId,
      platform,
      browser,
      deviceName,
      endpoint
    });

    // Also store token in Firestore/Supabase user record if userId is provided
    if (userId && userId !== 'guest') {
      try {
        const dbInstance = getAdminDb();
        const userRef = dbInstance.collection('users').doc(userId);
        const doc = await userRef.get();
        let tokens: string[] = [];
        if (doc.exists) {
          tokens = doc.data()?.fcm_tokens || [];
        }
        if (!tokens.includes(token)) {
          tokens.push(token);
          await userRef.set({ fcm_tokens: tokens }, { merge: true });
        }
      } catch (_) {}
    }

    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Notification Route] Error in register-token:', error);
    return res.status(500).json({ error: error.message || 'Failed to register token' });
  }
});

/**
 * Unregister / deactivate a token
 */
router.post('/unregister-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (token) {
      await NotificationService.unregisterToken(token);
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Protected Order Notification Trigger Endpoint
 * Secure, Idempotent notification dispatcher for order status changes
 */
router.post('/send-order-notification', requireNotificationAuth, async (req: Request, res: Response) => {
  try {
    const { orderId, status, userId, guestSessionId, customReason, refundAmount, deliveryEta, eventVersion, idempotencyKey } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ error: 'Missing required parameters: orderId and status are required' });
    }

    const result = await NotificationService.sendOrderNotification({
      orderId,
      status,
      userId,
      guestSessionId,
      customReason,
      refundAmount,
      deliveryEta,
      eventVersion,
      idempotencyKey
    });

    return res.json(result);
  } catch (error: any) {
    console.error('[Notification Route] Error in send-order-notification:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch order notification' });
  }
});

/**
 * Authoritative Order Status Notification Trigger (Alias)
 */
router.post('/send-order-update', requireNotificationAuth, async (req: Request, res: Response) => {
  try {
    const { orderId, status, userId, guestSessionId, customReason, refundAmount, deliveryEta, eventVersion, idempotencyKey } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ error: 'Missing required parameters: orderId and status are required' });
    }

    const result = await NotificationService.sendOrderNotification({
      orderId,
      status,
      userId,
      guestSessionId,
      customReason,
      refundAmount,
      deliveryEta,
      eventVersion,
      idempotencyKey
    });

    return res.json(result);
  } catch (error: any) {
    console.error('[Notification Route] Error in send-order-update:', error);
    return res.status(500).json({ error: error.message || 'Failed to dispatch order status notification' });
  }
});

/**
 * Queue Non-Critical Order Notification Endpoint
 * Batches and schedules non-critical order status updates
 */
router.post('/queue-order-notification', requireNotificationAuth, async (req: Request, res: Response) => {
  try {
    const { orderId, status, userId, guestSessionId, customReason, refundAmount, deliveryEta, eventVersion, delayMs, batchKey } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ error: 'Missing required parameters: orderId and status are required' });
    }

    const result = await NotificationService.queueOrderNotification({
      orderId,
      status,
      userId,
      guestSessionId,
      customReason,
      refundAmount,
      deliveryEta,
      eventVersion,
      delayMs,
      batchKey
    });

    return res.json(result);
  } catch (error: any) {
    console.error('[Notification Route] Error in queue-order-notification:', error);
    return res.status(500).json({ error: error.message || 'Failed to queue order notification' });
  }
});

/**
 * Flush all currently queued batch notifications
 */
router.post('/flush-queued', requireNotificationAuth, async (_req: Request, res: Response) => {
  try {
    const result = await NotificationService.flushQueuedNotifications();
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Notification Route] Error flushing queued notifications:', error);
    return res.status(500).json({ error: error.message || 'Failed to flush queued notifications' });
  }
});

/**
 * Broadcast Campaign / Custom Push (Admin)
 */
router.post('/send-campaign', async (req, res) => {
  try {
    const { title, message, audience, targetUserId, deepLink, imageUrl } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const result = await NotificationService.sendCampaign({
      title,
      message,
      audience: audience || 'all',
      targetUserId,
      deepLink,
      imageUrl
    });

    return res.json(result);
  } catch (error: any) {
    console.error('[Notification Route] Error sending campaign:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Backward-compatible endpoint for sending direct push to a user
 */
router.post('/send-push', async (req, res) => {
  const { userId, title, body, data } = req.body;

  if (!userId || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields: userId, title, body' });
  }

  try {
    const tokens = await NotificationService.resolveTokensForTarget({ userId });

    if (tokens.length === 0) {
      return res.json({ success: true, message: 'No registered active tokens found for user' });
    }

    const result = await NotificationService.sendCampaign({
      title,
      message: body,
      audience: 'user',
      targetUserId: userId,
      deepLink: data?.link || '/'
    });

    return res.json({
      success: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount
    });
  } catch (error: any) {
    console.error('[Notification Route] Error in send-push:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Track Notification Open / Deep Link Click
 */
router.post('/track-click', async (req, res) => {
  try {
    const { eventId } = req.body;
    if (eventId) {
      await NotificationService.trackClick(eventId);
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger Frosty-Style Customer Re-Engagement Engine
 */
router.post('/trigger-reengagement', async (req, res) => {
  try {
    const { dryRun = false, forceUserId } = req.body;
    const result = await NotificationService.processReengagement({ dryRun, forceUserId });
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Notification Route] Error running re-engagement:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Get Notification Analytics Summary
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await NotificationService.getAnalyticsSummary();
    return res.json({ success: true, analytics });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Get Templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = NotificationService.getTemplates();
    return res.json({ success: true, templates });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Update Template
 */
router.put('/templates/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const updated = NotificationService.updateTemplate(type, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Template not found' });
    }
    return res.json({ success: true, template: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Get Notification Preferences
 */
router.get('/preferences', async (req, res) => {
  try {
    const { userId, guestSessionId } = req.query;
    const prefs = await NotificationService.getUserPreferences(
      userId as string,
      guestSessionId as string
    );
    return res.json({ success: true, preferences: prefs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Save Notification Preferences
 */
router.post('/preferences', async (req, res) => {
  try {
    const prefs = await NotificationService.savePreferences(req.body);
    return res.json({ success: true, preferences: prefs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Test Push Diagnostic Endpoint
 */
router.post('/test-push', async (req, res) => {
  try {
    const { token, title = 'Frosty Bite Test 🍰', body = 'Push notification system is working perfectly!' } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Missing token for test push' });
    }

    let sent = false;
    try {
      if (admin && admin.messaging) {
        await admin.messaging().send({
          token,
          notification: { title, body },
          webpush: {
            notification: {
              title,
              body,
              icon: '/logo.png'
            }
          }
        });
        sent = true;
      }
    } catch (e: any) {
      console.warn('[Test Push] FCM direct send returned:', e.message);
    }

    return res.json({ success: true, sent, message: 'Test notification triggered successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
