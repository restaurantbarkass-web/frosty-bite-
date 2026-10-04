import express from 'express';
import { CustomOtpService } from '../services/customOtp.service';
import { UserService } from '../services/user.service';
import { supabase } from '../lib/supabase';

const router = express.Router();

/**
 * POST /api/auth/otp/request
 * Requests a secure 6-digit OTP sent via physical-SIM SMS Gateway.
 */
router.post('/request', async (req, res) => {
  try {
    const { phone, purpose } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const validPurposes = ['LOGIN', 'SIGNUP', 'VERIFY_PHONE', 'PASSWORD_RESET'];
    const otpPurpose = validPurposes.includes(purpose) ? purpose : 'LOGIN';

    const result = await CustomOtpService.requestOtp({
      phone,
      purpose: otpPurpose,
      ip: String(ip)
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[OTP Request Error]:', err.message);
    return res.status(400).json({
      ok: false,
      error: err.message || 'Failed to send OTP. Please try again.'
    });
  }
});

/**
 * POST /api/auth/otp/verify
 * Verifies the submitted 6-digit OTP and completes authentication / session setup.
 */
router.post('/verify', async (req, res) => {
  try {
    const { phone, purpose, otp } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone number and verification code are required.' });
    }

    const validPurposes = ['LOGIN', 'SIGNUP', 'VERIFY_PHONE', 'PASSWORD_RESET'];
    const otpPurpose = validPurposes.includes(purpose) ? purpose : 'LOGIN';

    // Verify OTP via CustomOtpService
    const verification = await CustomOtpService.verifyOtp({
      phone,
      purpose: otpPurpose,
      otp,
      ip: String(ip)
    });

    if (!verification.verified) {
      return res.status(400).json({ ok: false, error: 'Verification failed.' });
    }

    const normalizedPhone = CustomOtpService.normalizePhone(phone);

    // Sync or create user record in Supabase users table based on verified phone number
    let user = null;
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existingUser) {
        user = existingUser;
        // Update last login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', existingUser.id);
      } else {
        // Create new user profile for phone-verified user
        const newUserId = crypto.randomUUID();
        const dummyEmail = `phone_${normalizedPhone.replace(/\D/g, '')}@frostybite.local`;
        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            email: dummyEmail,
            phone: normalizedPhone,
            name: `Foodie ${normalizedPhone.slice(-4)}`,
            full_name: `Foodie ${normalizedPhone.slice(-4)}`,
            role: 'customer',
            auth_methods: ['otp_phone'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!createError && createdUser) {
          user = createdUser;
        } else {
          // Fallback user object if DB insert restricted
          user = {
            id: newUserId,
            email: dummyEmail,
            phone: normalizedPhone,
            name: `Foodie ${normalizedPhone.slice(-4)}`,
            role: 'customer'
          };
        }
      }
    } catch (syncErr) {
      console.warn('[OTP Verify] User sync warning:', syncErr);
    }

    return res.json({
      ok: true,
      message: 'OTP verified successfully.',
      verified: true,
      user
    });
  } catch (err: any) {
    console.error('[OTP Verify Error]:', err.message);
    return res.status(400).json({
      ok: false,
      error: err.message || 'Invalid verification code.'
    });
  }
});

export default router;
