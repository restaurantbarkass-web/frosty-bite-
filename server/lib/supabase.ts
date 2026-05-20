import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    let supabaseUrl = process.env.VITE_SUPABASE_URL || '';

    // Sanitize URL: @supabase/supabase-js expects the base URL. 
    if (supabaseUrl.endsWith('/rest/v1/')) {
      supabaseUrl = supabaseUrl.slice(0, -9);
    } else if (supabaseUrl.endsWith('/rest/v1')) {
      supabaseUrl = supabaseUrl.slice(0, -8);
    }

    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[Supabase Server] Warning: Missing Supabase environment variables during lazy initialization');
    }

    supabaseInstance = createClient(
      supabaseUrl,
      supabaseServiceKey
    );
  }
  return supabaseInstance;
}

// Export a Proxy that intercepts all property/method access on supabase to enforce lazy loading
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target: any, prop: string | symbol) => {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});
