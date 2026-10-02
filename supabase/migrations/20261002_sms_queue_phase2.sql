-- ============================================================================
-- Frosty Bite SMS Queue Migration
-- Run this in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. Create ENUM types for status and message type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sms_job_status') THEN
        CREATE TYPE sms_job_status AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sms_job_type') THEN
        CREATE TYPE sms_job_type AS ENUM (
            'OTP', 'ORDER_RECEIVED', 'ORDER_ACCEPTED', 'ORDER_PREPARING',
            'OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'FEEDBACK', 'PROMOTIONAL', 'TEST'
        );
    END IF;
END $$;

-- 2. Create SMS queue table
CREATE TABLE IF NOT EXISTS sms_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "to"            TEXT NOT NULL,
    message         TEXT NOT NULL,
    type            sms_job_type NOT NULL DEFAULT 'TEST',
    order_id        TEXT,
    priority        INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 0 AND priority <= 10),
    status          sms_job_status NOT NULL DEFAULT 'QUEUED',
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 3,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at      TIMESTAMPTZ,
    claimed_by      TEXT,
    lease_until     TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    error_code      TEXT,
    error_message   TEXT
);

-- 3. Indexes for efficient polling
CREATE INDEX IF NOT EXISTS idx_sms_queue_poll
    ON sms_queue (status, priority DESC, created_at ASC)
    WHERE status = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_sms_queue_lease_recovery
    ON sms_queue (status, lease_until)
    WHERE status = 'SENDING';

CREATE INDEX IF NOT EXISTS idx_sms_queue_dedup
    ON sms_queue (order_id, type, "to")
    WHERE order_id IS NOT NULL AND status IN ('QUEUED', 'SENDING', 'SENT');

CREATE INDEX IF NOT EXISTS idx_sms_queue_order_id
    ON sms_queue (order_id)
    WHERE order_id IS NOT NULL;

-- 4. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_sms_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_queue_updated_at ON sms_queue;
CREATE TRIGGER trg_sms_queue_updated_at
    BEFORE UPDATE ON sms_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_sms_queue_updated_at();

-- 5. Atomic claim function (prevents duplicate SMS sending)
CREATE OR REPLACE FUNCTION claim_next_sms_job(
    p_device_id TEXT,
    p_lease_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
    job_id UUID,
    job_to TEXT,
    job_message TEXT,
    job_type sms_job_type,
    job_order_id TEXT,
    job_attempts INTEGER
) AS $$
DECLARE
    v_job_id UUID;
    v_now TIMESTAMPTZ := now();
    v_lease_until TIMESTAMPTZ := now() + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
    -- Step 1: Recover expired leases
    UPDATE sms_queue
    SET status = 'QUEUED',
        claimed_at = NULL,
        claimed_by = NULL,
        lease_until = NULL
    WHERE status = 'SENDING'
      AND lease_until IS NOT NULL
      AND lease_until < v_now
      AND attempts < max_attempts;

    -- Mark jobs that exceeded max_attempts as FAILED
    UPDATE sms_queue
    SET status = 'FAILED',
        failed_at = v_now,
        error_code = 'MAX_ATTEMPTS_EXCEEDED',
        error_message = 'Maximum retry attempts reached after lease expiry'
    WHERE status = 'SENDING'
      AND lease_until IS NOT NULL
      AND lease_until < v_now
      AND attempts >= max_attempts;

    -- Step 2: Atomically claim one QUEUED job
    SELECT sq.id INTO v_job_id
    FROM sms_queue sq
    WHERE sq.status = 'QUEUED'
    ORDER BY sq.priority DESC, sq.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    -- Step 3: Transition QUEUED -> SENDING
    UPDATE sms_queue
    SET status = 'SENDING',
        claimed_at = v_now,
        claimed_by = p_device_id,
        lease_until = v_lease_until,
        attempts = attempts + 1
    WHERE id = v_job_id;

    -- Step 4: Return claimed job
    RETURN QUERY
    SELECT sq.id, sq."to", sq.message, sq.type, sq.order_id, sq.attempts
    FROM sms_queue sq
    WHERE sq.id = v_job_id;
END;
$$ LANGUAGE plpgsql;

-- 6. RLS policies
ALTER TABLE sms_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON sms_queue;
CREATE POLICY "Service role full access"
    ON sms_queue FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON sms_queue TO service_role;
GRANT USAGE ON TYPE sms_job_status TO service_role;
GRANT USAGE ON TYPE sms_job_type TO service_role;
