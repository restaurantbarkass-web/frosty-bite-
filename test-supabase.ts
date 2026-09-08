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

  console.log('Fetching active app_settings records:');
  const { data: sysSettings, error: sysErr } = await client.from('app_settings').select('*').eq('id', '1').maybeSingle();
  if (sysErr) {
    console.error('Fetch app_settings row Error:', sysErr);
  } else {
    console.log('Successfully fetched app_settings row:', sysSettings);
  }

  console.log('Fetching service_pincodes records:');
  const { data: pins, error: pinErr } = await client.from('service_pincodes').select('*').limit(3);
  if (pinErr) {
    console.error('Fetch service_pincodes Error:', pinErr);
  } else {
    console.log('Successfully fetched service_pincodes:', pins);
  }

  console.log('Fetching products records:');
  const { data: prods, error: prodErr } = await client.from('products').select('*').limit(1);
  if (prodErr) {
    console.error('Fetch products Error:', prodErr);
  } else {
    console.log('Successfully fetched products:', prods);
    if (prods && prods.length > 0) {
      console.log('Product columns:', Object.keys(prods[0]));
      // Try calling run_sql, exec_sql or execute_sql
      for (const rpcName of ['exec_sql', 'run_sql', 'execute_sql']) {
        console.log(`Trying ${rpcName}...`);
        const { data, error } = await client.rpc(rpcName, { sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS estimated_delivery_time INTEGER DEFAULT 30;' });
        if (error) {
          console.log(`Failed ${rpcName}:`, error.message);
        } else {
          console.log(`✅ Success with ${rpcName}!`);
          break;
        }
      }
    }
  }
}

run();
