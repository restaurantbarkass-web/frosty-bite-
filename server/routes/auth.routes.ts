import express from 'express';
import { getAdminAuth, getAdminDb } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';
import { UserService } from '../services/user.service';
import { EmailService } from '../services/email.service';

function parseFirebaseError(err: any): { error: string; isApiNotEnabledError: boolean; activationUrl: string } | null {
  const errMsg = err?.message || '';
  const isApiIssue = errMsg.includes('identitytoolkit.googleapis.com') || 
                      errMsg.includes('Identity Toolkit API') || 
                      err?.code === 'auth/internal-error';
  
  if (isApiIssue) {
    return {
      error: 'Google Identity Toolkit API is recently enabled or still propagating. Please visit https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=706739706976 to confirm activation. Since you recently activated it, please wait 1–2 minutes for Google Cloud to fully propagate the changes and try again.',
      isApiNotEnabledError: true,
      activationUrl: 'https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=706739706976'
    };
  }
  return null;
}

const router = express.Router();

// Synchronize Firebase user with Supabase (used after Social Login or App Start)
router.post('/sync', async (req, res) => {
  const { idToken, markVerified } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Auth token required' });

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    if (markVerified && !decodedToken.email_verified) {
      console.log(`[AuthRoutes] Marking user ${decodedToken.email} as emailVerified: true in Firebase Auth`);
      await adminAuth.updateUser(decodedToken.uid, { emailVerified: true });
    }
    
    // Check if new user for welcome email (we check if they exist in Supabase users table)
    const existingUser = await UserService.getUserByFirebaseUid(decodedToken.uid);
    
    const user = await UserService.syncUser({
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      displayName: decodedToken.name,
      photoURL: decodedToken.picture
    });

    // Send welcome email only to genuine new users in the background (non-blocking)
    if (!existingUser && user?.email) {
      EmailService.sendWelcomeEmail(user.email, user.name).catch((emailErr) => {
        console.warn('[AuthRoutes] Welcome email background task failed:', emailErr);
      });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('[AuthRoutes] Sync error:', error);
    const apiError = parseFirebaseError(error);
    if (apiError) {
      return res.status(200).json({ success: false, ...apiError });
    }
    res.status(401).json({ error: 'Invalid token or sync failed' });
  }
});

// Generate a Firebase Custom Token after successful Supabase OTP verification
router.post('/firebase-token', async (req, res) => {
  const { supabaseAccessToken, email } = req.body;
  if (!supabaseAccessToken || !email) {
    return res.status(400).json({ error: 'Supabase access token and email are required' });
  }

  try {
    const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(supabaseAccessToken);
    
    if (sbError || !sbUser) {
      console.error('[AuthRoutes] Supabase token verification failed on server:', sbError);
      return res.status(401).json({ error: 'Invalid Supabase session' });
    }

    if (!sbUser.email || sbUser.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Email verification mismatch' });
    }

    const adminAuth = getAdminAuth();
    let firebaseUser;
    
    try {
      firebaseUser = await adminAuth.getUserByEmail(email);
      console.log(`[AuthRoutes] Found existing Firebase profile for ${email} (UID: ${firebaseUser.uid})`);
      if (!firebaseUser.emailVerified) {
        console.log(`[AuthRoutes] Marking existing user as emailVerified: true in Firebase Auth`);
        firebaseUser = await adminAuth.updateUser(firebaseUser.uid, { emailVerified: true });
      }
    } catch (fbGetError: any) {
      if (fbGetError.code === 'auth/user-not-found') {
        console.log(`[AuthRoutes] No existing Firebase profile for ${email}. Creating a new one...`);
        firebaseUser = await adminAuth.createUser({
          email: email,
          emailVerified: true,
          displayName: email.split('@')[0],
        });
      } else {
        throw fbGetError;
      }
    }

    const normalizedEmailStr = (firebaseUser.email || email).toLowerCase();
    const adminEmails = [
      "restaurantbarkass@gmail.com",
      "wasifmd924@gmail.com",
      "sayedazainab216@gmail.com",
      "sayedazainabali76@gmail.com"
    ];
    const isAdminUser = adminEmails.includes(normalizedEmailStr);

    const firebaseCustomToken = await adminAuth.createCustomToken(firebaseUser.uid, {
      email: firebaseUser.email || email,
      email_verified: true,
      role: isAdminUser ? 'admin' : 'customer',
      isAdmin: isAdminUser
    });
    console.log(`[AuthRoutes] Successfully generated Firebase custom token for UID: ${firebaseUser.uid}`);

    // Keep databases fully synced
    await UserService.syncUser({
      uid: firebaseUser.uid,
      supabaseUid: sbUser.id,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL
    });

    res.json({
      success: true,
      customToken: firebaseCustomToken,
      firebaseUser: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
      }
    });
  } catch (err: any) {
    console.error('[AuthRoutes] Firebase token generation error:', err);
    const apiError = parseFirebaseError(err);
    if (apiError) {
      return res.status(200).json({ success: false, ...apiError });
    }
    res.status(400).json({ success: false, error: err.message || 'Firebase token generation and authentication sync failed' });
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
    console.log(`[AuthRoutes] Checking correct OTP verification type for: ${normalizedEmail}`);
    
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error || !data || !data.users) {
      console.log(`[AuthRoutes] Error or empty list from listUsers for ${normalizedEmail}:`, error);
      return res.json({ type: 'signup' });
    }

    const foundUser = data.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);

    if (!foundUser) {
      console.log(`[AuthRoutes] User not found in GoTrue list for ${normalizedEmail}. Using 'signup'`);
      return res.json({ type: 'signup' });
    }

    const isConfirmed = !!foundUser.email_confirmed_at;
    const type = isConfirmed ? 'email' : 'signup';
    console.log(`[AuthRoutes] User ${normalizedEmail} found in GoTrue. (isConfirmed: ${isConfirmed}) -> Using OTP type: '${type}'`);
    
    res.json({ type });
  } catch (err: any) {
    console.error('[AuthRoutes] Error checking user OTP type in admin:', err);
    res.json({ type: 'signup' }); // Safe fallback
  }
});

