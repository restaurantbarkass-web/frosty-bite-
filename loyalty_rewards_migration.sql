-- ==============================================================================
-- FROSTY BITE BAKERY - COMPREHENSIVE LOYALTY & MYSTERY BOX SYSTEM MIGRATION
-- ==============================================================================

-- 1. LOYALTY SETTINGS
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    enabled BOOLEAN NOT NULL DEFAULT true,
    stamps_required INTEGER NOT NULL DEFAULT 5,
    eligible_order_statuses TEXT[] NOT NULL DEFAULT ARRAY['delivered', 'completed', 'dispatched'],
    minimum_order_amount NUMERIC NOT NULL DEFAULT 199,
    repeat_cycles_enabled BOOLEAN NOT NULL DEFAULT true,
    scratch_threshold NUMERIC NOT NULL DEFAULT 55,
    guaranteed_rewards_enabled BOOLEAN NOT NULL DEFAULT true,
    allocation_mode TEXT NOT NULL DEFAULT 'equal', -- 'equal', 'probability', 'fixed'
    fallback_action TEXT NOT NULL DEFAULT 'pause', -- 'pause', 'fallback_gift'
    fallback_prize_id TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default settings if empty
INSERT INTO public.loyalty_settings (id, enabled, stamps_required, minimum_order_amount)
VALUES ('default', true, 5, 199)
ON CONFLICT (id) DO NOTHING;

-- 2. REWARD PRIZES (ADMIN-CONTROLLED CATALOGUE)
CREATE TABLE IF NOT EXISTS public.reward_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    reward_type TEXT NOT NULL DEFAULT 'cupcake', -- 'cupcake', 'cookie', 'dessert', 'fixed_discount', 'percent_discount', 'product', 'custom'
    product_id TEXT, -- Optional link to real bakery menu item
    reward_value NUMERIC NOT NULL DEFAULT 100,
    stock_quantity INTEGER NOT NULL DEFAULT 50,
    active BOOLEAN NOT NULL DEFAULT true,
    validity_days INTEGER NOT NULL DEFAULT 30,
    redemption_rules TEXT DEFAULT 'Valid on orders above ₹299.',
    minimum_order_amount NUMERIC NOT NULL DEFAULT 0,
    redemption_type TEXT NOT NULL DEFAULT 'free_claim', -- 'free_claim', 'min_purchase'
    probability NUMERIC DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. LOYALTY LINKS (UNIQUE ORDER-SPECIFIC REDEMPTION TOKENS)
CREATE TABLE IF NOT EXISTS public.loyalty_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    customer_id TEXT,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'redeemed', 'expired', 'revoked'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_links_token ON public.loyalty_links(token);
CREATE INDEX IF NOT EXISTS idx_loyalty_links_order_id ON public.loyalty_links(order_id);

-- 4. LOYALTY STAMPS (ATOMIC STAMP AWARD WITH DUPLICATE PROTECTION)
CREATE TABLE IF NOT EXISTS public.loyalty_stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    order_id TEXT NOT NULL UNIQUE, -- Prevents awarding more than 1 stamp per order!
    loyalty_link_id UUID REFERENCES public.loyalty_links(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_stamps_customer ON public.loyalty_stamps(customer_id);

-- 5. SCRATCH REWARDS / MYSTERY BOX REWARDS
CREATE TABLE IF NOT EXISTS public.scratch_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    prize_id UUID REFERENCES public.reward_prizes(id) ON DELETE RESTRICT,
    unique_redemption_code TEXT NOT NULL UNIQUE,
    verification_code TEXT, -- 6-character code for Workflow A Free Claim verification
    link_token TEXT UNIQUE, -- Cryptographically secure unpredictable token for redemption link
    link_generated_at TIMESTAMP WITH TIME ZONE,
    link_expires_at TIMESTAMP WITH TIME ZONE,
    verification_status TEXT NOT NULL DEFAULT 'unverified', -- 'unverified', 'attempted', 'verified', 'failed'
    verification_attempts INTEGER NOT NULL DEFAULT 0, -- Anti-bruteforce protection
    whatsapp_status TEXT NOT NULL DEFAULT 'not_generated', -- 'not_generated', 'link_generated', 'whatsapp_opened', 'admin_confirmed_sent'
    whatsapp_opened_at TIMESTAMP WITH TIME ZONE,
    whatsapp_confirmed_at TIMESTAMP WITH TIME ZONE,
    page_visits_count INTEGER NOT NULL DEFAULT 0,
    last_page_visited_at TIMESTAMP WITH TIME ZONE,
    customer_type TEXT NOT NULL DEFAULT 'registered', -- 'registered', 'guest'
    customer_name TEXT,
    customer_contact TEXT,
    status TEXT NOT NULL DEFAULT 'assigned', -- 'available', 'assigned', 'reserved', 'opened', 'redeemed', 'expired', 'revoked'
    redemption_type TEXT NOT NULL DEFAULT 'free_claim', -- 'free_claim', 'min_purchase'
    redemption_method TEXT, -- 'whatsapp_link', 'checkout', 'in_store'
    order_id TEXT, -- Associated order if redeemed
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_at TIMESTAMP WITH TIME ZONE,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent column additions for existing installations
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS link_token TEXT;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS link_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS link_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified';
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'not_generated';
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS whatsapp_opened_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS whatsapp_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS page_visits_count INTEGER DEFAULT 0;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS last_page_visited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'registered';
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.scratch_rewards ADD COLUMN IF NOT EXISTS customer_contact TEXT;

CREATE INDEX IF NOT EXISTS idx_scratch_rewards_customer ON public.scratch_rewards(customer_id);
CREATE INDEX IF NOT EXISTS idx_scratch_rewards_code ON public.scratch_rewards(unique_redemption_code);
CREATE INDEX IF NOT EXISTS idx_scratch_rewards_vcode ON public.scratch_rewards(verification_code);
CREATE INDEX IF NOT EXISTS idx_scratch_rewards_token ON public.scratch_rewards(link_token);

-- 6. REDEMPTION AUDIT EVENTS
CREATE TABLE IF NOT EXISTS public.reward_redemption_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reward_id UUID REFERENCES public.scratch_rewards(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'reward_assigned', 'link_generated', 'link_revoked', 'whatsapp_opened', 'admin_confirmed_sent', 'page_visited', 'verification_attempt', 'verification_succeeded', 'verification_failed', 'order_created', 'order_cancelled', 'reward_redeemed', 'reward_expired', 'admin_action'
    actor TEXT NOT NULL DEFAULT 'system', -- 'admin', 'customer', 'system'
    customer_id TEXT,
    order_id TEXT,
    ip_address TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reward_redemption_events ADD COLUMN IF NOT EXISTS actor TEXT DEFAULT 'system';

-- Enable RLS
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scratch_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemption_events ENABLE ROW LEVEL SECURITY;

-- Read policies for public/authenticated users
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public can view loyalty settings" ON public.loyalty_settings;
    CREATE POLICY "Public can view loyalty settings" ON public.loyalty_settings FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Public can view active reward prizes" ON public.reward_prizes;
    CREATE POLICY "Public can view active reward prizes" ON public.reward_prizes FOR SELECT USING (active = true);

    DROP POLICY IF EXISTS "Customers can view own stamps" ON public.loyalty_stamps;
    CREATE POLICY "Customers can view own stamps" ON public.loyalty_stamps FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Customers can view own scratch rewards" ON public.scratch_rewards;
    CREATE POLICY "Customers can view own scratch rewards" ON public.scratch_rewards FOR SELECT USING (true);
END $$;
