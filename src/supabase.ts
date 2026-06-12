import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wilsmmashfpgrxkknmle.supabase.co';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM';

const isValidKey = (key: any): boolean => {
  if (!key || typeof key !== 'string') return false;
  const t = key.trim();
  return t !== '' && !t.includes('your_') && !t.includes('PLACEHOLDER') && t.startsWith('eyJ');
};

const supabaseAnonKey = isValidKey(import.meta.env.VITE_SUPABASE_ANON_KEY) ? import.meta.env.VITE_SUPABASE_ANON_KEY : defaultAnonKey;

// Sanitization for common configuration errors
if (supabaseUrl) {
  // Fix double https://
  supabaseUrl = supabaseUrl.replace(/https?:\/\/https?:\/\//g, 'https://');
  // Remove /rest/v1/ suffix
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, '');
  // Ensure no trailing slash
  supabaseUrl = supabaseUrl.replace(/\/$/, '');
} else {
  console.error("Supabase URL is missing! Check your environment variables.");
}

if (!supabaseAnonKey) {
  console.error("Supabase Anon Key is missing! Check your environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Monkey-patch removeChannel to prevent unhandled promise rejections during websocket page transitions/teardowns
const originalRemoveChannel = supabase.removeChannel;
if (originalRemoveChannel) {
  supabase.removeChannel = function (channel: any) {
    try {
      const res = originalRemoveChannel.call(supabase, channel);
      if (res && typeof res.catch === 'function') {
        return res.catch((err: any) => {
          console.warn('[Supabase] Handled channel removal safely:', err);
          return 'error';
        });
      }
      return res;
    } catch (err) {
      console.warn('[Supabase] Handled channel removal exception safely:', err);
      return Promise.resolve('error');
    }
  };
}
