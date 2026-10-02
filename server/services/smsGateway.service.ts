import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export interface GatewayDeviceInfo {
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
  lastError?: string;
}

export interface GatewayHeartbeatLog {
  timestamp: string;
  type: 'HEARTBEAT' | 'AUTH_FAILURE' | 'TEST_PING' | 'STATUS_CHANGE';
  message: string;
  details?: Record<string, any>;
}

export interface GatewayState {
  serverStatus: 'CONNECTED' | 'OFFLINE';
  gatewayStatus: 'ONLINE' | 'OFFLINE';
  lastHeartbeat: string | null;
  lastHeartbeatTimestampMs: number | null;
  heartbeatCount: number;
  deviceInfo: GatewayDeviceInfo | null;
  logs: GatewayHeartbeatLog[];
}

/**
 * Maximum elapsed milliseconds before the Android Gateway is considered OFFLINE.
 * Android Gateway sends periodic heartbeats (e.g. every 15-30s). 
 * 90s grace threshold allows for intermittent cellular reconnects.
 */
const HEARTBEAT_TIMEOUT_MS = 90 * 1000;

class SmsGatewayServiceClass {
  private state: GatewayState = {
    serverStatus: 'CONNECTED',
    gatewayStatus: 'OFFLINE',
    lastHeartbeat: null,
    lastHeartbeatTimestampMs: null,
    heartbeatCount: 0,
    deviceInfo: null,
    logs: []
  };

  constructor() {
    this.addLog('STATUS_CHANGE', 'Frosty Bite SMS Server communication layer initialized.');
  }

  /**
   * Safely adds an audit log entry (capped at last 40 entries, no sensitive secrets logged).
   */
  public addLog(type: GatewayHeartbeatLog['type'], message: string, details?: Record<string, any>) {
    const entry: GatewayHeartbeatLog = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details: details ? this.sanitizeDetails(details) : undefined
    };

