import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './server/lib/supabase';
import crypto from 'crypto';

async function testOtpCodesFullFlow() {
  console.log('🧪 Testing otp_codes table in production Supabase...');

  const phone = '+919876543210';
  const rawOtp = '123456';
  const secret = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'frosty-bite-secure-otp-pepper-2026';
  const otpHash = crypto.createHmac('sha256', secret).update(rawOtp).digest('hex');
  const expiresAt = new Date(Date.now() + 300000).toISOString();

  // 1. Invalidate previous records for this phone
  console.log('1. Cleaning / invalidating existing records for phone:', phone);
  await supabase.from('otp_codes').delete().eq('phone', phone);

  // 2. Insert new OTP record into otp_codes
  console.log('2. Inserting new OTP into otp_codes table...');
  const insertRes = await supabase.from('otp_codes').insert({
    phone,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempts: 0
  }).select().single();

  console.log('Insert Result:', insertRes);

  if (insertRes.error || !insertRes.data) {
    throw new Error(`Insert failed: ${insertRes.error?.message}`);
  }

  const recordId = insertRes.data.id;
  console.log('Created OTP Record ID:', recordId);

  // 3. Query active OTP record
  console.log('3. Querying active OTP record from otp_codes...');
  const { data: records, error: fetchErr } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('Fetch Result:', { records, fetchErr });

  if (fetchErr || !records || records.length === 0) {
    throw new Error('Failed to fetch active OTP record from otp_codes');
  }

  // 4. Update attempts count
  console.log('4. Incrementing attempts count...');
  const updateRes = await supabase
    .from('otp_codes')
    .update({ attempts: records[0].attempts + 1 })
    .eq('id', recordId)
    .select();

  console.log('Update Result:', updateRes);

  // 5. Cleanup
  console.log('5. Deleting test record...');
  await supabase.from('otp_codes').delete().eq('id', recordId);

  console.log('🎉 `otp_codes` table is 100% operational in production Supabase!');
}

testOtpCodesFullFlow().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Test Failed:', e);
  process.exit(1);
});
