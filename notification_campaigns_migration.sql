-- ==============================================================================
-- FROSTY BITE BAKERY: SMART OFFERS & MULTI-CHANNEL NOTIFICATION SYSTEM MIGRATION
-- ==============================================================================

-- 1. Promotional Notification Campaigns
CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  banner_image TEXT,
  coupon_code TEXT,
  discount_type TEXT DEFAULT 'percentage', -- 'percentage', 'fixed', 'free_item'
  discount_value NUMERIC DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0,
  start_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  end_at TIMESTAMPTZ NOT NULL,
  audience_type TEXT DEFAULT 'all', -- 'all', 'past_buyers', 'vip', 'inactive_7d', 'new_30d'
  channels JSONB NOT NULL DEFAULT '["sms", "whatsapp", "push"]'::jsonb,
  sms_template TEXT,
  whatsapp_template TEXT,
  push_title TEXT,
  push_body TEXT,
  push_link TEXT DEFAULT 'https://frosty-bite.vercel.app',
  status TEXT DEFAULT 'active', -- 'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'
  total_recipients INTEGER DEFAULT 0,
  sms_queued_count INTEGER DEFAULT 0,
  sms_sent_count INTEGER DEFAULT 0,
  sms_failed_count INTEGER DEFAULT 0,
  whatsapp_total_count INTEGER DEFAULT 0,
  whatsapp_sent_count INTEGER DEFAULT 0,
  whatsapp_skipped_count INTEGER DEFAULT 0,
  push_sent_count INTEGER DEFAULT 0,
  push_failed_count INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Campaign Recipients & Delivery Tracking
CREATE TABLE IF NOT EXISTS public.notification_campaign_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES public.notification_campaigns(id) ON DELETE CASCADE,
  customer_name TEXT,
  phone TEXT,
  email TEXT,
  user_id TEXT,
  channels JSONB NOT NULL DEFAULT '["sms", "whatsapp"]'::jsonb,
  sms_job_id TEXT,
  sms_status TEXT DEFAULT 'pending', -- 'pending', 'queued', 'sent', 'failed', 'skipped'
  sms_sent_at TIMESTAMPTZ,
  whatsapp_status TEXT DEFAULT 'pending', -- 'pending', 'opened', 'sent', 'skipped'
  whatsapp_opened_at TIMESTAMPTZ,
  whatsapp_sent_at TIMESTAMPTZ,
  whatsapp_prefilled_url TEXT,
  whatsapp_message TEXT,
  push_status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'skipped'
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. Unified Notification Jobs / Audit Logs
CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES public.notification_campaigns(id) ON DELETE SET NULL,
  channel TEXT NOT NULL, -- 'SMS', 'WHATSAPP', 'PUSH'
  recipient_phone TEXT,
  recipient_name TEXT,
  recipient_token TEXT,
  title TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_notif_camp_status ON public.notification_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_notif_camp_created ON public.notification_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_recip_camp ON public.notification_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notif_recip_wa_status ON public.notification_campaign_recipients(whatsapp_status);
CREATE INDEX IF NOT EXISTS idx_notif_jobs_channel ON public.notification_jobs(channel);
CREATE INDEX IF NOT EXISTS idx_notif_jobs_status ON public.notification_jobs(status);
CREATE INDEX IF NOT EXISTS idx_notif_jobs_created ON public.notification_jobs(created_at DESC);