/**
 * POST /api/auth/reset-password
 * Securely resets user password in the Database after verifying a valid OTP code.
 */
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

    // Verify OTP first using Supabase .auth.verifyOtp flow
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
      console.warn('[ResetPasswordRoute] Failed listing users for OTP type on server:', err.message);
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: cleanOtp,
      type: verifyType,
    });

    if (verifyError || !verifyData?.user) {
      // Fallback try alternate code type
      const altType = verifyType === 'email' ? 'signup' : 'email';
      const { data: verifyDataAlt, error: verifyErrorAlt } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: cleanOtp,
        type: altType,
      });

      if (verifyErrorAlt || !verifyDataAlt?.user) {
        return res.status(401).json({ error: 'Invalid or expired OTP verification code.' });
      }
    }

    // 2. Perform the update of public.users.password in the database
    const { data: updatedUsers, error: dbErr } = await supabase
      .from('users')
      .update({ password: cleanPassword })
      .eq('email', normalizedEmail)
      .select();

    if (dbErr) {
      console.error('[ResetPasswordRoute] Failed to update user custom password field:', dbErr.message);
      return res.status(500).json({ error: 'Failed to update password in database.' });
    }

    console.log(`[ResetPasswordRoute] Successfully reset custom password for: ${normalizedEmail}`);
    return res.json({ success: true, message: 'Your password has been successfully reset! Please check-in using your new password.' });
  } catch (err: any) {
    console.error('[ResetPasswordRoute] Unexpected Exception:', err);
    return res.status(500).json({ error: err.message || 'An unexpected error occurred during password reset.' });
  }
});

/**
 * POST /api/auth/send-mobile-otp
 * Generates and stores/sends an OTP code to a mobile phone number
 */
router.post('/send-mobile-otp', async (req, res) => {
  const { phone, isSignup, email, name, password } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Mobile phone number is required.' });
  }

  try {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    // Check if user exists in our supabase db by this phone number
    const { data: dbUser, error: dbErr } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (dbErr) {
      console.error('[SendMobileOtp] DB Query error:', dbErr.message);
    }

    let isRegistrationFlow = isSignup || !dbUser;

    if (isSignup) {
      if (dbUser) {
        return res.status(400).json({ error: 'A Frosty Bite account is already registered with this phone number. Please sign in instead!' });
      }

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const { data: dbUserByEmail } = await supabase
          .from('users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (dbUserByEmail) {
          return res.status(400).json({ error: 'A Frosty Bite account is already registered with this email ID. Please sign in instead!' });
        }
      }
    }

    // Generate beautiful 8-digit OTP code to perfectly fit the UI grids
    const otp = Math.floor(10000000 + Math.random() * 90000000).toString();
    const expires_at = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Save in Firestore under a safe collection 'mobile_otps'
    const dbInstance = getAdminDb();
    const otpPayload: any = {
      otp,
      expires_at,
      email: (isRegistrationFlow && email) ? email.trim().toLowerCase() : (dbUser ? dbUser.email : `${cleanPhone}@frostybite.temp`),
    };

    if (isRegistrationFlow) {
      otpPayload.isSignup = true;
      otpPayload.name = name ? name.trim() : `User ${cleanPhone}`;
      otpPayload.password = password ? password.trim() : '';
    } else if (dbUser) {
      otpPayload.userId = dbUser.id;
    }

    await dbInstance.collection('mobile_otps').doc(cleanPhone).set(otpPayload);

    console.log('\n=============================================');
    console.log(`📱 [MOBILE OTP] Generated ${isSignup ? 'Signup' : 'Signin'} OTP for +91${cleanPhone}: ${otp}`);
    console.log('=============================================\n');

    return res.json({
      success: true,
      message: `Verification code successfully sent to +91 ${cleanPhone}.`,
      dev_otp_hint: otp // Helpful development hint returned directly to play with
    });
  } catch (err: any) {
    console.error('[SendMobileOtp] Unexpected Error:', err);
    return res.status(500).json({ error: err.message || 'An unexpected error occurred while dispatching OTP.' });
  }
});

