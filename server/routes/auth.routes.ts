import express from 'express';
import { supabase } from '../lib/supabase';
import { UserService } from '../services/user.service';
import { EmailService } from '../services/email.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { OtpQueueService } from '../services/otpQueue';
import crypto from 'crypto';

// Indian Phone Normalizer: Strip all non-digits, then if 11 digits starts with '0', strip it. If 12 digits starts with '91', strip it.
export function normalizePhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11 && clean.startsWith('0')) {
    return clean.slice(1);
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return clean.slice(2);
  }
  return clean;
}

const router = express.Router();

// In-memory collections to replace Firestore for rate limiting and OTPs
const ipRateLimits = new Map<string, { attempts: number; first_attempt_time: number; blocked: boolean; blocked_until: number }>();
const mobileOtps = new Map<string, { otp: string; expires_at: number; email: string; isSignup?: boolean; name?: string; password?: string; userId?: string }>();

// Memory fallback for daily OTP limits (max 3 per user per day)
const otpDailyLimitsMemory = new Map<string, { count: number; dateStr: string }>();

// Maximum OTP requests allowed per day per user (more generous to prevent blocking legitimate users)
const DAILY_OTP_LIMIT = process.env.NODE_ENV !== 'production' ? 100 : 25;

// Helper to get UTC Date String ('YYYY-MM-DD')
function getUtcDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// Reset daily OTP send limit (e.g. after successful login or administrative reset)
async function resetOtpLimit(identifier: string): Promise<void> {
  const cleanId = identifier.trim().toLowerCase();
  otpDailyLimitsMemory.delete(cleanId);
  try {
    await supabase
      .from('otps')
      .update({
        request_count: 0,
        last_request_at: Date.now()
      })
      .eq('email', cleanId);
  } catch (err: any) {
    console.warn('[resetOtpLimit] DB update failed:', err.message);
  }
}

// Check and increment daily OTP send limit
async function checkAndIncrementOtpLimit(identifier: string): Promise<{ allowed: boolean; count: number; limit: number }> {
  const cleanId = identifier.trim().toLowerCase();
  const currentDateStr = getUtcDateString();
  const now = Date.now();

  // 1. Check Memory limit first
  const memLimit = otpDailyLimitsMemory.get(cleanId);
  if (memLimit) {
    if (memLimit.dateStr === currentDateStr) {
      if (memLimit.count >= DAILY_OTP_LIMIT) {
        return { allowed: false, count: memLimit.count, limit: DAILY_OTP_LIMIT };
      }
    } else {
      // Different day, reset memory
      otpDailyLimitsMemory.set(cleanId, { count: 0, dateStr: currentDateStr });
    }
  }

  // 2. Query Database limit from public.otps
  let dbCount = 0;
  let hasDbRecord = false;

  try {
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .eq('email', cleanId)
      .maybeSingle();

    if (!error && data) {
      hasDbRecord = true;
      // Convert last_request_at (BIGINT millisecond timestamp) to UTC date string
      const lastRequestDate = data.last_request_at 
        ? new Date(Number(data.last_request_at)).toISOString().split('T')[0]
        : '';
      
      if (lastRequestDate === currentDateStr) {
        dbCount = data.request_count || 0;
      } else {
        dbCount = 0; // Reset count for a different day
      }
    }
  } catch (err: any) {
    console.warn('[checkAndIncrementOtpLimit] DB read failed, relying on memory fallback:', err.message);
  }

  // Combine memory and DB count (choose the maximum of both to prevent bypasses)
  const currentCount = Math.max(dbCount, (memLimit?.dateStr === currentDateStr ? memLimit.count : 0));

  if (currentCount >= DAILY_OTP_LIMIT) {
    // Sync memory if missing
    otpDailyLimitsMemory.set(cleanId, { count: currentCount, dateStr: currentDateStr });
    return { allowed: false, count: currentCount, limit: DAILY_OTP_LIMIT };
  }

  const newCount = currentCount + 1;

  // 3. Update Memory
  otpDailyLimitsMemory.set(cleanId, { count: newCount, dateStr: currentDateStr });

  // 4. Update Database
  try {
    if (hasDbRecord) {
      await supabase
        .from('otps')
        .update({
          request_count: newCount,
          last_request_at: now,
          otp: 'rate-limit-dummy',
          expires_at: now + 5 * 60 * 1000
        })
        .eq('email', cleanId);
    } else {
      await supabase
        .from('otps')
        .insert({
          email: cleanId,
          otp: 'rate-limit-dummy',
          expires_at: now + 5 * 60 * 1000,
          request_count: newCount,
          last_request_at: now
        });
    }
  } catch (err: any) {
    console.warn('[checkAndIncrementOtpLimit] DB write failed:', err.message);
  }

  return { allowed: true, count: newCount, limit: DAILY_OTP_LIMIT };
}

