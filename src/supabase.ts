import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wilsmmashfpgrxkknmle.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM';

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
