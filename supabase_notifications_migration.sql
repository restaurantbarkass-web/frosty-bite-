-- ==============================================================================
-- Frosty Bite Push Notification Platform Migration
-- Tables: push_subscriptions, notification_events, notification_preferences, notification_templates
-- ==============================================================================

-- 1. Push Subscriptions Table (Device & Browser Tokens for Auth and Guest Users)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    guest_session_id TEXT,
    device_token TEXT NOT NULL UNIQUE,
    platform TEXT DEFAULT 'web', -- web, android, ios, pwa
    browser TEXT,
    device_name TEXT,
    endpoint TEXT,
    is_active BOOLEAN DEFAULT true,
    permission_status TEXT DEFAULT 'granted',
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for lightning-fast token lookup and pruning
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_guest_session_id ON public.push_subscriptions (guest_session_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_token ON public.push_subscriptions (device_token);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON public.push_subscriptions (is_active);

-- 2. Notification Events Table (Idempotent Event Log & Analytics)
CREATE TABLE IF NOT EXISTS public.notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE, -- E.g. 'order:ORD123:preparing:v1' or 'reengagement:USR456:day_3'
    order_id TEXT,
    user_id TEXT,
    guest_session_id TEXT,
    notification_type TEXT NOT NULL, -- order_status, reengagement, campaign, system
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'sent', -- pending, sent, delivered, failed, skipped_cooldown, skipped_quiet_hours
    provider_message_id TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_events_event_key ON public.notification_events (event_key);
CREATE INDEX IF NOT EXISTS idx_notification_events_order_id ON public.notification_events (order_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_user_id ON public.notification_events (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_type ON public.notification_events (notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_created_at ON public.notification_events (created_at DESC);

-- 3. Notification Preferences Table (User and Guest granular opt-ins)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE,
    guest_session_id TEXT UNIQUE,
    order_updates BOOLEAN DEFAULT true,
    promotional_notifications BOOLEAN DEFAULT true,
    reengagement_notifications BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    quiet_hours_enabled BOOLEAN DEFAULT true,
    quiet_hours_start TEXT DEFAULT '23:00',
    quiet_hours_end TEXT DEFAULT '08:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_guest ON public.notification_preferences (guest_session_id);

-- 4. Notification Templates Table (Dynamic Brand Voice & Admin Customization)
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_type TEXT NOT NULL UNIQUE,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    emoji TEXT DEFAULT '🍰',
    image_url TEXT,
    deep_link TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed Default Frosty Bite Brand Templates
INSERT INTO public.notification_templates (notification_type, title_template, body_template, emoji, deep_link)
VALUES
    ('order_confirmed', 'Order Confirmed 🍰', 'Your sweet order #{{order_id}} is confirmed! Our bakers are getting ready.', '🍰', '/order-tracking/{{order_id}}'),
    ('order_preparing', 'Your order is being prepared 👨‍🍳', 'Our bakers are whipping up something delicious for order #{{order_id}} with love.', '👨‍🍳', '/order-tracking/{{order_id}}'),
    ('order_almost_ready', 'Almost Ready ✨', 'Your order #{{order_id}} is almost ready. Just adding the finishing sweet touches…', '✨', '/order-tracking/{{order_id}}'),
    ('order_ready', 'Your order is ready! 🎂', 'Your order #{{order_id}} is packed and ready. Your sweet moment awaits!', '🎂', '/order-tracking/{{order_id}}'),
    ('order_out_for_delivery', 'Out for Delivery 🛵', 'Your sweet surprise for order #{{order_id}} is on its way to you!', '🛵', '/order-tracking/{{order_id}}'),
    ('order_near_you', 'Almost there! 📍', 'Rider is almost at your doorstep with order #{{order_id}}.', '📍', '/order-tracking/{{order_id}}'),
    ('order_delivered', 'Delivered! 🤍', 'Order #{{order_id}} has arrived! We hope every bite makes you smile.', '🤍', '/order-tracking/{{order_id}}'),
    ('order_cancelled', 'Order Cancelled', 'Order #{{order_id}} was cancelled: {{reason}}', '❌', '/order-tracking/{{order_id}}'),
    ('order_refund', 'Refund Initiated 💳', 'Your refund for order #{{order_id}} of ₹{{amount}} has been initiated.', '💳', '/order-tracking/{{order_id}}'),
    ('reengagement_3d', 'Something sweet is missing… 🍰', 'We think it might be you! Come taste what is freshly baked today.', '🍰', '/'),
    ('reengagement_5d', 'Your dessert cravings called ✨', 'We answered! Explore our chef special pastries and cakes.', '✨', '/'),
    ('reengagement_7d', 'It has been a little while! 🎂', 'Your next sweet moment is waiting. Grab your favourite slice today.', '🎂', '/'),
    ('reengagement_10d', 'No pressure… but your cake misses you 💕', 'Treat yourself to something warm and delicious from Frosty Bite.', '💕', '/'),
    ('reengagement_14d', 'We haven’t seen you lately 👀', 'Should we tempt you with something delicious today?', '👀', '/'),
    ('reengagement_21d', 'New cravings unlocked! 🍓', 'Come see what is fresh in our bakery ovens this week.', '🍓', '/')
ON CONFLICT (notification_type) DO UPDATE SET
    title_template = EXCLUDED.title_template,
    body_template = EXCLUDED.body_template,
    emoji = EXCLUDED.emoji,
    deep_link = EXCLUDED.deep_link,
    updated_at = now();

-- Row Level Security (RLS) setup
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Allow public read of templates and preferences
CREATE POLICY "Public Read Notification Templates" ON public.notification_templates FOR SELECT USING (true);
CREATE POLICY "Public Manage Push Subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Manage Notification Events" ON public.notification_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Manage Notification Preferences" ON public.notification_preferences FOR ALL USING (true) WITH CHECK (true);