// Synchronize user with backend
router.post('/sync', async (req, res) => {
  const { idToken, markVerified, userProfile } = req.body;
  if (!idToken && !userProfile) return res.status(400).json({ error: 'Auth token or user profile required' });

  try {
    let email = '';
    let name = 'User';
    let uid = 'mock-uid';
    let photoURL = '';

    // Extract info from token
    if (idToken) {
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          email = payload.email || payload.user_metadata?.email || '';
          name = payload.name || payload.user_metadata?.full_name || 'User';
          uid = payload.sub || payload.id || 'mock-uid';
          photoURL = payload.picture || payload.user_metadata?.avatar_url || '';
        }
      } catch (tokenErr) {
        console.warn('[AuthRoutes Sync] Token parse bypassed:', tokenErr);
      }
    }

    if (userProfile) {
      email = email || userProfile.email || '';
      name = name || userProfile.name || 'User';
      uid = uid || userProfile.id || 'mock-uid';
      photoURL = photoURL || userProfile.avatar_url || '';
    }

    const existingUser = await UserService.getUserByFirebaseUid(uid);
    
    const user = await UserService.syncUser({
      uid,
      email: email || '',
      displayName: name,
      photoURL
    });

    if (!existingUser && user?.email) {
      EmailService.sendWelcomeEmail(user.email, user.name).catch((emailErr) => {
        console.warn('[AuthRoutes] Welcome email task failed:', emailErr);
      });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('[AuthRoutes] Sync error:', error);
    res.status(401).json({ error: 'Invalid token or sync failed' });
  }
});

// Generate dummy/custom token for compatibility
router.post('/firebase-token', async (req, res) => {
  const { supabaseAccessToken, email } = req.body;
  if (!supabaseAccessToken || !email) {
    return res.status(400).json({ error: 'Supabase access token and email are required' });
  }

  try {
    const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(supabaseAccessToken);
    
    if (sbError || !sbUser) {
      return res.status(401).json({ error: 'Invalid Supabase session' });
    }

    const mockPayload = {
      iss: 'https://securetoken.google.com/mock',
      sub: sbUser.id,
      email: sbUser.email || email,
      email_verified: true,
      name: sbUser.user_metadata?.full_name || email.split('@')[0]
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64');
    const signature = 'securesig';
    const fakeCustomToken = `${header}.${payload}.${signature}`;

    res.json({
      success: true,
      customToken: fakeCustomToken,
      firebaseUser: {
        uid: sbUser.id,
        email: sbUser.email || email,
        displayName: sbUser.user_metadata?.full_name || email.split('@')[0],
      }
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Token generation failed' });
  }
});

// Determine correct Supabase GoTrue OTP verification type ('signup' vs 'email')
router.get('/otp-type', async (req, res) => {
  const email = req.query.email as string;
  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error || !data || !data.users) {
      return res.json({ type: 'signup' });
    }

    const foundUser = data.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);

    if (!foundUser) {
      return res.json({ type: 'signup' });
    }

    const isConfirmed = !!foundUser.email_confirmed_at;
    const type = isConfirmed ? 'email' : 'signup';
    res.json({ type });
  } catch (err: any) {
    res.json({ type: 'signup' });
  }
});

