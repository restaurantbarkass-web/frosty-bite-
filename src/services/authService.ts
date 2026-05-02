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
import { auth, db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestoreService';
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

  // Sync user with tables (Firestore for role/meta, Supabase for primary data)
  async syncUserWithDatabase(user: any, name?: string) {
    const determinedRole = getRoleFromEmail(user.email);
    const userData = {
      uid: user.uid,
      email: user.email,
      full_name: name || user.displayName || '',
      role: determinedRole,
      updated_at: new Date().toISOString(),
    };

    // Firestore Sync (for role-based security rules if still needed)
    try {
      await setDoc(doc(db, 'users', user.uid), userData, { merge: true });
    } catch (error: any) {
      console.error('Error syncing user with Firestore:', error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    }

    // Supabase Sync
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
      
      if (error && error.code !== 'PGRST116') { // Only log if it's not a "not found" style error on upsert
        console.error('Error syncing user with Supabase:', error);
      }
    } catch (error) {
      console.error('Supabase user sync crash:', error);
    }
  },

  // Sign out
  logout
};
