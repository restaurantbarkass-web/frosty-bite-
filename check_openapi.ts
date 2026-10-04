import dotenv from 'dotenv';
dotenv.config();

async function checkOpenApi() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const res = await fetch(`${url}/`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });

  const json = await res.json();
  console.log('OpenAPI definitions / tables:', Object.keys(json.definitions || {}));
}

checkOpenApi().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
