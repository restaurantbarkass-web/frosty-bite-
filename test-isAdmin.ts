import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.error('SUPABASE_URL or VITE_SUPABASE_URL is required.');
  process.exit(1);
}

async function run() {
  console.log('Sanitized Supabase URL:', supabaseUrl);

  if (serviceKey) {
    const clientWithServiceKey = createClient(supabaseUrl, serviceKey);
    const { data: data2, error: error2 } = await clientWithServiceKey.from('users').select('role').limit(1);
    if (error2) {
      console.log('❌ Attempt with serviceKey failed:', error2.message);
    } else {
      console.log('✅ Attempt with serviceKey succeeded! Data:', data2);
    }
  }

  if (anonKey) {
    const clientWithAnonKey = createClient(supabaseUrl, anonKey);
    const { data: data3, error: error3 } = await clientWithAnonKey.from('users').select('role').limit(1);
    if (error3) {
      console.log('❌ Attempt with anonKey failed:', error3.message);
    } else {
      console.log('✅ Attempt with anonKey succeeded! Data:', data3);
    }
  }
}

run();