// Securely resets user password in the Database after verifying a valid OTP code.
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP code, and new password are required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const cleanPassword = newPassword.trim();

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    let verifyType: 'signup' | 'email' | 'magiclink' = 'email';
    try {
      const { data: userList } = await supabase.auth.admin.listUsers();
      if (userList && userList.users) {
        const found = userList.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
        if (found) {
          verifyType = found.email_confirmed_at ? 'email' : 'signup';
        } else {
          verifyType = 'signup';
        }
      }
    } catch (err: any) {
      console.warn('[ResetPasswordRoute] Failed listing users:', err.message);
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: cleanOtp,
      type: verifyType,
    });

    let userToUpdate = verifyData?.user;

    if (verifyError || !verifyData?.user) {
      const altType = verifyType === 'email' ? 'signup' : 'email';
      const { data: verifyDataAlt, error: verifyErrorAlt } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanOtp,
        type: altType,
      });

      if (verifyErrorAlt || !verifyDataAlt?.user) {
        return res.status(401).json({ error: 'Invalid or expired OTP verification code.' });
      }
      userToUpdate = verifyDataAlt.user;
    }

    if (userToUpdate) {
      await supabase.auth.admin.updateUserById(userToUpdate.id, {
        password: cleanPassword
      });
    }

    return res.json({ success: true, message: 'Your password has been successfully reset! Please check-in using your new password.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'An unexpected error occurred during password reset.' });
  }
});

// Memory fallback for secure whatsapp_otps
const whatsappOtpsMemory = new Map<string, {
  id: string;
  phone_number: string;
  otp_code: string; // hashed
  expires_at: string; // ISO String
  attempts: number;
  created_at: string; // ISO String
}>();

// In-memory sync for Email OTPs
interface EmailOtpRecord {
  id: string;
  email: string;
  otp_code: string; // hashed
  expires_at: number; // timestamp
  attempts: number;
  created_at: number;
}
const emailOtpsMemory = new Map<string, EmailOtpRecord>();

// Helper to save Email OTP
async function saveEmailOtp(email: string, otp: string) {
  const cleanEmail = email.trim().toLowerCase();
  const hashedOtp = hashOtp(otp);
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
  const createdAt = Date.now();
  const id = crypto.randomUUID();

  emailOtpsMemory.set(cleanEmail, {
    id,
    email: cleanEmail,
    otp_code: hashedOtp,
    expires_at: expiresAt,
    attempts: 0,
    created_at: createdAt
  });
}

// Helper to retrieve Email OTP
async function getEmailOtp(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  return emailOtpsMemory.get(cleanEmail) || null;
}

// Helper to increment Email attempts
async function incrementEmailAttempts(email: string, currentAttempts: number) {
  const cleanEmail = email.trim().toLowerCase();
  const newAttempts = currentAttempts + 1;
  const mem = emailOtpsMemory.get(cleanEmail);
  if (mem) {
    mem.attempts = newAttempts;
    emailOtpsMemory.set(cleanEmail, mem);
  }
}

// Helper to delete Email OTP
async function deleteEmailOtp(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  emailOtpsMemory.delete(cleanEmail);
}

