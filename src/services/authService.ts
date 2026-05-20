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

    // Determine the optimal verification type order
    // If the user does not exist, they are likely signing up (type: signup)
    // If they exist, they are likely signing in (type: email or magiclink)
    const verificationTypes: Array<'signup' | 'email' | 'magiclink'> = isNewUser
      ? ['signup', 'email', 'magiclink']
      : ['email', 'magiclink', 'signup'];

    console.log(`[AuthService] Verifying OTP for ${normalizedEmail}. Optimal types order:`, verificationTypes);

    let supabaseAuthSession = null;
    let lastError: any = null;

    for (const verifyType of verificationTypes) {
      try {
        console.log(`[AuthService] Trying verifyOtp with type: ${verifyType}`);
        const { data: resData, error: resError } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: cleanOtp,
          type: verifyType,
        });

        if (!resError && resData?.user) {
          console.log(`[AuthService] verifyOtp succeeded with type: ${verifyType}!`);
          supabaseAuthSession = resData;
          lastError = null;
          break; // Succeeded!
        } else {
          lastError = resError || new Error(`No user returned for type ${verifyType}`);
          console.log(`[AuthService] verifyOtp type ${verifyType} returned details:`, lastError.message || lastError);
        }
      } catch (err: any) {
        lastError = err;
        console.log(`[AuthService] verifyOtp type ${verifyType} threw exception:`, err);
      }
    }

    if (lastError || !supabaseAuthSession) {
      throw new Error(lastError?.message || 'Verification token is invalid or has expired');
    }

    console.log("Login success");

    // Logging user to Firebase with a secure, deterministic client password
    const securePassword = `frostybite_otp_${normalizedEmail.split('@')[0]}_9823#$!`;
    let result;
    try {
      result = await signInWithEmailAndPassword(auth, normalizedEmail, securePassword);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.message?.includes('user-not-found') || err.code === 'auth/invalid-credential') {
        console.log('[AuthService] User not existing/invalid, registering client-side under OTP login...');
        try {
          result = await createUserWithEmailAndPassword(auth, normalizedEmail, securePassword);
          if (result && result.user) {
            await updateProfile(result.user, { displayName: normalizedEmail.split('@')[0] });
          }
        } catch (signUpErr) {
          throw signUpErr;
        }
      } else {
        throw err;
      }
    }

    if (result && result.user) {
      await this.syncUserWithDatabase(result.user, undefined, true);
    }
    
    return result;
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
      await supabase
        .from('users')
        .upsert({
          firebase_uid: user.uid,
          email: user.email,
          name: name || user.displayName || '',
          avatar_url: user.photoURL,
          role: determinedRole,
          last_login: new Date().toISOString()
        }, { onConflict: 'firebase_uid' });
    } catch (error) {
       console.error('[AuthService] Supabase client sync error:', error);
    }
  },

  // Sign out
  logout
};
