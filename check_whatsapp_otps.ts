import dotenv from 'dotenv';
dotenv.config();
import { supabase } from './server/lib/supabase';

async function checkWhatsappOtpsSchema() {
  const res = await supabase.from('whatsapp_otps').select('*').limit(5);
  console.log('whatsapp_otps table structure:', JSON.stringify(res, null, 2));
}

checkWhatsappOtpsSchema().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
