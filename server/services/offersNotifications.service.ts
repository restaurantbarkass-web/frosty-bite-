import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabase } from '../lib/supabase';
import { SmsGatewayService } from './smsGateway.service';
import { NotificationService } from './notification.service';

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  customer_name: string;
  phone: string;
  email?: string;
  user_id?: string;
  channels: ('sms' | 'whatsapp' | 'push')[];
  sms_job_id?: string;
  sms_status: 'pending' | 'queued' | 'sent' | 'failed' | 'skipped';
  sms_sent_at?: string;
  whatsapp_status: 'pending' | 'opened' | 'sent' | 'skipped';
  whatsapp_opened_at?: string;
  whatsapp_sent_at?: string;
  whatsapp_prefilled_url?: string;
  whatsapp_message?: string;
  push_status: 'pending' | 'sent' | 'failed' | 'skipped';
  created_at: string;
  updated_at: string;
}

export interface NotificationCampaign {
  id: string;
  title: string;
  description: string;
  banner_image?: string;
  coupon_code?: string;
  discount_type: 'percentage' | 'fixed' | 'free_item';
  discount_value: number;
  min_order_amount: number;
  start_at: string;
  end_at: string;
  audience_type: 'all' | 'past_buyers' | 'vip' | 'inactive_7d' | 'new_30d';
  channels: ('sms' | 'whatsapp' | 'push')[];
  sms_template?: string;
  whatsapp_template?: string;
  push_title?: string;
  push_body?: string;
  push_link?: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  total_recipients: number;
  sms_queued_count: number;
  sms_sent_count: number;
  sms_failed_count: number;
  whatsapp_total_count: number;
  whatsapp_sent_count: number;
  whatsapp_skipped_count: number;
  push_sent_count: number;
  push_failed_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationJobLog {
  id: string;
  campaign_id?: string;
  channel: 'SMS' | 'WHATSAPP' | 'PUSH';
  recipient_phone?: string;
  recipient_name?: string;
  recipient_token?: string;
  title?: string;
  message: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED' | 'OPENED';
  attempts: number;
  error_message?: string;
  dispatched_at?: string;
  delivered_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ResolvedCustomer {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  user_id?: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate?: string;
  createdAt: string;
  isVip: boolean;
  isPastBuyer: boolean;
  isInactive7d: boolean;
  isNew30d: boolean;
}

const LOCAL_STORE_FILE = path.join(os.tmpdir(), 'frosty_offers_notifications_backup.json');

class OffersNotificationsServiceClass {
  private campaigns: Map<string, NotificationCampaign> = new Map();
  private recipients: Map<string, CampaignRecipient[]> = new Map();
  private jobs: NotificationJobLog[] = [];

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(LOCAL_STORE_FILE)) {
        const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.campaigns)) {
          data.campaigns.forEach((c: NotificationCampaign) => this.campaigns.set(c.id, c));
        }
        if (data.recipients && typeof data.recipients === 'object') {
          for (const [campId, list] of Object.entries(data.recipients)) {
            if (Array.isArray(list)) {
              this.recipients.set(campId, list as CampaignRecipient[]);
            }
          }
        }
        if (Array.isArray(data.jobs)) {
          this.jobs = data.jobs;
        }
      }
    } catch (_) {}
  }

  private saveToDisk() {
    try {
      const serializedRecipients: Record<string, CampaignRecipient[]> = {};
      for (const [campId, list] of this.recipients.entries()) {
        serializedRecipients[campId] = list;
      }
      const data = {
        campaigns: Array.from(this.campaigns.values()),
        recipients: serializedRecipients,
        jobs: this.jobs.slice(-1000), // retain latest 1000 jobs
        updated_at: new Date().toISOString()
      };
      fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (_) {}
  }

  /**
   * Phone number normalization utility ensuring E.164 +91 format for India
   */
  public normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = String(phone).replace(/[^0-9]/g, '');

    if (digits.length === 10) {
      return `+91${digits}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    } else if (digits.length >= 10 && digits.length <= 15) {
      return `+${digits}`;
    }
    return null;
  }

  /**
   * Helper to format masked phone numbers (e.g., +91 98765 ••••10)
   */
  public maskPhone(phone?: string | null): string {
    if (!phone) return '••••••••••';
    const clean = phone.trim();
    if (clean.length < 6) return '••••••';
    const prefix = clean.slice(0, Math.min(6, clean.length - 4));
    const suffix = clean.slice(-2);
    return `${prefix} •••• ${suffix}`;
  }

  /**
   * Resolves past customers across both orders and users tables, deduplicating by phone.
   */
  public async getResolvedCustomers(): Promise<ResolvedCustomer[]> {
    const customerMap = new Map<string, ResolvedCustomer>();
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // 1. Load users table
    try {
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .limit(1000);

      if (Array.isArray(users)) {
        users.forEach(u => {
          const rawPhone = u.phone || u.mobile || u.phone_number;
          const normalized = this.normalizePhone(rawPhone);
          const key = normalized || (u.id ? `user:${u.id}` : null);
          if (!key) return;

          const createdTs = u.created_at ? new Date(u.created_at).getTime() : now;
          const isNew30d = createdTs >= thirtyDaysAgo;

          customerMap.set(key, {
            id: u.id || `u-${Math.random()}`,
            name: u.full_name || u.name || 'Valued Customer',
            phone: rawPhone || '',
            normalizedPhone: normalized || '',
            email: u.email || '',
            user_id: u.id,
            orderCount: Number(u.total_orders) || 0,
            totalSpent: Number(u.lifetime_spend) || 0,
            lastOrderDate: u.last_order_at || undefined,
            createdAt: u.created_at || new Date().toISOString(),
            isVip: (Number(u.lifetime_spend) || 0) >= 500 || (Number(u.total_orders) || 0) >= 3,
            isPastBuyer: (Number(u.total_orders) || 0) > 0,
            isInactive7d: false,
            isNew30d
          });
        });
      }
    } catch (err) {
      console.warn('[OffersNotifications] users query warning:', err);
    }

    // 2. Load orders table to collect past buyers & guest customers
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, user_id, customer_name, customer_phone, phone, email, total, total_amount, created_at, status, address, delivery_address')
        .order('created_at', { ascending: false })
        .limit(2000);

      if (Array.isArray(orders)) {
        orders.forEach(o => {
          let rawPhone = o.phone || o.customer_phone;
          if (!rawPhone) {
            const combinedAddr = `${o.address || ''} ${o.delivery_address || ''}`;
            const phoneMatch = combinedAddr.match(/(?:phone|mob|contact|tel)?[:\s-]*([6-9]\d{9})\b/i);
            if (phoneMatch && phoneMatch[1]) {
              rawPhone = phoneMatch[1];
            }
          }
          const normalized = this.normalizePhone(rawPhone);
          const key = normalized || (o.user_id ? `user:${o.user_id}` : null) || (o.email ? `email:${o.email}` : null);
          if (!key) return;

          const orderAmount = Number(o.total || o.total_amount || 0);
          const orderTs = o.created_at ? new Date(o.created_at).getTime() : now;
          const orderDateStr = o.created_at || new Date().toISOString();

          if (customerMap.has(key)) {
            const existing = customerMap.get(key)!;
            existing.orderCount += 1;
            existing.totalSpent += orderAmount;
            if (!existing.lastOrderDate || new Date(existing.lastOrderDate).getTime() < orderTs) {
              existing.lastOrderDate = orderDateStr;
            }
            if (!existing.name || existing.name === 'Valued Customer') {
              existing.name = o.customer_name || existing.name;
            }
            if (!existing.email && o.email) {
              existing.email = o.email;
            }
            existing.isPastBuyer = true;
            existing.isVip = existing.totalSpent >= 500 || existing.orderCount >= 3;
            existing.isInactive7d = !!(existing.lastOrderDate && new Date(existing.lastOrderDate).getTime() < sevenDaysAgo);
          } else {
            const isInactive7d = orderTs < sevenDaysAgo;
            const isNew30d = orderTs >= thirtyDaysAgo;

            customerMap.set(key, {
              id: o.user_id || `guest-${o.id}`,
              name: o.customer_name || 'Valued Customer',
              phone: rawPhone || '',
              normalizedPhone: normalized || '',
              email: o.email || '',
              user_id: o.user_id,
              orderCount: 1,
              totalSpent: orderAmount,
              lastOrderDate: orderDateStr,
              createdAt: orderDateStr,
              isVip: orderAmount >= 500,
              isPastBuyer: true,
              isInactive7d,
              isNew30d
            });
          }
        });
      }
    } catch (err) {
      console.warn('[OffersNotifications] orders query warning:', err);
    }

    return Array.from(customerMap.values());
  }

  /**
   * Filter resolved customers based on audience type
   */
  public filterAudience(customers: ResolvedCustomer[], audienceType: NotificationCampaign['audience_type']): ResolvedCustomer[] {
    switch (audienceType) {
      case 'past_buyers':
        return customers.filter(c => c.isPastBuyer);
      case 'vip':
        return customers.filter(c => c.isVip);
      case 'inactive_7d':
        return customers.filter(c => c.isInactive7d);
      case 'new_30d':
        return customers.filter(c => c.isNew30d);
      case 'all':
      default:
        return customers;
    }
  }

  /**
   * Get dynamic audience counts for live wizard feedback
   */
  public async getAudiencePreview(audienceType: NotificationCampaign['audience_type'] = 'all'): Promise<{
    audienceType: string;
    totalCustomers: number;
    smsEligible: number;
    whatsappEligible: number;
    pushSubscribers: number;
    customers: Array<{
      id: string;
      name: string;
      maskedPhone: string;
      orderCount: number;
      totalSpent: number;
      isVip: boolean;
    }>;
  }> {
    const allCustomers = await this.getResolvedCustomers();
    const filtered = this.filterAudience(allCustomers, audienceType);

    const smsEligible = filtered.filter(c => !!c.normalizedPhone).length;
    const whatsappEligible = filtered.filter(c => !!c.normalizedPhone).length;

    // Get active push count
    let pushSubscribers = 0;
    try {
      const { count } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      pushSubscribers = count || 0;
    } catch (_) {}

    return {
      audienceType,
      totalCustomers: filtered.length,
      smsEligible,
      whatsappEligible,
      pushSubscribers,
      customers: filtered.slice(0, 10).map(c => ({
        id: c.id,
        name: c.name,
        maskedPhone: this.maskPhone(c.normalizedPhone || c.phone),
        orderCount: c.orderCount,
        totalSpent: c.totalSpent,
        isVip: c.isVip
      }))
    };
  }

  /**
   * Interpolate template variables
   */
  public interpolateTemplate(
    template: string,
    vars: {
      name?: string;
      code?: string;
      discount?: string;
      min_order?: string;
      link?: string;
      valid_until?: string;
    }
  ): string {
    let result = template;
    const map: Record<string, string> = {
      '{name}': vars.name || 'Valued Customer',
      '{code}': vars.code || 'SWEETDEAL',
      '{discount}': vars.discount || 'Special Offer',
      '{min_order}': vars.min_order || '0',
      '{link}': vars.link || 'https://frosty-bite.vercel.app',
      '{valid_until}': vars.valid_until || 'Soon'
    };

    for (const [key, val] of Object.entries(map)) {
      result = result.replace(new RegExp(key, 'gi'), val);
    }
    return result;
  }

  /**
   * Build prefilled WhatsApp URL (wa.me)
   */
  public buildWhatsAppUrl(phone: string, message: string): string {
    const digits = phone.replace(/[^0-9]/g, '');
    const cleanNumber = digits.startsWith('91') && digits.length === 12
      ? digits
      : (digits.length === 10 ? `91${digits}` : digits);
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Create and launch a promotional campaign across SMS, WhatsApp, and Push
   */
  public async createCampaign(payload: {
    title: string;
    description?: string;
    banner_image?: string;
    coupon_code?: string;
    discount_type?: 'percentage' | 'fixed' | 'free_item';
    discount_value?: number;
    min_order_amount?: number;
    start_at?: string;
    end_at: string;
    audience_type: NotificationCampaign['audience_type'];
    channels: ('sms' | 'whatsapp' | 'push')[];
    sms_template?: string;
    whatsapp_template?: string;
    push_title?: string;
    push_body?: string;
    push_link?: string;
    executeImmediately?: boolean;
    createdBy?: string;
  }): Promise<{ campaign: NotificationCampaign; recipientsCount: number; message: string }> {
    const nowIso = new Date().toISOString();
    const campaignId = `camp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const cleanCode = payload.coupon_code ? payload.coupon_code.trim().toUpperCase() : undefined;
    const discountValue = Number(payload.discount_value) || 0;
    const discountType = payload.discount_type || 'percentage';
    const minOrder = Number(payload.min_order_amount) || 0;
    const discountStr = discountType === 'percentage'
      ? `${discountValue}% OFF`
      : (discountType === 'fixed' ? `Flat ₹${discountValue} OFF` : 'Free Gift Item');

    const formattedExpiry = new Date(payload.end_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    // 1. Sync coupon into coupons table so users can checkout with this code immediately
    if (cleanCode) {
      try {
        await supabase.from('coupons').upsert({
          id: `coupon-${campaignId}`,
          code: cleanCode,
          type: discountType,
          value: discountValue,
          min_order: minOrder,
          expiry_date: payload.end_at.split('T')[0],
          usage_limit: 10000,
          usage_count: 0,
          status: 'active',
          is_hidden: false,
          created_at: nowIso
        }, { onConflict: 'code' });
      } catch (couponErr) {
        console.warn('[OffersNotifications] Coupon sync warning:', couponErr);
      }
    }

    // 2. Resolve audience
    const allCustomers = await this.getResolvedCustomers();
    const filteredCustomers = this.filterAudience(allCustomers, payload.audience_type);

    const defaultSmsTpl = `Frosty Bite Bakery: Enjoy {discount} on your order! Use code {code} at checkout. Order now: {link}`;
    const defaultWaTpl = `Hello {name} 👋\n\nTreat yourself with {discount} at Frosty Bite Bakery! 🍰\n\nUse code: *{code}*\nValid until: {valid_until}\n\n👉 Order online:\n{link}\n\n— Frosty Bite Bakery`;

    const smsTemplate = payload.sms_template || defaultSmsTpl;
    const whatsappTemplate = payload.whatsapp_template || defaultWaTpl;
    const pushTitle = payload.push_title || payload.title;
    const pushBody = payload.push_body || `Special Offer: ${discountStr} at Frosty Bite Bakery! Use code ${cleanCode || ''}`;
    const pushLink = payload.push_link || 'https://frosty-bite.vercel.app';

    // 3. Create Campaign record
    const campaign: NotificationCampaign = {
      id: campaignId,
      title: payload.title.trim(),
      description: payload.description || '',
      banner_image: payload.banner_image,
      coupon_code: cleanCode,
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrder,
      start_at: payload.start_at || nowIso,
      end_at: payload.end_at,
      audience_type: payload.audience_type,
      channels: payload.channels,
      sms_template: smsTemplate,
      whatsapp_template: whatsappTemplate,
      push_title: pushTitle,
      push_body: pushBody,
      push_link: pushLink,
      status: 'active',
      total_recipients: filteredCustomers.length,
      sms_queued_count: 0,
      sms_sent_count: 0,
      sms_failed_count: 0,
      whatsapp_total_count: 0,
      whatsapp_sent_count: 0,
      whatsapp_skipped_count: 0,
      push_sent_count: 0,
      push_failed_count: 0,
      created_by: payload.createdBy || 'admin',
      created_at: nowIso,
      updated_at: nowIso
    };

    // 4. Generate recipients and queue SMS / WhatsApp / Push
    const recipientRecords: CampaignRecipient[] = [];
    const hasSms = payload.channels.includes('sms');
    const hasWhatsApp = payload.channels.includes('whatsapp');
    const hasPush = payload.channels.includes('push');

    for (const customer of filteredCustomers) {
      const recipientId = `recip-${campaignId}-${Math.random().toString(36).substring(2, 9)}`;
      const customerName = customer.name || 'Valued Customer';
      const phone = customer.normalizedPhone || customer.phone;

      // Interpolate templates
      const personalizedSms = this.interpolateTemplate(smsTemplate, {
        name: customerName,
        code: cleanCode,
        discount: discountStr,
        min_order: `₹${minOrder}`,
        link: pushLink,
        valid_until: formattedExpiry
      });

      const personalizedWa = this.interpolateTemplate(whatsappTemplate, {
        name: customerName,
        code: cleanCode,
        discount: discountStr,
        min_order: `₹${minOrder}`,
        link: pushLink,
        valid_until: formattedExpiry
      });

      const prefilledWaUrl = phone ? this.buildWhatsAppUrl(phone, personalizedWa) : undefined;

      const recipientItem: CampaignRecipient = {
        id: recipientId,
        campaign_id: campaignId,
        customer_name: customerName,
        phone,
        email: customer.email,
        user_id: customer.user_id,
        channels: payload.channels,
        sms_status: hasSms && phone ? 'pending' : 'skipped',
        whatsapp_status: hasWhatsApp && phone ? 'pending' : 'skipped',
        whatsapp_prefilled_url: prefilledWaUrl,
        whatsapp_message: personalizedWa,
        push_status: hasPush ? 'pending' : 'skipped',
        created_at: nowIso,
        updated_at: nowIso
      };

      // Queue SMS via Android SMS Gateway
      if (hasSms && phone) {
        try {
          const smsResult = await SmsGatewayService.queueSms({
            recipient: phone,
            message: personalizedSms,
            type: 'PROMOTIONAL',
            priority: 'NORMAL',
            idempotencyKey: `camp:${campaignId}:sms:${phone}`
          });

          if (smsResult.ok) {
            recipientItem.sms_status = 'queued';
            recipientItem.sms_job_id = smsResult.job?.id;
            campaign.sms_queued_count += 1;

            this.logJob({
              id: `job-sms-${recipientId}`,
              campaign_id: campaignId,
              channel: 'SMS',
              recipient_phone: phone,
              recipient_name: customerName,
              message: personalizedSms,
              status: 'QUEUED',
              attempts: 0,
              metadata: { jobId: smsResult.job?.id }
            });
          } else {
            recipientItem.sms_status = 'failed';
            campaign.sms_failed_count += 1;
          }
        } catch (smsErr) {
          console.warn('[OffersNotifications] SMS queue error for recipient:', smsErr);
          recipientItem.sms_status = 'failed';
          campaign.sms_failed_count += 1;
        }
      }

      // Prepare WhatsApp message (NEVER AUTO-SENT - stored in WhatsApp queue for admin review)
      if (hasWhatsApp && phone) {
        campaign.whatsapp_total_count += 1;
        this.logJob({
          id: `job-wa-${recipientId}`,
          campaign_id: campaignId,
          channel: 'WHATSAPP',
          recipient_phone: phone,
          recipient_name: customerName,
          message: personalizedWa,
          status: 'QUEUED',
          attempts: 0,
          metadata: { prefilledUrl: prefilledWaUrl }
        });
      }

      recipientRecords.push(recipientItem);
    }

    // 5. Broadcast Push Notification to active subscribers
    if (hasPush) {
      try {
        const pushResult = await NotificationService.sendCampaign({
          title: pushTitle,
          message: pushBody,
          audience: 'all',
          deepLink: pushLink,
          imageUrl: payload.banner_image
        });

        if (pushResult.success) {
          campaign.push_sent_count = pushResult.sentCount;
          campaign.push_failed_count = pushResult.failedCount;

          this.logJob({
            id: `job-push-${campaignId}`,
            campaign_id: campaignId,
            channel: 'PUSH',
            title: pushTitle,
            message: pushBody,
            status: 'SENT',
            attempts: 1,
            dispatched_at: nowIso,
            delivered_at: nowIso,
            metadata: {
              sentCount: pushResult.sentCount,
              failedCount: pushResult.failedCount
            }
          });
        }
      } catch (pushErr) {
        console.warn('[OffersNotifications] Push broadcast warning:', pushErr);
      }
    }

    // 6. Save in memory and disk
    this.campaigns.set(campaignId, campaign);
    this.recipients.set(campaignId, recipientRecords);
    this.saveToDisk();

    // 7. Persist to Supabase relational tables if available
    try {
      await supabase.from('notification_campaigns').insert(campaign);
      if (recipientRecords.length > 0) {
        // Chunk inserts by 50 to prevent packet size limits
        for (let i = 0; i < recipientRecords.length; i += 50) {
          await supabase.from('notification_campaign_recipients').insert(recipientRecords.slice(i, i + 50));
        }
      }
    } catch (dbErr) {
      console.warn('[OffersNotifications] Database insert warning (store backup retained):', dbErr);
    }

    return {
      campaign,
      recipientsCount: recipientRecords.length,
      message: `Campaign "${campaign.title}" created successfully! SMS queued: ${campaign.sms_queued_count}, WhatsApp prepared: ${campaign.whatsapp_total_count}, Push sent: ${campaign.push_sent_count}`
    };
  }

  /**
   * Log a notification job in unified logs
   */
  private logJob(job: Partial<NotificationJobLog> & { id: string; channel: 'SMS' | 'WHATSAPP' | 'PUSH'; message: string }) {
    const nowIso = new Date().toISOString();
    const entry: NotificationJobLog = {
      id: job.id,
      campaign_id: job.campaign_id,
      channel: job.channel,
      recipient_phone: job.recipient_phone,
      recipient_name: job.recipient_name,
      recipient_token: job.recipient_token,
      title: job.title,
      message: job.message,
      status: job.status || 'QUEUED',
      attempts: job.attempts || 0,
      error_message: job.error_message,
      dispatched_at: job.dispatched_at,
      delivered_at: job.delivered_at,
      metadata: job.metadata || {},
      created_at: nowIso,
      updated_at: nowIso
    };

    this.jobs.unshift(entry);
    if (this.jobs.length > 1000) {
      this.jobs = this.jobs.slice(0, 1000);
    }

    // Try Supabase insert
    supabase.from('notification_jobs').insert(entry).then(() => {}).catch(() => {});
  }

  /**
   * Get all campaigns with dynamic calculation of totals
   */
  public async getCampaigns(options: {
    status?: string;
    limit?: number;
  } = {}): Promise<NotificationCampaign[]> {
    let list: NotificationCampaign[] = [];

    // Try fetching from database first
    try {
      let query = supabase.from('notification_campaigns').select('*').order('created_at', { ascending: false });
      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
      if (options.limit) {
        query = query.limit(options.limit);
      }
      const { data } = await query;
      if (Array.isArray(data) && data.length > 0) {
        list = data;
      }
    } catch (_) {}

    // Fallback to in-memory store
    if (list.length === 0) {
      list = Array.from(this.campaigns.values());
      if (options.status && options.status !== 'all') {
        list = list.filter(c => c.status === options.status);
      }
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (options.limit) {
        list = list.slice(0, options.limit);
      }
    }

    return list;
  }

  /**
   * Update campaign status: 'paused', 'active', 'cancelled'
   */
  public async updateCampaignStatus(campaignId: string, status: NotificationCampaign['status']): Promise<NotificationCampaign | null> {
    const nowIso = new Date().toISOString();
    const camp = this.campaigns.get(campaignId);
    if (camp) {
      camp.status = status;
      camp.updated_at = nowIso;
      this.campaigns.set(campaignId, camp);
      this.saveToDisk();
    }

    try {
      await supabase
        .from('notification_campaigns')
        .update({ status, updated_at: nowIso })
        .eq('id', campaignId);
    } catch (_) {}

    return camp || null;
  }

  /**
   * Fetch WhatsApp message queue for admin review and one-by-one sending
   */
  public async getWhatsAppQueue(options: {
    campaignId?: string;
    status?: 'all' | 'pending' | 'opened' | 'sent' | 'skipped';
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    items: CampaignRecipient[];
    total: number;
    pendingCount: number;
    sentCount: number;
    skippedCount: number;
    page: number;
    limit: number;
  }> {
    const { campaignId, status = 'all', search, page = 1, limit = 50 } = options;
    let allRecipients: CampaignRecipient[] = [];

    if (campaignId && this.recipients.has(campaignId)) {
      allRecipients = this.recipients.get(campaignId) || [];
    } else {
      for (const list of this.recipients.values()) {
        allRecipients.push(...list);
      }
    }

    // Try Supabase fetch if empty
    if (allRecipients.length === 0) {
      try {
        let q = supabase.from('notification_campaign_recipients').select('*');
        if (campaignId) q = q.eq('campaign_id', campaignId);
        const { data } = await q.limit(500);
        if (Array.isArray(data)) {
          allRecipients = data;
        }
      } catch (_) {}
    }

    // Only recipients with WhatsApp enabled
    let waRecipients = allRecipients.filter(r => r.whatsapp_prefilled_url || r.channels.includes('whatsapp'));

    const pendingCount = waRecipients.filter(r => r.whatsapp_status === 'pending').length;
    const sentCount = waRecipients.filter(r => r.whatsapp_status === 'sent').length;
    const skippedCount = waRecipients.filter(r => r.whatsapp_status === 'skipped').length;

    if (status !== 'all') {
      waRecipients = waRecipients.filter(r => r.whatsapp_status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      waRecipients = waRecipients.filter(r =>
        (r.customer_name?.toLowerCase() || '').includes(q) ||
        (r.phone || '').includes(q)
      );
    }

    const offset = (page - 1) * limit;
    const paginated = waRecipients.slice(offset, offset + limit);

    return {
      items: paginated,
      total: waRecipients.length,
      pendingCount,
      sentCount,
      skippedCount,
      page,
      limit
    };
  }

  /**
   * Update WhatsApp recipient action ('opened', 'mark_sent', 'skip')
   */
  public async handleWhatsAppAction(recipientId: string, action: 'open' | 'mark_sent' | 'skip'): Promise<{
    success: boolean;
    recipient?: CampaignRecipient;
    message: string;
  }> {
    const nowIso = new Date().toISOString();
    let targetRecipient: CampaignRecipient | null = null;
    let targetCampId: string | null = null;

    // Search in-memory
    for (const [campId, list] of this.recipients.entries()) {
      const found = list.find(r => r.id === recipientId);
      if (found) {
        targetRecipient = found;
        targetCampId = campId;
        break;
      }
    }

    if (!targetRecipient) {
      // Fallback query database
      try {
        const { data } = await supabase
          .from('notification_campaign_recipients')
          .select('*')
          .eq('id', recipientId)
          .maybeSingle();
        if (data) targetRecipient = data;
      } catch (_) {}
    }

    if (!targetRecipient) {
      return { success: false, message: 'Recipient not found' };
    }

    if (action === 'open') {
      targetRecipient.whatsapp_status = 'opened';
      targetRecipient.whatsapp_opened_at = nowIso;
    } else if (action === 'mark_sent') {
      targetRecipient.whatsapp_status = 'sent';
      targetRecipient.whatsapp_sent_at = nowIso;
      if (targetCampId) {
        const camp = this.campaigns.get(targetCampId);
        if (camp) camp.whatsapp_sent_count += 1;
      }
    } else if (action === 'skip') {
      targetRecipient.whatsapp_status = 'skipped';
      if (targetCampId) {
        const camp = this.campaigns.get(targetCampId);
        if (camp) camp.whatsapp_skipped_count += 1;
      }
    }
    targetRecipient.updated_at = nowIso;

    this.saveToDisk();

    try {
      await supabase
        .from('notification_campaign_recipients')
        .update({
          whatsapp_status: targetRecipient.whatsapp_status,
          whatsapp_opened_at: targetRecipient.whatsapp_opened_at,
          whatsapp_sent_at: targetRecipient.whatsapp_sent_at,
          updated_at: nowIso
        })
        .eq('id', recipientId);
    } catch (_) {}

    return {
      success: true,
      recipient: targetRecipient,
      message: `WhatsApp status updated to ${targetRecipient.whatsapp_status}`
    };
  }

  /**
   * Search and filter delivery logs
   */
  public async getDeliveryLogs(options: {
    channel?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    logs: NotificationJobLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { channel, status, search, page = 1, limit = 50 } = options;
    let list = [...this.jobs];

    // Merge with live SMS gateway logs if SMS channel selected or all
    if (!channel || channel === 'SMS') {
      try {
        const gwStatus = await SmsGatewayService.getStatus();
        if (Array.isArray(gwStatus.logs)) {
          gwStatus.logs.forEach((gl, idx) => {
            list.push({
              id: `gw-log-${idx}-${gl.timestamp}`,
              channel: 'SMS',
              message: gl.message,
              status: gl.type === 'SMS_SENT' ? 'SENT' : (gl.type === 'SMS_FAILED' ? 'FAILED' : 'QUEUED'),
              attempts: 1,
              created_at: gl.timestamp,
              updated_at: gl.timestamp,
              metadata: gl.details
            });
          });
        }
      } catch (_) {}
    }

    if (channel && channel !== 'all') {
      list = list.filter(l => l.channel.toUpperCase() === channel.toUpperCase());
    }

    if (status && status !== 'all') {
      list = list.filter(l => l.status.toUpperCase() === status.toUpperCase());
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.recipient_name?.toLowerCase() || '').includes(q) ||
        (l.recipient_phone || '').includes(q) ||
        (l.message || '').includes(q)
      );
    }

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const offset = (page - 1) * limit;
    const paginated = list.slice(offset, offset + limit);

    return {
      logs: paginated,
      total: list.length,
      page,
      limit
    };
  }

  /**
   * Retry an individual failed SMS or Push job
   */
  public async retryJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) {
      return { success: false, message: 'Job not found' };
    }

    if (job.channel === 'SMS' && job.recipient_phone) {
      const res = await SmsGatewayService.queueSms({
        recipient: job.recipient_phone,
        message: job.message,
        type: 'PROMOTIONAL',
        priority: 'HIGH',
        idempotencyKey: `retry:${jobId}:${Date.now()}`
      });
      if (res.ok) {
        job.status = 'QUEUED';
        job.attempts = (job.attempts || 0) + 1;
        job.updated_at = new Date().toISOString();
        this.saveToDisk();
        return { success: true, message: 'SMS job re-queued successfully!' };
      }
    }

    return { success: false, message: 'Unable to retry job' };
  }

  /**
   * Get overview stats for the main dashboard
   */
  public async getOverviewStats(): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    totalReach: number;
    smsSent: number;
    smsQueued: number;
    smsFailed: number;
    whatsappPrepared: number;
    whatsappSent: number;
    pushDelivered: number;
    smsGateway: {
      status: 'ONLINE' | 'OFFLINE';
      deviceId: string;
      simReady: boolean;
      smsReady: boolean;
      batteryLevel?: number;
      lastHeartbeat: string | null;
    };
    pushSubscribers: number;
  }> {
    const campaigns = await this.getCampaigns();
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

    let smsSent = 0;
    let smsQueued = 0;
    let smsFailed = 0;
    let whatsappPrepared = 0;
    let whatsappSent = 0;
    let pushDelivered = 0;
    let totalReach = 0;

    campaigns.forEach(c => {
      smsSent += c.sms_sent_count || 0;
      smsQueued += c.sms_queued_count || 0;
      smsFailed += c.sms_failed_count || 0;
      whatsappPrepared += c.whatsapp_total_count || 0;
      whatsappSent += c.whatsapp_sent_count || 0;
      pushDelivered += c.push_sent_count || 0;
      totalReach += c.total_recipients || 0;
    });

    // Gateway status
    let gwDevice: any = null;
    let gwGatewayStatus: 'ONLINE' | 'OFFLINE' = 'ONLINE';
    let gwHeartbeat: string | null = null;
    try {
      const gwStatus = await SmsGatewayService.getStatus();
      gwDevice = gwStatus.device;
      gwGatewayStatus = gwStatus.gateway;
      gwHeartbeat = gwStatus.lastHeartbeat;
    } catch (_) {}

    // Push subscribers
    let pushSubscribers = 0;
    try {
      const { count } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      pushSubscribers = count || 0;
    } catch (_) {}

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns,
      totalReach,
      smsSent,
      smsQueued,
      smsFailed,
      whatsappPrepared,
      whatsappSent,
      pushDelivered,
      smsGateway: {
        status: gwGatewayStatus,
        deviceId: gwDevice?.deviceId || 'frosty-sms-gateway-01',
        simReady: gwDevice?.simReady ?? false,
        smsReady: gwDevice?.smsReady ?? false,
        batteryLevel: gwDevice?.batteryLevel,
        lastHeartbeat: gwHeartbeat
      },
      pushSubscribers
    };
  }
}

export const OffersNotificationsService = new OffersNotificationsServiceClass();
