import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  let url = process.env.VITE_SUPABASE_URL || 'https://wilsmmashfpgrxkknmle.supabase.co';
  url = url.replace(/https?:\/\/https?:\/\//g, 'https://').replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const client = createClient(url, anonKey);

  console.log('--- SERVICE ZONES ---');
  const { data: zones } = await client.from('service_zones').select('id, city_name, is_active');
  console.log(zones);

  console.log('--- SERVICE PINCODES ---');
  const { data: pins } = await client.from('service_pincodes').select('id, pincode, active');
  console.log(pins);

  console.log('--- DELIVERY AREAS ---');
  const { data: areas } = await client.from('delivery_areas').select('id, area_name, pincode, is_deliverable');
  console.log(areas);
}

run();
