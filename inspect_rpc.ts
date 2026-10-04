import dotenv from 'dotenv';
dotenv.config();

async function checkRpcFunctions() {
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
  const paths = Object.keys(json.paths || {}).filter(p => p.startsWith('/rpc/'));
  console.log('Available RPC paths in Supabase:', paths);
}

checkRpcFunctions().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
