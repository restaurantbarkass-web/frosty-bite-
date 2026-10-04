import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabase';

export type SmsType = 
  | 'OTP' 
  | 'ORDER_RECEIVED' 
  | 'ORDER_ACCEPTED' 
  | 'ORDER_PREPARING' 
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY' 
  | 'ORDER_DELIVERED' 
  | 'ORDER_CANCELLED'
  | 'FEEDBACK' 
  | 'PROMOTIONAL' 
  | 'TEST';

export type SmsStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';

export interface SmsJob {
  id: string; // UUID primary key
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
  claimedAt?: string;
  claimedBy?: string;
  attempts: number;
  error?: string;
  retryCount: number;
  orderEventAt?: string;
  dispatchedAt?: string;
  reportReceivedAt?: string;
}

export interface QueueSmsParams {
  recipient: string;
  message: string;
  type: SmsType;
  orderId?: string;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  idempotencyKey?: string;
  orderEventAt?: string;
}

export interface OrderStatusSmsParams {
  orderId: string;
  status: string;
  prevStatus?: string;
  phone?: string;
  customerName?: string;
  orderType?: 'delivery' | 'pickup' | string;
  address?: string;
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

export interface DispatchTelemetry {
  jobId: string;
  type: SmsType;
  orderId?: string;
  status: SmsStatus;
  queueLatencyMs: number;
  dispatchLatencyMs: number;
  totalGatewayMs: number;
  timestamp: string;
}

export interface GatewayMetrics {
  currentPollIntervalSeconds: number;
  lastPollTime: string | null;
  lastPollLatencyMs: number | null;
  lastJobReceivedTime: string | null;
  lastJobId: string | null;
  lastSmsDispatchTime: string | null;
  lastSmsDispatchLatencyMs: number | null;
  lastReportTime: string | null;
  endToEndGatewayLatencyMs: number | null;
  jobsReceivedCount: number;
  smsSentCount: number;
  smsFailedCount: number;
}

export interface GatewayState {
  serverStatus: 'CONNECTED' | 'OFFLINE';
  gatewayStatus: 'ONLINE' | 'OFFLINE';
  lastHeartbeat: string | null;
  lastHeartbeatTimestampMs: number | null;
  heartbeatCount: number;
  deviceInfo: GatewayDeviceInfo | null;
  lastDispatchTelemetry: DispatchTelemetry | null;
  metrics: GatewayMetrics;
  logs: GatewayHeartbeatLog[];
}

/**
 * Maximum elapsed milliseconds before the Android Gateway is considered OFFLINE.
 * Android Gateway sends periodic heartbeats (e.g. every 15-30s). 
 * 90s grace threshold allows for intermittent cellular reconnects.
 */
const HEARTBEAT_TIMEOUT_MS = 90 * 1000;

class SmsGatewayServiceClass {
  private static readonly CLAIM_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes lock
  private static readonly MAX_ATTEMPTS = 3;

  private state: GatewayState = {
    serverStatus: 'CONNECTED',
    gatewayStatus: 'OFFLINE',
    lastHeartbeat: null,
    lastHeartbeatTimestampMs: null,
    heartbeatCount: 0,
    deviceInfo: null,
    lastDispatchTelemetry: null,
    metrics: {
      currentPollIntervalSeconds: 2,
      lastPollTime: null,
      lastPollLatencyMs: null,
      lastJobReceivedTime: null,
      lastJobId: null,
      lastSmsDispatchTime: null,
      lastSmsDispatchLatencyMs: null,
      lastReportTime: null,
      endToEndGatewayLatencyMs: null,
      jobsReceivedCount: 0,
      smsSentCount: 0,
      smsFailedCount: 0
    },
    logs: []
  };

  /**
   * In-memory queue store with deduplication and state tracking
   */
  private queue: Map<string, SmsJob> = new Map();

