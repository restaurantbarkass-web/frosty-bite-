import dotenv from 'dotenv';
dotenv.config();

async function testServiceRoleDdl() {
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const match = rawUrl.match(/https?:\/\/[^\/]+/);
  const baseUrl = match ? match[0] : rawUrl;

  console.log('Testing DDL with Service Role Key against:', baseUrl);

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

  // Test various PostgREST / Admin paths
  const paths = [
    '/rest/v1/rpc/exec_sql',
    '/rest/v1/rpc/exec',
    '/rest/v1/rpc/query',
    '/rest/v1/rpc/sql',
    '/pg/query',
    '/pg_meta/v1/query',
    '/api/v1/query',
    '/rest/v1/rpc/postgis_full_version'
  ];

  for (const p of paths) {
    try {
      const res = await fetch(`${baseUrl}${p}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({ query: ddlSql, sql: ddlSql })
      });
      const text = await res.text();
      console.log(`Path ${p} -> Status ${res.status}:`, text.slice(0, 150));
    } catch (e: any) {
      console.log(`Path ${p} fetch failed:`, e.message);
    }
  }
}

testServiceRoleDdl().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
