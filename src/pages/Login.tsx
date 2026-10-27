import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  MapPin, 
  Navigation, 
  Sparkles,
  ChefHat,
  Compass,
  User,
  ShieldCheck,
  Check,
  Phone,
  MessageSquare,
  Smartphone,
  ChevronRight,
  Verified,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { useGeofence } from '../context/GeofenceContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { ADMIN_EMAILS } from '../constants';
import { authService } from '../services/authService';
import { supabase } from '../supabase';
import confetti from 'canvas-confetti';
import { LoadingScreen } from '../components/LoadingScreen';
import { OnboardingSlider } from '../components/OnboardingSlider';
import gsap from 'gsap';
import { safeTrim, safeTrimLowerCase } from '../utils/string';
import { GuestSessionManager } from '../core/guest/GuestSessionManager';
import { UNIVERSAL_LOGO_URL } from '../constants/logo';

const normalizePhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11 && clean.startsWith('0')) {
    return clean.slice(1);
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return clean.slice(2);
  }
  return clean;
};

const formatDisplayPhone = (phone: string): string => {
  const clean = normalizePhone(phone);
  return `+91 ${clean}`;
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, authStatus, refreshProfile, resolveAndSyncUser, loginAsGuest } = useAuth();
  const { selectManualCity } = useGeofence();

  const [activeView, setActiveView] = useState<'main' | 'email' | 'mobile' | 'guest'>('main');
  const [showTour, setShowTour] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailMode, setEmailMode] = useState<'otp' | 'password'>('otp');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpDigits, setEmailOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendEmailCooldown, setResendEmailCooldown] = useState(0);

  const [phone, setPhone] = useState('');
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileOtpDigits, setMobileOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendMobileCooldown, setResendMobileCooldown] = useState(0);

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; icon: string; spinning: boolean } | null>(null);

  const emailOtpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mobileOtpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timers
  useEffect(() => {
    if (resendEmailCooldown > 0) {
      const timer = setTimeout(() => setResendEmailCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendEmailCooldown]);

  useEffect(() => {
    if (resendMobileCooldown > 0) {
      const timer = setTimeout(() => setResendMobileCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendMobileCooldown]);

  const [forceReady, setForceReady] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Safety timeout: never leave user on an infinite blank loading screen if network is slow
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceReady(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Check for completed Google redirect sign-in upon returning to /login
  useEffect(() => {
    let isMounted = true;
    const checkRedirect = async () => {
      try {
        const fbUser = await authService.getGoogleRedirectResult();
        if (fbUser && isMounted) {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          toast.success('Welcome back to Frosty Bite!');
          await resolveAndSyncUser(null, fbUser);
          await refreshProfile();
          navigate('/', { replace: true });
        }
      } catch (err: any) {
        console.warn('[Login] Redirect check error:', err);
      }
    };
    checkRedirect();
    return () => { isMounted = false; };
  }, [navigate, refreshProfile, resolveAndSyncUser]);

  if ((loading || authStatus === 'loading') && !forceReady) {
    return <LoadingScreen fullScreen={true} message="Loading Frosty Bite secure portal..." />;
  }

  if (user) {
    return <Navigate to={isAdmin ? "/admin" : "/"} replace />;
  }

  const showNotification = (text: string, icon = 'sparkles', spinning = false) => {
    setToastMsg({ text, icon, spinning });
    setTimeout(() => {
      setToastMsg(null);
    }, 4500);
  };

  // 1. Continue with Google (Firebase OAuth)
  const handleGoogleLogin = async () => {
    setGoogleError(null);
    showNotification('Connecting to Google...', 'sparkles', true);
    try {
      const fbUser = await authService.loginWithGoogle();
      if (fbUser) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        toast.success('Welcome to Frosty Bite!');
        await resolveAndSyncUser(null, fbUser);
        await refreshProfile();
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      console.error('Google sign-in notice:', err);
      const msg = err?.message || 'Google sign-in encountered an issue.';
      setGoogleError(msg);
      toast.error(msg, { duration: 5000 });
      showNotification(msg.length > 50 ? 'Google sign-in unavailable' : msg, 'alert', false);
    }
  };

  // 2. Email Flow: Send OTP or Password Login
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = safeTrimLowerCase(email);
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);

    if (emailMode === 'password') {
      if (!password) {
        toast.error('Please enter your password.');
        setSubmitting(false);
        return;
      }
      showNotification('Verifying credentials...', 'sparkles', true);
      try {
        const res = await authService.handleEmailLogin(cleanEmail, password);
        if (res && res.user) {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          toast.success('Welcome back to Frosty Bite!');
          await resolveAndSyncUser(res.user, null);
          await refreshProfile();
          navigate(res.user?.email && ADMIN_EMAILS.includes(res.user.email.toLowerCase()) ? '/admin' : '/', { replace: true });
        }
      } catch (err: any) {
        toast.error(err.message || 'Incorrect email or password.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // OTP mode
    showNotification('Sending 6-digit verification code...', 'sparkles', true);
    try {
      await authService.sendOTP(cleanEmail);
      setEmailOtpSent(true);
      setResendEmailCooldown(30);
      showNotification('Verification code sent to your inbox!', 'check', false);
      toast.success('6-digit code dispatched to your email!');
      setTimeout(() => emailOtpInputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch email verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  // Email OTP Verification
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = safeTrimLowerCase(email);
    const fullOtp = emailOtpDigits.join('');
    if (fullOtp.length !== 6) {
      toast.error('Please enter the complete 6-digit verification code.');
      return;
    }

    setSubmitting(true);
    showNotification('Verifying email code...', 'sparkles', true);

    try {
      const res = await authService.verifyOTP(cleanEmail, fullOtp);
      if (res && res.user) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        toast.success('Email verified successfully! Welcome to Frosty Bite.');
        await resolveAndSyncUser(res.user, null);
        await refreshProfile();
        navigate(res.user?.email && ADMIN_EMAILS.includes(res.user.email.toLowerCase()) ? '/admin' : '/', { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || 'Invalid or expired verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (resendEmailCooldown > 0 || submitting) return;
    const cleanEmail = safeTrimLowerCase(email);
    if (!cleanEmail) return;
    setSubmitting(true);
    try {
      await authService.sendOTP(cleanEmail);
      setResendEmailCooldown(30);
      toast.success('New 6-digit code sent to your email!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend code.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Mobile SMS OTP Flow
  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSubmitting(true);

    if (!mobileOtpSent) {
      showNotification('Dispatching SMS verification...', 'sparkles', true);
      try {
        await authService.sendMobileOTP(cleanPhone, false);
        setMobileOtpSent(true);
        setResendMobileCooldown(30);
        showNotification('Verification code sent via SMS!', 'check', false);
        toast.success('SMS verification code sent!');
        setTimeout(() => mobileOtpInputRefs.current[0]?.focus(), 150);
      } catch (err: any) {
        toast.error(err.message || 'Failed to send SMS code.');
      } finally {
        setSubmitting(false);
      }
    } else {
      const fullOtp = mobileOtpDigits.join('');
      if (fullOtp.length !== 6) {
        toast.error('Please enter the complete 6-digit SMS code.');
        setSubmitting(false);
        return;
      }

      showNotification('Verifying mobile number...', 'sparkles', true);
      try {
        const res = await authService.verifyMobileOTP(cleanPhone, fullOtp);
        if (res.success && res.user) {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
          toast.success('Mobile verified successfully!');
          await resolveAndSyncUser(null, { uid: res.user.id || res.user.uid, email: res.user.email });
          await refreshProfile();
          navigate('/', { replace: true });
        }
      } catch (err: any) {
        toast.error(err.message || 'SMS verification failed. Check code.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleResendMobileOtp = async () => {
    if (resendMobileCooldown > 0 || submitting) return;
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return;
    setSubmitting(true);
    try {
      await authService.resendMobileOTP(cleanPhone);
      setResendMobileCooldown(30);
      toast.success('New SMS code sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend SMS code.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Continue as Guest
  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameClean = safeTrim(guestName) || 'Valued Guest';
    const phoneClean = normalizePhone(guestPhone);

    if (!nameClean) {
      toast.error('Please enter your name.');
      return;
    }
    if (!phoneClean || phoneClean.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number for order delivery.');
      return;
    }

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, phone, full_name, account_type')
        .eq('phone', phoneClean)
        .maybeSingle();

      if (existingUser) {
        toast.error('This mobile number is already associated with an account. Please sign in or verify ownership.');
        return;
      }
    } catch (err) {}

    GuestSessionManager.registerFromCheckout({
      name: nameClean,
      phone: phoneClean,
      address: '',
      email: `guest_${phoneClean.slice(-4)}@frostybite.local`
    });

    loginAsGuest({ name: nameClean, phone: phoneClean });
    confetti({ particleCount: 60, spread: 55, origin: { y: 0.6 } });
    toast.success(`Welcome, ${nameClean}! Enjoy browsing our artisan treats.`);
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-x-hidden font-sans bg-[#FFFDF8] text-[#1b1c1a]">
      {/* Onboarding Tour Overlay when requested */}
      <AnimatePresence>
        {showTour && (
          <OnboardingSlider 
            onComplete={() => setShowTour(false)} 
            onSkip={() => setShowTour(false)} 
          />
        )}
      </AnimatePresence>

      {/* Main Luxury Google Stitch Login Card - Clean Background */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[440px] bg-[#fbf9f5] border border-[#5c3826]/15 rounded-[32px] p-6 sm:p-8 shadow-xl text-[#1b1c1a]"
      >
        {/* Ambient Glows */}
        <div className="absolute -top-12 -right-10 w-48 h-48 rounded-full bg-[#ffd9df]/20 blur-3xl pointer-events-none" />
        <div className="absolute top-80 -left-16 w-56 h-56 rounded-full bg-[#ffdbca]/30 blur-3xl pointer-events-none" />

        {/* 1. Top Header & Branding */}
        <div className="flex flex-col items-center text-center mb-6 pt-1">
          <div className="relative group cursor-pointer mb-3">
            <div className="w-20 h-20 rounded-3xl bg-[#ffffff] p-2 shadow-md flex items-center justify-center relative overflow-hidden transition-transform duration-300 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#ffdbca]/30 via-transparent to-[#ffd9df]/20 pointer-events-none" />
              <img 
                alt="Frosty Bite signature logo" 
                className="w-full h-full object-cover rounded-2xl relative z-10 drop-shadow-sm" 
                src={UNIVERSAL_LOGO_URL} 
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1b1c1a] flex items-center justify-center gap-1.5 mt-1 font-serif">
            <span>Frosty Bite</span><span className="text-[#FF7597] text-base">✦</span>
          </h1>
          <p className="text-xs text-[#5C3826] tracking-wide font-medium">Artisan Bakes & Sweet Bites</p>
        </div>

        {/* 2. Main Heading Section */}
        <div className="text-center mb-5 px-2">
          <h2 className="text-xl font-bold text-[#1b1c1a] leading-tight font-serif">
            Sweet moments start here!
          </h2>
          <p className="text-xs text-[#5c3826] mt-1.5">
            Your favourite treats are just a little step away.
          </p>
        </div>

        {/* Status Toast Notification */}
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-3 px-3.5 py-2.5 rounded-xl bg-[#ffdbca]/80 text-[#2d1608] text-xs flex items-center justify-between shadow-xs border border-[#5c3826]/10"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className={`text-[#D97706] ${toastMsg.spinning ? 'animate-spin' : ''}`} />
              <span className="font-medium">{toastMsg.text}</span>
            </div>
          </motion.div>
        )}

        {/* VIEW A: SIGN IN OPTIONS */}
        {activeView === 'main' && (
          <div className="w-full flex flex-col gap-3">
            {/* Option 1: Continue with Google */}
            <button 
              onClick={handleGoogleLogin}
              className="w-full min-h-[54px] px-4 py-3 bg-[#ffffff] rounded-full shadow-xs hover:shadow-md active:scale-[0.98] transition-all duration-200 flex items-center justify-between group cursor-pointer border border-[#5C3826]/10"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#fbf9f5] shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-[#1b1c1a] group-hover:text-[#FF7597] transition-colors">
                  Continue with Google
                </span>
              </div>
              <ChevronRight size={18} className="text-[#8C583E] group-hover:translate-x-0.5 transition-transform" />
            </button>

            {googleError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-xs text-amber-900 space-y-1.5 shadow-2xs"
              >
                <div className="flex items-start gap-1.5 font-bold text-amber-950">
                  <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>Google Sign-In Notice:</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed pl-5">
                  {googleError}
                </p>
                <div className="flex items-center gap-2 pt-1 pl-5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => { setGoogleError(null); setActiveView('email'); }}
                    className="text-[#88183e] underline hover:text-[#FF7597] cursor-pointer"
                  >
                    Use 6-Digit Email OTP
                  </button>
                  <span className="text-amber-400">•</span>
                  <button
                    type="button"
                    onClick={() => { setGoogleError(null); setActiveView('guest'); }}
                    className="text-[#b45309] underline hover:text-[#92400e] cursor-pointer"
                  >
                    Instant Guest Checkout
                  </button>
                </div>
              </motion.div>
            )}

            {/* Option 2: Continue with Email */}
            <button 
              onClick={() => setActiveView('email')}
              className="w-full min-h-[54px] px-4 py-3 bg-[#ffffff] rounded-full shadow-xs hover:shadow-md active:scale-[0.98] transition-all duration-200 flex items-center justify-between group cursor-pointer border border-[#5C3826]/10"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#ffd9df] shrink-0 text-[#88183e]">
                  <Mail size={16} />
                </div>
                <span className="text-sm font-bold text-[#1b1c1a] group-hover:text-[#FF7597] transition-colors">
                  Continue with Email
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-[#e4e2de] text-[#5c3826] px-2 py-0.5 rounded-full font-semibold">OTP Link</span>
                <ChevronRight size={18} className="text-[#8C583E] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Option 3: Continue with Mobile */}
            <button 
              onClick={() => setActiveView('mobile')}
              className="w-full min-h-[54px] px-4 py-3 bg-[#ffffff] rounded-full shadow-xs hover:shadow-md active:scale-[0.98] transition-all duration-200 flex items-center justify-between group cursor-pointer border border-[#5C3826]/10"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#ffdbca] shrink-0 text-[#5e402f]">
                  <Smartphone size={16} />
                </div>
                <span className="text-sm font-bold text-[#1b1c1a] group-hover:text-[#FF7597] transition-colors">
                  Continue with Mobile
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-[#e4e2de] text-[#5c3826] px-2 py-0.5 rounded-full font-semibold">SMS OTP</span>
                <ChevronRight size={18} className="text-[#8C583E] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Option 4: Continue as Guest */}
            <button 
              onClick={() => setActiveView('guest')}
              className="w-full min-h-[54px] px-4 py-3 bg-[#ffffff] rounded-full shadow-xs hover:shadow-md active:scale-[0.98] transition-all duration-200 flex items-center justify-between group cursor-pointer border border-[#5C3826]/10"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#ffdcc3] shrink-0 text-[#6e3900]">
                  <User size={16} />
                </div>
                <span className="text-sm font-bold text-[#1b1c1a] group-hover:text-[#FF7597] transition-colors">
                  Continue as Guest
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-[#FFF9F5] text-[#D97706] border border-[#D97706]/30 px-2 py-0.5 rounded-full font-semibold">Quick Order</span>
                <ChevronRight size={18} className="text-[#8C583E] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Quick Tour Button */}
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setShowTour(true)}
                className="inline-flex items-center gap-1.5 text-xs text-[#795745] hover:text-[#a83255] font-semibold transition-colors py-1.5 px-3 rounded-full hover:bg-white/60 cursor-pointer"
              >
                <Sparkles size={13} className="text-[#a83255]" />
                <span>New to Frosty Bite? Take the 10s tour</span>
              </button>
            </div>
          </div>
        )}

        {/* SUBVIEW: EMAIL LOGIN FORM */}
        {activeView === 'email' && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button"
                onClick={() => {
                  setActiveView('main');
                  setEmailOtpSent(false);
                  setEmailOtpDigits(['', '', '', '', '', '']);
                }}
                className="w-8 h-8 rounded-full bg-[#e4e2de] flex items-center justify-center text-[#5c3826] hover:bg-[#d4d2cd] transition-colors cursor-pointer"
                title="Go back"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-sm font-bold text-[#1b1c1a]">
                {emailOtpSent ? 'Verify Email Code' : 'Email Sign In'}
              </span>
              <span className="w-8" />
            </div>

            {!emailOtpSent ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {/* Method selector: OTP code vs Password */}
                <div className="flex bg-[#e4e2de]/60 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setEmailMode('otp')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      emailMode === 'otp' ? 'bg-[#ffffff] text-[#1b1c1a] shadow-xs' : 'text-[#5c3826] hover:text-[#1b1c1a]'
                    }`}
                  >
                    6-Digit Code (OTP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMode('password')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      emailMode === 'password' ? 'bg-[#ffffff] text-[#1b1c1a] shadow-xs' : 'text-[#5c3826] hover:text-[#1b1c1a]'
                    }`}
                  >
                    Password
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-[#5c3826] font-semibold pl-1">Email Address *</label>
                  <div className="relative flex items-center">
                    <Mail size={18} className="absolute left-3.5 text-[#8C583E]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. baker@frostybite.com"
                      className="w-full pl-10 pr-4 py-3 bg-[#e4e2de]/40 rounded-xl text-[#1b1c1a] text-sm focus:outline-none focus:bg-[#ffffff] focus:shadow-md transition-all border border-[#5c3826]/10"
                    />
                  </div>
                </div>

                {emailMode === 'password' && (
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#5c3826] font-semibold pl-1">Account Password *</label>
                    <div className="relative flex items-center">
                      <Lock size={18} className="absolute left-3.5 text-[#8C583E]" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-3 bg-[#e4e2de]/40 rounded-xl text-[#1b1c1a] text-sm focus:outline-none focus:bg-[#ffffff] focus:shadow-md transition-all border border-[#5c3826]/10"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-full bg-[#FF7597] hover:bg-[#E05A7E] text-[#ffffff] text-sm font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-70"
                >
                  <span>{submitting ? 'Please wait...' : (emailMode === 'otp' ? 'Send Verification Code' : 'Sign In')}</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                <div className="text-center px-1">
                  <p className="text-xs text-[#5c3826]">
                    We sent a 6-digit verification code to:
                  </p>
                  <p className="text-xs font-bold text-[#1b1c1a] mt-0.5 truncate">{email}</p>
                </div>

                {/* 6-digit OTP Input */}
                <div 
                  className="flex justify-center gap-2 py-1"
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    if (text) {
                      const next = [...emailOtpDigits];
                      for (let i = 0; i < 6; i++) next[i] = text[i] || '';
                      setEmailOtpDigits(next);
                      const targetIdx = Math.min(text.length, 5);
                      emailOtpInputRefs.current[targetIdx]?.focus();
                    }
                  }}
                >
                  {emailOtpDigits.map((digit, idx) => (
                    <input
                      key={`email-otp-${idx}`}
                      ref={(el) => { emailOtpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        const next = [...emailOtpDigits];
                        next[idx] = val;
                        setEmailOtpDigits(next);
                        if (val && idx < 5) {
                          emailOtpInputRefs.current[idx + 1]?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !emailOtpDigits[idx] && idx > 0) {
                          emailOtpInputRefs.current[idx - 1]?.focus();
                        }
                      }}
                      className="w-10 h-12 text-center text-lg font-bold bg-[#ffffff] border border-[#5c3826]/20 rounded-xl text-[#1b1c1a] focus:outline-none focus:border-[#FF7597] shadow-2xs"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-full bg-[#FF7597] hover:bg-[#E05A7E] text-[#ffffff] text-sm font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <span>{submitting ? 'Verifying code...' : 'Verify & Enter'}</span>
                  <Check size={16} />
                </button>

                <div className="flex items-center justify-between text-xs pt-1 px-1 text-[#5c3826]">
                  <button
                    type="button"
                    onClick={() => setEmailOtpSent(false)}
                    className="hover:text-[#1b1c1a] underline underline-offset-2"
                  >
                    Edit email
                  </button>
                  <button
                    type="button"
                    disabled={resendEmailCooldown > 0 || submitting}
                    onClick={handleResendEmailOtp}
                    className={`font-semibold ${resendEmailCooldown > 0 ? 'text-stone-400 cursor-not-allowed' : 'text-[#FF7597] hover:underline'}`}
                  >
                    {resendEmailCooldown > 0 ? `Resend code (${resendEmailCooldown}s)` : 'Resend code'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* SUBVIEW: MOBILE LOGIN FORM */}
        {activeView === 'mobile' && (
          <form onSubmit={handleMobileSubmit} className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button"
                onClick={() => { 
                  setActiveView('main'); 
                  setMobileOtpSent(false);
                  setMobileOtpDigits(['', '', '', '', '', '']);
                }}
                className="w-8 h-8 rounded-full bg-[#e4e2de] flex items-center justify-center text-[#5c3826] hover:bg-[#d4d2cd] transition-colors cursor-pointer"
                title="Go back"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-sm font-bold text-[#1b1c1a]">
                {mobileOtpSent ? 'Verify Mobile SMS' : 'Mobile Verification'}
              </span>
              <span className="w-8" />
            </div>

            {!mobileOtpSent ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-[#5c3826] font-semibold pl-1">Mobile Number *</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-2.5 flex items-center gap-1 bg-[#e4e2de] px-2 py-1 rounded-lg select-none text-xs font-bold text-[#1b1c1a]">
                      <span>🇮🇳</span><span>+91</span>
                    </div>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="98765 43210"
                      className="w-full pl-24 pr-4 py-3 bg-[#e4e2de]/40 rounded-xl text-[#1b1c1a] text-sm focus:outline-none focus:bg-[#ffffff] focus:shadow-md transition-all border border-[#5c3826]/10 font-mono tracking-wider"
                    />
                  </div>
                  <span className="text-[11px] text-[#8C583E] pl-1">A secure 6-digit SMS verification code will be sent.</span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-full bg-[#FF7597] hover:bg-[#E05A7E] text-[#ffffff] text-sm font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <span>{submitting ? 'Dispatching SMS...' : 'Send SMS Code'}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center px-1">
                  <p className="text-xs text-[#5c3826]">Enter the 6-digit code sent to:</p>
                  <p className="text-xs font-bold text-[#1b1c1a] mt-0.5 font-mono">+91 {phone}</p>
                </div>

                <div 
                  className="flex justify-center gap-2 py-1"
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    if (text) {
                      const next = [...mobileOtpDigits];
                      for (let i = 0; i < 6; i++) next[i] = text[i] || '';
                      setMobileOtpDigits(next);
                      const targetIdx = Math.min(text.length, 5);
                      mobileOtpInputRefs.current[targetIdx]?.focus();
                    }
                  }}
                >
                  {mobileOtpDigits.map((digit, idx) => (
                    <input
                      key={`mobile-otp-${idx}`}
                      ref={(el) => { mobileOtpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        const next = [...mobileOtpDigits];
                        next[idx] = val;
                        setMobileOtpDigits(next);
                        if (val && idx < 5) {
                          mobileOtpInputRefs.current[idx + 1]?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !mobileOtpDigits[idx] && idx > 0) {
                          mobileOtpInputRefs.current[idx - 1]?.focus();
                        }
                      }}
                      className="w-10 h-12 text-center text-lg font-bold bg-[#ffffff] border border-[#5c3826]/20 rounded-xl text-[#1b1c1a] focus:outline-none focus:border-[#FF7597] shadow-2xs"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded-full bg-[#FF7597] hover:bg-[#E05A7E] text-[#ffffff] text-sm font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <span>{submitting ? 'Verifying...' : 'Verify & Enter'}</span>
                  <Check size={16} />
                </button>

                <div className="flex items-center justify-between text-xs pt-1 px-1 text-[#5c3826]">
                  <button
                    type="button"
                    onClick={() => setMobileOtpSent(false)}
                    className="hover:text-[#1b1c1a] underline underline-offset-2"
                  >
                    Change phone
                  </button>
                  <button
                    type="button"
                    disabled={resendMobileCooldown > 0 || submitting}
                    onClick={handleResendMobileOtp}
                    className={`font-semibold ${resendMobileCooldown > 0 ? 'text-stone-400 cursor-not-allowed' : 'text-[#FF7597] hover:underline'}`}
                  >
                    {resendMobileCooldown > 0 ? `Resend SMS (${resendMobileCooldown}s)` : 'Resend SMS'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* SUBVIEW: GUEST CHECKOUT FORM */}
        {activeView === 'guest' && (
          <form onSubmit={handleGuestSubmit} className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between pb-1">
              <button 
                type="button"
                onClick={() => setActiveView('main')}
                className="w-8 h-8 rounded-full bg-[#e4e2de] flex items-center justify-center text-[#5c3826] hover:bg-[#d4d2cd] transition-colors cursor-pointer"
                title="Go back"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-sm font-bold text-[#1b1c1a]">Let's get to know you!</span>
              <span className="w-8" />
            </div>

            <p className="text-xs text-[#5c3826] text-center -mt-2">
              Just a few details before you order your favourite treats.
            </p>

            <div className="bg-[#ffdbca]/40 rounded-2xl p-3.5 flex items-start gap-2.5 border border-[#E76A54]/20">
              <ShieldCheck size={20} className="text-[#E76A54] shrink-0 mt-0.5" />
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-bold text-[#2d1608] leading-snug">
                  Create your guest account to enjoy delicious treats from Frosty Bite. No OTP required!
                </p>
                <p className="text-[11px] text-[#8C583E] font-medium leading-snug">
                  Your mobile number will remain unverified until you verify it later.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#5c3826] font-semibold pl-1">Your Name *</label>
                <div className="relative flex items-center">
                  <User size={18} className="absolute left-3.5 text-[#8C583E]" />
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full pl-10 pr-4 py-3 bg-[#e4e2de]/40 rounded-xl text-[#1b1c1a] text-sm focus:outline-none focus:bg-[#ffffff] focus:shadow-md transition-all border border-[#5c3826]/10"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#5c3826] font-semibold pl-1">Delivery Phone Number *</label>
                <div className="relative flex items-center">
                  <div className="absolute left-2 flex items-center gap-1 bg-[#e4e2de] px-2.5 py-1.5 rounded-lg select-none text-xs font-bold text-[#1b1c1a]">
                    <span>🇮🇳</span><span>+91</span>
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                    className="w-full pl-24 pr-4 py-3 bg-[#e4e2de]/40 rounded-xl text-[#1b1c1a] text-sm focus:outline-none focus:bg-[#ffffff] focus:shadow-md transition-all border border-[#5c3826]/10 font-mono tracking-wider"
                  />
                </div>
                <span className="text-[11px] text-[#8C583E] pl-1">Used exclusively for live bakery order updates via SMS.</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-full bg-[#FF7597] hover:bg-[#E05A7E] text-[#ffffff] text-sm font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer"
            >
              <span>Start Ordering as Guest</span>
              <ChefHat size={18} />
            </button>
          </form>
        )}

        {/* 5. Legal & Footer Section */}
        <div className="w-full text-center mt-6 pt-2">
          <p className="text-[11px] text-[#5c3826] leading-relaxed">
            By continuing, you agree to our{' '}
            <a className="text-[#FF7597] font-semibold underline underline-offset-2 hover:text-[#E05A7E]" href="https://frosty-bite-privacy-and-policy.vercel.app/" target="_blank" rel="noopener noreferrer">Terms of Service</a>{' '}
            and{' '}
            <a className="text-[#FF7597] font-semibold underline underline-offset-2 hover:text-[#E05A7E]" href="https://frosty-bite-privacy-and-policy.vercel.app/" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-3 text-[#5c3826] text-[11px] font-medium">
            <span>Handcrafted with</span>
            <span className="text-[#FF7597] animate-pulse">❤️</span>
            <span>by Frosty Bite chefs</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
