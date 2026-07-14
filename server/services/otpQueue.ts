import crypto from 'crypto';
import { WhatsAppService } from './whatsapp.service';
import { supabase } from '../lib/supabase';

export interface OtpJob {
  id: string;
  recipient: string; // Cleaned phone number or email
  type: 'whatsapp' | 'email';
  otp: string;
  idempotencyKey?: string;
  ip: string;
  payload: any; // signup details or userId
  retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  error?: string;
  resolve?: (value: any) => void;
  reject?: (reason: any) => void;
}

export interface OtpMetric {
  timestamp: number;
  recipient: string;
  ip: string;
  event: 'requested' | 'sent' | 'failed' | 'rate_limited' | 'cancelled' | 'abnormal_surge';
  error?: string;
}

export class OtpQueueService {
  private static instance: OtpQueueService;
  private queue: OtpJob[] = [];
  private activeJobsCount = 0;
  private readonly maxConcurrency = 1; // Controlled concurrency to prevent spam / messaging provider block

  // Deduplication & rate limit mappings
  private idempotencyStore = new Map<string, { status: 'pending' | 'completed' | 'failed'; response: any; expiresAt: number }>();
  private lastRequestTimes = new Map<string, number>(); // Recipient cooldown (prevent accidental message bursts)
  private ipRequestTimes = new Map<string, number[]>(); // IP monitoring (for abnormal traffic alerting)
  private systemMetrics: OtpMetric[] = []; // In-memory metrics for abnormal pattern detection

  private constructor() {
    // Start periodic cleaning of expired idempotency keys
    setInterval(() => this.cleanupIdempotencyKeys(), 60000);
  }

  public static getInstance(): OtpQueueService {
    if (!OtpQueueService.instance) {
      OtpQueueService.instance = new OtpQueueService();
    }
    return OtpQueueService.instance;
  }

  /**
   * Validates a phone number for format, digits, and reasonable length.
   */
  public validatePhone(phone: string): boolean {
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 10 && clean.length <= 15;
  }

  /**
   * Helper to mask recipient identifier for privacy (never log clean OTPs or raw phone numbers fully)
   */
  public maskRecipient(recipient: string): string {
    if (recipient.includes('@')) {
      const [local, domain] = recipient.split('@');
      if (local.length <= 2) return `${local[0]}***@${domain}`;
      return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
    }
    // Phone number
    const clean = recipient.replace(/\D/g, '');
    if (clean.length < 6) return '******';
    return `+${clean.slice(0, 3)}*****${clean.slice(-3)}`;
  }

  /**
   * Cleans up expired idempotency keys
   */
  private cleanupIdempotencyKeys() {
    const now = Date.now();
    for (const [key, val] of this.idempotencyStore.entries()) {
      if (now > val.expiresAt) {
        this.idempotencyStore.delete(key);
      }
    }
  }

  /**
   * Tracks an event metric and analyzes for abnormal traffic spikes.
   */
  private logMetric(recipient: string, ip: string, event: OtpMetric['event'], error?: string) {
    const now = Date.now();
    const metric: OtpMetric = { timestamp: now, recipient, ip, event, error };
    this.systemMetrics.push(metric);

    // Keep metrics list bounded
    if (this.systemMetrics.length > 1000) {
      this.systemMetrics.shift();
    }

    // Masked log printing (No plain text OTP values logged!)
    const maskedRecipient = this.maskRecipient(recipient);
    if (error) {
      console.warn(`[OTP System] Event: ${event.toUpperCase()} | Recipient: ${maskedRecipient} | IP: ${ip} | Error: ${error}`);
    } else {
      console.log(`[OTP System] Event: ${event.toUpperCase()} | Recipient: ${maskedRecipient} | IP: ${ip}`);
    }

    // Perform real-time abnormal traffic pattern alerts
    this.detectAbnormalPatterns(ip, recipient);
  }

  /**
   * Detects unusual request patterns and emits high-visibility warning logs
   */
  private detectAbnormalPatterns(ip: string, recipient: string) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const fiveMinutesAgo = now - 5 * 60000;

    // 1. System-wide requests surge (e.g. > 15 requests/min)
    const systemRecent = this.systemMetrics.filter(m => m.timestamp > oneMinuteAgo && m.event === 'requested');
    if (systemRecent.length > 15) {
      console.error(`\n🚨 ALERT: Abnormal System-Wide OTP Request Surge! Detected ${systemRecent.length} requests in the last 60 seconds.`);
    }

