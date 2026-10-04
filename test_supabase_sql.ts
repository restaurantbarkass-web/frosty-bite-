import dotenv from 'dotenv';
dotenv.config();

async function testCleanSqlEndpoints() {
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  // Extract base URL e.g. https://wilsmmashfpgrxkknmle.supabase.co
  const match = rawUrl.match(/https?:\/\/[^\/]+/);
  const baseUrl = match ? match[0] : rawUrl;

  console.log('Project Base URL:', baseUrl);

  const endpoints = [
    `${baseUrl}/pg_meta/v1/query`,
    `${baseUrl}/api/v1/query`,
    `${baseUrl}/sql`
  ];

  const ddlSql = `
    CREATE TABLE IF NOT EXISTS public.otp_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone TEXT NOT NULL,
        purpose TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        verified_at TIMESTAMPTZ NULL,
        invalidated_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        request_id UUID NOT NULL,
        metadata JSONB NULL
    );

    CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone ON public.otp_verifications(phone);
    CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone_purpose ON public.otp_verifications(phone, purpose);
    CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON public.otp_verifications(expires_at);
    CREATE INDEX IF NOT EXISTS idx_otp_verifications_request_id ON public.otp_verifications(request_id);

    ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Deny Public Access to OTP Verifications" ON public.otp_verifications;
    CREATE POLICY "Deny Public Access to OTP Verifications" ON public.otp_verifications FOR ALL USING (false) WITH CHECK (false);

    NOTIFY pgrst, 'reload schema';
  `;

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({ query: ddlSql, sql: ddlSql })
      });
      const text = await res.text();
      console.log(`Endpoint ${ep} -> Status ${res.status}:`, text.slice(0, 300));
    } catch (err: any) {
      console.log(`Endpoint ${ep} error:`, err.message);
    }
  }
}

testCleanSqlEndpoints().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
