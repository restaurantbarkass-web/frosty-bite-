import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    let supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wilsmmashfpgrxkknmle.supabase.co';

    // Sanitize URL: @supabase/supabase-js expects the base URL.
    if (supabaseUrl) {
      // Fix double https://
      supabaseUrl = supabaseUrl.replace(/https?:\/\/https?:\/\//g, 'https://');
      // Remove /rest/v1/ suffix
      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, '');
      // Ensure no trailing slash
      supabaseUrl = supabaseUrl.replace(/\/$/, '');
    }

    const defaultServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU0NjAwMywiZXhwIjoyMDkzMTIyMDAzfQ.3Ogc0oVn7lmZ1VKNrX-M0nx9MzUSp1mVgmCf_VaMymo';
    const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM';
    
    const isValidKey = (key: any): boolean => {
      if (!key || typeof key !== 'string') return false;
      const t = key.trim();
      return t !== '' && !t.includes('your_') && !t.includes('PLACEHOLDER') && t.startsWith('eyJ');
    };

    const supabaseServiceKey = [
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      defaultServiceKey,
      process.env.VITE_SUPABASE_ANON_KEY,
      defaultAnonKey
    ].find(isValidKey) || defaultServiceKey;

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
