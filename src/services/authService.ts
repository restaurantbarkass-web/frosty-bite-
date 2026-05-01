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

const googleProvider = new GoogleAuthProvider();

export const logout = async () => {
  await signOut(auth);
};

export const authService = {
  // Email/Password Login
  async handleEmailLogin(email: string, pass: string) {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (result.user) {
      await this.syncUserWithFirestore(result.user);
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
      await this.syncUserWithFirestore(result.user, name);
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
      await this.syncUserWithFirestore(result.user);
    }
    return result;
  },

  // Password Reset
  async forgotPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  },

  // Sync user with table
  async syncUserWithFirestore(user: any, name?: string) {
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        full_name: name || user.displayName || '',
        role: 'customer', // Default role
        updated_at: new Date().toISOString(),
      }, { merge: true });
    } catch (error: any) {
      console.error('Error syncing user with Firestore:', error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  },

  // Sign out
  logout
};
