import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  sendEmailVerification,
  signInWithCustomToken
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { supabase } from '../supabase';
import { getRoleFromEmail } from '../constants';
import { safeFirestore } from './firestoreService';
import { doc, serverTimestamp } from 'firebase/firestore';

const googleProvider = new GoogleAuthProvider();

export const logout = async () => {
  await signOut(auth);
};

export const authService = {
  // Email/Password Login
  async handleEmailLogin(email: string, pass: string) {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      await this.syncUserWithDatabase(result.user);
    }
    return result;
  },

  // Signup
  async handleSignup(email: string, pass: string, name?: string) {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      if (name) {
        await updateProfile(result.user, { displayName: name });
      }
      await this.syncUserWithDatabase(result.user, name);
      // Automatically send verification
      await sendEmailVerification(result.user);
    }
    return result;
  },

  // Send Email Verification
  async verifyEmail() {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  },

  // Magic Link Login
  async sendSignInLink(email: string) {
    const actionCodeSettings = {
      // Point to our finishing page
      url: `${window.location.origin}/finish-sign-in?email=${encodeURIComponent(email)}`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  },

  // Send OTP directly using Supabase client
  async sendOTP(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    });

    if (error) {
      console.log(error.message);
      throw new Error(error.message);
    }

    console.log("OTP sent");
  },

  // Verify OTP directly using Supabase client and sign in client-side to Firebase
  async verifyOTP(email: string, otp: string, isSignupHint?: boolean) {
    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    let isNewUser = true;

    if (isSignupHint !== undefined) {
      isNewUser = isSignupHint;
    } else {
      try {
        const { data: existingSbUser } = await supabase
          .from('users')
          .select('email')
          .eq('email', normalizedEmail)
          .maybeSingle();
        if (existingSbUser) {
          isNewUser = false;
        }
      } catch (err) {
        console.warn('[AuthService] Error checking user in local table:', err);
      }
    }

    // 1. Resolve exact Supabase OTP type from our secure server admin endpoint as a hint.
    // However, because we dispatch the OTP using signInWithOtp (in sendOTP), the expected GoTrue
    // verification type is almost always 'email' (for numeric OTP codes), regardless of whether
    // the user is new or existing.
    // To be exceptionally resilient, we will use a fallback sequence: trying 'email' first
    // (since signUp with password was never called), and fallback to other types if needed.
    let verifyTypeHint: 'signup' | 'email' | 'magiclink' = isNewUser ? 'signup' : 'email';
    try {
      const typeRes = await fetch(`/api/auth/otp-type?email=${encodeURIComponent(normalizedEmail)}`);
      if (typeRes.ok && typeRes.headers.get('content-type')?.includes('application/json')) {
        const typeData = await typeRes.json();
        if (typeData && typeData.type) {
          verifyTypeHint = typeData.type;
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error checking OTP type with server, falling back to client heuristic:', err);
    }

    // Since signInWithOtp is passwordless, 'email' is the proper GoTrue type.
    // We try 'email' first, then the hint or manual fallbacks.
    const verificationTypes: Array<'signup' | 'email' | 'magiclink'> = verifyTypeHint === 'signup'
      ? ['email', 'signup', 'magiclink']
      : [verifyTypeHint, 'email', 'signup', 'magiclink'];

    const uniqueTypes = Array.from(new Set(verificationTypes)) as Array<'signup' | 'email' | 'magiclink'>;

    console.log(`[AuthService] Verifying OTP for ${normalizedEmail} with fallback sequence:`, uniqueTypes);

    let supabaseAuthSession = null;
    let lastError: any = null;

    for (const currentType of uniqueTypes) {
      try {
        console.log(`[AuthService] Calling verifyOtp with type: ${currentType}`);
        const { data: resData, error: resError } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: cleanOtp,
          type: currentType,
        });

        if (!resError && resData?.user) {
          console.log(`[AuthService] verifyOtp succeeded with type: ${currentType}!`);
          supabaseAuthSession = resData;
          lastError = null;
          break; // Succeeded!
        } else {
          lastError = resError || new Error(`No user returned for type ${currentType}`);
          console.log(`[AuthService] verifyOtp failed for type ${currentType}:`, lastError.message || lastError);
        }
      } catch (err: any) {
        lastError = err;
        console.log(`[AuthService] verifyOtp threw exception for type ${currentType}:`, err);
      }
    }

    if (lastError || !supabaseAuthSession) {
      throw new Error(lastError?.message || 'Verification token is invalid or has expired');
    }

    console.log("[AuthService] Supabase OTP verification succeeded securely.");

    const accessToken = supabaseAuthSession.session?.access_token;
    if (!accessToken) {
      throw new Error('Supabase login completed but no authenticated token was provided.');
    }

    // Call server to fetch the old Firebase user profile or establish a clean synced profile
    try {
      const response = await fetch('/api/auth/firebase-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supabaseAccessToken: accessToken,
          email: normalizedEmail,
        }),
      });

      const isJson = response.headers.get('content-type')?.includes('application/json');
      if (response.ok && isJson) {
        const { customToken } = await response.json();
        if (customToken) {
          // Authenticate clean and securely on client to Firebase using the server-generated Custom Token
          const result = await signInWithCustomToken(auth, customToken);

          if (result && result.user) {
            localStorage.setItem(`verified_${result.user.uid}`, 'true');
            await this.syncUserWithDatabase(result.user, undefined, true);
          }
          return result;
        }
      } else {
        let errorMsg = 'Server-side Firebase flow mapping failed.';
        if (isJson && response) {
          const errBody = await response.json().catch(() => ({}));
          errorMsg = errBody.error || errorMsg;
        } else if (response) {
          const text = await response.text().catch(() => '');
          console.error('[AuthService] Non-JSON error response received:', text);
        }
        console.warn(`[AuthService] Firebase token generation did not complete: ${errorMsg}. Continuing with Supabase OTP session...`);
      }
    } catch (fbTokenError) {
      console.warn('[AuthService] Firebase custom token exchange failed. Using secure direct Supabase master identity session: ', fbTokenError);
    }

    // Fallback: If Firebase custom token flow is unavailable/unlicensed, complete authentication using public master DB Session
    console.log('[AuthService] Completing authentication fallback using Supabase master/public database record.');
    return {
      user: {
        uid: supabaseAuthSession.user?.id || 'sb-user',
        email: normalizedEmail,
        displayName: normalizedEmail.split('@')[0],
        emailVerified: true,
        getIdToken: async () => accessToken,
        reload: async () => {},
      }
    };
  },

  // Google Login
  async loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      await this.syncUserWithDatabase(result.user, undefined, true);
    }
    return result;
  },

  // Password Reset
  async forgotPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  },

  // Sync user with tables (Firestore + Supabase via Backend sync)
  async syncUserWithDatabase(user: any, name?: string, markVerified: boolean = false) {
    const determinedRole = getRoleFromEmail(user.email);

    if (markVerified && user?.uid) {
      localStorage.setItem(`verified_${user.uid}`, 'true');
    }

    // 1. Backend Sync (Supabase + Welcome Email) - Production approach
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, markVerified: markVerified || user.emailVerified })
      });
      
      if (!response.ok) {
        console.warn('[AuthService] Backend sync failed, falling back to direct sync');
      } else if (markVerified) {
        try {
          await user.reload();
        } catch (reloadErr) {
          console.warn('[AuthService] Error reloading user:', reloadErr);
        }
      }
    } catch (syncErr) {
      console.error('[AuthService] Sync error:', syncErr);
    }

    // 2. Firestore Sync (Using safeFirestore + hardened rules)
    try {
      const userRef = doc(db, 'users', user.uid);
      await safeFirestore.set(userRef, {
        uid: user.uid,
        email: user.email,
        full_name: name || user.displayName || '',
        role: determinedRole,
        updated_at: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore user sync warning:', err);
    }

    // 3. Direct client-side Supabase backup sync (if backend was reachable but missed something)
    try {
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      const sbUid = sbUser?.id || null;

      const upsertPayload: any = {
        email: user.email,
        name: name || user.displayName || '',
        full_name: name || user.displayName || '',
        avatar_url: user.photoURL,
        avatar: user.photoURL,
        role: determinedRole,
        last_login: new Date().toISOString(),
        last_login_at: new Date().toISOString()
      };

      if (user.uid) upsertPayload.firebase_uid = user.uid;
      if (sbUid) upsertPayload.supabase_uid = sbUid;

      const methods = [];
      if (user.uid) methods.push('firebase');
      if (sbUid) methods.push('otp');
      if (methods.length > 0) {
        upsertPayload.auth_methods = methods;
      }

      await supabase
        .from('users')
        .upsert(upsertPayload, { onConflict: 'email' });
    } catch (error) {
       console.error('[AuthService] Supabase client sync error:', error);
    }
  },

  // Sign out
  logout
};
