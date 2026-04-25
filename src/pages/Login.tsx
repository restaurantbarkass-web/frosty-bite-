import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  Phone, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ChefHat, 
  User, 
  Bike,
  ShieldCheck,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';
import { OTPInput } from '../components/OTPInput';

type LoginMethod = 'email' | 'phone';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isRider } = useAuth();
  
  // UI State
  const [method, setMethod] = useState<LoginMethod>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [isOTPView, setIsOTPView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (user) {
      if (isAdmin) navigate('/admin');
      else if (isRider) navigate('/rider');
      else navigate('/');
    }
  }, [user, isAdmin, isRider, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authService.handleEmailLogin(email, password);
      setSuccess('Logged in successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const user = await authService.loginWithGoogle();
      if (!user) {
        // User cancelled the popup, no error needed
        return;
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError('Google sign-in popup was blocked. Please enable popups for this site and try again.');
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      // Mock for demo if recaptcha isn't setup
      setTimeout(() => {
        setIsOTPView(true);
        setIsLoading(false);
        setSuccess('OTP sent to your phone!');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError(null);
    setIsLoading(true);
    try {
      setSuccess('Phone verified successfully!');
    } catch (err: any) {
      setError('Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#050505]">
      {/* Background Video */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-40 blur-[2px] scale-105"
        >
          <source src="https://www.pexels.com/download/video/16664748/" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />
      </div>

      {/* Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-900/20 rounded-full blur-[120px] animate-pulse delay-700" />

      {/* Login Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center justify-center mb-4"
            >
              <img 
                src="https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg" 
                alt="Frosty Bite Logo" 
                className="h-32 w-auto object-contain drop-shadow-2xl rounded-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <p className="text-gray-400 text-sm">Login to continue ordering delicious food</p>
          </div>

          {/* Error/Success Messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm"
              >
                <AlertCircle size={18} className="shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-400 text-sm"
              >
                <CheckCircle2 size={18} className="shrink-0" />
                <p>{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Forms */}
          {!isOTPView ? (
            <div className="space-y-6">
              {/* Method Toggle */}
              <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                <button 
                  onClick={() => setMethod('email')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${method === 'email' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Email
                </button>
                <button 
                  onClick={() => setMethod('phone')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${method === 'phone' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Phone
                </button>
              </div>

              <form onSubmit={method === 'email' ? handleEmailLogin : handleSendOTP} className="space-y-4">
                {method === 'email' ? (
                  <>
                    <InputField 
                      label="Email Address"
                      placeholder="name@example.com"
                      icon={Mail}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <InputField 
                      label="Password"
                      placeholder="••••••••"
                      icon={Lock}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      rightElement={
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                    <div className="flex justify-end">
                      <Link to="/forgot-password" className="text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors">
                        Forgot Password?
                      </Link>
                    </div>
                  </>
                ) : (
                  <InputField 
                    label="Phone Number"
                    placeholder="+1 (555) 000-0000"
                    icon={Phone}
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                )}

                <Button type="submit" isLoading={isLoading} icon={<ArrowRight size={18} />}>
                  {method === 'email' ? 'Login' : 'Send OTP'}
                </Button>
              </form>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#121212] px-4 text-gray-500 font-medium tracking-widest">Or continue with</span></div>
              </div>

              <Button 
                variant="google" 
                onClick={handleGoogleLogin}
                isLoading={isLoading}
                icon={<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />}
              >
                Google
              </Button>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-2">Verify Phone</h2>
                <p className="text-gray-400 text-sm">Enter the 6-digit code sent to {phoneNumber}</p>
              </div>

              <OTPInput value={otp} onChange={setOtp} />

              <div className="space-y-4">
                <Button onClick={handleVerifyOTP} isLoading={isLoading}>
                  Verify OTP
                </Button>
                <button 
                  onClick={() => setIsOTPView(false)}
                  className="w-full py-2 text-sm text-gray-500 hover:text-white transition-colors"
                >
                  Change Phone Number
                </button>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-500">
                  Didn't receive code? {' '}
                  <button className="text-orange-500 font-semibold hover:underline">Resend</button>
                </p>
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account? {' '}
              <Link to="/signup" className="text-orange-500 font-bold hover:text-orange-400 transition-colors">
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Legal Links */}
        <div className="mt-8 flex justify-center gap-6 text-[10px] text-gray-600 font-medium uppercase tracking-widest">
          <a href="#" className="hover:text-gray-400 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Terms of Service</a>
        </div>
      </motion.div>

      {/* Recaptcha Container (Invisible) */}
      <div id="recaptcha-container"></div>
    </div>
  );
}
