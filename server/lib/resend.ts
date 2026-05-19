import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn('[Resend] RESEND_API_KEY is not defined. Email functionality will be disabled.');
}

// Resend might throw if apiKey is null/undefined in some versions, 
// so we provide a placeholder or handle it.
export const resend = new Resend(apiKey || 're_placeholder');
