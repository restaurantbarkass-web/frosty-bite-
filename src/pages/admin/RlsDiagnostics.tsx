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
import { DiagnosticsRepository } from '../../repositories';
import toast from 'react-hot-toast';
import { safeFetchJson } from '../../utils/safeFetch';

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
      'cities',
      'pincodes',
      'localities'
    ];

    const results: TestResult[] = [];

    for (const table of tables) {
      let selectType: 'ok' | 'blocked' | 'error' | 'missing' = 'ok';
      let insertType: 'ok' | 'blocked' | 'error' | 'missing' = 'ok';
      let selectStr = '✅ Allowed';
      let insertStr = '✅ Allowed';

      // 1. SELECT test
      const selectRes = await DiagnosticsRepository.testTableSelect(table);
      selectStr = selectRes.selectStr;
      selectType = selectRes.selectType;

      // 2. INSERT test
      const insertRes = await DiagnosticsRepository.testTableInsert(table);
      insertStr = insertRes.insertStr;
      insertType = insertRes.insertType;

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
    safeFetchJson<{ sql?: string }>('/api/migration-script')
      .then(res => {
        if (res.data && res.data.sql) {
          setMigrationScript(res.data.sql);
        } else {
          setMigrationScript('-- Info: Default migration script initialized.');
        }
      })
      .catch(() => {
        setMigrationScript('-- Info: Default migration script initialized.');
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
ALTER TABLE public.cities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pincodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.localities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist DISABLE ROW LEVEL SECURITY;`,
    rules: `-- FIX: Create fully permissive Row Level Security policies for Dev/Preview testing
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissive_all_cities" ON public.cities;
CREATE POLICY "permissive_all_cities" ON public.cities FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_pincodes" ON public.pincodes;
CREATE POLICY "permissive_all_pincodes" ON public.pincodes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissive_all_localities" ON public.localities;
CREATE POLICY "permissive_all_localities" ON public.localities FOR ALL USING (true) WITH CHECK (true);

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
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E76A54]/10 border border-[#E76A54]/20 flex items-center justify-center text-[#E76A54] shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight uppercase">
              Security & RLS Diagnostics
            </h1>
            <p className="text-stone-500 text-xs sm:text-sm font-medium mt-0.5">
              Monitor Row Level Security, diagnose access errors, and generate bypass or security policies for your database.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main interactive testing panel (colspan 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-7 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
                  <Database size={18} className="text-[#E76A54]" />
                  Table Authentication Matrix
                </h2>
                <p className="text-xs text-stone-500 font-medium">
                  Instantly trace permission levels and client-side limits directly from active client connections.
                </p>
              </div>
              <button
                onClick={runDbScan}
                disabled={isTesting}
                className="px-4 h-10 rounded-xl bg-[#E76A54]/10 hover:bg-[#E76A54]/20 text-[#E76A54] font-bold text-xs uppercase tracking-wider border border-[#E76A54]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
              >
                {isTesting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-[#E76A54]" />
                    <span>Scanning Public API...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="text-[#E76A54]" />
                    <span>Run Connection Scan</span>
                  </>
                )}
              </button>
            </div>

            <div className="w-full h-[1px] bg-stone-100" />

            {/* Grid status matrix */}
            <div className="bg-[#FAF8F5] border border-stone-200 rounded-2xl overflow-hidden shadow-inner">
              <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-100/75">
                      <th className="p-3.5 text-[10px] uppercase font-black tracking-wider text-stone-600">Table Name</th>
                      <th className="p-3.5 text-[10px] uppercase font-black tracking-wider text-stone-600">SELECT (Read Access)</th>
                      <th className="p-3.5 text-[10px] uppercase font-black tracking-wider text-stone-600">INSERT (Write Access)</th>
                      <th className="p-3.5 text-[10px] uppercase font-black tracking-wider text-stone-600">Security State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-stone-400 text-xs">
                          <div className="flex flex-col items-center gap-2">
                            <RefreshCw size={24} className="animate-spin text-stone-400" />
                            <span>Initializing assessment scan...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      testResults.map((res) => (
                        <tr key={res.table} className="border-b border-stone-200/60 hover:bg-white/60 transition-colors">
                          <td className="p-3.5 font-mono text-xs font-bold text-stone-900">{res.table}</td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              res.select.includes('✅') 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : res.select.includes('❓')
                                  ? 'bg-stone-100 text-stone-600 border border-stone-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {res.select}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              res.insert.includes('✅') 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : res.insert.includes('❓')
                                  ? 'bg-stone-100 text-stone-600 border border-stone-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {res.insert}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                              res.status === 'ok' 
                                ? 'text-emerald-700' 
                                : res.status === 'missing'
                                  ? 'text-stone-500'
                                  : 'text-rose-700'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                res.status === 'ok' 
                                  ? 'bg-emerald-500' 
                                  : res.status === 'missing'
                                    ? 'bg-stone-400'
                                    : 'bg-rose-500'
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
          <div className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xs">
            <div className="space-y-0.5">
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Lock size={18} className="text-amber-500" />
                SQL Recovery Remedies
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                If some tables fail testing, configure permissive policies or bypass RLS security checks in your database SQL Editor.
              </p>
            </div>

            {/* Tab Selection */}
            <div className="flex flex-wrap border border-stone-200 gap-1 p-1 bg-[#FAF8F5] rounded-xl w-fit">
              <button
                onClick={() => setActiveSqlTab('rules')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  activeSqlTab === 'rules' ? 'bg-[#E76A54] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Deploy RLS Rules
              </button>
              <button
                onClick={() => setActiveSqlTab('bypass')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  activeSqlTab === 'bypass' ? 'bg-[#E76A54] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Bypass / Disable RLS
              </button>
              <button
                onClick={() => setActiveSqlTab('rpc')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  activeSqlTab === 'rpc' ? 'bg-[#E76A54] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Policy Inspector SQL
              </button>
              <button
                onClick={() => setActiveSqlTab('migration')}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeSqlTab === 'migration' ? 'bg-amber-600 text-white shadow-xs font-black' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Database size={11} />
                <span>Copy Full Migration Script</span>
              </button>
            </div>

            <div className="relative bg-[#1C1917] border border-stone-800 rounded-2xl p-4 sm:p-5 font-mono text-[11px] leading-relaxed text-stone-300 overflow-x-auto text-left shadow-inner">
              <pre className="whitespace-pre overflow-x-auto max-h-[320px] custom-scrollbar selection:bg-[#E76A54]/30 select-all">
                <code>{sqlSnippets[activeSqlTab]}</code>
              </pre>
              <button
                onClick={() => copySqlToClipboard(sqlSnippets[activeSqlTab])}
                className="absolute top-4 right-4 px-3 py-2 h-8 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-[10px] text-white border border-white/20 font-sans font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all uppercase tracking-wider"
              >
                <Copy size={12} />
                <span>{copiedText ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Info Sidebar (colspan 1) */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-7 space-y-5 shadow-xs">
            <div className="space-y-0.5">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Info size={18} className="text-[#E76A54]" />
                Technical Overview
              </h2>
              <p className="text-xs text-stone-500 font-medium">Why do connection tokens and state updates fail?</p>
            </div>

            <div className="w-full h-[1px] bg-stone-100" />

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#E76A54] rounded-full" />
                  <span className="text-[10px] font-black uppercase text-[#E76A54] tracking-wider font-mono">1. Client / Anon Token</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  By default, when you execute queries via the client from a web browser, request headers send your <span className="text-stone-900 font-mono font-bold bg-white px-1.5 py-0.5 border border-stone-200 rounded">Anon/Public Key</span>. PostgreSQL enforces strict RLS (Row Level Security); any unauthorized access returns a <span className="text-rose-600 font-mono font-bold">42501 Permission Error</span>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider font-mono">2. Server Admin Key</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  When you perform requests through administrative backend routes like <span className="text-stone-900 font-mono font-bold bg-white px-1.5 py-0.5 border border-stone-200 rounded">PATCH /api/*</span>, operations automatically run using the secure <span className="text-stone-900 font-mono font-bold bg-white px-1.5 py-0.5 border border-stone-200 rounded">Service Role Key</span>. The database bypasses all RLS checks entirely here.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-stone-200/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full" />
                  <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider font-mono">3. Firebase Syncing</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  Our application integrates Firebase Firestore for double durability. Ensure your Firestore rules are synchronized properly alongside any database updates to keep standard records matching correctly.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links / Troubleshooting Box */}
          <div className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-7 space-y-3.5 shadow-xs">
            <h4 className="font-bold text-stone-900 text-sm">Need deep database debugging?</h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Open your database dashboard or execute terminal custom scripts to directly view PostgreSQL system tables and policy catalogs.
            </p>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 font-bold text-xs uppercase tracking-wider border border-stone-200 transition-all text-center"
            >
              <span>Go to Database Dashboard</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
