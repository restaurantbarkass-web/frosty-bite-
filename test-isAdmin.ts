import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const supabaseUrl = (process.env.VITE_SUPABASE_URL || 'https://wilsmmashfpgrxkknmle.supabase.co').replace(/\/rest\/v1\/?$/, '');

const defaultServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU0NjAwMywiZXhwIjoyMDkzMTIyMDAzfQ.3Ogc0oVn7lmZ1VKNrX-M0nx9MzUSp1mVgmCf_VaMymo';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM';

const keyToUse = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || defaultServiceKey || defaultAnonKey;

async function run() {
  console.log('Sanitized Supabase URL:', supabaseUrl);
  console.log('keyToUse matches VITE_SUPABASE_ANON_KEY?', keyToUse === process.env.VITE_SUPABASE_ANON_KEY);
  console.log('keyToUse matches defaultServiceKey?', keyToUse === defaultServiceKey);
  console.log('keyToUse matches defaultAnonKey?', keyToUse === defaultAnonKey);

  const client = createClient(supabaseUrl, keyToUse);
  const { data, error } = await client.from('users').select('role').limit(1);
  if (error) {
    console.log('❌ Attempt with default keyToUse failed:', error.message);
  } else {
    console.log('✅ Attempt with default keyToUse succeeded! Data:', data);
  }

  const clientWithDefaultServiceKey = createClient(supabaseUrl, defaultServiceKey);
  const { data: data2, error: error2 } = await clientWithDefaultServiceKey.from('users').select('role').limit(1);
  if (error2) {
    console.log('❌ Attempt with defaultServiceKey failed:', error2.message);
  } else {
    console.log('✅ Attempt with defaultServiceKey succeeded! Data:', data2);
  }

  const clientWithDefaultAnonKey = createClient(supabaseUrl, defaultAnonKey);
  const { data: data3, error: error3 } = await clientWithDefaultAnonKey.from('users').select('role').limit(1);
  if (error3) {
    console.log('❌ Attempt with defaultAnonKey failed:', error3.message);
  } else {
    console.log('✅ Attempt with defaultAnonKey succeeded! Data:', data3);
  }
}

run();