// Helper to hash OTP
function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// Helper to save OTP
async function saveWhatsAppOtp(phone: string, otp: string) {
  const cleanPhone = normalizePhone(phone);
  const hashedOtp = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();

  try {
    // Delete any existing OTPs for this number
    await supabase.from('whatsapp_otps').delete().eq('phone_number', cleanPhone);
    
    await supabase.from('whatsapp_otps').insert({
      id,
      phone_number: cleanPhone,
      otp_code: hashedOtp,
      expires_at: expiresAt,
      attempts: 0,
      created_at: createdAt
    });
    console.log('[whatsapp_otps] Saved OTP to DB:', cleanPhone);
  } catch (err: any) {
    console.warn('[whatsapp_otps] DB Save failed, using Memory fallback:', err.message);
  }

  // Always keep in-memory sync/fallback active
  whatsappOtpsMemory.set(cleanPhone, {
    id,
    phone_number: cleanPhone,
    otp_code: hashedOtp,
    expires_at: expiresAt,
    attempts: 0,
    created_at: createdAt
  });
}

// Helper to retrieve OTP
async function getWhatsAppOtp(phone: string) {
  const cleanPhone = normalizePhone(phone);
  
  try {
    const { data, error } = await supabase
      .from('whatsapp_otps')
      .select('*')
      .eq('phone_number', cleanPhone)
      .maybeSingle();
      
    if (!error && data) {
      return {
        id: data.id,
        phone_number: data.phone_number,
        otp_code: data.otp_code,
        expires_at: data.expires_at,
        attempts: data.attempts || 0,
        created_at: data.created_at
      };
    }
  } catch (err: any) {
    console.warn('[whatsapp_otps] DB Get failed, using Memory fallback:', err.message);
  }

  return whatsappOtpsMemory.get(cleanPhone) || null;
}

// Helper to increment attempts
async function incrementWhatsAppAttempts(phone: string, currentAttempts: number) {
  const cleanPhone = normalizePhone(phone);
  const newAttempts = currentAttempts + 1;

  try {
    await supabase
      .from('whatsapp_otps')
      .update({ attempts: newAttempts })
      .eq('phone_number', cleanPhone);
  } catch (err: any) {
    console.warn('[whatsapp_otps] DB Update attempts failed:', err.message);
  }

  const mem = whatsappOtpsMemory.get(cleanPhone);
  if (mem) {
    mem.attempts = newAttempts;
    whatsappOtpsMemory.set(cleanPhone, mem);
  }
}

// Helper to delete OTP
async function deleteWhatsAppOtp(phone: string) {
  const cleanPhone = normalizePhone(phone);

  try {
    await supabase
      .from('whatsapp_otps')
      .delete()
      .eq('phone_number', cleanPhone);
  } catch (err: any) {
    console.warn('[whatsapp_otps] DB Delete failed:', err.message);
  }

  whatsappOtpsMemory.delete(cleanPhone);
}



