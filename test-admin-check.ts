import express from 'express';

const ADMIN_EMAILS = [
  'restaurantbarkass@gmail.com',
  'wasifmd924@gmail.com',
  'sayedazainab216@gmail.com',
  'sayedazainabali76@gmail.com',
];

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      base64Url.length + (4 - (base64Url.length % 4)) % 4, '='
    );
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function getEmailFromArbitraryToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(jsonPayload);
    
    if (payload) {
      if (payload.email) {
        return payload.email;
      }
      if (payload.user_metadata && payload.user_metadata.email) {
        return payload.user_metadata.email;
      }
      if (payload.user && payload.user.email) {
        return payload.user.email;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Generate a valid-looking test token
const testPayload = {
  iss: 'https://securetoken.google.com/frostybite07',
  email: 'restaurantbarkass@gmail.com',
  user_id: 'test-user-123'
};
const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/=/g, '');
const payloadStr = Buffer.from(JSON.stringify(testPayload)).toString('base64').replace(/=/g, '');
const signature = 'securesig';
const token = `${header}.${payloadStr}.${signature}`;

console.log('Generated token:', token);
console.log('Decoded issuer matches firebase token issuer?', decodeJwtPayload(token)?.iss?.startsWith('https://securetoken.google.com/'));
console.log('Extracted email:', getEmailFromArbitraryToken(token));
console.log('Is email in ADMIN_EMAILS?', ADMIN_EMAILS.includes((getEmailFromArbitraryToken(token) || '').toLowerCase()));
