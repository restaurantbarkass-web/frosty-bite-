import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const anonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!url || !anonKey) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY/SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const client = createClient(url, anonKey);

async function inventoryV1Data() {
  console.log('--- INVENTORY V1 DATA ---');

  // 1. service_zones / service_cities
  console.log('\n[service_zones]');
  const { data: zones, error: zErr } = await client.from('service_zones').select('*');
  if (zErr) console.error('Error fetching service_zones:', zErr);
  else {
    console.log(`Count: ${zones?.length || 0}`);
    console.log('Sample rows:', zones);
  }

  // 2. service_pincodes
  console.log('\n[service_pincodes]');
  const { data: pincodes, error: pErr } = await client.from('service_pincodes').select('*');
  if (pErr) console.error('Error fetching service_pincodes:', pErr);
  else {
    console.log(`Count: ${pincodes?.length || 0}`);
    console.log('Sample rows:', pincodes);
  }

  // 3. delivery_areas
  console.log('\n[delivery_areas]');
  const { data: areas, error: aErr } = await client.from('delivery_areas').select('*');
  if (aErr) console.error('Error fetching delivery_areas:', aErr);
  else {
    console.log(`Count: ${areas?.length || 0}`);
    console.log('Sample rows:', areas);
  }

  // 4. delivery_pincodes
  console.log('\n[delivery_pincodes]');
  const { data: delPins, error: dpErr } = await client.from('delivery_pincodes').select('*');
  if (dpErr) console.error('Error fetching delivery_pincodes:', dpErr);
  else {
    console.log(`Count: ${delPins?.length || 0}`);
    console.log('Sample rows:', delPins);
  }

  // 5. delivery_zones
  console.log('\n[delivery_zones]');
  const { data: delZones, error: dzErr } = await client.from('delivery_zones').select('*');
  if (dzErr) console.error('Error fetching delivery_zones:', dzErr);
  else {
    console.log(`Count: ${delZones?.length || 0}`);
    console.log('Sample rows:', delZones);
  }
}

inventoryV1Data();
