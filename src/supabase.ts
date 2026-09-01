import { createClient } from '@supabase/supabase-js';
import { safeTrim } from './utils/string';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: unknown): url is string => {
  if (!url || typeof url !== 'string') return false;
  const t = safeTrim(url);
  if (!t.startsWith('https://') && !t.startsWith('http://')) return false;
  if (t.includes('placeholder.supabase.co')) return false;
  return true;
};

const isValidKey = (key: unknown): key is string => {
  if (!key || typeof key !== 'string') return false;
  const t = safeTrim(key);
  if (t === '' || t.includes('your_') || t.includes('PLACEHOLDER') || t.includes('placeholder')) return false;
  return t.startsWith('eyJ');
};

export const isSupabaseConfigured = isValidUrl(rawUrl) && isValidKey(rawAnonKey);

let supabaseUrl = isSupabaseConfigured ? safeTrim(rawUrl) : 'https://unconfigured.supabase.co';
let supabaseAnonKey = isSupabaseConfigured ? safeTrim(rawAnonKey) : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.unconfigured';

if (!isSupabaseConfigured) {
  console.warn('[Supabase] VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing or invalid. Running in unconfigured client mode.');
} else {
  supabaseUrl = supabaseUrl.replace(/https?:\/\/https?:\/\//g, 'https://');
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, '');
  supabaseUrl = supabaseUrl.replace(/\/$/, '');
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
