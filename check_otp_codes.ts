import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './server/lib/supabase';

async function checkOtpCodesTable() {
  const res = await supabase.from('otp_codes').select('*').limit(5);
  console.log('otp_codes table structure/data:', JSON.stringify(res, null, 2));
}

checkOtpCodesTable().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