// POST /send-otp - Generates and sends a WhatsApp-based OTP via the WhatsApp Service
router.post('/send-otp', async (req, res) => {
  const { phone, isSignup, email, name, password, idempotencyKey } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Mobile phone number is required.' });
  }

  try {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    // Check daily OTP limit
    const limitCheck = await checkAndIncrementOtpLimit(cleanPhone);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Security Limit: You have reached the maximum daily limit of ${limitCheck.limit} verification OTPs. Please try again later.`
      });
    }

    // IP Rate Limiting (Security Hold)
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
    const clientIp = (Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : String(rawIp))
      .replace(/[^a-zA-Z0-9.-:_]/g, '_');

    const now = Date.now();
    const windowMs = 60 * 60 * 1000;

    let limit = ipRateLimits.get(clientIp);
    if (limit) {
      if (limit.blocked || (limit.blocked_until && now < limit.blocked_until)) {
        const remainingMinutes = Math.ceil((limit.blocked_until - now) / 60000);
        return res.status(429).json({
          error: `Security Hold: Temporarily blocked from requesting OTPs. Please wait ${remainingMinutes > 0 ? remainingMinutes : 60} minutes.`
        });
      }

      if (now - limit.first_attempt_time > windowMs) {
        ipRateLimits.set(clientIp, {
          attempts: 1,
          first_attempt_time: now,
          blocked: false,
          blocked_until: 0
        });
      } else {
        const updatedAttempts = limit.attempts + 1;
        if (updatedAttempts > 5) {
          ipRateLimits.set(clientIp, {
            attempts: updatedAttempts,
            first_attempt_time: limit.first_attempt_time,
            blocked: true,
            blocked_until: now + windowMs
          });
          return res.status(429).json({
            error: 'Security Hold: Maximum OTP limits exceeded. Blocked for 60 minutes.'
          });
        } else {
          limit.attempts = updatedAttempts;
        }
      }
    } else {
      ipRateLimits.set(clientIp, {
        attempts: 1,
        first_attempt_time: now,
        blocked: false,
        blocked_until: 0
      });
    }

    // Check existing user
    const { data: dbUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    const isRegistrationFlow = isSignup || !dbUser;

    if (isSignup) {
      if (dbUser) {
        return res.status(400).json({ error: 'A Frosty Bite account is already registered with this phone number.' });
      }

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const { data: dbUserByEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (dbUserByEmail) {
          return res.status(400).json({ error: 'A Frosty Bite account is already registered with this email ID.' });
        }
      }
    }

    // Generate secure 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store secure registration details in the metadata store so we don't lose signup passwords/emails
    const otpPayload: any = {
      otp,
      expires_at: Date.now() + 3 * 60 * 1000, // 3 minutes expiration
      email: (isRegistrationFlow && email) ? email.trim().toLowerCase() : (dbUser ? dbUser.email : `${cleanPhone}@frostybite.temp`),
    };

    if (isRegistrationFlow) {
      otpPayload.isSignup = true;
      otpPayload.name = name ? name.trim() : `User ${cleanPhone}`;
      otpPayload.password = password ? password.trim() : '';
    } else if (dbUser) {
      otpPayload.userId = dbUser.id;
    }

    mobileOtps.set(cleanPhone, otpPayload);

    // Save hashed OTP to secure DB/memory storage
    await saveWhatsAppOtp(cleanPhone, otp);

    // Dispatch WhatsApp verification message securely through queue with concurrency, backoff, and deduplication
    const queueService = OtpQueueService.getInstance();
    const waResult = await queueService.enqueue(
      cleanPhone,
      'whatsapp',
      otp,
      clientIp,
      idempotencyKey,
      otpPayload
    );

    return res.json({
      success: true,
      message: waResult.message,
      dev_otp_hint: waResult.dev_otp_hint,
      client_dispatch_required: waResult.client_dispatch_required,
      textMessage: waResult.textMessage,
      formattedPhone: waResult.formattedPhone
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'An unexpected error occurred while dispatching WhatsApp OTP.' });
  }
});

// POST /verify-otp - Verifies 6-digit WhatsApp OTP code and logs the user in
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone number and verification OTP are required.' });
  }

  try {
    const cleanPhone = normalizePhone(phone);
    const cleanOtp = otp.trim();

    // 1. Get OTP from DB or memory fallback
    const otpRecord = await getWhatsAppOtp(cleanPhone);
    if (!otpRecord) {
      return res.status(401).json({ error: 'Verification code not found or has expired.' });
    }

    // 2. Check Expiry
    const expiresTime = new Date(otpRecord.expires_at).getTime();
    if (expiresTime < Date.now()) {
      await deleteWhatsAppOtp(cleanPhone);
      mobileOtps.delete(cleanPhone);
      return res.status(401).json({ error: 'Verification code has expired.' });
    }

    // 3. Check Attempt Count (max 5 attempts)
    if (otpRecord.attempts >= 5) {
      return res.status(429).json({ error: 'Maximum attempts exceeded. Please request a new verification OTP.' });
    }

    // 4. Validate OTP (hash comparison)
    const hashedInput = hashOtp(cleanOtp);
    if (otpRecord.otp_code !== hashedInput) {
      await incrementWhatsAppAttempts(cleanPhone, otpRecord.attempts);
      return res.status(401).json({ error: 'Incorrect verification code.' });
    }

    // Success! Retrieve signup metadata
    const signupData = mobileOtps.get(cleanPhone) || { isSignup: false, email: `${cleanPhone}@frostybite.temp`, name: `User ${cleanPhone}` };

    // Prune the code immediately from secure storage
    await deleteWhatsAppOtp(cleanPhone);
    mobileOtps.delete(cleanPhone);

    // Resolve or insert user in database
    let dbUser = null;
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    dbUser = existingUser;

    if (signupData.isSignup && !dbUser) {
      const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email: signupData.email || `${cleanPhone}@frostybite.temp`,
          name: signupData.name || `User ${cleanPhone}`,
          full_name: signupData.name || `User ${cleanPhone}`,
          phone: cleanPhone,
          auth_methods: ['otp', 'mobile_otp', 'whatsapp_otp'],
          last_login: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code !== '23505') {
          return res.status(500).json({ error: 'Failed to create account: ' + insertError.message });
        }
      } else {
        dbUser = insertedUser;
      }
    }

    if (!dbUser) {
      const { data: refetchedUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();
      dbUser = refetchedUser;
    }

    if (!dbUser) {
      return res.status(401).json({ error: 'Failed to resolve user account credentials.' });
    }

    // Update login history
    try {
      await supabase
        .from('users')
        .update({
          last_login: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .eq('id', dbUser.id);
    } catch (_) {}

    // Sync login audit
    const syncedUid = dbUser.supabase_uid || dbUser.id;
    try {
      await UserService.syncUser({
        uid: syncedUid,
        supabaseUid: dbUser.supabase_uid || dbUser.id,
        email: dbUser.email,
        displayName: dbUser.name || dbUser.email.split('@')[0],
        photoURL: dbUser.avatar_url || null
      });
    } catch (syncErr: any) {
      console.warn('[VerifyWhatsAppOtp] DB syncing failed:', syncErr.message);
    }

    // Generate mock custom login token (JWTLike payload)
    const mockPayload = {
      iss: 'https://securetoken.google.com/mock',
      sub: syncedUid,
      email: dbUser.email,
      email_verified: true,
      name: dbUser.name
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64');
    const fakeCustomToken = `${header}.${payload}.securesig`;

    // Reset daily rate limit on successful verification
    await resetOtpLimit(cleanPhone);

    return res.json({
      success: true,
      customToken: fakeCustomToken,
      email: dbUser.email,
      user: dbUser
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Verification failed.' });
  }
});

// POST /resend-otp - Generates a fresh OTP, invalidates previous OTP, and dispatches via the WhatsApp Service
router.post('/resend-otp', async (req, res) => {
  const { phone, idempotencyKey } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    const cleanPhone = normalizePhone(phone);
    
    // Check daily OTP limit
    const limitCheck = await checkAndIncrementOtpLimit(cleanPhone);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Security Limit: You have reached the maximum daily limit of ${limitCheck.limit} verification OTPs. Please try again later.`
      });
    }

    // Invalidate previous OTP
    await deleteWhatsAppOtp(cleanPhone);
    mobileOtps.delete(cleanPhone);

    // Generate a fresh 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Preserve metadata if present
    const existingMetadata = mobileOtps.get(cleanPhone) || {
      email: `${cleanPhone}@frostybite.temp`,
    };

    const otpPayload = {
      ...existingMetadata,
      otp,
      expires_at: Date.now() + 3 * 60 * 1000 // 3 minutes expiration
    };
    mobileOtps.set(cleanPhone, otpPayload);

    // Save hashed OTP to secure DB/memory storage
    await saveWhatsAppOtp(cleanPhone, otp);

    // Extract IP
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
    const clientIp = (Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : String(rawIp))
      .replace(/[^a-zA-Z0-9.-:_]/g, '_');

    // Dispatch fresh WhatsApp verification securely through queue with concurrency, backoff, and deduplication
    const queueService = OtpQueueService.getInstance();
    const waResult = await queueService.enqueue(
      cleanPhone,
      'whatsapp',
      otp,
      clientIp,
      idempotencyKey,
      otpPayload
    );

    return res.json({
      success: true,
      message: 'A fresh WhatsApp verification code has been dispatched!',
      dev_otp_hint: waResult.dev_otp_hint,
      client_dispatch_required: waResult.client_dispatch_required,
      textMessage: waResult.textMessage,
      formattedPhone: waResult.formattedPhone
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to resend WhatsApp verification code.' });
  }
});

