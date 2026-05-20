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
      email: email.trim(),
    });

    if (error) {
      console.log(error.message);
      throw new Error(error.message);
    }

    console.log("OTP sent");
  },

  // Verify OTP directly using Supabase client and sign in client-side to Firebase
  async verifyOTP(email: string, otp: string) {
    // We will try three different validation types because GoTrue scopes OTPs to specific actions:
    // 1. "email" (standard passwordless OTP sign-in in some GoTrue setups)
    // 2. "magiclink" (standard passwordless OTP / magiclink code)
    // 3. "signup" (confirmation code for a new user registration)
    
    let data = null;
    let error = null;

    console.log(`[AuthService] Attempting verifyOtp (type: email) for: ${email}`);
    try {
      const res = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });
      data = res.data;
      error = res.error;
    } catch (e: any) {
      error = e;
    }

    if (error) {
      console.log(`[AuthService] verifyOtp (type: email) failed: ${error.message || error}. Trying magiclink...`);
      try {
        const res = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: "magiclink",
        });
        if (!res.error) {
          data = res.data;
          error = null;
          console.log('[AuthService] verifyOtp (type: magiclink) succeeded!');
        } else {
          error = res.error;
        }
      } catch (e: any) {
        error = e;
      }
    }

    if (error) {
      console.log(`[AuthService] verifyOtp (type: magiclink) failed: ${error.message || error}. Trying signup...`);
      try {
        const res = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otp.trim(),
          type: "signup",
        });
        if (!res.error) {
          data = res.data;
          error = null;
          console.log('[AuthService] verifyOtp (type: signup) succeeded!');
        } else {
          error = res.error;
        }
      } catch (e: any) {
        error = e;
      }
    }

    if (error) {
      console.log(`[AuthService] All verification types failed. Error details:`, error.message || error);
      throw new Error(error.message || 'Verification token is invalid or has expired');
    }

    console.log("Login success");

    // Logging user to Firebase with a secure, deterministic client password
    const securePassword = `frostybite_otp_${email.trim().split('@')[0]}_9823#$!`;
    let result;
    try {
      result = await signInWithEmailAndPassword(auth, email.trim(), securePassword);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.message?.includes('user-not-found') || err.code === 'auth/invalid-credential') {
        console.log('[AuthService] User not existing/invalid, registering client-side under OTP login...');
        try {
          result = await createUserWithEmailAndPassword(auth, email.trim(), securePassword);
          if (result && result.user) {
            await updateProfile(result.user, { displayName: email.trim().split('@')[0] });
          }
        } catch (signUpErr) {
          throw signUpErr;
        }
      } else {
        throw err;
      }
    }

    if (result && result.user) {
      await this.syncUserWithDatabase(result.user);
    }
    
    return result;
  },

  // Google Login
  async loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      await this.syncUserWithDatabase(result.user);
    }
    return result;
  },

  // Password Reset
  async forgotPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  },

  // Sync user with tables (Firestore + Supabase via Backend sync)
  async syncUserWithDatabase(user: any, name?: string) {
    const determinedRole = getRoleFromEmail(user.email);

    // 1. Backend Sync (Supabase + Welcome Email) - Production approach
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      
      if (!response.ok) {
        console.warn('[AuthService] Backend sync failed, falling back to direct sync');
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
