import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './server/lib/supabase';

async function checkAllTables() {
  const tables = [
    'otp_verifications',
    'whatsapp_otps',
    'otps',
    'payment_verification_events',
    'app_settings',
    'sms_queue',
    'users'
  ];

  for (const t of tables) {
    const res = await supabase.from(t).select('*').limit(1);
    if (res.error) {
      console.log(`Table '${t}': ERROR -> ${res.error.code} - ${res.error.message}`);
    } else {
      console.log(`Table '${t}': EXISTS (Data count: ${res.data?.length})`);
    }
  }
}

checkAllTables().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
