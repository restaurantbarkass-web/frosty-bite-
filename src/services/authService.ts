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

  // Send OTP (Resend Backend)
  async sendOTP(email: string) {
    const response = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Failed to parse server response');
      }
    } else {
      const text = await response.text();
      console.error('[AuthService] Non-JSON response in sendOTP:', text.substring(0, 200));
      throw new Error('Server returned an invalid non-JSON response from send-otp. Response: ' + text.substring(0, 300));
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send OTP');
    }
    return data;
  },

  // Verify OTP and Sign In
  async verifyOTP(email: string, otp: string) {
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    
    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Failed to parse server response');
      }
    } else {
      const text = await response.text();
      console.error('[AuthService] Non-JSON response in verifyOTP:', text.substring(0, 200));
      throw new Error('Server returned an invalid non-JSON response from verify-otp. Response: ' + text.substring(0, 300));
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to verify OTP');
    }

    let result;
    if (data.clientAuthFallback) {
      console.log('[AuthService] Using client-side deterministic auth fallback for OTP...');
      const securePassword = `frostybite_otp_${email.split('@')[0]}_9823#$!`;
      try {
        // Try logging in existing user first
        result = await signInWithEmailAndPassword(auth, email, securePassword);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.message?.includes('user-not-found') || err.code === 'auth/invalid-credential') {
          console.log('[AuthService] User not found/invalid credentials, creating/resetting user client-side under OTP login...');
          // Since it's a verified OTP, make sure the user is created or updated
          try {
            result = await createUserWithEmailAndPassword(auth, email, securePassword);
            if (result.user) {
              await updateProfile(result.user, { displayName: email.split('@')[0] });
            }
          } catch (signUpErr) {
            // Already exists or other issues, try normal login with this password, or throw
            throw signUpErr;
          }
        } else {
          throw err;
        }
      }
    } else {
      result = await signInWithCustomToken(auth, data.token);
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
