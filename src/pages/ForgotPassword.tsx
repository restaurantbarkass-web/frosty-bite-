import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, ArrowLeft, Mail, Loader2, CheckCircle2, Lock, ShieldCheck, RefreshCw } from 'lucide-react';
import { authService } from '../services/authService';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';

type ResetStep = 'send_otp' | 'verify_otp' | 'success';

const parseAuthError = (err: any): string => {
  if (!err) return 'An unexpected recovery error occurred. Please try again.';
  
  const originalMessage = typeof err === 'string' ? err : (err.message || err.error || err.code || '');
  const code = err.code || '';
  
  const normalized = `${originalMessage} ${code}`.toLowerCase();
  
  if (normalized.includes('invalid-email') || normalized.includes('invalid email')) {
    return 'Invalid email address format. Please enter a valid email address (e.g., baker@frostybite.com) without spaces.';
  }
  
  if (normalized.includes('weak-password') || normalized.includes('password too short') || normalized.includes('password must be at least')) {
    return 'Password too short. Your new password must be at least 6 characters long to secure your account.';
  }
  
  if (normalized.includes('user-not-found') || normalized.includes('no user found') || normalized.includes("couldn't find a frosty bite") || normalized.includes("couldn't find any frosty bite")) {
    return 'We couldn\'t find a Frosty Bite account with that email. Please register or check your spelling.';
  }
  
  if (normalized.includes('invalid or expired') || normalized.includes('expired verification') || normalized.includes('otp') || normalized.includes('token_expired')) {
    return 'Incorrect or expired verification code. Please check your inbox for the latest code or request a new one.';
  }
  
  if (normalized.includes('network-request-failed') || normalized.includes('failed to fetch') || normalized.includes('network error') || normalized.includes('cors')) {
    return 'A network connectivity issue occurred. Please check your internet connection and try again.';
  }

  if (normalized.includes('unexpected token') || normalized.includes('not valid json') || normalized.includes('syntaxerror') || normalized.includes('json.parse') || normalized.includes('a server e') || normalized.includes('500') || normalized.includes('502') || normalized.includes('504')) {
    return 'We were unable to communicate with the verification server. Please check your connection and try again.';
  }

  return typeof err === 'string' ? err : (err.message || 'An unexpected recovery error occurred. Please try again.');
};

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<ResetStep>('send_otp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const navigate = useNavigate();

  // Resend Countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Step 1: Send OTP code
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setError('Invalid email format. Please enter a valid email address (e.g., baker@frostybite.com) without spaces.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Send Firebase password reset as a quiet background dispatch
      try {
        await authService.forgotPassword(emailTrimmed);
      } catch (fbErr) {
        console.warn('[ForgotPassword] Firebase quiet dispatch warning:', fbErr);
      }

      // Send the secure OTP for our database reset flow
      await authService.sendOTP(emailTrimmed);
      setStep('verify_otp');
      setResendTimer(60);
    } catch (err: any) {
      console.error('[ForgotPassword] Send OTP error:', err);
      setError(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and Reset custom DB password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrimmed = email.trim().toLowerCase();
    const otpTrimmed = otpCode.trim();
    const passwordTrimmed = newPassword.trim();

    if (!emailTrimmed || !otpTrimmed || !passwordTrimmed) {
      setError('Please fill in all requested fields.');
      return;
    }

    if (otpTrimmed.length < 8) {
      setError('Incorrect or incomplete code. Please enter the full 8-digit verification code sent to your inbox.');
      return;
    }

    if (passwordTrimmed.length < 6) {
      setError('Password too short. Your new password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.resetPasswordWithOTP(emailTrimmed, otpTrimmed, passwordTrimmed);
      setStep('success');
    } catch (err: any) {
      console.error('[ForgotPassword] Reset password error:', err);
      setError(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP directly
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    const emailTrimmed = email.trim().toLowerCase();
    
    setLoading(true);
    setError(null);
    try {
      await authService.sendOTP(emailTrimmed);
      setResendTimer(60);
    } catch (err: any) {
      setError(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#050505] px-4 py-12">
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-900/10 rounded-full blur-[120px]" />

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/login')}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
      >
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
          <ArrowLeft size={20} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest hidden sm:block">Back to Login</span>
      </motion.button>

      <div className="max-w-md w-full relative z-10">
        <AnimatePresence mode="wait">
          {step === 'send_otp' && (
            <motion.div
              key="send-otp-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <div id="forgot_icon_card" className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-primary/20">
                  <KeyRound className="text-primary animate-pulse" size={40} />
                </div>
                <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">
                  Reset Password
                </h1>
                <p className="text-zinc-500 font-medium">
                  Enter your email address to receive a secure recovery code to reset your password.
                </p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-6">
                <InputField
                  id="forgot_email_input"
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={Mail}
                  required
                />

                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl font-bold italic"
                    id="forgot_error_msg"
                  >
                    {error}
                  </motion.div>
                )}

                <Button
                  id="forgot_send_btn"
                  type="submit"
                  className="w-full"
                  disabled={loading || !email.trim()}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={18} />
                      <span>Sending security code...</span>
                    </div>
                  ) : (
                    'Send Security Code'
                  )}
                </Button>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest py-2"
                  >
                    <ArrowLeft size={14} />
                    Back to login
                  </Link>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'verify_otp' && (
            <motion.div
              key="verify-otp-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center">
                <div id="verify_otp_icon" className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 animate-bounce">
                  <ShieldCheck className="text-emerald-500" size={40} />
                </div>
                <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">
                  Check Your Inbox
                </h1>
                <p className="text-zinc-500 font-medium">
                  We sent a 6-digit verification code to <span className="text-white font-bold">{email}</span>. Please enter the code along with your new password below.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <InputField
                  id="forgot_otp_code_input"
                  label="6-Digit Code"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  required
                />

                <InputField
                  id="forgot_new_password_input"
                  label="New Password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={Lock}
                  required
                />

                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl font-bold italic"
                    id="reset_error_msg"
                  >
                    {error}
                  </motion.div>
                )}

                <Button
                  id="forgot_reset_btn"
                  type="submit"
                  className="w-full mt-2"
                  disabled={loading || otpCode.length < 6 || newPassword.length < 6}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={18} />
                      <span>Updating password...</span>
                    </div>
                  ) : (
                    'Reset Password'
                  )}
                </Button>

                <div className="flex items-center justify-between text-xs font-bold pt-4 text-zinc-500 uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => setStep('send_otp')}
                    className="hover:text-white transition-colors"
                  >
                    Change Email
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendTimer > 0 || loading}
                    className="flex items-center gap-1.5 hover:text-white transition-colors disabled:opacity-40 disabled:hover:text-zinc-500"
                  >
                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : 'Resend Code'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="reset-success-container"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass p-8 rounded-3xl border border-emerald-500/20 text-center space-y-6"
            >
              <div id="success_tick_circle" className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="text-emerald-500" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">Password Reset Complete!</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Your customized password has been securely updated and stored in your profile registry. You can now sign in immediately using your new credentials.
                </p>
              </div>
              <Button
                id="forgot_success_login_btn"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ForgotPassword;
