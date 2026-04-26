import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendEmailVerification
} from 'firebase/auth';
import { auth, signInWithGoogle, syncUserWithFirestore } from '../firebase';

export const authService = {
  // Standard Email Verification
  async sendVerificationEmail() {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  },

  // Email Link (Passwordless)
  async sendSignInLink(email: string) {
    const actionCodeSettings = {
      // The URL to redirect back to. The domain (www.example.com) for this
      // URL must be whitelisted in the Firebase Console.
      url: `${window.location.origin}/finish-sign-in`,
      // This must be true.
      handleCodeInApp: true,
    };

    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // The link was successfully sent. Inform the user.
    // Save the email locally so you don't need to ask the user for it again
    // if they open the link on the same device.
    window.localStorage.setItem('emailForSignIn', email);
  },

  async isSignInLink(url: string) {
    return isSignInWithEmailLink(auth, url);
  },

  async handleSignInWithLink(email: string, url: string) {
    const result = await signInWithEmailLink(auth, email, url);
    await syncUserWithFirestore(result.user);
    window.localStorage.removeItem('emailForSignIn');
    return result;
  },
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