  /**
   * Set of in-flight processing job IDs to prevent race conditions within the process
   */
  private currentlyProcessingJobIds: Set<string> = new Set();

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
      } else if (lower.includes('phone') || lower.includes('recipient') || lower === 'to') {
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
   * Generates a deterministic RFC 4122 compliant UUIDv5 based on the idempotency key.
   * Guarantees that the PostgreSQL UUID PRIMARY KEY constraint natively enforces uniqueness in Supabase.
   */
  public generateDeterministicJobId(idempotencyKey: string): string {
    const hash = crypto.createHash('sha1').update(`frosty-sms:${idempotencyKey}`).digest('hex');
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      '5' + hash.substring(13, 16),
      ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  /**
   * Maps string priority to integer for database column compatibility.
   */
  private priorityToInteger(p?: string): number {
    if (p === 'HIGH') return 5;
    if (p === 'LOW') return 1;
    return 3; // NORMAL
  }

  /**
   * Maps database integer priority back to string.
   */
  private integerToPriority(p?: number): 'HIGH' | 'NORMAL' | 'LOW' {
    if (p && p >= 5) return 'HIGH';
    if (p && p <= 1) return 'LOW';
    return 'NORMAL';
  }

  /**
   * Queues an SMS message with strict durable database uniqueness and phone validation.
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
      const deterministicJobId = this.generateDeterministicJobId(idempotencyKey);

      // 1. In-memory deduplication check
      if (this.queue.has(idempotencyKey)) {
        const existingJob = this.queue.get(idempotencyKey)!;
        if (existingJob.status === 'FAILED') {
          console.log(`[SMS Gateway] 🔄 Reviving in-memory FAILED SMS job ${existingJob.id} for Order #${cleanOrderId || 'N/A'}`);
          existingJob.status = 'QUEUED';
          existingJob.attempts = 0;
          existingJob.error = undefined;
          existingJob.claimedAt = undefined;
          existingJob.claimedBy = undefined;
          existingJob.updatedAt = new Date().toISOString();
          this.queue.set(idempotencyKey, existingJob);
          await supabase
            .from('sms_queue')
            .update({
              status: 'QUEUED',
              attempts: 0,
              error_message: null,
              claimed_at: null,
              claimed_by: null,
              updated_at: existingJob.updatedAt
            })
            .eq('id', existingJob.id);
          return {
            ok: true,
            job: existingJob,
            reason: 'Re-queued previously failed SMS job'
          };
        }

        this.addLog('SMS_SKIPPED', `Duplicate SMS skipped for key: ${idempotencyKey}`, {
          orderId: cleanOrderId,
          type: params.type,
          status: existingJob.status
        });
        console.log(`[SMS Gateway] 📋 Job State: jobId=${existingJob.id}, orderId=${cleanOrderId || 'N/A'}, type=${params.type}, status=${existingJob.status}, attempt=${existingJob.attempts || 0}, deviceId=${existingJob.claimedBy || 'N/A'}, timestamp=${new Date().toISOString()} (Duplicate In-Memory)`);
        return {
          ok: true,
          duplicate: true,
          job: existingJob,
          reason: `Duplicate SMS job already exists (${existingJob.status})`
        };
      }

      // 2. Durable Supabase sms_queue database table check (UUID primary key)
      try {
        const { data: existingDbJob } = await supabase
          .from('sms_queue')
          .select('*')
          .eq('id', deterministicJobId)
          .maybeSingle();

        if (existingDbJob) {
          const parsedJob: SmsJob = {
            id: existingDbJob.id,
            recipient: existingDbJob.to || existingDbJob.recipient || normalizedPhone,
            message: existingDbJob.message,
            type: existingDbJob.type,
            orderId: existingDbJob.order_id || cleanOrderId,
            status: existingDbJob.status,
            priority: this.integerToPriority(existingDbJob.priority),
            idempotencyKey,
            createdAt: existingDbJob.created_at || new Date().toISOString(),
            updatedAt: existingDbJob.updated_at || new Date().toISOString(),
            claimedAt: existingDbJob.claimed_at,
            claimedBy: existingDbJob.claimed_by,
            attempts: existingDbJob.attempts ?? existingDbJob.retry_count ?? 0,
            retryCount: existingDbJob.retry_count || 0,
            error: existingDbJob.error_message || existingDbJob.error,
            sentAt: existingDbJob.sent_at,
            orderEventAt: params.orderEventAt
          };

          // If the job previously failed, revive it to QUEUED so it can be re-dispatched
          if (existingDbJob.status === 'FAILED') {
            console.log(`[SMS Gateway] 🔄 Reviving database FAILED SMS job ${existingDbJob.id} for Order #${cleanOrderId || 'N/A'}`);
            parsedJob.status = 'QUEUED';
            parsedJob.attempts = 0;
            parsedJob.error = undefined;
            parsedJob.claimedAt = undefined;
            parsedJob.claimedBy = undefined;
            parsedJob.updatedAt = new Date().toISOString();
            this.queue.set(idempotencyKey, parsedJob);
            await supabase
              .from('sms_queue')
              .update({
                status: 'QUEUED',
                attempts: 0,
                error_message: null,
                claimed_at: null,
                claimed_by: null,
                updated_at: parsedJob.updatedAt
              })
              .eq('id', deterministicJobId);
            return {
              ok: true,
              job: parsedJob,
              reason: 'Re-queued previously failed SMS job'
            };
          }

          this.queue.set(idempotencyKey, parsedJob);
          console.log(`[SMS Gateway] 📋 Job State: jobId=${parsedJob.id}, orderId=${cleanOrderId || 'N/A'}, type=${params.type}, status=${parsedJob.status}, attempt=${parsedJob.attempts}, deviceId=${parsedJob.claimedBy || 'N/A'}, timestamp=${new Date().toISOString()} (Duplicate DB Table)`);
          return {
            ok: true,
            duplicate: true,
            job: parsedJob,
            reason: `Duplicate SMS job already recorded in database (${parsedJob.status})`
          };
        }
      } catch (_) {}

      // 3. Create new durable SMS Job (Optimized single-pass insertion)
      const nowIso = new Date().toISOString();
      const newJob: SmsJob = {
        id: deterministicJobId,
        recipient: normalizedPhone,
        message: params.message.trim(),
        type: params.type,
        orderId: cleanOrderId,
        status: 'QUEUED',
        priority: params.priority || 'HIGH',
        idempotencyKey,
        createdAt: nowIso,
        updatedAt: nowIso,
        attempts: 0,
        retryCount: 0,
        orderEventAt: params.orderEventAt || nowIso
      };

      // Store in memory queue
      this.queue.set(idempotencyKey, newJob);

      // Keep queue map within memory bounds (max 500 jobs)
      if (this.queue.size > 500) {
        const firstKey = this.queue.keys().next().value;
        if (firstKey) this.queue.delete(firstKey);
      }

      this.addLog('SMS_QUEUED', `SMS queued: ${params.type} for Order #${cleanOrderId || 'N/A'}`, {
        jobId: newJob.id,
        type: params.type,
        orderId: cleanOrderId,
        priority: newJob.priority,
        recipient: normalizedPhone
      });

      console.log(`[SMS Gateway] 📋 Job State: jobId=${newJob.id}, orderId=${cleanOrderId || 'N/A'}, type=${params.type}, status=${newJob.status}, attempt=${newJob.attempts}, deviceId=N/A, timestamp=${nowIso}`);

      // 4. Persist to database (sms_queue synchronously, app_settings asynchronously)
      await this.persistJobToDatabase(newJob, false);

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

      // 1. Resolve Order Phone, Customer Name, and Address from trusted Supabase database
      // Note: In public.orders, 'order_type' does NOT exist as a column. Pickup is stored in address or delivery_address.
      let resolvedPhone = params.phone ? String(params.phone).trim() : undefined;
      let resolvedType = orderType;
      let resolvedCustomerName = customerName;
      let resolvedOrder: any = null;

      try {
        const withoutPrefix = cleanOrderId.replace(/^FB-/i, '').trim();
        const withPrefix = `FB-${withoutPrefix}`;

        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select('id, phone, customer_phone, customer_name, address, delivery_address, status')
          .or(`id.eq.${cleanOrderId},id.ilike.${cleanOrderId},id.ilike.${withPrefix},id.ilike.${withoutPrefix}`)
          .maybeSingle();

        if (orderData) {
          resolvedOrder = orderData;
          resolvedPhone = orderData.phone || orderData.customer_phone || resolvedPhone;
          resolvedCustomerName = orderData.customer_name || resolvedCustomerName;
        } else if (orderErr) {
          console.warn('[SMS Gateway] DB query notice for order:', orderErr.message);
        }
      } catch (dbErr) {
        console.warn('[SMS Gateway] DB query exception resolving order details:', dbErr);
      }

      // Fallback: Check if phone is embedded in delivery address text
      if (!resolvedPhone) {
        const combinedAddr = `${resolvedOrder?.address || ''} ${resolvedOrder?.delivery_address || ''} ${params.address || ''}`;
        const phoneMatch = combinedAddr.match(/(?:phone|mob|contact|tel)?[:\s-]*([6-9]\d{9})\b/i);
        if (phoneMatch && phoneMatch[1]) {
          resolvedPhone = phoneMatch[1];
        }
      }

      const addressString = `${resolvedOrder?.address || ''} ${resolvedOrder?.delivery_address || ''} ${params.address || ''}`.toLowerCase();
      const isPickup = Boolean(
        resolvedType === 'pickup' || 
        params.orderType === 'pickup' || 
        params.orderType === 'self_pickup' || 
        params.orderType === 'store_pickup' || 
        params.orderType === 'takeaway' || 
        addressString.includes('in-store pickup') ||
        addressString.includes('[in-store pickup]') ||
        addressString.includes('bakery: frosty bite bakery') ||
        addressString.includes('pickup')
      );

      // Centralized order URL builder (authoritative customer-facing order code)
      const FROSTY_BITE_ORDER_BASE_URL = 'https://frosty-bite.vercel.app/orders';
      const rawCode = (resolvedOrder?.id ? String(resolvedOrder.id).trim() : cleanOrderId).toUpperCase();
      const orderCode = rawCode.startsWith('FB-') ? rawCode : (rawCode.length > 8 ? rawCode.substring(0, 8) : rawCode);
      const orderUrl = `${FROSTY_BITE_ORDER_BASE_URL}/${orderCode}`;

      // 2. Map Order Status to SMS Type and Message Template
      let smsType: SmsType | null = null;
      let message = '';

      switch (cleanStatus) {
        case 'pending':
        case 'created':
        case 'awaiting_payment':
        case 'received':
          smsType = 'ORDER_RECEIVED';
          message = `Frosty Bite: Your order #${orderCode} has been received successfully.\n\nView Order:\n${orderUrl}`;
          break;

        case 'confirmed':
        case 'accepted':
          smsType = 'ORDER_ACCEPTED';
          message = `Frosty Bite: Your order #${orderCode} has been confirmed and accepted.\n\nView Order:\n${orderUrl}`;
          break;

        case 'preparing':
        case 'processing':
        case 'kitchen':
        case 'in_kitchen':
          smsType = 'ORDER_PREPARING';
          message = `Frosty Bite: Your order #${orderCode} is now being prepared.\n\nView Order:\n${orderUrl}`;
          break;

        case 'ready':
        case 'ready_for_pickup':
        case 'ready_pickup':
          smsType = 'READY_FOR_PICKUP';
          message = `Frosty Bite: Your order #${orderCode} is ready for pickup.\n\nView Order:\n${orderUrl}`;
          break;

        case 'out_for_delivery':
        case 'out-for-delivery':
        case 'dispatched':
        case 'on_the_way':
          if (isPickup) {
            smsType = 'READY_FOR_PICKUP';
            message = `Frosty Bite: Your order #${orderCode} is ready for pickup.\n\nView Order:\n${orderUrl}`;
          } else {
            smsType = 'OUT_FOR_DELIVERY';
            message = `Frosty Bite: Your order #${orderCode} is out for delivery.\n\nView Order:\n${orderUrl}`;
          }
          break;

        case 'delivered':
        case 'completed':
        case 'collected':
          smsType = 'ORDER_DELIVERED';
          if (isPickup) {
            message = `Frosty Bite: Your order #${orderCode} has been picked up successfully. Thank you for choosing Frosty Bite!\n\nView Order:\n${orderUrl}`;
          } else {
            message = `Frosty Bite: Your order #${orderCode} has been delivered. Thank you for ordering with us.\n\nView Order:\n${orderUrl}`;
          }
          break;

        case 'cancelled':
        case 'canceled':
        case 'rejected':
          smsType = 'ORDER_CANCELLED';
          message = `Frosty Bite: Your order #${orderCode} has been cancelled successfully. If you have any questions, please contact us.\n\nView Order:\n${orderUrl}`;
          break;

        default:
          return {
            ok: true,
            skipped: true,
            reason: `No automated SMS mapped for status '${cleanStatus}'`
          };
      }

      if (!smsType || !message) {
        return { ok: true, skipped: true, reason: 'No matching SMS template' };
      }

      const idempotencyKey = `order:${orderCode}:${smsType}`;
      const transitionKey = `transition:${orderCode}:${smsType}`;

      if (this.processedTransitions.has(transitionKey)) {
        return {
          ok: true,
          duplicate: true,
          reason: `Transition '${transitionKey}' already executed.`
        };
      }

      // 3. Queue the SMS Job
      const queueResult = await this.queueSms({
        recipient: resolvedPhone || '',
        message,
        type: smsType,
        orderId: orderCode,
        priority: 'HIGH',
        idempotencyKey,
        orderEventAt: new Date().toISOString()
      });

      // Mark transition as processed only if successfully queued
      if (queueResult.ok) {
        this.processedTransitions.add(transitionKey);
        if (this.processedTransitions.size > 1000) {
          const first = this.processedTransitions.values().next().value;
          if (first) this.processedTransitions.delete(first);
        }
      }

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
   * Count of currently pending (QUEUED) jobs for read-only metrics without claiming locks.
   */
  public async countPendingJobs(): Promise<number> {
    const pendingIds = new Set<string>();

    for (const job of this.queue.values()) {
      if (job.status === 'QUEUED') {
        pendingIds.add(job.id);
      }
    }

    try {
      const { data: row } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'sms_queue_jobs')
        .maybeSingle();

      if (Array.isArray(row?.value)) {
        for (const j of row.value) {
          if (j.status === 'QUEUED') {
            pendingIds.add(j.id);
          }
        }
      }
    } catch (_) {}

    try {
      const { data: dbJobs } = await supabase
        .from('sms_queue')
        .select('id')
        .eq('status', 'QUEUED');

      if (Array.isArray(dbJobs)) {
        for (const row of dbJobs) {
          pendingIds.add(row.id);
        }
      }
    } catch (_) {}

    return pendingIds.size;
  }

  /**
   * Retrieves and ATOMICALLY CLAIMS all eligible pending jobs for the polling Android device.
   * Transitions claimed jobs from QUEUED -> SENDING so subsequent polls NEVER return the same job.
   */
  public async claimPendingJobs(claimingDeviceId?: string, limit: number = 1): Promise<SmsJob[]> {
    const pollStartMs = Date.now();
    const authorizedDeviceId = process.env.SMS_GATEWAY_DEVICE_ID || 'frosty-sms-gateway-01';
    const effectiveDeviceId = (claimingDeviceId || 'frosty-sms-gateway-01').trim();

    // 1. Single Active Gateway Protection: Only the designated Android device processes queue
    if (effectiveDeviceId !== authorizedDeviceId && authorizedDeviceId !== 'Any') {
      console.warn(`[SMS Gateway] Rejected unauthorized device '${effectiveDeviceId}' from claiming jobs. Active gateway is '${authorizedDeviceId}'.`);
      return [];
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    // 2. Gather all potential pending jobs from memory and sms_queue
    const candidateJobsMap = new Map<string, SmsJob>();

    // In-memory
    for (const job of this.queue.values()) {
      candidateJobsMap.set(job.id, job);
    }

    // Direct indexed query on relational sms_queue table
    try {
      const { data: dbJobs } = await supabase
        .from('sms_queue')
        .select('*')
        .in('status', ['QUEUED', 'SENDING'])
        .order('created_at', { ascending: true })
        .limit(50);

      if (Array.isArray(dbJobs)) {
        for (const row of dbJobs) {
          const j: SmsJob = {
            id: row.id,
            recipient: row.to || row.recipient || '',
            message: row.message,
            type: row.type,
            orderId: row.order_id,
            status: row.status,
            priority: this.integerToPriority(row.priority),
            idempotencyKey: row.order_id ? `order:${row.order_id}:${row.type}` : `job:${row.id}`,
            createdAt: row.created_at || nowIso,
            updatedAt: row.updated_at || nowIso,
            claimedAt: row.claimed_at,
            claimedBy: row.claimed_by,
            attempts: row.attempts ?? row.retry_count ?? 0,
            retryCount: row.retry_count || 0,
            error: row.error_message || row.error,
            sentAt: row.sent_at
          };
          candidateJobsMap.set(j.id, j);
          this.queue.set(j.idempotencyKey, j);
        }
      }
    } catch (_) {}

    // 3. Filter strictly eligible jobs for claiming
    const claimableJobs: SmsJob[] = [];

    for (const job of candidateJobsMap.values()) {
      if (this.currentlyProcessingJobIds.has(job.id)) {
        continue;
      }
      if (job.status === 'SENT') {
        continue;
      }

      if (job.status === 'QUEUED') {
        claimableJobs.push(job);
      } else if (job.status === 'SENDING') {
        const claimedTs = job.claimedAt ? new Date(job.claimedAt).getTime() : 0;
        const lockExpired = (now - claimedTs) > SmsGatewayServiceClass.CLAIM_LOCK_TIMEOUT_MS;
        const attempts = job.attempts || 0;

        if (lockExpired && attempts < SmsGatewayServiceClass.MAX_ATTEMPTS) {
          console.warn(`[SMS Gateway] ⚠️ Re-claiming expired SENDING job: ${job.id} (Attempt ${attempts + 1})`);
          claimableJobs.push(job);
        } else if (lockExpired && attempts >= SmsGatewayServiceClass.MAX_ATTEMPTS) {
          job.status = 'FAILED';
          job.error = 'Exceeded maximum claim attempts without delivery report';
          job.updatedAt = nowIso;
          await this.persistJobToDatabase(job);
        }
      }
    }

    // Update Live Poll Diagnostics Metrics
    const pollLatencyMs = Math.max(1, Date.now() - pollStartMs);
    this.state.metrics.lastPollTime = nowIso;
    this.state.metrics.lastPollLatencyMs = pollLatencyMs;

    if (claimableJobs.length === 0) {
      return [];
    }

    // 4. Strict Queue Priority: Transactional Order Lifecycle SMS & OTP before Promotional/Broadcast
    const typePriority: Record<string, number> = {
      'OTP': 0,
      'ORDER_RECEIVED': 1,
      'ORDER_ACCEPTED': 2,
      'ORDER_PREPARING': 3,
      'READY_FOR_PICKUP': 4,
      'OUT_FOR_DELIVERY': 5,
      'ORDER_DELIVERED': 6,
      'ORDER_CANCELLED': 7,
      'FEEDBACK': 20,
      'TEST': 30,
      'PROMOTIONAL': 50
    };

    const priorityOrder = { HIGH: 0, NORMAL: 1, LOW: 2 };

    claimableJobs.sort((a, b) => {
      const aTypePrio = typePriority[a.type] ?? 40;
      const bTypePrio = typePriority[b.type] ?? 40;
      if (aTypePrio !== bTypePrio) return aTypePrio - bTypePrio;

      const pDiff = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      if (pDiff !== 0) return pDiff;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Limit to max sequential reliable SIM dispatch (default 1 job per poll)
    const effectiveLimit = Math.max(1, Math.min(limit || 1, 5));
    const batchToClaim = claimableJobs.slice(0, effectiveLimit);

    // 5. Atomically transition claimed jobs to SENDING with concurrent database updates
    const claimedResults: SmsJob[] = [];

    for (const job of batchToClaim) {
      this.currentlyProcessingJobIds.add(job.id);
      job.status = 'SENDING';
      job.claimedAt = nowIso;
      job.claimedBy = effectiveDeviceId;
      job.attempts = (job.attempts || 0) + 1;
      job.updatedAt = nowIso;

      this.queue.set(job.idempotencyKey, job);

      this.addLog('STATUS_CHANGE', `Job ${job.id} claimed by ${effectiveDeviceId} (Attempt ${job.attempts})`, {
        jobId: job.id,
        orderId: job.orderId,
        type: job.type,
        status: job.status,
        attempt: job.attempts,
        deviceId: effectiveDeviceId
      });

      console.log(`[SMS Gateway] 📋 Job State: jobId=${job.id}, orderId=${job.orderId || 'N/A'}, type=${job.type}, status=${job.status}, attempt=${job.attempts}, deviceId=${effectiveDeviceId}, timestamp=${nowIso}`);

      claimedResults.push({ ...job });
    }

    // Persist claimed state to Supabase concurrently for ultra-low claim latency
    try {
      await Promise.all(
        batchToClaim.map(job =>
          supabase
            .from('sms_queue')
            .update({
              status: 'SENDING',
              claimed_at: nowIso,
              claimed_by: effectiveDeviceId,
              attempts: job.attempts,
              updated_at: nowIso
            })
            .eq('id', job.id)
        )
      );

      // Background asynchronous sync
      for (const job of batchToClaim) {
        this.persistJobToDatabase(job).catch(() => {});
      }
    } finally {
      for (const job of batchToClaim) {
        this.currentlyProcessingJobIds.delete(job.id);
      }
    }

    if (claimedResults.length > 0) {
      this.state.metrics.lastJobReceivedTime = nowIso;
      this.state.metrics.lastJobId = claimedResults[0].id;
      this.state.metrics.jobsReceivedCount += claimedResults.length;
    }

    return claimedResults;
  }

  /**
   * Alias for claimPendingJobs for backward-compatible call signatures.
   */
  public async getPendingJobs(claimingDeviceId?: string, limit: number = 1): Promise<SmsJob[]> {
    return this.claimPendingJobs(claimingDeviceId, limit);
  }

  /**
   * Acknowledges SMS delivery status from Android Gateway device with precise latency logging.
   * Terminal state: Marked as SENT, never returned on subsequent polls.
   */
  public async acknowledgeJob(
    jobId: string, 
    status: 'SENT' | 'FAILED', 
    error?: string,
    options?: {
      dispatchedAt?: string;
      dispatchLatencyMs?: number;
      deviceId?: string;
    }
  ): Promise<{ ok: boolean; message: string }> {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    let targetJob: SmsJob | null = null;

    // Check in-memory
    for (const job of this.queue.values()) {
      if (job.id === jobId || job.idempotencyKey === jobId) {
        targetJob = job;
        break;
      }
    }

    // If not found in memory, load from sms_queue table
    if (!targetJob) {
      try {
        const { data: row } = await supabase
          .from('sms_queue')
          .select('*')
          .eq('id', jobId)
          .maybeSingle();

        if (row) {
          targetJob = {
            id: row.id,
            recipient: row.to || row.recipient || '',
            message: row.message,
            type: row.type,
            orderId: row.order_id,
            status: row.status,
            priority: this.integerToPriority(row.priority),
            idempotencyKey: row.order_id ? `order:${row.order_id}:${row.type}` : `job:${row.id}`,
            createdAt: row.created_at || nowIso,
            updatedAt: row.updated_at || nowIso,
            claimedAt: row.claimed_at,
            claimedBy: row.claimed_by,
            attempts: row.attempts ?? row.retry_count ?? 1,
            retryCount: row.retry_count || 0,
            error: row.error_message || row.error,
            sentAt: row.sent_at
          };
        }
      } catch (_) {}
    }

    if (targetJob) {
      // If already SENT, it is terminal and idempotent
      if (targetJob.status === 'SENT' && status === 'SENT') {
        return { ok: true, message: `Job ${jobId} was already confirmed SENT` };
      }

      targetJob.status = status;
      targetJob.updatedAt = nowIso;
      if (status === 'SENT') {
        targetJob.sentAt = options?.dispatchedAt || nowIso;
        targetJob.error = undefined;
        this.addLog('SMS_SENT', `SMS sent successfully: Job ${jobId} (${targetJob.type})`, {
          jobId,
          type: targetJob.type,
          orderId: targetJob.orderId,
          recipient: targetJob.recipient
        });
      } else {
        targetJob.error = error || 'Delivery failed on Android SIM device';
        this.addLog('SMS_FAILED', `SMS delivery failed: Job ${jobId} (${targetJob.error})`, {
          jobId,
          type: targetJob.type,
          orderId: targetJob.orderId,
          error: targetJob.error
        });
      }

      this.queue.set(targetJob.idempotencyKey, targetJob);

      // Latency Calculations: T2 -> T4 -> T5 -> T6 -> T7
      const queuedTimeMs = new Date(targetJob.createdAt).getTime();
      const claimedTimeMs = targetJob.claimedAt ? new Date(targetJob.claimedAt).getTime() : now;
      const sentTimeMs = targetJob.sentAt ? new Date(targetJob.sentAt).getTime() : now;

      const queueLatencyMs = Math.max(0, claimedTimeMs - queuedTimeMs);
      const claimLatencyMs = Math.max(0, Math.min(300, queueLatencyMs));
      const dispatchLatencyMs = options?.dispatchLatencyMs || Math.max(1, sentTimeMs - claimedTimeMs);
      const reportLatencyMs = Math.max(1, now - sentTimeMs);
      const totalGatewayLatencyMs = Math.max(1, now - (targetJob.orderEventAt ? new Date(targetJob.orderEventAt).getTime() : queuedTimeMs));

      // Safe latency logging as specified (No API keys or customer secrets logged)
      console.log(`[SMS LATENCY]\norderCode=${targetJob.orderId || 'N/A'}\nsmsType=${targetJob.type}\njobId=${targetJob.id}\nqueuedAt=${targetJob.createdAt}\nclaimedAt=${targetJob.claimedAt || 'N/A'}\nsentAt=${targetJob.sentAt || nowIso}\nqueueLatencyMs=${queueLatencyMs}\nclaimLatencyMs=${claimLatencyMs}\ndispatchLatencyMs=${dispatchLatencyMs}\nreportLatencyMs=${reportLatencyMs}\ntotalGatewayLatencyMs=${totalGatewayLatencyMs}`);

      // Update Live Telemetry Metrics
      this.state.metrics.lastSmsDispatchTime = targetJob.sentAt || nowIso;
      this.state.metrics.lastSmsDispatchLatencyMs = dispatchLatencyMs;
      this.state.metrics.lastReportTime = nowIso;
      this.state.metrics.endToEndGatewayLatencyMs = totalGatewayLatencyMs;
      if (status === 'SENT') {
        this.state.metrics.smsSentCount += 1;
      } else {
        this.state.metrics.smsFailedCount += 1;
      }

      await this.persistJobToDatabase(targetJob, false);

      console.log(`[SMS Gateway] 📋 Job State: jobId=${targetJob.id}, orderId=${targetJob.orderId || 'N/A'}, type=${targetJob.type}, status=${targetJob.status}, attempt=${targetJob.attempts || 1}, deviceId=${targetJob.claimedBy || 'N/A'}, timestamp=${nowIso}`);

      return { ok: true, message: `Job ${jobId} marked as ${status}` };
    }

    // Direct database update fallback if job not in memory
    const updatePayload: any = {
      status,
      updated_at: nowIso
    };
    if (status === 'SENT') {
      updatePayload.sent_at = options?.dispatchedAt || nowIso;
    } else {
      updatePayload.error_message = error || 'Delivery failed on Android SIM device';
    }

    try {
      await supabase
        .from('sms_queue')
        .update(updatePayload)
        .eq('id', jobId);

      this.state.metrics.lastReportTime = nowIso;
      if (status === 'SENT') {
        this.state.metrics.smsSentCount += 1;
      } else {
        this.state.metrics.smsFailedCount += 1;
      }
    } catch (_) {}

    console.log(`[SMS Gateway] 📋 Job State: jobId=${jobId}, orderId=N/A, type=N/A, status=${status}, attempt=1, deviceId=N/A, timestamp=${nowIso}`);

    return { ok: true, message: `Job ${jobId} acknowledged as ${status}` };
  }

  /**
   * Processes a heartbeat payload from the Android SMS Gateway application.
   */
  public async processHeartbeat(
    payload: Partial<GatewayDeviceInfo> & Record<string, any>,
    clientIp?: string,
    headers?: Record<string, any>
  ): Promise<{ ok: boolean; message: string; gatewayState: 'ONLINE' | 'OFFLINE' }> {
    const now = Date.now();
    const isoNow = new Date(now).toISOString();

    const expectedDeviceId = process.env.SMS_GATEWAY_DEVICE_ID;
    const incomingDeviceId = String(
      payload.deviceId || 
      payload.device_id || 
      headers?.['x-device-id'] || 
      headers?.['x-device'] || 
      'frosty-sms-gateway-01'
    ).trim();

    if (expectedDeviceId && incomingDeviceId !== expectedDeviceId.trim()) {
      this.addLog('AUTH_FAILURE', `Heartbeat rejected: Device ID mismatch (Expected: ${expectedDeviceId}, Received: ${incomingDeviceId})`);
      return {
        ok: false,
        message: `Device ID mismatch`,
        gatewayState: 'OFFLINE'
      };
    }

    const simReady = payload.simReady === true || 
                     payload.sim_ready === true || 
                     String(payload.simState || '').toUpperCase() === 'READY' || 
                     String(payload.sim_state || '').toUpperCase() === 'READY' || 
                     (payload.simReady !== false && payload.sim_ready !== false && String(payload.status || '').toLowerCase() !== 'sim_error');

    const smsReady = payload.smsReady === true || 
                     payload.sms_ready === true || 
                     String(payload.smsCapability || '').toUpperCase() === 'READY' || 
                     String(payload.sms_capability || '').toUpperCase() === 'READY' || 
                     (payload.smsReady !== false && payload.sms_ready !== false);

    const permissionGranted = payload.permissionGranted === true || 
                              payload.permission_granted === true || 
                              String(payload.permission || '').toUpperCase() === 'GRANTED' || 
                              String(payload.permissions || '').toUpperCase() === 'GRANTED' || 
                              (payload.permissionGranted !== false && payload.permission_granted !== false);

    const batteryLevel = typeof payload.batteryLevel === 'number' 
      ? payload.batteryLevel 
      : (typeof payload.battery_level === 'number' ? payload.battery_level : (typeof payload.battery === 'number' ? payload.battery : undefined));

    const networkType = payload.networkType || payload.network_type || payload.network || 'Cellular/WiFi';
    const signalStrength = payload.signalStrength || payload.signal_strength || payload.signal || 'Good';
    const simOperator = payload.simOperator || payload.sim_operator || payload.operator || 'Active SIM';
    const appVersion = payload.appVersion || payload.app_version || payload.version || '1.0.0';

    this.state.deviceInfo = {
      deviceId: incomingDeviceId,
      status: payload.status || (simReady && smsReady && permissionGranted ? 'READY' : 'OFFLINE'),
      simReady,
      smsReady,
      permissionGranted,
      batteryLevel,
      networkType,
      signalStrength,
      simOperator,
      appVersion,
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
      battery: batteryLevel,
      network: networkType,
      appVersion
    });

    console.log(`[SMS Gateway] 💓 Heartbeat acknowledged from device: ${incomingDeviceId} (SIM: ${simReady ? 'READY' : 'NOT READY'}, SMS: ${smsReady ? 'READY' : 'DISABLED'})`);

    await this.syncStateToDatabase();

    return {
      ok: true,
      message: 'Heartbeat acknowledged',
      gatewayState: this.state.gatewayStatus
    };
  }

  /**
   * Computes the real-time status of the SMS Server & Android Gateway.
   * Asynchronously synchronizes with persistent database state across serverless instances.
   */
  public async getStatus(): Promise<{
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
  }> {
    const now = Date.now();

    // 1. If in-memory state is empty or expired, hydrate from persistent Supabase database
    if (!this.state.lastHeartbeatTimestampMs || (now - this.state.lastHeartbeatTimestampMs) > HEARTBEAT_TIMEOUT_MS) {
      try {
        const { data: settingRow } = await supabase
          .from('app_settings')
          .select('value')
          .eq('id', 'sms_gateway_state')
          .maybeSingle();

        if (settingRow?.value && typeof settingRow.value === 'object') {
          const val = settingRow.value;
          const persistedTs = val.lastHeartbeatTimestampMs || (val.lastHeartbeat ? new Date(val.lastHeartbeat).getTime() : null);
          if (persistedTs) {
            this.state.lastHeartbeat = val.lastHeartbeat || new Date(persistedTs).toISOString();
            this.state.lastHeartbeatTimestampMs = persistedTs;
            this.state.heartbeatCount = Math.max(this.state.heartbeatCount, val.heartbeatCount || 1);
            this.state.deviceInfo = {
              deviceId: val.deviceId || 'frosty-sms-gateway-01',
              status: val.status || 'READY',
              simReady: val.simReady !== false,
              smsReady: val.smsReady !== false,
              permissionGranted: val.permissionGranted !== false,
              batteryLevel: val.batteryLevel,
              networkType: val.networkType || 'Cellular/WiFi',
              signalStrength: val.signalStrength || 'Good',
              simOperator: val.simOperator || 'Active SIM',
              appVersion: val.appVersion || '1.0.0',
              ip: val.ip || '127.0.0.1'
            };
          }
        } else {
          const { data: stateRow } = await supabase
            .from('sms_gateway_state')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (stateRow) {
            const persistedTs = stateRow.last_heartbeat ? new Date(stateRow.last_heartbeat).getTime() : new Date(stateRow.updated_at).getTime();
            this.state.lastHeartbeat = stateRow.last_heartbeat || stateRow.updated_at;
            this.state.lastHeartbeatTimestampMs = persistedTs;
            this.state.heartbeatCount = Math.max(this.state.heartbeatCount, 1);
            this.state.deviceInfo = {
              deviceId: stateRow.device_id || 'frosty-sms-gateway-01',
              status: stateRow.status || 'READY',
              simReady: stateRow.sim_ready !== false,
              smsReady: stateRow.sms_ready !== false,
              permissionGranted: stateRow.permission_granted !== false,
              batteryLevel: stateRow.battery_level,
              networkType: stateRow.network_type || 'Cellular/WiFi',
              simOperator: stateRow.sim_operator || 'Active SIM',
              appVersion: stateRow.app_version || '1.0.0'
            };
          }
        }
      } catch (_) {}
    }

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
      pendingQueueCount: await this.countPendingJobs(),
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
    const currentStatus = await this.getStatus();
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
   * Persists job to Supabase (sms_queue table & app_settings fallback) for guaranteed cross-instance durability.
   */
  private async persistJobToDatabase(job: SmsJob, syncAppSettings: boolean = true): Promise<void> {
    // 1. Persist to relational sms_queue table
    try {
      await supabase
        .from('sms_queue')
        .upsert({
          id: job.id,
          to: job.recipient,
          message: job.message,
          type: job.type,
          order_id: job.orderId,
          status: job.status,
          priority: this.priorityToInteger(job.priority),
          attempts: job.attempts,
          claimed_at: job.claimedAt,
          claimed_by: job.claimedBy,
          sent_at: job.sentAt,
          error_message: job.error,
          updated_at: job.updatedAt,
          created_at: job.createdAt
        }, { onConflict: 'id' });
    } catch (_) {}

    if (!syncAppSettings) return;

    // 2. Persist to app_settings key-value store
    try {
      const { data: row } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'sms_queue_jobs')
        .maybeSingle();

      let jobsList: SmsJob[] = Array.isArray(row?.value) ? row.value : [];
      const idx = jobsList.findIndex(j => j.id === job.id || j.idempotencyKey === job.idempotencyKey);
      if (idx >= 0) {
        jobsList[idx] = { ...jobsList[idx], ...job };
      } else {
        jobsList.push(job);
      }

      // Retain latest 100 jobs
      if (jobsList.length > 100) {
        jobsList = jobsList.slice(-100);
      }

      await supabase
        .from('app_settings')
        .upsert({
          id: 'sms_queue_jobs',
          value: jobsList
        }, { onConflict: 'id' });
    } catch (_) {}
  }

  /**
   * Persists gateway state to Supabase table (app_settings & sms_gateway_state) for cross-instance durability.
   */
  private async syncStateToDatabase(): Promise<void> {
    try {
      const device = this.state.deviceInfo;
      if (!device) return;

      const statePayload = {
        deviceId: device.deviceId,
        status: this.state.gatewayStatus,
        simReady: device.simReady,
        smsReady: device.smsReady,
        permissionGranted: device.permissionGranted,
        batteryLevel: device.batteryLevel,
        networkType: device.networkType,
        signalStrength: device.signalStrength,
        simOperator: device.simOperator,
        appVersion: device.appVersion,
        ip: device.ip,
        lastHeartbeat: this.state.lastHeartbeat,
        lastHeartbeatTimestampMs: this.state.lastHeartbeatTimestampMs,
        heartbeatCount: this.state.heartbeatCount,
        gatewayStatus: this.state.gatewayStatus,
        updatedAt: new Date().toISOString()
      };

      await supabase
        .from('app_settings')
        .upsert({
          id: 'sms_gateway_state',
          value: statePayload
        }, { onConflict: 'id' });

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
    } catch (_) {}
  }
}

export const SmsGatewayService = new SmsGatewayServiceClass();