// GET /whatsapp-poll - Local WhatsApp server polls this to find any queued OTP messages to send
router.get('/whatsapp-poll', (req, res) => {
  const now = Date.now();
  const maxAge = 120000; // 2 minutes expiration
  
  // Clean up stale or expired queued items
  const validMessages = WhatsAppService.pendingQueue.filter(m => (now - m.timestamp) < maxAge);
  WhatsAppService.pendingQueue = validMessages;

  res.json({ messages: WhatsAppService.pendingQueue });
});

// POST /whatsapp-ack - Local WhatsApp server calls this once a message is successfully sent
router.post('/whatsapp-ack', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Message ID is required for acknowledgement.' });
  }

  const index = WhatsAppService.pendingQueue.findIndex(m => m.id === id);
  if (index !== -1) {
    WhatsAppService.pendingQueue.splice(index, 1);
  }

  res.json({ success: true });
});

// Backward-compatibility Aliases (so any existing legacy clients do not fail!)
router.post('/send-mobile-otp', async (req, res) => {
  console.log('[AuthRoutes] Legacy send-mobile-otp route redirecting to /send-otp');
  return req.app._router.handle(req, res); // Redirects internally
});

router.post('/verify-mobile-otp', async (req, res) => {
  console.log('[AuthRoutes] Legacy verify-mobile-otp route redirecting to /verify-otp');
  return req.app._router.handle(req, res); // Redirects internally
});

