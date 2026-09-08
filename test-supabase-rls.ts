import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function runDiagnostics() {
  let url = process.env.VITE_SUPABASE_URL || 'https://wilsmmashfpgrxkknmle.supabase.co';
  if (url) {
    url = url.replace(/https?:\/\/https?:\/\//g, 'https://');
    url = url.replace(/\/rest\/v1\/?$/i, '');
    url = url.replace(/\/$/, '');
  }
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    console.error('❌ Supabase URL or Anon Key is missing from environment variables.');
    return;
  }

  const client = createClient(url, anonKey);
  console.log('\n================================================================');
  console.log('🛡️  SUPABASE DATABASE & ROW LEVEL SECURITY (RLS) DIAGNOSTIC TOOL');
  console.log('================================================================');
  console.log(`📡 URL: ${url}`);
  console.log(`🔑 Key Type: Anonymous Client (Simulates Front-End / Web App user)\n`);

  const tablesToTest = [
    'users',
    'products',
    'orders',
    'riders',
    'wishlist',
    'coupons',
    'banners',
    'banner_clicks',
    'admins',
    'reviews',
    'otps',
    'cancellation_logs',
    'delivery_areas',
    'service_pincodes',
    'service_zones'
  ];

  console.log('Analyzing database tables through client REST queries...');
  console.log('------------------------------------------------------------------------------------------------------');
  console.log(
    ` ${'TABLE NAME'.padEnd(20)} | ${'SELECT STATUS'.padEnd(16)} | ${'INSERT STATUS'.padEnd(16)} | ${'UPDATE/DELETE RLS STATE'.padEnd(25)}`
  );
  console.log('------------------------------------------------------------------------------------------------------');

  for (const table of tablesToTest) {
    let selectStatus = '✅ Allowed';
    let insertStatus = '✅ Allowed';
    let rlsWarning = '🟢 Permissive / Bypassed';

    // 1. Test SELECT operation
    try {
      const { error } = await client.from(table).select('*').limit(1);
      if (error) {
        if (error.code === '42501') {
          selectStatus = '❌ Blocked (RLS)';
          rlsWarning = '🔴 RLS Enforced';
        } else if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.message.includes('schema cache')) {
          selectStatus = '❓ Not Found';
          rlsWarning = '⚠️ Missing Table';
        } else {
          selectStatus = `⚠️ Error ${error.code}`;
        }
      }
    } catch (e: any) {
      selectStatus = '💥 Unhandled';
    }

    // 2. Test INSERT operation (dry runs or triggers RLS check)
    try {
      // Send a single invalid or mostly-null insert to trigger schema or permission evaluation
      const { error } = await client.from(table).insert({ id: 'dummy_non_existent_id_for_rls_check' }).select();
      if (error) {
        if (error.code === '42501') {
          insertStatus = '❌ Blocked (RLS)';
          if (rlsWarning !== '⚠️ Missing Table') {
            rlsWarning = '🔴 RLS Enforced';
          }
        } else if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.message.includes('schema cache')) {
          insertStatus = '❓ Not Found';
        } else {
          // Other codes like 23505 (conflict) or required fields missing (23502) means INSERT got past RLS!
          insertStatus = '✅ Allowed';
        }
      }
    } catch (e: any) {
      insertStatus = '💥 Unhandled';
    }

    // 3. Print Row
    console.log(
      ` ${table.padEnd(20)} | ${selectStatus.padEnd(16)} | ${insertStatus.padEnd(16)} | ${rlsWarning}`
    );
  }

  console.log('------------------------------------------------------------------------------------------------------');

  console.log('\nChecking if get_rls_policies SQL function is installed...');
  try {
    const { data, error } = await client.rpc('get_rls_policies');
    if (error) {
      if (error.message && error.message.includes('does not exist')) {
        console.log('⚠️  Function public.get_rls_policies() not found in database.');
        console.log('💡 To list the precise policies, execute the SQL under the "Database RPC View Helper" section of the summary.');
      } else {
        console.log(`⚠️  RPC error: ${error.message} (Code: ${error.code})`);
      }
    } else if (data) {
      console.log('✅ Function found! Loaded precise active DB policies:');
      console.log(data);
    }
  } catch (e: any) {
    console.log('⚠️ Failed to query RPC helper function:', e.message);
  }

  console.log('\n================================================================');
  console.log('💡 RETROSPECTIVE & REMEDY PLANS');
  console.log('================================================================');
  console.log('1. If toggle updates fail, RLS is often blocking non-authed users.');
  console.log('2. Verify if the table has been altered to enable RLS:');
  console.log('   `ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;`');
  console.log('3. Verify if permissive policies are created for dev/preview:');
  console.log('   `CREATE POLICY "permissive_all" ON public.<table_name> FOR ALL USING (true) WITH CHECK (true);`');
  console.log('4. Keep in mind that direct client updates rely on FRONTEND user roles or anon policies,');
  console.log('   whereas backend API proxy updates use the SERVICE_ROLE which bypasses RLS rules.\n');
}

runDiagnostics();
