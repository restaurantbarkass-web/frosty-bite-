import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './server/lib/supabase';
import crypto from 'crypto';

async function testOtpCodesInsert() {
  const reqId = crypto.randomUUID();
  const res = await supabase.from('otp_codes').insert({
    phone: '+919876543210',
    otp_hash: 'samplehash123',
    expires_at: new Date(Date.now() + 300000).toISOString(),
    attempts: 0
  }).select();

  console.log('otp_codes insert result:', JSON.stringify(res, null, 2));

  if (res.data && res.data.length > 0) {
    await supabase.from('otp_codes').delete().eq('id', res.data[0].id);
    console.log('Test record cleaned up successfully!');
  }
}

testOtpCodesInsert().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
