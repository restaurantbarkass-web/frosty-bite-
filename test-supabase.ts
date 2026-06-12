import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  let url = process.env.VITE_SUPABASE_URL || 'https://wilsmmashfpgrxkknmle.supabase.co';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (url) {
    url = url.replace(/https?:\/\/https?:\/\//g, 'https://');
    url = url.replace(/\/rest\/v1\/?$/i, '');
    url = url.replace(/\/$/, '');
  }

  const client = createClient(url, anonKey);

  console.log('Fetching active service_zones records:');
  const { data, error } = await client.from('service_zones').select('*').limit(3);
  if (error) {
    console.error('Fetch service_zones Error:', error);
  } else {
    console.log('Successfully fetched service_zones:', data);
  }

  console.log('Fetching service_pincodes records:');
  const { data: pins, error: pinErr } = await client.from('service_pincodes').select('*').limit(3);
  if (pinErr) {
    console.error('Fetch service_pincodes Error:', pinErr);
  } else {
    console.log('Successfully fetched service_pincodes:', pins);
  }

  console.log('Fetching delivery_areas records:');
  const { data: areas, error: areaErr } = await client.from('delivery_areas').select('*').limit(3);
  if (areaErr) {
    console.error('Fetch delivery_areas Error:', areaErr);
  } else {
    console.log('Successfully fetched delivery_areas:', areas);
  }
}

run();
