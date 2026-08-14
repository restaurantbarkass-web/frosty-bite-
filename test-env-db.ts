import dotenv from 'dotenv';
dotenv.config();

const url = 'https://wilsmmashfpgrxkknmle.supabase.co/rest/v1/';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU0NjAwMywiZXhwIjoyMDkzMTIyMDAzfQ.3Ogc0oVn7lmZ1VKNrX-M0nx9MzUSp1mVgmCf_VaMymo';

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
