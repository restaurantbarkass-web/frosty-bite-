-- ============================================================================
-- FROSTYPAY PAYMENT VERIFICATION SYSTEM (PHASE 2 - STEP 3)
-- DATABASE SCHEMA MIGRATION
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Create public.payment_verification_events table
CREATE TABLE IF NOT EXISTS public.payment_verification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    amount_paise BIGINT NOT NULL,
    upi_reference TEXT,
    source_package TEXT,
    source_type TEXT NOT NULL,
    transaction_time TIMESTAMPTZ DEFAULT now(),
    device_id TEXT NOT NULL,
    matched BOOLEAN DEFAULT false,
    processed BOOLEAN DEFAULT false,
    match_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ensure all columns exist idempotently if table already exists
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS amount_paise BIGINT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS upi_reference TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS source_package TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS transaction_time TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS matched BOOLEAN DEFAULT false;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS match_reason TEXT;
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payment_verification_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT now();

-- 3. Indexes for fast lookup and idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_verification_events_event_id ON public.payment_verification_events (event_id);
CREATE INDEX IF NOT EXISTS idx_payment_verification_events_upi_ref ON public.payment_verification_events (upi_reference);
CREATE INDEX IF NOT EXISTS idx_payment_verification_events_amount ON public.payment_verification_events (amount_paise);
CREATE INDEX IF NOT EXISTS idx_payment_verification_events_order_id ON public.payment_verification_events (order_id);

-- 4. Create public.payment_attempts table
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    amount_paise BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- waiting, matched, expired, cancelled
    upi_reference TEXT,
    expires_at TIMESTAMPTZ,
    matched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS amount_paise BIGINT;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS upi_reference TEXT;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payment_attempts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_payment_attempts_status_amount ON public.payment_attempts (status, amount_paise);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_id ON public.payment_attempts (order_id);

-- 5. Row Level Security & Policies
ALTER TABLE public.payment_verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Manage Payment Events" ON public.payment_verification_events;
CREATE POLICY "Service Role Manage Payment Events" ON public.payment_verification_events FOR ALL USING (true);

DROP POLICY IF EXISTS "Service Role Manage Payment Attempts" ON public.payment_attempts;
CREATE POLICY "Service Role Manage Payment Attempts" ON public.payment_attempts FOR ALL USING (true);

-- 6. Add Unique Constraint to prevent multiple active waiting attempts for a single order
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_waiting_attempt 
ON public.payment_attempts (order_id) 
WHERE status = 'waiting';
