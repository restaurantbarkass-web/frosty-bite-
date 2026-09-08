import dotenv from 'dotenv';
dotenv.config();

const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const url = `${baseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')}/rest/v1/`;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!baseUrl || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

async function parseOpenApi() {
  const res = await fetch(url, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });
  const openapi = await res.json();
  console.log('OpenAPI Title:', openapi.info?.title);
  const paths = Object.keys(openapi.paths || {});
  console.log('Available Paths Count:', paths.length);
  const rpcPaths = paths.filter(p => p.startsWith('/rpc/'));
  console.log('RPC Paths:', rpcPaths);
  const tablePaths = paths.filter(p => !p.startsWith('/rpc/'));
  console.log('Table Paths:', tablePaths);
}

parseOpenApi();