    // 2. High failure rate (e.g. > 5 failures in 5 mins)
    const failuresRecent = this.systemMetrics.filter(m => m.timestamp > fiveMinutesAgo && m.event === 'failed');
    if (failuresRecent.length > 5) {
      console.error(`\n🚨 ALERT: High OTP Delivery Failure Rate! ${failuresRecent.length} dispatch failures in the last 5 minutes. Check WhatsApp server status!`);
    }

    // 3. Per-IP request surge (e.g. > 5 requests/5 mins from the same IP)
    const ipRecent = this.systemMetrics.filter(m => m.ip === ip && m.timestamp > fiveMinutesAgo && m.event === 'requested');
    if (ipRecent.length > 5) {
      console.warn(`\n⚠️ WARNING: Suspected Bot Behavior! IP ${ip} requested OTP ${ipRecent.length} times in the last 5 minutes.`);
    }
  }

  /**
   * Registers a client request IP time-stamp to prevent rapid retries.
   */
  private trackIpRateLimit(ip: string): boolean {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5-minute window
    const maxRequests = 5;

    let timestamps = this.ipRequestTimes.get(ip) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);
    timestamps.push(now);
    this.ipRequestTimes.set(ip, timestamps);

    return timestamps.length <= maxRequests;
  }

  /**
   * Enqueues an OTP request and processes it within controlled concurrency.
   */
  public async enqueue(
    recipient: string,
    type: 'whatsapp' | 'email',
    otp: string,
    ip: string,
    idempotencyKey?: string,
    payload: any = {}
  ): Promise<any> {
    const now = Date.now();
    const masked = this.maskRecipient(recipient);

    // 1. Phone number validation (if whatsapp)
    if (type === 'whatsapp' && !this.validatePhone(recipient)) {
      this.logMetric(recipient, ip, 'rate_limited', 'Invalid phone number format');
      throw new Error('Please enter a valid mobile number (10 to 15 digits).');
    }

    // 2. Cooldown check: Prevent accidental/burst duplicate clicks (minimum 60-second cooldown)
    const lastRequest = this.lastRequestTimes.get(recipient);
    if (lastRequest && (now - lastRequest < 60000)) {
      const remaining = Math.ceil((60000 - (now - lastRequest)) / 1000);
      this.logMetric(recipient, ip, 'rate_limited', `Accidental burst blocked (cooldown active: ${remaining}s remaining)`);
      throw new Error(`Accidental burst prevention: Please wait ${remaining} seconds before requesting another verification code.`);
    }

    // 3. IP Rate limiting checks
    if (!this.trackIpRateLimit(ip)) {
      this.logMetric(recipient, ip, 'rate_limited', 'IP limit exceeded');
      throw new Error('Security alert: Too many requests from this IP address. Please try again in 5 minutes.');
    }

    // 4. Request Deduplication using Idempotency Keys
    if (idempotencyKey) {
      const existing = this.idempotencyStore.get(idempotencyKey);
      if (existing) {
        if (existing.status === 'completed' || existing.status === 'pending') {
          console.log(`[OTP System] Deduplicated request for key: ${idempotencyKey}. Returning cached response.`);
          return existing.response;
        }
      }
      // Initialize key state as pending
      this.idempotencyStore.set(idempotencyKey, {
        status: 'pending',
        response: null,
        expiresAt: now + 5 * 60 * 1000 // Cache key for 5 minutes
      });
    }

    // Update last request timestamp immediately to block simultaneous bursters
    this.lastRequestTimes.set(recipient, now);

    // 5. Invalidation: Cancel any pending/processing OTP jobs for the SAME recipient
    this.cancelPendingJobsForRecipient(recipient);

    this.logMetric(recipient, ip, 'requested');

    // Create a new job and push into queue
    return new Promise((resolve, reject) => {
      const job: OtpJob = {
        id: crypto.randomUUID(),
        recipient,
        type,
        otp,
        idempotencyKey,
        ip,
        payload,
        retries: 0,
        status: 'pending',
        createdAt: now,
        resolve,
        reject
      };

      this.queue.push(job);
      this.processNext();
    });
  }

  /**
   * Cancels any pending or processing jobs for a specific recipient to avoid multiple delivery runs
   */
  private cancelPendingJobsForRecipient(recipient: string) {
    let cancelledCount = 0;
    this.queue = this.queue.map(job => {
      if (job.recipient === recipient && (job.status === 'pending' || job.status === 'processing')) {
        job.status = 'cancelled';
        cancelledCount++;
        if (job.reject) {
          job.reject(new Error('Job cancelled because a newer OTP request was initiated.'));
        }
        this.logMetric(recipient, job.ip, 'cancelled', 'Cancelled by newer OTP request');
      }
      return job;
    });

    if (cancelledCount > 0) {
      console.log(`[OTP System] Cancelled ${cancelledCount} older pending OTP jobs for recipient: ${this.maskRecipient(recipient)}`);
    }
  }

  /**
   * Processes the next pending job in the queue respecting concurrency rules
   */
  private async processNext() {
    if (this.activeJobsCount >= this.maxConcurrency) {
      return;
    }

    // Find next pending job
    const jobIndex = this.queue.findIndex(j => j.status === 'pending');
    if (jobIndex === -1) {
      return;
    }

    const job = this.queue[jobIndex];
    job.status = 'processing';
    this.activeJobsCount++;

    try {
      const result = await this.executeJobWithBackoff(job);
      job.status = 'completed';

      // Save to idempotency store if key was provided
      if (job.idempotencyKey) {
        this.idempotencyStore.set(job.idempotencyKey, {
          status: 'completed',
          response: result,
          expiresAt: Date.now() + 5 * 60 * 1000
        });
      }

      this.logMetric(job.recipient, job.ip, 'sent');
      if (job.resolve) job.resolve(result);

    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message;

      if (job.idempotencyKey) {
        this.idempotencyStore.set(job.idempotencyKey, {
          status: 'failed',
          response: { success: false, error: err.message },
          expiresAt: Date.now() + 5 * 60 * 1000
        });
      }

      this.logMetric(job.recipient, job.ip, 'failed', err.message);
      if (job.reject) job.reject(err);

    } finally {
      this.activeJobsCount--;
      // Remove completed/failed job from main list to avoid leak
      const idx = this.queue.indexOf(job);
      if (idx !== -1) {
        this.queue.splice(idx, 1);
      }
      // Trigger next job in queue
      this.processNext();
    }
  }

  /**
   * Executes the dispatch logic with custom exponential backoff retries for transient failures.
   */
  private async executeJobWithBackoff(job: OtpJob): Promise<any> {
    const maxRetries = 3;
    
    while (job.retries < maxRetries) {
      try {
        if (job.status === 'cancelled') {
          throw new Error('Job cancelled');
        }

        if (job.type === 'whatsapp') {
          // Attempt dispatch through WhatsApp Service
          const result = await WhatsAppService.sendOtpWhatsApp(job.recipient, job.otp);
          return result;
        } else {
          // Email OTP flow integration
          const { error } = await supabase.auth.signInWithOtp({
            email: job.recipient,
          });
          if (error) {
            throw error;
          }
          return { success: true, message: 'Email OTP dispatched' };
        }

      } catch (err: any) {
        job.retries++;
        if (job.retries >= maxRetries || job.status === 'cancelled') {
          throw err;
        }

        // Exponential backoff wait (e.g. 1000ms, 2000ms, 4000ms)
        const backoffDelay = Math.pow(2, job.retries) * 1000;
        console.warn(`[OTP Queue] Dispatch failed for ${this.maskRecipient(job.recipient)} (Attempt ${job.retries}/${maxRetries}). Retrying in ${backoffDelay}ms... Error: ${err.message}`);
        await new Promise(res => setTimeout(res, backoffDelay));
      }
    }
  }

  /**
   * Exposes monitoring diagnostic metrics for alerting and dashboards.
   */
  public getDiagnostics(): any {
    const now = Date.now();
    const systemRecent = this.systemMetrics.filter(m => now - m.timestamp < 30 * 60 * 1000); // last 30 minutes

    return {
      activeJobs: this.activeJobsCount,
      queueLength: this.queue.filter(j => j.status === 'pending').length,
      metricsCount: this.systemMetrics.length,
      recentMetrics: systemRecent.map(m => ({
        timestamp: new Date(m.timestamp).toISOString(),
        recipient: this.maskRecipient(m.recipient),
        ip: m.ip,
        event: m.event,
        error: m.error
      })),
      idempotencyKeysCount: this.idempotencyStore.size
    };
  }
}
