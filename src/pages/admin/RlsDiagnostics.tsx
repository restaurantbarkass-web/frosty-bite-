import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Info, 
  Database, 
  RefreshCw, 
  Copy, 
  CheckCircle2, 
  AlertTriangle,
  Play,
  Lock,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';

interface TestResult {
  table: string;
  select: string;
  insert: string;
  status: 'ok' | 'blocked' | 'error' | 'missing';
}

export const RlsDiagnostics: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [activeSqlTab, setActiveSqlTab] = useState<'bypass' | 'rules' | 'rpc' | 'migration'>('rules');
  const [migrationScript, setMigrationScript] = useState<string>('-- Fetching full migration script from server...');
  const [copiedText, setCopiedText] = useState(false);

  const runDbScan = async () => {
    setIsTesting(true);
    const tables = [
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

    const results: TestResult[] = [];

    for (const table of tables) {
      let selectType: 'ok' | 'blocked' | 'error' | 'missing' = 'ok';
      let insertType: 'ok' | 'blocked' | 'error' | 'missing' = 'ok';
      let selectStr = '✅ Allowed';
      let insertStr = '✅ Allowed';

      // 1. SELECT test
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          if (error.code === '42501') {
            selectStr = '❌ Blocked (RLS)';
            selectType = 'blocked';
          } else if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            selectStr = '❓ Table Missing';
            selectType = 'missing';
          } else {
            selectStr = `⚠️ Code ${error.code}`;
            selectType = 'error';
          }
        }
      } catch (e: any) {
        selectStr = '💥 Fail';
        selectType = 'error';
      }

      // 2. INSERT test (trigger validation/RLS failure checking with dummy/invalid keys)
      try {
        const { error } = await supabase.from(table).insert({ id: '00000000-0000-0000-0000-000000000000' }).select();
        if (error) {
          if (error.code === '42501') {
            insertStr = '❌ Blocked (RLS)';
            insertType = 'blocked';
          } else if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.message?.includes('schema cache')) {
            insertStr = '❓ Table Missing';
            insertType = 'missing';
          } else {
            // Other errors (e.g. invalid UUID format 22P02, duplicate keys, required field violations)
            // mean Postgres got past RLS and tried to perform database validation checks!
            insertStr = '✅ Allowed (Checked)';
            insertType = 'ok';
          }
        }
      } catch (e: any) {
        insertStr = '💥 Fail';
        insertType = 'error';
      }

      const overallStatus = 
        selectType === 'missing' || insertType === 'missing' ? 'missing' :
        selectType === 'blocked' || insertType === 'blocked' ? 'blocked' :
        selectType === 'error' || insertType === 'error' ? 'error' : 'ok';

      results.push({
        table,
        select: selectStr,
        insert: insertStr,
        status: overallStatus
      });
    }

    setTestResults(results);
    setIsTesting(false);
    toast.success('Database permissions scan completed!');
  };

  useEffect(() => {
    runDbScan();
    // Load full migration from Express API
    fetch('/api/migration-script')
      .then(res => res.json())
      .then(data => {
        if (data && data.sql) {
          setMigrationScript(data.sql);
        } else {
          setMigrationScript('-- Error: Returned dataset did not contain migration code.');
        }
      })
      .catch(err => {
        setMigrationScript('-- Error: Failed connecting to web app endpoint to retrieve migration script.');
      });
  }, []);

  const copySqlToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    toast.success('SQL Command copied successfully!');
    setTimeout(() => setCopiedText(false), 2000);
  };

  const sqlSnippets = {
    bypass: `-- FIX: Toggle Row Level Security off for active tables to permit rapid front-end tests
ALTER TABLE public.service_zones DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pincodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist DISABLE ROW LEVEL SECURITY;`,
    rules: `-- FIX: Create fully permissive Row Level Security policies for Dev/Preview testing
ALTER TABLE public.service_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissive_all_service_zones" ON public.service_zones;
CREATE POLICY "permissive_all_service_zones" ON public.service_zones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_service_pincodes" ON public.service_pincodes;
CREATE POLICY "permissive_all_service_pincodes" ON public.service_pincodes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_delivery_areas" ON public.delivery_areas;
CREATE POLICY "permissive_all_delivery_areas" ON public.delivery_areas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_coupons" ON public.coupons;
CREATE POLICY "permissive_all_coupons" ON public.coupons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_banners" ON public.banners;
CREATE POLICY "permissive_all_banners" ON public.banners FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_products" ON public.products;
CREATE POLICY "permissive_all_products" ON public.products FOR ALL USING (true) WITH CHECK (true);`,
    rpc: `-- SQL views & RPC helpers to dynamically inspect PostgreSQL system policies
CREATE OR REPLACE FUNCTION public.get_rls_policies()
RETURNS TABLE (
    schemaname text,
    tablename text,
    rls_enabled boolean,
    policyname text,
    permissive text,
    roles text[],
    cmd text,
    qual text,
    with_check text
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.schemaname::text,
        c.tablename::text,
        COALESCE(cls.relrowsecurity, false) AS rls_enabled,
        p.policyname::text,
        p.permissive::text,
        p.roles::text[],
        p.cmd::text,
        p.qual::text,
        p.with_check::text
    FROM pg_catalog.pg_tables c
    JOIN pg_catalog.pg_class cls ON cls.relname = c.tablename AND cls.relnamespace = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = c.schemaname)
    LEFT JOIN pg_catalog.pg_policies p ON p.tablename = c.tablename AND p.schemaname = c.schemaname
    WHERE c.schemaname = 'public';
END;
$$ LANGUAGE plpgsql;`,
    migration: migrationScript
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-2 flex items-center gap-3">
          <ShieldCheck size={40} className="text-red-500" />
          Security & RLS Diagnostics
        </h1>
        <p className="text-gray-500 font-medium">
          Monitor Row Level Security, diagnose access errors, and generate bypass or security policies for your database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main interactive testing panel (colspan 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database size={18} className="text-primary" />
                  Table Authentication Matrix
                </h2>
                <p className="text-xs text-zinc-500 font-medium font-sans">
                  Instantly trace permission levels and client-side limits directly from active client connections.
                </p>
              </div>
              <button
                onClick={runDbScan}
                disabled={isTesting}
                className="px-4 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase tracking-wider border border-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isTesting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-red-400" />
                    <span>Scanning Public API...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="text-red-400" />
                    <span>Run Connection Scan</span>
                  </>
                )}
              </button>
            </div>

            <div className="w-full h-[1px] bg-white/5" />

            {/* Grid status matrix */}
            <div className="bg-[#07070a] border border-white/5 rounded-2xl overflow-hidden shadow-inner">
              <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01]">
                      <th className="p-4 text-[10px] uppercase font-black tracking-widest text-zinc-500">Table Name</th>
                      <th className="p-4 text-[10px] uppercase font-black tracking-widest text-zinc-500">SELECT (Read Access)</th>
                      <th className="p-4 text-[10px] uppercase font-black tracking-widest text-zinc-500">INSERT (Write Access)</th>
                      <th className="p-4 text-[10px] uppercase font-black tracking-widest text-zinc-500">Security State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-zinc-500 text-xs">
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw size={24} className="animate-spin text-zinc-650" />
                            <span>Initializing assessment scan...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      testResults.map((res) => (
                        <tr key={res.table} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                          <td className="p-4 font-mono text-xs font-bold text-white">{res.table}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              res.select.includes('✅') 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                                : res.select.includes('❓')
                                  ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/10'
                                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}>
                              {res.select}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              res.insert.includes('✅') 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' 
                                : res.insert.includes('❓')
                                  ? 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/10'
                                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                            }`}>
                              {res.insert}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                              res.status === 'ok' 
                                ? 'text-emerald-400' 
                                : res.status === 'missing'
                                  ? 'text-zinc-500'
                                  : 'text-red-500'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                res.status === 'ok' 
                                  ? 'bg-emerald-400' 
                                  : res.status === 'missing'
                                    ? 'bg-zinc-550'
                                    : 'bg-red-500'
                              }`} />
                              {res.status === 'ok' 
                                ? 'Access Permissive' 
                                : res.status === 'missing'
                                  ? 'Missing in DB'
                                  : 'RLS Constrained'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SQL Remedy Section */}
          <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock size={18} className="text-amber-500" />
                SQL Recovery Remedies
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                If some tables fail testing, configure permissive policies or bypass RLS security checks in your Supabase SQL Editor.
              </p>
            </div>

            {/* Tab Selection */}
            <div className="flex flex-wrap border border-white/5 gap-1 p-1 bg-[#121218] rounded-xl w-fit">
              <button
                onClick={() => setActiveSqlTab('rules')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  activeSqlTab === 'rules' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                Deploy RLS Rules
              </button>
              <button
                onClick={() => setActiveSqlTab('bypass')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  activeSqlTab === 'bypass' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                Bypass / Disable RLS
              </button>
              <button
                onClick={() => setActiveSqlTab('rpc')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  activeSqlTab === 'rpc' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-350'
                }`}
              >
                Policy Inspector SQL
              </button>
              <button
                onClick={() => setActiveSqlTab('migration')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSqlTab === 'migration' ? 'bg-red-500 text-white shadow-sm font-black' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Database size={11} />
                <span>Copy Full Migration Script</span>
              </button>
            </div>

            <div className="relative bg-[#050507] border border-white/5 rounded-2xl p-5 font-mono text-[11px] leading-relaxed text-zinc-400 overflow-x-auto text-left">
              <pre className="whitespace-pre overflow-x-auto max-h-[320px] custom-scrollbar selection:bg-primary/20 select-all">
                <code>{sqlSnippets[activeSqlTab]}</code>
              </pre>
              <button
                onClick={() => copySqlToClipboard(sqlSnippets[activeSqlTab])}
                className="absolute top-4 right-4 px-3 py-2 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-[10px] text-white border border-white/10 font-sans font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all uppercase tracking-widest"
              >
                <Copy size={12} />
                <span>{copiedText ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Info Sidebar (colspan 1) */}
        <div className="space-y-6">
          <div className="bg-[#0c0c0e] border border-white/5 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Info size={18} className="text-primary" />
                Technical Overview
              </h2>
              <p className="text-xs text-zinc-500 font-medium">Why do connection tokens and state updates fail?</p>
            </div>

            <div className="w-full h-[1px] bg-white/5" />

            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-red-400 tracking-wider font-mono">1. Client / Anon Token</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                  By default, when you execute queries via the Supabase Client from a web browser, request headers send your <span className="text-white font-mono font-bold bg-white/10 px-1 rounded">Anon/Public Key</span>. PostgreSQL enforces strict RLS (Row Level Security); any unauthorized access returns a <span className="text-red-400 font-mono">42501 Permission Error</span>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider font-mono">2. Server Admin Key</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                  When you perform requests through administrative backend routes like <span className="text-zinc-300 font-mono">PATCH /api/*</span>, operations automatically run using the secure <span className="text-white font-mono font-bold bg-white/10 px-1 rounded">Service Role Key</span>. The database bypasses all RLS checks entirely here.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider font-mono">3. Firebase Syncing</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                  Our application integrates Firebase Firestore for double durability. Ensure your Firestore rules are synchronized properly alongside any Supabase updates to keep standard records matching correctly.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links / Troubleshooting Box */}
          <div className="bg-[#0c0c0e]/30 border border-white/5 rounded-3xl p-6 sm:p-8 space-y-4">
            <h4 className="font-bold text-white text-sm">Need deep database debugging?</h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Open your Supabase dashboard or execute terminal custom scripts to directly view PostgreSQL system tables and policy catalogs.
            </p>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider border border-white/10 transition-all text-center"
            >
              <span>Go to Supabase</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