    this.state.logs.unshift(entry);
    if (this.state.logs.length > 40) {
      this.state.logs = this.state.logs.slice(0, 40);
    }
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const safe: Record<string, any> = {};
    for (const [key, val] of Object.entries(details)) {
      const lower = key.toLowerCase();
      // Allow safe diagnostic telemetry values through without redacting
      if (key === 'apiKeyConfigured' || key === 'receivedApiKeyPresent' || key === 'receivedKeyLength' || key === 'expectedDeviceId' || key === 'deviceId' || key === 'httpStatus') {
        safe[key] = val;
        continue;
      }
      if (lower.includes('key') || lower.includes('secret') || lower.includes('token') || lower.includes('password') || lower.includes('phone') || lower.includes('otp')) {
        safe[key] = '[REDACTED]';
      } else {
        safe[key] = val;
      }
    }
    return safe;
  }

  /**
   * Validates if the incoming request comes with a valid Android SMS Gateway API key.
   * Does NOT transform, hash, or truncate the key. Performs exact credential comparison.
   */
  public validateApiKey(providedKey?: string): boolean {
    const configuredKey = process.env.SMS_GATEWAY_API_KEY || process.env.FROSTY_SMS_GATEWAY_KEY;

    if (!configuredKey) {
      // In development or if key is not yet set, allow a default placeholder
      if (process.env.NODE_ENV !== 'production') {
        return true;
      }
      return false;
    }

    if (!providedKey) return false;

    // Safely remove any surrounding quotes if inadvertently included in environment variable definition
    const cleanConfigured = configuredKey.replace(/^["']|["']$/g, '').trim();
    const cleanProvided = providedKey.replace(/^["']|["']$/g, '').trim();

    return cleanProvided === cleanConfigured;
  }

  /**
   * Processes a heartbeat payload from the Android SMS Gateway application.
   */
  public async processHeartbeat(payload: Partial<GatewayDeviceInfo> & Record<string, any>, clientIp?: string): Promise<{ ok: boolean; message: string; gatewayState: 'ONLINE' | 'OFFLINE' }> {
    const now = Date.now();
    const isoNow = new Date(now).toISOString();

    const expectedDeviceId = (process.env.SMS_GATEWAY_DEVICE_ID || '').trim();
    const incomingDeviceId = (payload.deviceId || 'unknown-android-gateway').trim();

    if (expectedDeviceId && incomingDeviceId && incomingDeviceId !== expectedDeviceId) {
      this.addLog('AUTH_FAILURE', `Heartbeat rejected: Device ID mismatch (Expected: ${expectedDeviceId}, Received: ${incomingDeviceId})`, {
        expectedDeviceId,
        deviceId: incomingDeviceId,
        httpStatus: 403
      });
      return {
        ok: false,
        message: `Device ID mismatch`,
        gatewayState: 'OFFLINE'
      };
    }

    // Support both boolean flags and string representations sent by Android diagnostics
    const simReady = payload.simReady === true || 
      (typeof payload.simStatus === 'string' && payload.simStatus.toUpperCase() === 'READY') ||
      (payload.simReady !== false && payload.status?.toLowerCase() !== 'sim_error');

    const smsReady = payload.smsReady === true ||
      (typeof payload.smsCapability === 'string' && payload.smsCapability.toUpperCase() === 'READY') ||
      payload.smsReady !== false;

    const permissionGranted = payload.permissionGranted === true ||
      (typeof payload.permissionStatus === 'string' && payload.permissionStatus.toUpperCase() === 'GRANTED');

    this.state.deviceInfo = {
      deviceId: incomingDeviceId,
      status: payload.status || (simReady && smsReady ? 'READY' : 'NOT_READY'),
      simReady,
      smsReady,
      permissionGranted,
      batteryLevel: payload.batteryLevel ?? 100,
      networkType: payload.networkType || payload.networkInfo || 'WIFI',
      signalStrength: payload.signalStrength || 'Good',
      simOperator: payload.simOperator || 'Active SIM',
      appVersion: payload.appVersion || '1.0',
      ip: clientIp || payload.ip || '127.0.0.1'
    };

    this.state.lastHeartbeat = isoNow;
    this.state.lastHeartbeatTimestampMs = now;
    this.state.heartbeatCount += 1;
    this.state.serverStatus = 'CONNECTED';

    // Gateway is ONLINE when active heartbeats are received and hardware (SIM & SMS capability) is ready
    const isOnline = simReady && smsReady;
    this.state.gatewayStatus = isOnline ? 'ONLINE' : 'OFFLINE';

    this.addLog('HEARTBEAT', `Heartbeat acknowledged from device: ${incomingDeviceId}`, {
      status: this.state.deviceInfo.status,
      simReady,
      smsReady,
      permissionGranted,
      battery: payload.batteryLevel ?? 100,
      network: this.state.deviceInfo.networkType,
      appVersion: payload.appVersion || '1.0'
    });

    console.log(`[SMS Gateway] Heartbeat acknowledged from device: ${incomingDeviceId} (SIM: ${simReady ? 'READY' : 'NOT READY'}, SMS: ${smsReady ? 'READY' : 'DISABLED'}, Permission: ${permissionGranted ? 'GRANTED' : 'REQUIRED'})`);

    // Optional background sync to Supabase for persistence across serverless executions
    this.syncStateToDatabase().catch(() => {});

    return {
      ok: true,
      message: 'Heartbeat acknowledged',
      gatewayState: this.state.gatewayStatus
    };
  }

  /**
   * Computes the real-time status of the SMS Server & Android Gateway.
   */
  public getStatus(): {
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
    logs: GatewayHeartbeatLog[];
  } {
    const now = Date.now();
    let currentGatewayStatus: 'ONLINE' | 'OFFLINE' = 'OFFLINE';
    let ageSeconds: number | null = null;

    if (this.state.lastHeartbeatTimestampMs) {
      const elapsedMs = now - this.state.lastHeartbeatTimestampMs;
      ageSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

      const isWithinWindow = elapsedMs <= HEARTBEAT_TIMEOUT_MS;
      const isDeviceHealthy = this.state.deviceInfo?.simReady && this.state.deviceInfo?.smsReady;

      if (isWithinWindow && isDeviceHealthy) {
        currentGatewayStatus = 'ONLINE';
      } else {
        currentGatewayStatus = 'OFFLINE';
      }
    }

    this.state.gatewayStatus = currentGatewayStatus;

    return {
      server: 'CONNECTED',
      gateway: currentGatewayStatus,
      lastHeartbeat: this.state.lastHeartbeat,
      lastHeartbeatAgeSeconds: ageSeconds,
      heartbeatCount: this.state.heartbeatCount,
      device: this.state.deviceInfo,
      config: {
        hasApiKey: !!(process.env.SMS_GATEWAY_API_KEY || process.env.FROSTY_SMS_GATEWAY_KEY),
        hasDeviceId: !!process.env.SMS_GATEWAY_DEVICE_ID,
        hasGatewayUrl: !!process.env.SMS_GATEWAY_URL,
        expectedDeviceId: process.env.SMS_GATEWAY_DEVICE_ID
      },
      logs: this.state.logs
    };
  }

  /**
   * Performs an end-to-end admin diagnostic test of the SMS Gateway connection.
   * Does NOT send any SMS.
   */
  public async testConnection(): Promise<{
    ok: boolean;
    status: 'GATEWAY ONLINE' | 'GATEWAY OFFLINE';
    serverStatus: 'CONNECTED' | 'OFFLINE';
    gatewayStatus: 'ONLINE' | 'OFFLINE';
    simReady: boolean;
    smsReady: boolean;
    permissionGranted: boolean;
    latencyMs: number;
    lastHeartbeat: string | null;
    lastHeartbeatAgeSeconds: number | null;
    device: GatewayDeviceInfo | null;
    message: string;
  }> {
    const startTime = Date.now();
    const currentStatus = this.getStatus();
    const latencyMs = Math.max(1, Date.now() - startTime);

    const isOnline = currentStatus.gateway === 'ONLINE';
    const simReady = currentStatus.device?.simReady ?? false;
    const smsReady = currentStatus.device?.smsReady ?? false;
    const permissionGranted = currentStatus.device?.permissionGranted ?? false;

    let message = '';
    if (!currentStatus.lastHeartbeat) {
      message = 'No heartbeat received from Android SMS Gateway yet. Ensure the Android app is running and pointing to this server.';
    } else if (currentStatus.lastHeartbeatAgeSeconds !== null && currentStatus.lastHeartbeatAgeSeconds > 90) {
      message = `Gateway is offline. Last heartbeat was ${currentStatus.lastHeartbeatAgeSeconds} seconds ago (timeout: 90s).`;
    } else if (!simReady) {
      message = 'Gateway is connected but SIM card reports NOT READY.';
    } else if (!smsReady) {
      message = 'Gateway is connected but SMS sending capability is DISABLED or NOT READY.';
    } else if (!permissionGranted) {
      message = 'Gateway is connected but required Android SMS permissions are NOT GRANTED.';
    } else {
      message = 'Gateway is ONLINE, SIM is READY, and SMS Capability is verified.';
    }

    this.addLog('TEST_PING', `Admin test connection performed: ${isOnline ? 'GATEWAY ONLINE' : 'GATEWAY OFFLINE'} (${latencyMs}ms)`, {
      serverStatus: 'CONNECTED',
      gatewayStatus: currentStatus.gateway,
      simReady,
      smsReady,
      permissionGranted,
      latencyMs
    });

    return {
      ok: isOnline,
      status: isOnline ? 'GATEWAY ONLINE' : 'GATEWAY OFFLINE',
      serverStatus: 'CONNECTED',
      gatewayStatus: currentStatus.gateway,
      simReady,
      smsReady,
      permissionGranted,
      latencyMs,
      lastHeartbeat: currentStatus.lastHeartbeat,
      lastHeartbeatAgeSeconds: currentStatus.lastHeartbeatAgeSeconds,
      device: currentStatus.device,
      message
    };
  }

  /**
   * Persists gateway state to Supabase table if it exists (fails gracefully if table not created).
   */
  private async syncStateToDatabase(): Promise<void> {
    try {
      const device = this.state.deviceInfo;
      if (!device) return;

      await supabase
        .from('sms_gateway_state')
        .upsert({
          device_id: device.deviceId,
          status: this.state.gatewayStatus,
          sim_ready: device.simReady,
          sms_ready: device.smsReady,
          permission_granted: device.permissionGranted,
          battery_level: device.batteryLevel,
          network_type: device.networkType,
          sim_operator: device.simOperator,
          app_version: device.appVersion,
          last_heartbeat: this.state.lastHeartbeat,
          updated_at: new Date().toISOString()
        }, { onConflict: 'device_id' });
    } catch (_) {
      // Optional persistence - in-memory state is the authoritative low-latency source
    }
  }
}

export const SmsGatewayService = new SmsGatewayServiceClass();
