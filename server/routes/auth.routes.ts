import express from 'express';
import { getAdminAuth } from '../lib/firebase-admin';
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

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('[AuthRoutes] Sync error:', error);
    const apiError = parseFirebaseError(error);
    if (apiError) {
      return res.status(503).json(apiError);
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

    const firebaseCustomToken = await adminAuth.createCustomToken(firebaseUser.uid);
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
      return res.status(503).json(apiError);
    }
    res.status(500).json({ error: err.message || 'Firebase token generation and authentication sync failed' });
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

export default router;
