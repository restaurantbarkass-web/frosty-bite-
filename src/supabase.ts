import { createClient } from '@supabase/supabase-js';
import { safeTrim } from './utils/string';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUrl = (url: unknown): url is string => {
  if (!url || typeof url !== 'string') return false;
  const t = safeTrim(url);
  if (!t.startsWith('https://')) return false;
  if (t.includes('placeholder.supabase.co')) return false;
  if (import.meta.env.PROD && (t.includes('localhost') || t.includes('127.0.0.1'))) return false;
  return true;
};

const isValidKey = (key: unknown): key is string => {
  if (!key || typeof key !== 'string') return false;
  const t = safeTrim(key);
  if (t === '' || t.includes('your_') || t.includes('PLACEHOLDER') || t.includes('placeholder')) return false;
  return t.startsWith('eyJ');
};

if (!isValidUrl(rawUrl) || !isValidKey(rawAnonKey)) {
  const errorMsg = '[Supabase Configuration Error] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing or invalid in the frontend environment. Please configure valid Supabase production credentials.';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

let sanitizedUrl = safeTrim(rawUrl);
sanitizedUrl = sanitizedUrl.replace(/https?:\/\/https?:\/\//g, 'https://');
sanitizedUrl = sanitizedUrl.replace(/\/rest\/v1\/?$/i, '');
sanitizedUrl = sanitizedUrl.replace(/\/$/, '');

export const supabase = createClient(sanitizedUrl, safeTrim(rawAnonKey), {
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