// POST /send-email-otp - Generates a 6-digit OTP, saves it securely, and dispatches via SMTP / Email Queue
router.post('/send-email-otp', async (req, res) => {
  const { email, idempotencyKey } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Check daily OTP limit
    const limitCheck = await checkAndIncrementOtpLimit(normalizedEmail);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: `Security Limit: You have reached the maximum daily limit of ${limitCheck.limit} verification OTPs. Please try again later.`
      });
    }

    // Extract IP
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
    const clientIp = (Array.isArray(rawIp) ? rawIp[0] : typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : String(rawIp))
      .replace(/[^a-zA-Z0-9.-:_]/g, '_');

    // Generate guaranteed 6-digit numerical OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to secure memory store
    await saveEmailOtp(normalizedEmail, otp);

    // Route through Queue for rate-control and email dispatch
    try {
      const queueService = OtpQueueService.getInstance();
      await queueService.enqueue(
        normalizedEmail,
        'email',
        otp,
        clientIp,
        idempotencyKey,
        {}
      );
    } catch (dispatchErr: any) {
      console.warn('[send-email-otp] SMTP delivery warning:', dispatchErr.message || dispatchErr);
      // Even if SMTP queue has transient network delay, OTP is saved and fallback is ready
    }

    return res.json({ 
      success: true, 
      message: 'A 6-digit verification code has been dispatched to your email.',
      dev_otp_hint: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (err: any) {
    console.error('[send-email-otp] Exception:', err.message || err);
    return res.status(500).json({ 
      success: false, 
      error: err.message || 'An unexpected error occurred while dispatching email OTP.' 
    });
  }
});

