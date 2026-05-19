import express from 'express';
import { getAdminAuth } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';
import { EmailService } from '../services/email.service';

const router = express.Router();

router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  try {
    console.log(`[AuthRoutes] Using Supabase for OTP storage...`);
    
    // Store OTP in Supabase
    const { error: dbError } = await supabase
      .from('otps')
      .upsert({
        email,
        otp,
        expires_at: expiresAt
      }, { onConflict: 'email' });

    if (dbError) {
      console.error('[AuthRoutes] Supabase Write Error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Send email via Resend
    console.log(`[AuthRoutes] Attempting to send OTP email to ${email}...`);
    try {
      await EmailService.sendOTPEmail(email, otp);
    } catch (emailError: any) {
      console.error('[AuthRoutes] Email Send Error:', emailError);
      throw emailError;
    }

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error('[AuthRoutes] Send OTP Main Error:', error);
    let message = error.message;
    
    if (message.includes('RESEND_API_KEY')) {
      message = 'Email service configuration missing. Please add RESEND_API_KEY in the Settings menu.';
    } else if (message.includes('onboarding@resend.dev')) {
      message = 'Invalid email sender. If your domain isn\'t verified in Resend, you must use onboarding@resend.dev as the sender.';
    } else {
      message = `Failed to send login code: ${error.message}`;
    }
    
    res.status(500).json({ error: message });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    const adminAuth = getAdminAuth();
    
    // Get OTP from Supabase
    const { data: otpData, error: dbError } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .single();
    
    if (dbError || !otpData) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    
    // Check if OTP matches and hasn't expired
    if (otpData.otp !== otp || Date.now() > otpData.expires_at) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // OTP is valid, delete it (fire and forget or handle error)
    try {
      await supabase
        .from('otps')
        .delete()
        .eq('email', email);
    } catch (delErr) {
      console.warn('[AuthRoutes] Failed to delete used OTP:', delErr);
    }

    // Get user or create new one in Firebase Auth
    let user;
    try {
      const adminAuth = getAdminAuth();
      try {
        user = await adminAuth.getUserByEmail(email);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.message?.includes('not-found')) {
          user = await adminAuth.createUser({
            email,
            emailVerified: true,
            displayName: email.split('@')[0],
          });
        } else {
          console.error('[AuthRoutes] Firebase Auth specific error:', error.message);
          throw error;
        }
      }

      // Create custom token for Frontend to sign in
      const customToken = await adminAuth.createCustomToken(user.uid);
      res.json({ success: true, token: customToken });
    } catch (firebaseErr: any) {
      console.error('[AuthRoutes] Firebase Auth Critical Failure:', firebaseErr);
      
      // Fallback: If Firebase is totally broken but user wants Supabase, 
      // we might need a different strategy, but for now, we must fail with a clear message.
      const isGrpcError = firebaseErr.message?.includes('PERMISSION_DENIED') || firebaseErr.message?.includes('7');
      const errorMessage = isGrpcError 
        ? 'Authentication service (Firebase) permission denied. Please verify your FIREBASE_PROJECT_ID and credentials.' 
        : `Authentication system error: ${firebaseErr.message}`;
        
      res.status(503).json({ error: errorMessage });
    }
  } catch (error: any) {
    console.error('[AuthRoutes] Verify OTP Error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
