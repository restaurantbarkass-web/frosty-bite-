import dotenv from 'dotenv';
dotenv.config();

async function inspectDefinitions() {
  const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const match = rawUrl.match(/https?:\/\/[^\/]+/);
  const baseUrl = match ? match[0] : rawUrl;

  const res = await fetch(`${baseUrl}/rest/v1/`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });

  const json = await res.json();
  console.log('--- otp_codes definition ---');
  console.log(JSON.stringify(json.definitions?.otp_codes, null, 2));

  console.log('--- whatsapp_otps definition ---');
  console.log(JSON.stringify(json.definitions?.whatsapp_otps, null, 2));
}

inspectDefinitions().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
