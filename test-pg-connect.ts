import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function testConnections() {
  const passwords = [
    process.env.SUPABASE_DB_PASSWORD,
    process.env.POSTGRES_PASSWORD,
    'Restaurantbarkass@123',
    'Frostybite@123',
    'FrostyBite123',
    'wilsmmashfpgrxkknmle'
  ].filter(Boolean) as string[];

  const hosts = [
    'db.wilsmmashfpgrxkknmle.supabase.co'
  ];

  for (const host of hosts) {
    for (const pw of passwords) {
      const user = 'postgres';
      const port = 5432;
      const connStr = `postgres://${user}:${encodeURIComponent(pw)}@${host}:${port}/postgres`;
      try {
        console.log(`Testing ${host}:${port} with user ${user}...`);
        const client = new Client({
          connectionString: connStr,
          connectionTimeoutMillis: 5000,
          ssl: { rejectUnauthorized: false }
        });
        await client.connect();
        console.log(`✅ CONNECTED TO POSTGRES! host: ${host}, password matched: ${pw}`);
        const res = await client.query('SELECT version();');
        console.log('PostgreSQL version:', res.rows[0].version);
        await client.end();
        return connStr;
      } catch (err: any) {
        console.log(`❌ Failed (${host}):`, err.message);
      }
    }
  }
}

testConnections();
