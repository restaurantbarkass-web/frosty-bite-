import React, { useState, useEffect, useCallback } from 'react';
import { 
  Smartphone, 
  Radio, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Activity, 
  ShieldCheck, 
  Cpu, 
  Battery, 
  Wifi, 
  Signal, 
  Copy, 
  Check, 
  Clock, 
  Terminal, 
  Server, 
  SendHorizontal,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

interface GatewayDeviceInfo {
  deviceId: string;
  status: string;
  simReady: boolean;
  smsReady: boolean;
  permissionGranted: boolean;
  batteryLevel?: number;
  networkType?: string;
  signalStrength?: string;
  simOperator?: string;
  appVersion?: string;
  ip?: string;
}

interface HeartbeatLog {
  timestamp: string;
  type: 'HEARTBEAT' | 'AUTH_FAILURE' | 'TEST_PING' | 'STATUS_CHANGE';
  message: string;
  details?: Record<string, any>;
}

interface GatewayStatusResponse {
  ok: boolean;
  server: 'CONNECTED' | 'OFFLINE';
  gateway: 'ONLINE' | 'OFFLINE';
  lastHeartbeat: string | null;
  lastHeartbeatAgeSeconds: number | null;
  heartbeatCount: number;
  device: GatewayDeviceInfo | null;
  config: {
    hasApiKey: boolean;
    hasDeviceId: boolean;
    hasGatewayUrl: boolean;
    expectedDeviceId?: string;
  };
  logs: HeartbeatLog[];
}

export const SmsGatewayPage: React.FC = () => {
  const { getAuthToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [statusData, setStatusData] = useState<GatewayStatusResponse | null>(null);
  const [testResult, setTestResult] = useState<{
    status: 'GATEWAY ONLINE' | 'GATEWAY OFFLINE';
    latencyMs: number;
    message: string;
    timestamp: string;
  } | null>(null);

  const fetchStatus = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/sms-gateway/status', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: GatewayStatusResponse = await res.json();
      setStatusData(data);
    } catch (err: any) {
      console.error('Failed to fetch SMS gateway status:', err);
      if (!isSilent) {
        toast.error('Unable to fetch SMS gateway telemetry');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Periodic polling when auto-refresh is active
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStatus(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/sms-gateway/test-connection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();
      setTestResult({
        status: data.status,
        latencyMs: data.latencyMs || 0,
        message: data.message || (data.ok ? 'Connection verified.' : 'Connection check failed.'),
        timestamp: new Date().toLocaleTimeString()
      });

      if (data.ok) {
        toast.success(`GATEWAY ONLINE (${data.latencyMs}ms)`, { icon: '🟢' });
      } else {
        toast.error(`GATEWAY OFFLINE: ${data.message}`, { icon: '🔴' });
      }

      // Refresh status telemetry
      await fetchStatus(true);
    } catch (err: any) {
      setTestResult({
        status: 'GATEWAY OFFLINE',
        latencyMs: 0,
        message: err.message || 'Diagnostic failed to reach SMS server.',
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Diagnostic test failed');
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://frostybite.app';
  const heartbeatEndpoint = `${originUrl}/api/sms-gateway/heartbeat`;
  const pingEndpoint = `${originUrl}/api/sms-gateway/ping`;

  const isGatewayOnline = statusData?.gateway === 'ONLINE';
  const device = statusData?.device;

  const formatAge = (seconds: number | null) => {
    if (seconds === null) return 'Never';
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ${seconds % 60}s ago`;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E76A54]/10 border border-[#E76A54]/20 flex items-center justify-center text-[#E76A54]">
              <Smartphone size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                  Android SMS Gateway
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  Phase 1 • Connection Layer
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 font-medium">
                Hardware communication bridge connecting website to physical SIM gateway.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer",
              autoRefresh 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
            )}
            title="Toggle Live Telemetry Polling"
          >
            <Activity size={14} className={autoRefresh ? "animate-pulse text-emerald-600" : ""} />
            <span>{autoRefresh ? 'Live Polling (8s)' : 'Polling Paused'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchStatus(false)}
            disabled={loading}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-stone-200/90 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-5 py-2.5 bg-[#E76A54] hover:bg-[#d65943] text-white rounded-xl text-xs font-bold tracking-wide uppercase transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Radio size={15} className={testing ? "animate-pulse" : ""} />
            <span>{testing ? 'Checking Gateway...' : 'CHECK SMS GATEWAY'}</span>
          </button>
        </div>
      </div>

      {/* 2. Core Status Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Server Status */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
              SMS Server Status
            </span>
            <Server size={18} className="text-stone-400" />
          </div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <span className="text-lg font-black tracking-tight text-stone-900 font-mono">
              SERVER: CONNECTED
            </span>
          </div>
          <p className="text-[11px] text-stone-500 font-medium">
            Express / Node API endpoints ready on port 3000 & Vercel serverless.
          </p>
        </div>

        {/* Android Gateway Status */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Android Gateway
            </span>
            <Radio size={18} className={isGatewayOnline ? "text-emerald-500" : "text-rose-500"} />
          </div>
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "h-3.5 w-3.5 rounded-full shrink-0",
              isGatewayOnline ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-rose-500 ring-4 ring-rose-100"
            )} />
            <span className={cn(
              "text-lg font-black tracking-tight font-mono",
              isGatewayOnline ? "text-emerald-600" : "text-rose-600"
            )}>
              {isGatewayOnline ? 'GATEWAY: ONLINE' : 'GATEWAY: OFFLINE'}
            </span>
          </div>
          <p className="text-[11px] text-stone-500 font-medium">
            {isGatewayOnline 
              ? 'Physical Android SIM device heartbeat active.' 
              : 'Waiting for heartbeat from Android application.'}
          </p>
        </div>

        {/* Last Heartbeat */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Last Heartbeat
            </span>
            <Clock size={18} className="text-stone-400" />
          </div>
          <div>
            <div className="text-lg font-black tracking-tight text-stone-900 font-mono">
              {formatAge(statusData?.lastHeartbeatAgeSeconds ?? null)}
            </div>
            <div className="text-[10px] text-stone-400 font-mono truncate mt-0.5">
              {statusData?.lastHeartbeat ? new Date(statusData.lastHeartbeat).toLocaleTimeString() : 'No timestamp yet'}
            </div>
          </div>
          <p className="text-[11px] text-stone-500 font-medium">
            Total heartbeats processed: <strong className="text-stone-800">{statusData?.heartbeatCount || 0}</strong>
          </p>
        </div>

        {/* Diagnostic Check Result */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Test Connection
            </span>
            <ShieldCheck size={18} className="text-[#E76A54]" />
          </div>
          <div>
            <div className={cn(
              "text-sm font-black tracking-wide font-mono",
              testResult?.status === 'GATEWAY ONLINE' ? "text-emerald-600" : testResult ? "text-rose-600" : "text-stone-500"
            )}>
              {testResult ? testResult.status : 'NOT RUN YET'}
            </div>
            {testResult && (
              <div className="text-[10px] text-stone-500 font-medium mt-0.5">
                Latency: {testResult.latencyMs}ms • {testResult.timestamp}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="w-full py-1.5 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            {testing ? 'Testing...' : 'Run Diagnostics'}
          </button>
        </div>
      </div>

      {/* 3. Physical Android Device & Hardware Telemetry */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/90 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
              <Cpu size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Android Hardware & SIM Telemetry
              </h2>
              <p className="text-xs text-stone-500">
                Live diagnostics reported by the physical Android phone
              </p>
            </div>
          </div>
          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-bold font-mono",
            isGatewayOnline ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"
          )}>
            {device?.deviceId || 'frosty-sms-gateway'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* SIM Card Status */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              SIM Card
            </span>
            <div className="flex items-center gap-1.5">
              {device?.simReady ? (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              ) : (
                <XCircle size={16} className="text-rose-500 shrink-0" />
              )}
              <span className="text-xs font-bold text-stone-900 font-mono">
                {device?.simReady ? 'READY' : 'NOT READY'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 truncate block">
              {device?.simOperator || 'Physical SIM'}
            </span>
          </div>

          {/* SMS Capability */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              SMS Capability
            </span>
            <div className="flex items-center gap-1.5">
              {device?.smsReady ? (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              ) : (
                <XCircle size={16} className="text-rose-500 shrink-0" />
              )}
              <span className="text-xs font-bold text-stone-900 font-mono">
                {device?.smsReady ? 'READY' : 'DISABLED'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 truncate block">
              SmsManager API
            </span>
          </div>

          {/* Android Permissions */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              Permissions
            </span>
            <div className="flex items-center gap-1.5">
              {device?.permissionGranted ? (
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
              )}
              <span className="text-xs font-bold text-stone-900 font-mono">
                {device?.permissionGranted ? 'GRANTED' : 'DENIED'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 truncate block">
              SEND_SMS, READ_PHONE
            </span>
          </div>

          {/* Battery */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              Battery Level
            </span>
            <div className="flex items-center gap-1.5">
              <Battery size={16} className="text-stone-600 shrink-0" />
              <span className="text-xs font-bold text-stone-900 font-mono">
                {device?.batteryLevel !== undefined ? `${device.batteryLevel}%` : 'N/A'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 truncate block">
              Power Connected
            </span>
          </div>

          {/* Network & Signal */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              Network
            </span>
            <div className="flex items-center gap-1.5">
              <Signal size={16} className="text-stone-600 shrink-0" />
              <span className="text-xs font-bold text-stone-900 font-mono truncate">
                {device?.networkType || 'Cellular'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 truncate block">
              Signal: {device?.signalStrength || 'Good'}
            </span>
          </div>

          {/* App Version */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              Gateway App
            </span>
            <div className="flex items-center gap-1.5">
              <Smartphone size={16} className="text-stone-600 shrink-0" />
              <span className="text-xs font-bold text-stone-900 font-mono">
                v{device?.appVersion || '1.0.0'}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 truncate block">
              Frosty Bite Gateway
            </span>
          </div>
        </div>
      </div>

      {/* 4. Android App Setup & Configuration Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Endpoints */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-[#E76A54]" />
            <h3 className="font-bold text-stone-900 text-sm">
              Server Connection Endpoints
            </h3>
          </div>

          <div className="space-y-3">
            {/* Heartbeat URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                1. Gateway Heartbeat POST URL
              </label>
              <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                <code className="text-xs font-mono text-stone-800 flex-1 truncate select-all">
                  {heartbeatEndpoint}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(heartbeatEndpoint, 'heartbeat')}
                  className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-600 transition-colors cursor-pointer"
                  title="Copy URL"
                >
                  {copiedField === 'heartbeat' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Ping URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                2. Server Health Ping GET URL
              </label>
              <div className="flex items-center gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                <code className="text-xs font-mono text-stone-800 flex-1 truncate select-all">
                  {pingEndpoint}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(pingEndpoint, 'ping')}
                  className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-600 transition-colors cursor-pointer"
                  title="Copy URL"
                >
                  {copiedField === 'ping' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Config Status Indicators */}
            <div className="pt-2 border-t border-stone-200 flex flex-wrap gap-2 text-[11px]">
              <span className={cn(
                "px-2.5 py-1 rounded-lg font-mono font-semibold flex items-center gap-1",
                statusData?.config?.hasApiKey ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
              )}>
                {statusData?.config?.hasApiKey ? '✓ SMS_GATEWAY_API_KEY Configured' : '⚠️ Default Dev Key Active'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-mono border border-stone-200">
                Device Filter: {statusData?.config?.expectedDeviceId || 'Any Authenticated Device'}
              </span>
            </div>
          </div>
        </div>

        {/* Phase 1 Scope & Architecture Notice */}
        <div className="bg-stone-50 rounded-3xl p-6 sm:p-7 border border-stone-200/90 space-y-4">
          <div className="flex items-center gap-2">
            <Info size={18} className="text-[#E76A54]" />
            <h3 className="font-bold text-stone-900 text-sm">
              Phase 1 Architecture & Security Rules
            </h3>
          </div>

          <div className="text-xs text-stone-600 space-y-2.5 leading-relaxed">
            <p>
              • <strong className="text-stone-900">Zero Public Endpoints:</strong> The physical Android phone does not expose unauthenticated public endpoints. Communication flows through authenticated backend heartbeats.
            </p>
            <p>
              • <strong className="text-stone-900">Safe Diagnostics:</strong> The <code className="bg-stone-200/70 px-1 py-0.5 rounded font-mono text-[11px]">CHECK SMS GATEWAY</code> button verifies handshake responsiveness and hardware readiness without firing any customer SMS messages.
            </p>
            <p>
              • <strong className="text-stone-900">Automatic SMS Guard:</strong> Order confirmation, OTP, and marketing SMS automations remain strictly disabled for this connection phase as per specification.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Heartbeat & Audit Event Log */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-stone-700" />
            <h3 className="font-bold text-stone-900 text-sm">
              Recent Heartbeat & Diagnostic Logs
            </h3>
          </div>
          <span className="text-xs text-stone-400 font-medium">
            Showing last {statusData?.logs?.length || 0} events
          </span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {statusData?.logs && statusData.logs.length > 0 ? (
            statusData.logs.map((log, idx) => (
              <div 
                key={`log-${idx}`}
                className="p-3 bg-stone-50 hover:bg-stone-100/80 rounded-xl border border-stone-200/70 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    log.type === 'HEARTBEAT' ? "bg-emerald-100 text-emerald-800" :
                    log.type === 'TEST_PING' ? "bg-blue-100 text-blue-800" :
                    log.type === 'AUTH_FAILURE' ? "bg-rose-100 text-rose-800" :
                    "bg-stone-200 text-stone-800"
                  )}>
                    {log.type}
                  </span>
                  <span className="text-stone-800 font-medium font-sans">
                    {log.message}
                  </span>
                </div>
                <span className="text-stone-400 text-[10px] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-stone-400 text-xs font-medium">
              No heartbeat events recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmsGatewayPage;
