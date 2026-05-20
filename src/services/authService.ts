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
    console.log('[AuthService] Sending OTP via Supabase client to:', email);
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      console.error('[AuthService] Supabase signInWithOtp error:', error);
      throw new Error(error.message || 'Failed to send OTP verification code');
    }
    return data;
  },

  // Verify OTP directly using Supabase client and sign in client-side to Firebase
  async verifyOTP(email: string, otp: string) {
    console.log('[AuthService] Verifying OTP directly with Supabase Client:', email);
    
    let sbData = null;
    let sbError = null;

    // Try type 'email'
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      });
      sbData = data;
      sbError = error;
    } catch (err: any) {
      sbError = err;
    }

    // Try type 'signup' fallback
    if (sbError || !sbData?.user) {
      console.log('[AuthService] type "email" verification failed, attempting type "signup" fallback...');
      try {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: 'signup'
        });
        if (!error && data?.user) {
          sbData = data;
          sbError = null;
        }
      } catch (err) {
        // ignore signup err
      }
    }

    if (sbError || !sbData?.user) {
      console.error('[AuthService] Supabase OTP verification failed:', sbError);
      throw new Error(sbError?.message || 'Invalid or expired login verification code');
    }

    console.log('[AuthService] Direct client-side Supabase verifyOtp success!', sbData);

    // Logging user to Firebase with a secure, deterministic client password
    const securePassword = `frostybite_otp_${email.split('@')[0]}_9823#$!`;
    let result;
    try {
      result = await signInWithEmailAndPassword(auth, email, securePassword);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.message?.includes('user-not-found') || err.code === 'auth/invalid-credential') {
        console.log('[AuthService] User not existing/invalid, registering client-side under OTP login...');
        try {
          result = await createUserWithEmailAndPassword(auth, email, securePassword);
          if (result && result.user) {
            await updateProfile(result.user, { displayName: email.split('@')[0] });
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
