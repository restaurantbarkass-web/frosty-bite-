import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
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
  },

  // Phone Auth / OTP
  async setupRecaptcha(containerId: string) {
    if ((window as any).recaptchaVerifier) return;
    (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
      }
    });
  },

  async sendOTP(phoneNumber: string): Promise<ConfirmationResult> {
    const appVerifier = (window as any).recaptchaVerifier;
    return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  },

  async verifyOTP(confirmationResult: ConfirmationResult, otp: string) {
    return confirmationResult.confirm(otp);
  }
};
