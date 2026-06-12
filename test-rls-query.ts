import { createClient } from '@supabase/supabase-js';

async function test() {
  const url = 'https://wilsmmashfpgrxkknmle.supabase.co';
  // Use service role key to be able to read system tables if possible
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU0NjAwMywiZXhwIjoyMDkzMTIyMDAzfQ.3Ogc0oVn7lmZ1VKNrX-M0nx9MzUSp1mVgmCf_VaMymo';
  const client = createClient(url, serviceKey);

  console.log('Testing general query to list public tables/policies...');
  
  // Try calling pg_policies view (often not exposed to PostgREST unless marked in public schema but let's see)
  const { data: polData, error: polErr } = await client.from('pg_policies').select('*');
  console.log('pg_policies data:', polData);
  console.log('pg_policies error:', polErr);
}

test();