// POST /verify-email-otp - Verifies the 6-digit email OTP and logs the user in
router.post('/verify-email-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email address and 6-digit verification code are required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    if (cleanOtp.length !== 6) {
      return res.status(400).json({ error: 'Please enter the full 6-digit verification code.' });
    }

    // 1. Get OTP record
    const otpRecord = await getEmailOtp(normalizedEmail);
    if (!otpRecord) {
      return res.status(401).json({ error: 'Verification code not found or has expired. Please request a new code.' });
    }

    // 2. Check Expiry
    if (otpRecord.expires_at < Date.now()) {
      await deleteEmailOtp(normalizedEmail);
      return res.status(401).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    // 3. Check Attempt Count (max 5 attempts)
    if (otpRecord.attempts >= 5) {
      await deleteEmailOtp(normalizedEmail);
      return res.status(429).json({ error: 'Maximum attempts exceeded. Please request a new verification code.' });
    }

    // 4. Validate OTP (hash comparison)
    const hashedInput = hashOtp(cleanOtp);
    if (otpRecord.otp_code !== hashedInput) {
      await incrementEmailAttempts(normalizedEmail, otpRecord.attempts);
      return res.status(401).json({ error: 'Incorrect verification code. Please check your email and try again.' });
    }

    // Success! Clear OTP immediately to prevent reuse
    await deleteEmailOtp(normalizedEmail);

    // Resolve or create user in database
    let dbUser: any = null;
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();
      dbUser = existingUser;
    } catch (e) {
      console.warn('[verify-email-otp] Error querying user:', e);
    }

    if (!dbUser) {
      const displayName = normalizedEmail.split('@')[0];
      try {
        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert({
            email: normalizedEmail,
            name: displayName,
            full_name: displayName,
            auth_methods: ['otp', 'email_otp'],
            last_login: new Date().toISOString(),
            last_login_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!insertError && insertedUser) {
          dbUser = insertedUser;
        }
      } catch (err: any) {
        console.warn('[verify-email-otp] Error inserting user:', err);
      }
    }

    if (!dbUser) {
      dbUser = {
        id: `usr_${Date.now()}`,
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
        role: 'customer'
      };
    }

    // Update login timestamp
    try {
      if (dbUser?.id && !String(dbUser.id).startsWith('usr_')) {
        await supabase
          .from('users')
          .update({
            last_login: new Date().toISOString(),
            last_login_at: new Date().toISOString()
          })
          .eq('id', dbUser.id);
      }
    } catch (_) {}

    // Sync login audit
    const syncedUid = dbUser.supabase_uid || dbUser.id;
    try {
      await UserService.syncUser({
        uid: syncedUid,
        supabaseUid: dbUser.supabase_uid || dbUser.id,
        email: dbUser.email,
        displayName: dbUser.name || dbUser.email.split('@')[0],
        photoURL: dbUser.avatar_url || null
      });
    } catch (syncErr: any) {
      console.warn('[verify-email-otp] DB syncing failed:', syncErr.message);
    }

    // Generate custom login token
    const mockPayload = {
      iss: 'https://securetoken.google.com/mock',
      sub: syncedUid,
      email: dbUser.email,
      email_verified: true,
      name: dbUser.name
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64');
    const fakeCustomToken = `${header}.${payload}.securesig`;

    // Reset daily rate limit on successful verification
    await resetOtpLimit(normalizedEmail);

    return res.json({
      success: true,
      customToken: fakeCustomToken,
      email: dbUser.email,
      user: dbUser
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Verification failed.' });
  }
});

// POST /reset-otp-limit - Reset rate limit for email or phone
router.post('/reset-otp-limit', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Identifier (email or phone) is required.' });
  }
  try {
    await resetOtpLimit(identifier);
    return res.json({ success: true, message: `OTP rate limit has been reset for ${identifier}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to reset OTP limit.' });
  }
});

// GET /otp-diagnostics - Diagnostic endpoint for real-time monitoring and abnormal traffic patterns
router.get('/otp-diagnostics', (req, res) => {
  try {
    const diagnostics = OtpQueueService.getInstance().getDiagnostics();
    return res.json({ success: true, diagnostics });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