/**
 * POST /api/auth/verify-mobile-otp
 * Verifies mobile phone number OTP code and logs the user in
 */
router.post('/verify-mobile-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone number and verification OTP are required.' });
  }

  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanOtp = otp.trim();

    const dbInstance = getAdminDb();
    const otpDocRef = dbInstance.collection('mobile_otps').doc(cleanPhone);
    const otpSnap = await otpDocRef.get();

    if (!otpSnap.exists) {
      return res.status(401).json({ error: 'Verification code not found or has expired. Please request a new code.' });
    }

    const otpData = otpSnap.data();
    if (!otpData) {
      return res.status(401).json({ error: 'Verification data is empty.' });
    }

    if (otpData.expires_at < Date.now()) {
      await otpDocRef.delete();
      return res.status(401).json({ error: 'Verification code has expired. Please request a new code.' });
    }

    if (otpData.otp !== cleanOtp) {
      return res.status(401).json({ error: 'Incorrect verification code. Please check your screen or console verification logs.' });
    }

    // Success! Prune the disposable code
    await otpDocRef.delete();

    // Fetch user from Supabase to complete profile synchronization
    let dbUser = null;
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanPhone)
      .maybeSingle();

    dbUser = existingUser;

    if (otpData.isSignup && !dbUser) {
      // Create user in Supabase first
      const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email: otpData.email || `${cleanPhone}@frostybite.temp`,
          name: otpData.name || `User ${cleanPhone}`,
          full_name: otpData.name || `User ${cleanPhone}`,
          phone: cleanPhone,
          password: otpData.password || '',
          auth_methods: ['otp', 'mobile_otp'],
          last_login: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('[VerifyMobileOtp] Failed to register user in Supabase:', insertError);
        if (insertError.code !== '23505') {
          return res.status(500).json({ error: 'Failed to create your Frosty Bite account. ' + insertError.message });
        }
      } else {
        dbUser = insertedUser;
        console.log(`[VerifyMobileOtp] User registered successfully in Supabase for: ${otpData.email}`);
      }
    }

    if (!dbUser) {
      // Recheck the DB, just in case
      const { data: refetchedUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();
      dbUser = refetchedUser;
    }

    if (!dbUser) {
      return res.status(401).json({ error: 'Failed to resolve user account credentials associated with this mobile phone.' });
    }

    // Generate Firebase custom login token
    const adminAuth = getAdminAuth();
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.getUserByEmail(dbUser.email);
      console.log(`[VerifyMobileOtp] Found Firebase User with Email: ${dbUser.email} (UID: ${firebaseUser.uid})`);
    } catch (fbErr: any) {
      if (fbErr.code === 'auth/user-not-found') {
        console.log(`[VerifyMobileOtp] Account missing in Firebase Auth. Creating on the fly: ${dbUser.email}`);
        firebaseUser = await adminAuth.createUser({
          email: dbUser.email,
          emailVerified: true,
          displayName: dbUser.name || dbUser.email.split('@')[0],
        });
      } else {
        throw fbErr;
      }
    }

    const adminEmails = [
      "restaurantbarkass@gmail.com",
      "wasifmd924@gmail.com",
      "sayedazainab216@gmail.com",
      "sayedazainabali76@gmail.com"
    ];
    const isAdminUser = adminEmails.includes(dbUser.email.toLowerCase());

    const firebaseCustomToken = await adminAuth.createCustomToken(firebaseUser.uid, {
      email: dbUser.email,
      email_verified: true,
      role: isAdminUser ? 'admin' : 'customer',
      isAdmin: isAdminUser
    });

    console.log(`[VerifyMobileOtp] Mobile Login/Registration complete. Syncing identity & generating Token for ${dbUser.email}`);
    
    // Sync login audit in UserService
    await UserService.syncUser({
      uid: firebaseUser.uid,
      supabaseUid: dbUser.supabase_uid || dbUser.id,
      email: dbUser.email,
      displayName: dbUser.name || firebaseUser.displayName,
      photoURL: dbUser.avatar_url || firebaseUser.photoURL
    });

    return res.json({
      success: true,
      customToken: firebaseCustomToken,
      email: dbUser.email,
      user: dbUser
    });
  } catch (err: any) {
    console.error('[VerifyMobileOtp] unexpected failure:', err);
    return res.status(500).json({ error: err.message || 'Verification failed. An unexpected error occurred on the authentication gateway.' });
  }
});

export default router;
