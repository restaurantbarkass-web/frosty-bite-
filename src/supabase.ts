import { createClient } from '@supabase/supabase-js';

import { safeTrim } from './utils/string';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidKey = (key: any): boolean => {
  if (!key || typeof key !== 'string') return false;
  const t = safeTrim(key);
  return t !== '' && !t.includes('your_') && !t.includes('PLACEHOLDER') && t.startsWith('eyJ');
};

const supabaseAnonKey = isValidKey(rawAnonKey) ? rawAnonKey : '';

// Sanitization for common configuration errors
if (supabaseUrl) {
  // Fix double https://
  supabaseUrl = supabaseUrl.replace(/https?:\/\/https?:\/\//g, 'https://');
  // Remove /rest/v1/ suffix
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, '');
  // Ensure no trailing slash
  supabaseUrl = supabaseUrl.replace(/\/$/, '');
} else {
  console.warn("[Supabase] VITE_SUPABASE_URL environment variable is missing.");
}

if (!supabaseAnonKey) {
  console.warn("[Supabase] VITE_SUPABASE_ANON_KEY environment variable is missing.");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-anon-key', {
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
