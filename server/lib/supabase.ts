import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.VITE_SUPABASE_URL || '';

// Sanitize URL: @supabase/supabase-js expects the base URL. 
// If it contains /rest/v1/, remove it.
if (supabaseUrl.endsWith('/rest/v1/')) {
  supabaseUrl = supabaseUrl.slice(0, -9);
} else if (supabaseUrl.endsWith('/rest/v1')) {
  supabaseUrl = supabaseUrl.slice(0, -8);
}

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Supabase Server] Missing Supabase environment variables');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseServiceKey || ''
);
