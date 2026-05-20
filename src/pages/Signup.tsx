import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  User, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { InputField } from '../components/InputField';
import { Button } from '../components/Button';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // UI State
  const [method, setMethod] = useState<'otp' | 'password'>('otp');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (!email || (method === 'otp' && !name)) {
        throw new Error('Please fill in all required fields');
      }
      await authService.sendOTP(email);
      setOtpSent(true);
      setSuccess(`A 6-digit code has been sent to ${email}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await authService.verifyOTP(email, otp);
      
      // If we have a name, update the profile after OTP verification
      if (name && result.user) {
        await authService.syncUserWithDatabase(result.user, name);
      }
      
      setSuccess('Welcome! Your account has been verified.');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'otp') {
      if (!otpSent) return handleSendOTP(e);
      return handleVerifyOTP(e);
    }
    
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      await authService.handleSignup(email, password, name);
      setSuccess('Account created! Please check your email to verify your address.');
      setTimeout(() => navigate('/'), 2500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.loginWithGoogle();
      setSuccess('Account created with Google!');
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-up failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#050505]">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1549590143-d5855148a9d5?auto=format&fit=crop&q=80&w=2000" 
          alt="Bakery Background" 
          className="w-full h-full object-cover opacity-40 blur-[2px] scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />
      </div>

      {/* Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-900/20 rounded-full blur-[120px] animate-pulse delay-700" />

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
      >
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
          <ArrowLeft size={20} />
        </div>
        <span className="text-xs font-black uppercase tracking-widest hidden sm:block">Back to Menu</span>
      </motion.button>

      {/* Signup Card */}
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
            <p className="text-gray-400 text-sm">Create an account to start ordering</p>
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

          {/* Signup Form / Method */}
          {otpSent ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-4"
            >
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto border border-orange-500/20">
                <Lock className="text-orange-500" size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white uppercase italic tracking-tight">Enter Code</h2>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We've sent a 6-digit code to <span className="text-white font-bold">{email}</span>.
                </p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <InputField 
                  label="Verification Code"
                  placeholder="123456"
                  icon={ArrowRight}
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                />
                <Button type="submit" isLoading={isLoading} icon={<CheckCircle2 size={18} />}>
                  Verify & Sign Up
                </Button>
              </form>

              <button 
                onClick={() => setOtpSent(false)}
                className="text-orange-500 text-xs font-black uppercase tracking-widest hover:text-orange-400 transition-colors pt-4"
              >
                Back to Sign-up
              </button>
            </motion.div>
          ) : (
            <>
               {/* Google Sign-up Button */}
               <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-black py-4 rounded-2xl font-bold transition-all mb-6 disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                <span className="text-sm font-black uppercase tracking-widest">Continue with Google</span>
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                  <span className="bg-[#0c0c0c] px-4 text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Method Toggle */}
              <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-6">
                <button 
                  onClick={() => setMethod('otp')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${method === 'otp' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Email OTP
                </button>
                <button 
                  onClick={() => setMethod('password')}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${method === 'password' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Password
                </button>
              </div>

              {/* Signup Form */}
              <form onSubmit={handleSignup} className="space-y-4">
                <InputField 
                  label="Full Name"
                  placeholder="John Doe"
                  icon={User}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
                <InputField 
                  label="Email Address"
                  placeholder="name@example.com"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                {method === 'password' && (
                  <InputField 
                    label="Password"
                    placeholder="••••••••"
                    icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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
                )}

                <Button type="submit" isLoading={isLoading} icon={<ArrowRight size={18} />}>
                  {method === 'otp' ? 'Send Verification Code' : 'Create Account'}
                </Button>
              </form>
            </>
          )}

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Already have an account? {' '}
              <Link to="/login" className="text-orange-500 font-bold hover:text-orange-400 transition-colors">
                Login
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
    </div>
  );
}

export default Signup;
