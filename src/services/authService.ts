import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail
} from 'firebase/auth';
import { auth } from '../firebase';
import { supabase } from '../supabase';
import { getRoleFromEmail } from '../constants';

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
    }
    return result;
  },

  // Magic Link Login
  async sendSignInLink(email: string) {
    const actionCodeSettings = {
      url: `${window.location.origin}/`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
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

  // Sync user with tables (Supabase for primary data)
  async syncUserWithDatabase(user: any, name?: string) {
    const determinedRole = getRoleFromEmail(user.email);
    const userData = {
      uid: user.uid,
      email: user.email,
      full_name: name || user.displayName || '',
      role: determinedRole,
      updated_at: new Date().toISOString(),
    };

    // Supabase Sync (Primary)
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.uid,
          email: user.email,
          full_name: userData.full_name,
          role: determinedRole,
          updated_at: userData.updated_at
        }, { onConflict: 'id' });
      
      if (error && error.code !== 'PGRST116') { 
        console.error('Error syncing user with Supabase:', error);
      }
    } catch (error) {
      console.error('Supabase user sync crash:', error);
    }
  },

  // Sign out
  logout
};
