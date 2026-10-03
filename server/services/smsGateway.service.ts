import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';

export type SmsType = 
  | 'OTP' 
  | 'ORDER_RECEIVED' 
  | 'ORDER_ACCEPTED' 
  | 'ORDER_PREPARING' 
  | 'OUT_FOR_DELIVERY' 
  | 'ORDER_DELIVERED' 
  | 'FEEDBACK' 
  | 'PROMOTIONAL' 
  | 'TEST';

export type SmsStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';

export interface SmsJob {
  id: string;
  recipient: string;
  message: string;
  type: SmsType;
  orderId?: string;
  status: SmsStatus;
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  error?: string;
  retryCount: number;
}

export interface QueueSmsParams {
  recipient: string;
  message: string;
  type: SmsType;
  orderId?: string;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  idempotencyKey?: string;
}

export interface OrderStatusSmsParams {
  orderId: string;
  status: string;
  prevStatus?: string;
  phone?: string;
  customerName?: string;
  orderType?: 'delivery' | 'pickup' | string;
}

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
  type: 'HEARTBEAT' | 'AUTH_FAILURE' | 'TEST_PING' | 'STATUS_CHANGE' | 'SMS_QUEUED' | 'SMS_SENT' | 'SMS_FAILED' | 'SMS_SKIPPED';
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
 * Validates phone numbers: accepts international (+91...) or standard 10-15 digit formats.
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?[1-9]\d{7,14}$/.test(clean);
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

  /**
   * In-memory queue store with deduplication and state tracking
   */
  private queue: Map<string, SmsJob> = new Map();

  /**
   * Set of processed transition idempotency keys to prevent duplicate execution
   */
  private processedTransitions: Set<string> = new Set();

  constructor() {
    this.addLog('STATUS_CHANGE', 'Frosty Bite SMS Server communication layer initialized.');
  }

  /**
   * Safely adds an audit log entry (capped at last 50 entries, no sensitive secrets logged).
   */
  public addLog(type: GatewayHeartbeatLog['type'], message: string, details?: Record<string, any>) {
    const entry: GatewayHeartbeatLog = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details: details ? this.sanitizeDetails(details) : undefined
    };

    this.state.logs.unshift(entry);
    if (this.state.logs.length > 50) {
      this.state.logs = this.state.logs.slice(0, 50);
    }
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const safe: Record<string, any> = {};
    for (const [key, val] of Object.entries(details)) {
      const lower = key.toLowerCase();
      if (lower.includes('key') || lower.includes('secret') || lower.includes('token') || lower.includes('password') || lower.includes('otp')) {
        safe[key] = '[REDACTED]';
      } else if (lower.includes('phone') || lower.includes('recipient')) {
        // Mask phone: show last 4 digits only
        const str = String(val);
        safe[key] = str.length > 4 ? `***${str.slice(-4)}` : '***';
      } else {
        safe[key] = val;
      }
    }
    return safe;
  }

  /**
   * Normalizes customer phone numbers to standard format (+91XXXXXXXXXX)
   */
  public normalizePhoneNumber(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = String(phone).replace(/[^0-9]/g, '');

    if (digits.length === 10) {
      return `+91${digits}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    } else if (digits.length >= 10 && digits.length <= 15) {
      return `+${digits}`;
    }

    return null;
  }

  /**
   * Validates if the incoming request comes with a valid Android SMS Gateway API key.
   */
  public validateApiKey(providedKey?: string): boolean {
    const configuredKey = process.env.SMS_GATEWAY_API_KEY || process.env.FROSTY_SMS_GATEWAY_KEY;

    if (!configuredKey) {
      if (process.env.NODE_ENV !== 'production') {
        return true;
      }
      return false;
    }

    if (!providedKey) return false;
    return providedKey.trim() === configuredKey.trim();
  }

  /**
   * Queues an SMS message with strict idempotency and phone validation.
   * SMS failure is safe and will never throw fatal errors.
   */
  public async queueSms(params: QueueSmsParams): Promise<{
    ok: boolean;
    job?: SmsJob;
    duplicate?: boolean;
    skipped?: boolean;
    reason?: string;
  }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(params.recipient);

      if (!normalizedPhone) {
        this.addLog('SMS_SKIPPED', `SMS skipped: Missing or invalid customer phone number (Order: ${params.orderId || 'N/A'}, Type: ${params.type})`);
        console.warn(`[SMS Gateway] SMS skipped: Invalid phone for order ${params.orderId || 'N/A'}`);
        return {
          ok: false,
          skipped: true,
          reason: 'Invalid or missing customer phone number'
        };
      }

      const cleanOrderId = params.orderId ? String(params.orderId).trim() : undefined;
      const idempotencyKey = params.idempotencyKey || `order:${cleanOrderId || 'no_order'}:${params.type}`;

      // 1. Idempotency Check: Prevent duplicate SMS jobs
      if (this.queue.has(idempotencyKey)) {
        const existingJob = this.queue.get(idempotencyKey)!;
        this.addLog('SMS_SKIPPED', `Duplicate SMS skipped for key: ${idempotencyKey}`, {
          orderId: cleanOrderId,
          type: params.type,
          status: existingJob.status
        });
        console.log(`[SMS Gateway] Duplicate SMS prevented for key=${idempotencyKey} (Status: ${existingJob.status})`);
        return {
          ok: true,
          duplicate: true,
          job: existingJob,
          reason: `Duplicate SMS job already exists (${existingJob.status})`
        };
      }

      // Check database duplicate if Supabase table is available
      try {
        const { data: existingDbJob } = await supabase
          .from('sms_queue')
          .select('*')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();

        if (existingDbJob) {
          this.queue.set(idempotencyKey, existingDbJob as SmsJob);
          return {
            ok: true,
            duplicate: true,
            job: existingDbJob as SmsJob,
            reason: `Duplicate SMS job already recorded in database`
          };
        }
      } catch (_) {}

      // 2. Create new SMS Job
      const nowIso = new Date().toISOString();
      const jobId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const newJob: SmsJob = {
        id: jobId,
        recipient: normalizedPhone,
        message: params.message.trim(),
        type: params.type,
        orderId: cleanOrderId,
        status: 'QUEUED',
        priority: params.priority || 'HIGH',
        idempotencyKey,
        createdAt: nowIso,
        updatedAt: nowIso,
        retryCount: 0
      };

      // Store in memory queue
      this.queue.set(idempotencyKey, newJob);

      // Keep queue map within memory bounds (max 500 jobs)
      if (this.queue.size > 500) {
        const firstKey = this.queue.keys().next().value;
        if (firstKey) this.queue.delete(firstKey);
      }

      this.addLog('SMS_QUEUED', `SMS queued: ${params.type} for Order #${cleanOrderId || 'N/A'}`, {
        jobId,
        type: params.type,
        orderId: cleanOrderId,
        priority: newJob.priority,
        recipient: normalizedPhone
      });

      console.log(`[SMS Gateway] 📨 SMS queued successfully: ID=${jobId}, Type=${params.type}, Order=#${cleanOrderId || 'N/A'}`);

      // 3. Optional non-blocking persistence to Supabase sms_queue table
      this.persistJobToDatabase(newJob).catch((err) => {
        // Non-blocking catch
      });

      return {
        ok: true,
        job: newJob
      };
    } catch (err: any) {
      console.error('[SMS Gateway] Unexpected error queueing SMS:', err);
      return {
        ok: false,
        skipped: true,
        reason: err?.message || 'Failed to queue SMS'
      };
    }
  }

  /**
   * Handles an order status transition and queues the appropriate SMS.
   * Maps real Frosty Bite order lifecycle states to SMS templates.
   */
  public async handleOrderStatusTransition(params: OrderStatusSmsParams): Promise<{
    ok: boolean;
    job?: SmsJob;
    skipped?: boolean;
    duplicate?: boolean;
    reason?: string;
  }> {
    try {
      const { orderId, status, prevStatus, customerName, orderType } = params;

      if (!orderId || !status) {
        return { ok: false, skipped: true, reason: 'orderId and status are required' };
      }

      const cleanOrderId = String(orderId).trim();
      const cleanStatus = String(status).trim().toLowerCase();
      const cleanPrevStatus = prevStatus ? String(prevStatus).trim().toLowerCase() : undefined;

      // Duplicate Transition Guard: If same status is saved again, skip SMS
      if (cleanPrevStatus && cleanPrevStatus === cleanStatus) {
        return {
          ok: true,
          skipped: true,
          reason: `Order is already in '${cleanStatus}' status. No transition occurred.`
        };
      }

      const transitionKey = `transition:${cleanOrderId}:${cleanStatus}`;
      if (this.processedTransitions.has(transitionKey)) {
        return {
          ok: true,
          duplicate: true,
          reason: `Transition '${transitionKey}' already executed.`
        };
      }

      // 1. Resolve Order Phone and Type from trusted Supabase database
      let resolvedPhone = params.phone;
      let resolvedType = orderType;
      let resolvedOrder: any = null;

      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, phone, customer_name, order_type, address')
          .eq('id', cleanOrderId)
          .maybeSingle();

        if (orderData) {
          resolvedOrder = orderData;
          // Strictly prioritize phone and order details recorded in database
          resolvedPhone = orderData.phone || resolvedPhone;
          resolvedType = orderData.order_type || resolvedType;
        }
      } catch (_) {}

      const isPickup = resolvedType === 'pickup' || 
                       resolvedOrder?.order_type === 'pickup' || 
                       String(resolvedOrder?.address || '').toLowerCase().includes('in-store pickup');

      const formattedOrderId = cleanOrderId.length > 8 ? cleanOrderId.substring(0, 8).toUpperCase() : cleanOrderId.toUpperCase();

      // 2. Map Order Status to SMS Type and Message Template
      let smsType: SmsType | null = null;
      let message = '';

      switch (cleanStatus) {
        case 'pending':
        case 'created':
        case 'awaiting_payment':
          smsType = 'ORDER_RECEIVED';
          message = `Frosty Bite: Your order #${formattedOrderId} has been received successfully. We will update you when your order is confirmed.`;
          break;

        case 'confirmed':
          smsType = 'ORDER_ACCEPTED';
          message = `Frosty Bite: Your order #${formattedOrderId} has been confirmed and accepted. Thank you for ordering with us!`;
          break;

        case 'preparing':
          smsType = 'ORDER_PREPARING';
          message = `Frosty Bite: Your order #${formattedOrderId} is now being prepared.`;
          break;

        case 'out_for_delivery':
        case 'ready':
          smsType = 'OUT_FOR_DELIVERY';
          if (isPickup) {
            message = `Frosty Bite: Your order #${formattedOrderId} is ready for pickup at our bakery. We look forward to serving you!`;
          } else {
            message = `Frosty Bite: Your order #${formattedOrderId} is out for delivery. It will reach you soon.`;
          }
          break;

        case 'delivered':
          smsType = 'ORDER_DELIVERED';
          if (isPickup) {
            message = `Frosty Bite: Your order #${formattedOrderId} has been picked up successfully. Thank you for choosing Frosty Bite!`;
          } else {
            message = `Frosty Bite: Your order #${formattedOrderId} has been delivered successfully. Thank you for choosing Frosty Bite!`;
          }
          break;

        default:
          // Unmapped status (e.g. cancelled) - skip without error
          return {
            ok: true,
            skipped: true,
            reason: `No automated SMS mapped for status '${cleanStatus}'`
          };
      }

      if (!smsType || !message) {
        return { ok: true, skipped: true, reason: 'No matching SMS template' };
      }

      // Mark transition as processed
      this.processedTransitions.add(transitionKey);
      if (this.processedTransitions.size > 1000) {
        const first = this.processedTransitions.values().next().value;
        if (first) this.processedTransitions.delete(first);
      }

      // 3. Queue the SMS Job
      const queueResult = await this.queueSms({
        recipient: resolvedPhone || '',
        message,
        type: smsType,
        orderId: cleanOrderId,
        priority: 'HIGH',
        idempotencyKey: `order:${cleanOrderId}:${smsType}`
      });

      return queueResult;
    } catch (err: any) {
      console.error('[SMS Gateway] Error handling order status transition:', err);
      return {
        ok: false,
        skipped: true,
        reason: err?.message || 'Error handling order status transition'
      };
    }
  }

  /**
   * Retrieves all pending jobs for Android SMS Gateway polling.
   */
  public getPendingJobs(): SmsJob[] {
    const jobs: SmsJob[] = [];
    for (const job of this.queue.values()) {
      if (job.status === 'QUEUED') {
        jobs.push(job);
      }
    }

    // Sort: HIGH priority first, then FIFO by createdAt
    const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };
    return jobs.sort((a, b) => {
      const pDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  /**
   * Acknowledges SMS delivery status from Android Gateway device.
   */
  public async acknowledgeJob(jobId: string, status: 'SENT' | 'FAILED', error?: string): Promise<{ ok: boolean; message: string }> {
    let foundJob: SmsJob | null = null;

    for (const job of this.queue.values()) {
      if (job.id === jobId) {
        foundJob = job;
        break;
      }
    }

    const nowIso = new Date().toISOString();

    if (foundJob) {
      foundJob.status = status;
      foundJob.updatedAt = nowIso;
      if (status === 'SENT') {
        foundJob.sentAt = nowIso;
        this.addLog('SMS_SENT', `SMS sent successfully: Job ${jobId} (${foundJob.type})`, {
          jobId,
          type: foundJob.type,
          orderId: foundJob.orderId,
          recipient: foundJob.recipient
        });
      } else {
        foundJob.error = error || 'Delivery failed on Android SIM device';
        this.addLog('SMS_FAILED', `SMS delivery failed: Job ${jobId} (${foundJob.error})`, {
          jobId,
          type: foundJob.type,
          orderId: foundJob.orderId,
          error: foundJob.error
        });
      }

      this.persistJobToDatabase(foundJob).catch(() => {});
      return { ok: true, message: `Job ${jobId} marked as ${status}` };
    }

    return { ok: true, message: `Job ${jobId} acknowledged` };
  }

  /**
   * Processes a heartbeat payload from the Android SMS Gateway application.
   */
  public async processHeartbeat(payload: Partial<GatewayDeviceInfo>, clientIp?: string): Promise<{ ok: boolean; message: string; gatewayState: 'ONLINE' | 'OFFLINE' }> {
    const now = Date.now();
    const isoNow = new Date(now).toISOString();

    const expectedDeviceId = process.env.SMS_GATEWAY_DEVICE_ID;
    const incomingDeviceId = payload.deviceId || 'frosty-sms-gateway-01';

    if (expectedDeviceId && payload.deviceId && payload.deviceId !== expectedDeviceId) {
      this.addLog('AUTH_FAILURE', `Heartbeat rejected: Device ID mismatch (Expected: ${expectedDeviceId}, Received: ${payload.deviceId})`);
      return {
        ok: false,
        message: `Device ID mismatch`,
        gatewayState: 'OFFLINE'
      };
    }

    const simReady = payload.simReady !== false && payload.status?.toLowerCase() !== 'sim_error';
    const smsReady = payload.smsReady !== false;
    const permissionGranted = payload.permissionGranted !== false;

    this.state.deviceInfo = {
      deviceId: incomingDeviceId,
      status: payload.status || 'READY',
      simReady,
      smsReady,
      permissionGranted,
      batteryLevel: payload.batteryLevel,
      networkType: payload.networkType || 'Cellular/WiFi',
      signalStrength: payload.signalStrength || 'Good',
      simOperator: payload.simOperator || 'Active SIM',
      appVersion: payload.appVersion || '1.0.0',
      ip: clientIp || payload.ip || '127.0.0.1'
    };

    this.state.lastHeartbeat = isoNow;
    this.state.lastHeartbeatTimestampMs = now;
    this.state.heartbeatCount += 1;
    this.state.serverStatus = 'CONNECTED';

    const isOnline = simReady && smsReady && permissionGranted;
    this.state.gatewayStatus = isOnline ? 'ONLINE' : 'OFFLINE';

    this.addLog('HEARTBEAT', `Heartbeat acknowledged from device: ${incomingDeviceId}`, {
      status: this.state.deviceInfo.status,
      simReady,
      smsReady,
      permissionGranted,
      battery: payload.batteryLevel,
      network: payload.networkType,
      appVersion: payload.appVersion
    });

    console.log(`[SMS Gateway] Heartbeat acknowledged from device: ${incomingDeviceId} (SIM: ${simReady ? 'READY' : 'NOT READY'}, SMS: ${smsReady ? 'READY' : 'DISABLED'})`);

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
    pendingQueueCount: number;
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
      const isDeviceHealthy = this.state.deviceInfo?.simReady && this.state.deviceInfo?.smsReady && this.state.deviceInfo?.permissionGranted;

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
      pendingQueueCount: this.getPendingJobs().length,
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
    pendingQueueCount: number;
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
      pendingQueueCount: currentStatus.pendingQueueCount,
      device: currentStatus.device,
      message
    };
  }

  /**
   * Non-blocking persistence to Supabase sms_queue table if table is provisioned
   */
  private async persistJobToDatabase(job: SmsJob): Promise<void> {
    try {
      await supabase
        .from('sms_queue')
        .upsert({
          id: job.id,
          recipient: job.recipient,
          message: job.message,
          type: job.type,
          order_id: job.orderId,
          status: job.status,
          priority: job.priority,
          idempotency_key: job.idempotencyKey,
          error: job.error,
          sent_at: job.sentAt,
          updated_at: job.updatedAt,
          created_at: job.createdAt
        }, { onConflict: 'id' });
    } catch (_) {
      // Graceful fallback to memory store
    }
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
      // Optional persistence
    }
  }
}

export const SmsGatewayService = new SmsGatewayServiceClass();
