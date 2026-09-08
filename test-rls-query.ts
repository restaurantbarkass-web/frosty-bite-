import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !serviceKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    return;
  }
  const client = createClient(url, serviceKey);

  console.log('Testing general query to list public tables/policies...');
  
  // Try calling pg_policies view (often not exposed to PostgREST unless marked in public schema but let's see)
  const { data: polData, error: polErr } = await client.from('pg_policies').select('*');
  console.log('pg_policies data:', polData);
  console.log('pg_policies error:', polErr);
}

test();
