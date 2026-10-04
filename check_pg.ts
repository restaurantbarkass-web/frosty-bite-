import dotenv from 'dotenv';
dotenv.config();
import pg from 'pg';

async function testPgConnection() {
  console.log('Checking environment variables...');
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
  console.log('Found DB URL:', dbUrl ? 'YES (length ' + dbUrl.length + ')' : 'NO');

  if (dbUrl) {
    const client = new pg.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log('Connected to Postgres directly!');

      // Run DDL script to create public.otp_verifications
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

        -- Reload PostgREST schema cache
        NOTIFY pgrst, 'reload schema';
      `;

      console.log('Executing DDL migration for otp_verifications...');
      await client.query(sql);
      console.log('DDL migration executed successfully via pg!');
      await client.end();
    } catch (err: any) {
      console.error('pg Connection/Query Error:', err.message);
    }
  }
}

testPgConnection().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
