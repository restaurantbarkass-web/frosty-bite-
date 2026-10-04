import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';

async function testPgPorts() {
  const projectRef = 'wilsmmashfpgrxkknmle';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const connectionStrings = [
    `postgres://postgres.${projectRef}:${serviceKey}@db.${projectRef}.supabase.co:5432/postgres`,
    `postgres://postgres.${projectRef}:${serviceKey}@db.${projectRef}.supabase.co:6543/postgres`,
    `postgres://postgres:${serviceKey}@db.${projectRef}.supabase.co:5432/postgres`,
    `postgres://postgres:${serviceKey}@db.${projectRef}.supabase.co:6543/postgres`,
    `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-asia-southeast1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${serviceKey}@aws-0-asia-southeast1.pooler.supabase.com:5432/postgres`
  ];

  for (const connStr of connectionStrings) {
    console.log('Testing PG connection:', connStr.replace(serviceKey, '[KEY]'));
    const client = new pg.Client({
      connectionString: connStr,
      connectionTimeoutMillis: 3000,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('SUCCESS! Connected to Postgres!');

      const sql = `
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

      await client.query(sql);
      console.log('DDL Migration executed successfully!');
      await client.end();
      return true;
    } catch (err: any) {
      console.log('Connection failed:', err.message);
      try { await client.end(); } catch (_) {}
    }
  }
  return false;
}

testPgPorts().then((ok) => {
  console.log('Migration result:', ok ? 'SUCCESS' : 'FAILED');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
