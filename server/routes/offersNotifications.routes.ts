import express, { Request, Response } from 'express';
import { requireAdmin } from '../middleware/auth';
import { OffersNotificationsService } from '../services/offersNotifications.service';
import { NotificationService } from '../services/notification.service';
import { SmsGatewayService } from '../services/smsGateway.service';

const router = express.Router();

/**
 * GET /overview
 * Overview stats for the dashboard header
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const stats = await OffersNotificationsService.getOverviewStats();
    res.json({ ok: true, stats });
  } catch (err: any) {
    console.error('[OffersNotifications] GET /overview error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to fetch overview stats' });
  }
});

/**
 * GET /audience-preview
 * Live audience sizing for the Create Offer wizard
 */
router.get('/audience-preview', async (req: Request, res: Response) => {
  try {
    const audienceType = (req.query.audience as any) || 'all';
    const preview = await OffersNotificationsService.getAudiencePreview(audienceType);
    res.json({ ok: true, preview });
  } catch (err: any) {
    console.error('[OffersNotifications] GET /audience-preview error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to calculate audience preview' });
  }
});

/**
 * GET /campaigns
 * List of promotional campaigns
 */
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const campaigns = await OffersNotificationsService.getCampaigns({ status });
    res.json({ ok: true, campaigns });
  } catch (err: any) {
    console.error('[OffersNotifications] GET /campaigns error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to fetch campaigns' });
  }
});

/**
 * POST /campaigns
 * Create a new offer campaign and queue SMS, WhatsApp, and Push
 */
router.post('/campaigns', requireAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.title || !body.end_at) {
      return res.status(400).json({ ok: false, error: 'Campaign title and end_at date are required' });
    }

    const adminUser = (req as any).user;
    const result = await OffersNotificationsService.createCampaign({
      title: body.title,
      description: body.description,
      banner_image: body.banner_image,
      coupon_code: body.coupon_code,
      discount_type: body.discount_type || 'percentage',
      discount_value: Number(body.discount_value) || 0,
      min_order_amount: Number(body.min_order_amount) || 0,
      start_at: body.start_at,
      end_at: body.end_at,
      audience_type: body.audience_type || 'all',
      channels: Array.isArray(body.channels) ? body.channels : ['sms', 'whatsapp', 'push'],
      sms_template: body.sms_template,
      whatsapp_template: body.whatsapp_template,
      push_title: body.push_title,
      push_body: body.push_body,
      push_link: body.push_link,
      executeImmediately: body.executeImmediately !== false,
      createdBy: adminUser?.email || adminUser?.id || 'admin'
    });

    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[OffersNotifications] POST /campaigns error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to create campaign' });
  }
});

/**
 * POST /campaigns/:id/status
 * Pause, resume, or cancel a campaign
 */
router.post('/campaigns/:id/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;
    if (!['active', 'paused', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid campaign status' });
    }

    const updated = await OffersNotificationsService.updateCampaignStatus(id, status);
    res.json({ ok: true, campaign: updated });
  } catch (err: any) {
    console.error('[OffersNotifications] POST /campaigns/:id/status error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to update campaign status' });
  }
});

/**
 * GET /whatsapp-queue
 * Paginated WhatsApp recipient queue for manual review & sending
 */
router.get('/whatsapp-queue', requireAdmin, async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    const status = (req.query.status as any) || 'all';
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);

    const result = await OffersNotificationsService.getWhatsAppQueue({
      campaignId,
      status,
      search,
      page,
      limit
    });

    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[OffersNotifications] GET /whatsapp-queue error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to fetch WhatsApp queue' });
  }
});

/**
 * POST /whatsapp-queue/:id/action
 * Mark WhatsApp message status: 'open', 'mark_sent', 'skip'
 */
router.post('/whatsapp-queue/:id/action', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { action } = req.body;

    if (!['open', 'mark_sent', 'skip'].includes(action)) {
      return res.status(400).json({ ok: false, error: 'Invalid action. Must be open, mark_sent, or skip' });
    }

    const result = await OffersNotificationsService.handleWhatsAppAction(id, action);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[OffersNotifications] POST /whatsapp-queue/:id/action error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to update WhatsApp action' });
  }
});

/**
 * GET /logs
 * Unified delivery audit logs
 */
router.get('/logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const channel = req.query.channel as string;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);

    const result = await OffersNotificationsService.getDeliveryLogs({
      channel,
      status,
      search,
      page,
      limit
    });

    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[OffersNotifications] GET /logs error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to fetch logs' });
  }
});

/**
 * POST /retry-job/:id
 * Retry an individual failed SMS/push job
 */
router.post('/retry-job/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const result = await OffersNotificationsService.retryJob(id);
    res.json({ ok: result.success, message: result.message });
  } catch (err: any) {
    console.error('[OffersNotifications] POST /retry-job/:id error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to retry job' });
  }
});

/**
 * POST /quick-push
 * Quick push notification broadcast to active web subscribers
 */
router.post('/quick-push', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, body, link, imageUrl } = req.body;
    if (!title || !body) {
      return res.status(400).json({ ok: false, error: 'Title and body are required' });
    }

    const result = await NotificationService.sendCampaign({
      title,
      message: body,
      audience: 'all',
      deepLink: link || 'https://frosty-bite.vercel.app',
      imageUrl
    });

    res.json({
      ok: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      message: `Push notification dispatched to ${result.sentCount} active subscriber(s)!`
    });
  } catch (err: any) {
    console.error('[OffersNotifications] POST /quick-push error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to dispatch quick push' });
  }
});

/**
 * GET /settings
 * Notification channel configurations & gateway status
 */
router.get('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const gwStatus = await SmsGatewayService.getStatus();
    res.json({
      ok: true,
      smsGateway: {
        deviceId: gwStatus.device?.deviceId || 'frosty-sms-gateway-01',
        status: gwStatus.gateway,
        simReady: gwStatus.device?.simReady ?? false,
        smsReady: gwStatus.device?.smsReady ?? false,
        batteryLevel: gwStatus.device?.batteryLevel,
        lastHeartbeat: gwStatus.lastHeartbeat,
        heartbeatEndpoint: '/api/sms-gateway/heartbeat',
        androidAppPackage: 'com.frostybite.smsgateway'
      },
      whatsApp: {
        defaultCountryCode: '+91',
        defaultSignOff: '— Frosty Bite Bakery 🍰',
        manualWorkflowEnforced: true,
        note: 'WhatsApp messages are generated as individual wa.me links for manual admin review. Auto-sending without customer opt-in is strictly prevented.'
      },
      push: {
        defaultUrl: 'https://frosty-bite.vercel.app',
        quietHours: '23:00 - 08:00',
        platform: 'Web Push / FCM'
      }
    });
  } catch (err: any) {
    console.error('[OffersNotifications] GET /settings error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to fetch settings' });
  }
});

export default router;
