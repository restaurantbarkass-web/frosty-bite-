import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, signInWithGoogle, syncUserWithFirestore } from '../firebase';

export const authService = {
  // Email/Password Login
  async handleEmailLogin(email: string, pass: string) {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    await syncUserWithFirestore(result.user);
    return result;
  },

  // Signup
  async handleSignup(email: string, pass: string) {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await syncUserWithFirestore(result.user);
    return result;
  },

  // Google Login (using our existing function)
  async loginWithGoogle() {
    return signInWithGoogle();
  },

  // Password Reset
  async forgotPassword(email: string) {
    return sendPasswordResetEmail(auth, email);
  }
};
