import crypto from 'crypto';
import { supabase } from '../lib/supabase';
import { SmsGatewayService } from './smsGateway.service';

export interface OtpRequestParams {
  phone: string;
  purpose: 'LOGIN' | 'SIGNUP' | 'VERIFY_PHONE' | 'PASSWORD_RESET';
  ip?: string;
  metadata?: Record<string, any>;
}

export interface OtpVerifyParams {
  phone: string;
  purpose: 'LOGIN' | 'SIGNUP' | 'VERIFY_PHONE' | 'PASSWORD_RESET';
  otp: string;
  ip?: string;
}

export class CustomOtpService {
  private static readonly OTP_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly COOLDOWN_MS = 30 * 1000; // 30 seconds
  private static readonly MAX_ATTEMPTS = 5;

  /**
   * Normalizes phone number to +91XXXXXXXXXX format.
   */
  public static normalizePhone(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
      return `+91${clean}`;
    } else if (clean.length === 11 && clean.startsWith('0')) {
      return `+91${clean.slice(1)}`;
    } else if (clean.length === 12 && clean.startsWith('91')) {
      return `+${clean}`;
    } else if (clean.length >= 10 && clean.length <= 15) {
      return `+${clean}`;
    }
    return phone.trim();
  }

  /**
   * Hashes OTP using server secret (OTP_HASH_SECRET)
   */
  public static hashOtp(otp: string): string {
    const secret = process.env.OTP_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'frosty-bite-secure-otp-pepper-2026';
    return crypto.createHmac('sha256', secret).update(otp).digest('hex');
  }

  /**
   * Generates a cryptographically secure 6-digit OTP (000000 - 999999).
   */
  public static generateSecureOtp(): string {
    const num = crypto.randomInt(0, 1000000);
    return String(num).padStart(6, '0');
  }

  /**
   * Request an OTP: validates cooldown, invalidates old active OTPs, creates new hashed OTP, queues SMS.
   * Single authoritative production OTP table: otp_verifications (with otp_codes schema sync).
   */
  public static async requestOtp(params: OtpRequestParams): Promise<{ ok: boolean; message: string; expiresIn: number; retryAfter: number; requestId: string }> {
    const normalizedPhone = this.normalizePhone(params.phone);
    if (!normalizedPhone || normalizedPhone.replace(/\D/g, '').length < 10) {
      throw new Error('Please enter a valid mobile number.');
    }

    const purpose = params.purpose || 'LOGIN';
    const requestId = crypto.randomUUID();
    const now = new Date();
    const nowMs = now.getTime();
    const expiresAt = new Date(nowMs + this.OTP_LIFETIME_MS).toISOString();

    // 1. Check cooldown (30 seconds) on active non-expired OTPs for same phone
    try {
      const { data: recentOtps } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', normalizedPhone)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentOtps && recentOtps.length > 0) {
        const lastOtp = recentOtps[0];
        const createdAtMs = new Date(lastOtp.created_at).getTime();
        const elapsed = nowMs - createdAtMs;
        if (elapsed < this.COOLDOWN_MS) {
          const remainingSec = Math.ceil((this.COOLDOWN_MS - elapsed) / 1000);
          throw new Error(`Please wait ${remainingSec} seconds before requesting another OTP.`);
        }
      } else {
        // Query otp_codes table if otp_verifications is aliased/re-routed
        const { data: codeOtps } = await supabase
          .from('otp_codes')
          .select('*')
          .eq('phone', normalizedPhone)
          .order('created_at', { ascending: false })
          .limit(1);

        if (codeOtps && codeOtps.length > 0) {
          const lastOtp = codeOtps[0];
          const createdAtMs = new Date(lastOtp.created_at).getTime();
          const elapsed = nowMs - createdAtMs;
          if (elapsed < this.COOLDOWN_MS) {
            const remainingSec = Math.ceil((this.COOLDOWN_MS - elapsed) / 1000);
            throw new Error(`Please wait ${remainingSec} seconds before requesting another OTP.`);
          }
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Please wait')) {
        throw err;
      }
      console.warn('[CustomOtpService] Cooldown check warning:', err.message);
    }

    // 2. Invalidate previous active OTPs for same phone
    try {
      await supabase
        .from('otp_verifications')
        .update({ invalidated_at: now.toISOString() })
        .eq('phone', normalizedPhone)
        .is('verified_at', null)
        .is('invalidated_at', null);

      await supabase
        .from('otp_codes')
        .delete()
        .eq('phone', normalizedPhone);
    } catch (err: any) {
      console.warn('[CustomOtpService] Invalidation warning:', err.message);
    }

    // 3. Generate 6-digit secure OTP
    const rawOtp = this.generateSecureOtp();
    const codeHash = this.hashOtp(rawOtp);

    // 4. Store hashed OTP exclusively in authoritative production OTP table (otp_verifications / otp_codes)
    let savedSuccessfully = false;

    // Primary: otp_verifications
    try {
      const { error: vErr } = await supabase
        .from('otp_verifications')
        .insert({
          phone: normalizedPhone,
          purpose,
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
          max_attempts: this.MAX_ATTEMPTS,
          request_id: requestId,
          metadata: params.metadata || {}
        });

      if (!vErr) {
        savedSuccessfully = true;
      } else {
        console.error(`[CustomOtpService] DB insert into otp_verifications failed: code=${vErr.code || 'UNKNOWN'}, message=${vErr.message}, details=${vErr.details || 'null'}, hint=${vErr.hint || 'null'}, operation=otp_verifications_insert`);
      }
    } catch (err: any) {
      console.error('[CustomOtpService] DB insert exception:', err.message || err);
    }

    // Secondary Production Table: otp_codes (recognised in PostgREST schema cache)
    if (!savedSuccessfully) {
      try {
        const { error: cErr } = await supabase
          .from('otp_codes')
          .insert({
            phone: normalizedPhone,
            otp_hash: codeHash,
            expires_at: expiresAt,
            attempts: 0
          });

        if (!cErr) {
          savedSuccessfully = true;
        } else {
          console.error(`[CustomOtpService] DB insert into otp_codes failed: code=${cErr.code || 'UNKNOWN'}, message=${cErr.message}, details=${cErr.details || 'null'}, hint=${cErr.hint || 'null'}, operation=otp_codes_insert`);
          throw new Error('Failed to generate verification code. Please try again.');
        }
      } catch (cEx: any) {
        if (cEx.message && cEx.message.includes('Please try again')) throw cEx;
        console.error('[CustomOtpService] otp_codes insert exception:', cEx.message || cEx);
        throw new Error('Failed to generate verification code. Please try again.');
      }
    }

    // 5. Queue SMS via existing physical-SIM SMS Gateway (type = 'OTP', high priority)
    const smsMessage = `Frosty Bite: Your verification code is ${rawOtp}. It expires in 5 minutes. Do not share this code with anyone.`;
    const idempotencyKey = `otp:${normalizedPhone}:${purpose}:${requestId}`;

    try {
      await SmsGatewayService.queueSms({
        recipient: normalizedPhone,
        message: smsMessage,
        type: 'OTP',
        priority: 'HIGH',
        idempotencyKey
      });
    } catch (smsErr: any) {
      console.error('[CustomOtpService] Failed to queue OTP SMS:', smsErr);
    }

    return {
      ok: true,
      message: 'OTP sent successfully.',
      expiresIn: Math.floor(this.OTP_LIFETIME_MS / 1000),
      retryAfter: Math.floor(this.COOLDOWN_MS / 1000),
      requestId
    };
  }

  /**
   * Verify an OTP: checks expiration, attempts limit, single-use, and hashes match securely.
   * Uses exclusively the authoritative production OTP tables (otp_verifications / otp_codes).
   */
  public static async verifyOtp(params: OtpVerifyParams): Promise<{ ok: boolean; message: string; verified: boolean }> {
    const normalizedPhone = this.normalizePhone(params.phone);
    const purpose = params.purpose || 'LOGIN';
    const submittedOtp = (params.otp || '').trim();

    if (!normalizedPhone || !submittedOtp || submittedOtp.length !== 6) {
      throw new Error('Invalid verification code format. Please enter the 6-digit code.');
    }

    const nowMs = Date.now();
    let record: any = null;
    let tableUsed: 'otp_verifications' | 'otp_codes' = 'otp_verifications';

    // 1. Try finding record in otp_verifications
    try {
      const { data: vRecords, error: vErr } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', normalizedPhone)
        .is('verified_at', null)
        .is('invalidated_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!vErr && vRecords && vRecords.length > 0) {
        record = vRecords[0];
        tableUsed = 'otp_verifications';
      }
    } catch (_) {}

    // 2. Try finding record in otp_codes
    if (!record) {
      try {
        const { data: cRecords, error: cErr } = await supabase
          .from('otp_codes')
          .select('*')
          .eq('phone', normalizedPhone)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!cErr && cRecords && cRecords.length > 0) {
          const r = cRecords[0];
          record = {
            id: r.id,
            code_hash: r.otp_hash,
            expires_at: r.expires_at,
            attempts: r.attempts || 0,
            max_attempts: this.MAX_ATTEMPTS
          };
          tableUsed = 'otp_codes';
        }
      } catch (_) {}
    }

    if (!record) {
      throw new Error('No active verification code found. Please request a new code.');
    }

    // Check expiration
    const recordExpiryMs = new Date(record.expires_at).getTime();
    if (nowMs > recordExpiryMs) {
      if (tableUsed === 'otp_verifications') {
        await supabase
          .from('otp_verifications')
          .update({ invalidated_at: new Date().toISOString() })
          .eq('id', record.id);
      } else {
        await supabase
          .from('otp_codes')
          .delete()
          .eq('id', record.id);
      }
      throw new Error('This OTP has expired. Please request a new code.');
    }

    // Check attempt limit
    const attempts = record.attempts || 0;
    const maxAttempts = record.max_attempts || this.MAX_ATTEMPTS;

    if (attempts >= maxAttempts) {
      if (tableUsed === 'otp_verifications') {
        await supabase
          .from('otp_verifications')
          .update({ invalidated_at: new Date().toISOString() })
          .eq('id', record.id);
      } else {
        await supabase
          .from('otp_codes')
          .delete()
          .eq('id', record.id);
      }
      throw new Error('Too many incorrect attempts. Please request a new OTP.');
    }

    // Increment attempts
    const newAttempts = attempts + 1;
    if (tableUsed === 'otp_verifications') {
      await supabase
        .from('otp_verifications')
        .update({ attempts: newAttempts })
        .eq('id', record.id);
    } else {
      await supabase
        .from('otp_codes')
        .update({ attempts: newAttempts })
        .eq('id', record.id);
    }

    if (newAttempts > maxAttempts) {
      throw new Error('Too many incorrect attempts. Please request a new OTP.');
    }

    // Hash submitted OTP and compare using constant-time comparison
    const submittedHash = this.hashOtp(submittedOtp);
    const match = this.safeCompare(submittedHash, record.code_hash);

    if (!match) {
      const remainingAttempts = maxAttempts - newAttempts;
      if (remainingAttempts <= 0) {
        throw new Error('Too many incorrect attempts. Please request a new OTP.');
      }
      throw new Error(`Invalid OTP. Please try again (${remainingAttempts} attempts remaining).`);
    }

    // Success! Mark as verified / single-use
    if (tableUsed === 'otp_verifications') {
      await supabase
        .from('otp_verifications')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', record.id);
    } else {
      await supabase
        .from('otp_codes')
        .delete()
        .eq('id', record.id);
    }

    return {
      ok: true,
      message: 'OTP verified successfully.',
      verified: true
    };
  }

  private static safeCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
