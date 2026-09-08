import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const passwords = [
    process.env.SUPABASE_DB_PASSWORD,
    process.env.POSTGRES_PASSWORD,
  ].filter(Boolean) as string[];
  const hosts = [
    process.env.SUPABASE_DB_HOST || process.env.POSTGRES_HOST
  ].filter(Boolean) as string[];

  let client;
  let connected = false;

  for (const host of hosts) {
    for (const pw of passwords) {
      const user = 'postgres';
      const port = 5432;
      const connStr = `postgres://${user}:${encodeURIComponent(pw)}@${host}:${port}/postgres`;
      try {
        console.log(`Testing ${host}:${port} with user ${user}...`);
        client = new Client({
          connectionString: connStr,
          connectionTimeoutMillis: 5000,
          ssl: { rejectUnauthorized: false }
        });
        await client.connect();
        connected = true;
        console.log(`✅ CONNECTED TO POSTGRES! host: ${host}`);
        break;
      } catch (err: any) {
        console.log(`❌ Failed (${host}):`, err.message);
      }
    }
    if (connected) break;
  }

  if (!connected || !client) {
    console.error('Failed to connect to database.');
    return;
  }

  try {
    const res = await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_single_waiting_attempt 
      ON public.payment_attempts (order_id) 
      WHERE status = 'waiting';
    `);
    console.log('✅ Unique index idx_single_waiting_attempt created successfully:', res);
  } catch (err) {
    console.error('❌ Failed to create unique index:', err);
  } finally {
    await client.end();
  }
}

run();
