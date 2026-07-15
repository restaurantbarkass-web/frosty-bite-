import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { useGeofence } from '../context/GeofenceContext';
import { ADMIN_EMAILS } from '../constants';
import { authService } from '../services/authService';
import { supabase } from '../supabase';
import confetti from 'canvas-confetti';
import { FeatureComingSoon } from '../components/FeatureComingSoon';
import { OtpSuccessAnimation } from '../components/OtpSuccessAnimation';
import gsap from 'gsap';

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

const parseAuthError = (err: any): string => {
  if (!err) return 'An unexpected authentication error occurred. Please try again.';
  
  const originalMessage = typeof err === 'string' ? err : (err.message || err.error || err.code || '');
  const code = err.code || '';
  
  const normalized = `${originalMessage} ${code}`.toLowerCase();
  
  if (normalized.includes('invalid-email') || normalized.includes('invalid email')) {
    return 'Invalid email address format. Please enter a valid email address (e.g., baker@frostybite.com) without spaces.';
  }
  
  if (normalized.includes('weak-password') || normalized.includes('password too short') || normalized.includes('password must be at least')) {
    return 'Password too short. Your password must be at least 6 characters long to secure your account.';
  }
  
  if (normalized.includes('email-already-in-use') || normalized.includes('already exists') || normalized.includes('unique_email') || normalized.includes('23505')) {
    return 'User already exists. A Frosty Bite account is already registered with this email. Please switch to "Sign In" above to access your account.';
  }
  
  if (normalized.includes('user-not-found') || normalized.includes('no user found') || normalized.includes("couldn't find a frosty bite") || normalized.includes("couldn't find any frosty bite")) {
    return 'We couldn\'t find a Frosty Bite account with that email. Please check your spelling or click "Create Account" below to register.';
  }
  
  if (normalized.includes('wrong-password') || normalized.includes('invalid-credential') || normalized.includes('incorrect password')) {
    return 'Incorrect password. Please verify your spelling, use the "Forgot?" link to recover your account, or choose "OTP Code" for a quick passwordless sign-in.';
  }
  
  if (normalized.includes('too-many-requests') || normalized.includes('temporarily disabled') || normalized.includes('lockout')) {
    return 'Too many failed login attempts have occurred. For your safety, this account is temporarily locked. Please try again in a few minutes.';
  }
  
  if (normalized.includes('network-request-failed') || normalized.includes('failed to fetch') || normalized.includes('network error') || normalized.includes('cors')) {
    return 'A network connectivity issue occurred. Please check your internet connection and try again.';
  }
  
  if (normalized.includes('invalid or expired') || normalized.includes('expired verification') || normalized.includes('otp') || normalized.includes('token_expired')) {
    return 'Incorrect or expired verification code. Please check your Inbox for the latest code or request a new one.';
  }

  if (normalized.includes('supabase') || normalized.includes('database') || normalized.includes('relation') || normalized.includes('row level security') || normalized.includes('rls') || normalized.includes('postgres') || normalized.includes('server error') || normalized.includes('internal')) {
    return 'Our servers are completing automated maintenance. Please try again in a few moments.';
  }

  return typeof err === 'string' ? err : (err.message || 'An unexpected authentication error occurred. Please try again.');
};

const renderErrorMessage = (msg: string | null) => {
  if (!msg) return null;
  return (
    <div className="flex-1 space-y-1 text-xs text-left leading-relaxed">
      <p className="text-zinc-200 font-medium">{msg}</p>
    </div>
  );
};

const BACKGROUND_VIDEOS = [
  'https://www.image2url.com/r2/default/videos/1783006515287-85eb06bd-ee88-4f16-8d89-816927831339.mp4',
  'https://www.image2url.com/r2/default/videos/1783006569462-7f438374-1c3c-4558-86e5-7b63f1781617.mp4',
  'https://www.image2url.com/r2/default/videos/1783006619307-96155b49-e541-4054-93cb-23f5bd35f7b7.mp4'
];

interface VideoBackgroundProps {
  urls: string[];
}

const VideoBackground: React.FC<VideoBackgroundProps> = ({ urls }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    urls.forEach((_, idx) => {
      const el = videoRefs.current[idx];
      if (!el) return;

      if (idx === activeIndex) {
        el.play().catch((err) => {
          console.warn(`[VideoBackground] Playback blocked for index ${idx}:`, err);
        });
        gsap.to(el, {
          opacity: 0.85,
          duration: 1.5,
          ease: 'power2.inOut'
        });
      } else {
        gsap.to(el, {
          opacity: 0,
          duration: 1.5,
          ease: 'power2.inOut',
          onComplete: () => {
            el.pause();
            el.currentTime = 0;
          }
        });
      }
    });
  }, [activeIndex, urls]);

  const handleEnded = (endedIdx: number) => {
    if (endedIdx === activeIndex) {
      setActiveIndex((prev) => (prev + 1) % urls.length);
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-[#040405]">
      {urls.map((url, idx) => (
        <video
          key={url}
          ref={(el) => {
            videoRefs.current[idx] = el;
          }}
          src={url}
          muted
          playsInline
          autoPlay={idx === 0}
          onEnded={() => handleEnded(idx)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-300"
          style={{ opacity: idx === 0 ? 0.85 : 0 }}
        />
      ))}
      {/* Premium dark gradient and soft overlay to ensure extreme readability and high-end feel */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#050505]/70 via-black/40 to-[#120904]/20 pointer-events-none" />
      <div className="absolute inset-0 bg-black/15 pointer-events-none" />
    </div>
  );
};

const isOtpSessionActive = (recipient: string): boolean => {
  if (!recipient) return false;
  const cleanRecipient = recipient.trim().toLowerCase();
  try {
    const rawSessions = localStorage.getItem('frostybite_active_otp_sessions');
    if (!rawSessions) return false;
    const sessions = JSON.parse(rawSessions);
    const expiresAt = sessions[cleanRecipient];
    if (expiresAt && Date.now() < expiresAt) {
      return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
};

const getRemainingTime = (recipient: string, defaultSeconds: number): number => {
  if (!recipient) return defaultSeconds;
  const cleanRecipient = recipient.trim().toLowerCase();
  try {
    const rawSessions = localStorage.getItem('frostybite_active_otp_sessions');
    if (rawSessions) {
      const sessions = JSON.parse(rawSessions);
      const expiresAt = sessions[cleanRecipient];
      if (expiresAt) {
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        return remaining;
      }
    }
  } catch (e) {}
  return defaultSeconds;
};

const saveActiveOtpSession = (recipient: string, durationMs: number) => {
  if (!recipient) return;
  const cleanRecipient = recipient.trim().toLowerCase();
  try {
    const rawSessions = localStorage.getItem('frostybite_active_otp_sessions');
    const sessions = rawSessions ? JSON.parse(rawSessions) : {};
    sessions[cleanRecipient] = Date.now() + durationMs;
    localStorage.setItem('frostybite_active_otp_sessions', JSON.stringify(sessions));
  } catch (e) {
    // ignore
  }
};

const removeActiveOtpSession = (recipient: string) => {
  if (!recipient) return;
  const cleanRecipient = recipient.trim().toLowerCase();
  try {
    const rawSessions = localStorage.getItem('frostybite_active_otp_sessions');
    if (rawSessions) {
      const sessions = JSON.parse(rawSessions);
      delete sessions[cleanRecipient];
      localStorage.setItem('frostybite_active_otp_sessions', JSON.stringify(sessions));
    }
  } catch (e) {}
};

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, refreshProfile } = useAuth();
  const { selectManualCity, allowedZonesList } = useGeofence();

  // Unified State Machine Steps: 'welcome' | 'email' | 'name' | 'otp' | 'location'
  const [step, setStep] = useState<'welcome' | 'email' | 'name' | 'otp' | 'location'>('welcome');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form parameters
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handlePhoneChange = (val: string) => {
    let clean = val.replace(/\D/g, '');
    if (clean.startsWith('91') && clean.length > 10) {
      clean = clean.slice(2);
    } else if (clean.startsWith('0') && clean.length > 10) {
      clean = clean.slice(1);
    }
    setPhone(clean.slice(0, 10));
  };
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signInMethod, setSignInMethod] = useState<'password' | 'otp' | 'mobile_otp'>('password');
  const [signupMethod, setSignupMethod] = useState<'email' | 'mobile_otp'>('email');
  const [isNewUser, setIsNewUser] = useState(false);
  
  // OTP array input
  const [otpArray, setOtpArray] = useState<string[]>(['', '', '', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Premium WhatsApp OTP additional states
  const [timerSeconds, setTimerSeconds] = useState(180);
  const [isErrorShaking, setIsErrorShaking] = useState(false);
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState(false);

  // Timer parameters
  const [resendTimer, setResendTimer] = useState<number>(0);

  // Developer and Testing support for local WhatsApp dispatch
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [localDispatchOffline, setLocalDispatchOffline] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [whatsappServerUrl, setWhatsappServerUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('whatsapp_server_url') || 'http://localhost:3001';
    }
    return 'http://localhost:3001';
  });

  // Autoredirect after full authentication and geofence verification
  useEffect(() => {
    if (user) {
      if (isAdmin) {
        navigate('/admin');
      } else {
        const hasLocation = localStorage.getItem('geofence_passed') === 'true' || localStorage.getItem('frostybite_selected_city_id') !== null;
        if (hasLocation) {
          navigate('/');
        } else {
          setStep('location');
        }
      }
    }
  }, [user, isAdmin, navigate]);

  // Countdown timer for resend
  const execute1ClickLogin = async (targetEmail: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Get user document from Supabase to obtain the correct supabase_uid
      const { data: dbUser, error: dbErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', targetEmail.trim().toLowerCase())
        .maybeSingle();

      let targetUser = dbUser;
      
      // If user does not exist in Supabase DB, auto-populate it
      if (!targetUser) {
        const is_admin = ADMIN_EMAILS.includes(targetEmail.trim().toLowerCase());
        const role = is_admin ? 'admin' : 'customer';
        const defaultName = targetEmail.split('@')[0];
        
        // Create user with default fields
        const { data: insertedUser, error: insertError } = await supabase
          .from('users')
          .insert({
            email: targetEmail.trim().toLowerCase(),
            name: defaultName,
            full_name: defaultName,
            role: role,
            auth_methods: ['firebase', 'otp'],
            last_login: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
            wallet_balance: is_admin ? 1500 : 800,
            locked_wallet_balance: 0,
          })
          .select()
          .single();
        if (insertError) throw insertError;
        targetUser = insertedUser;
      }

      // Track emails to allow local storage fallbacks
      localStorage.setItem('frostybite_active_session_email', targetEmail);
      localStorage.setItem('frostybite_has_active_session', 'true');

      // Confetti blast!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      setSuccess('Successfully authenticated! Redirecting...');
      toast.success('Welcome back to Frosty Bite! Successfully logged in.');
      
      setTimeout(() => {
        if (targetUser.role === 'admin') {
          navigate('/admin');
        } else {
          localStorage.setItem('geofence_passed', 'true');
          navigate('/');
        }
      }, 700);

    } catch (err: any) {
      console.error(err);
      setError(`Authentication error: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Premium WhatsApp 5-minute (300s) countdown timer
  useEffect(() => {
    if (step !== 'otp' || signInMethod !== 'mobile_otp') return;
    if (timerSeconds <= 0) return;
    
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev - 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [step, signInMethod, timerSeconds]);



  // Handle Google OAuth authentication
  const handleGoogleAuth = async () => {
    if (isLoading) return;
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      // Clear any pre-existing cached user location to ensure they are prompted for GPS selection
      localStorage.removeItem('geofence_passed');
      localStorage.removeItem('frostybite_selected_city_id');
      await authService.loginWithGoogle();
      setSuccess('Successfully signed in with Google! Verifying GPS location...');
      setStep('location');
    } catch (err: any) {
      console.error(err);
      setError(parseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Send mobile verification code step
  const handleSendMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      setError('Please enter your mobile phone number.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setError(null);
    setSuccess(null);

    // Prevent trigger if active, unexpired session exists
    if (isOtpSessionActive(cleanPhone)) {
      const remaining = getRemainingTime(cleanPhone, 180);
      setTimerSeconds(remaining);
      setSignInMethod('mobile_otp');
      setIsNewUser(false);
      setOtpArray(['', '', '', '', '', '']);
      setStep('otp');
      setSuccess('You have an active verification session. Resumed current session.');
      return;
    }

    setIsLoading(true);

    try {
      setIsNewUser(false); // Mobile OTP is for login
      setSignInMethod('mobile_otp');
      const res = await authService.sendMobileOTP(cleanPhone);
      
      // Save active session
      saveActiveOtpSession(cleanPhone, 180 * 1000);
      
      setResendTimer(60);
      setTimerSeconds(180);
      setOtpArray(['', '', '', '', '', '']);
      if (res.dev_otp_hint) {
        setDevOtpHint(res.dev_otp_hint);
      } else {
        setDevOtpHint(null);
      }
      setStep('otp');
      if (res.local_dispatch_error) {
        setLocalDispatchOffline(true);
        setSuccess('A verification code has been dispatched to your device.');
      } else {
        setLocalDispatchOffline(false);
        setSuccess(res.message || 'Verification code sent successfully!');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to dispatch verification code. Please make sure your mobile number is registered.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check email step (Used strictly for Sign In OTP dispatch)
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setError('Invalid email. Please enter a valid email address (e.g., baker@frostybite.com).');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // Check with Supabase users database table
      const { data: dbUser, error: dbErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailTrimmed)
        .maybeSingle();

      if (dbErr) {
        console.warn('DB check error:', dbErr);
      }

      if (authMode === 'signin') {
        if (dbUser) {
          // Pre-existing user found! Immediately dispatch OTP and step directly to OTP screen
          setIsNewUser(false);
          setSignInMethod('otp');

          if (isOtpSessionActive(emailTrimmed)) {
            const remaining = getRemainingTime(emailTrimmed, 60);
            setResendTimer(remaining);
            setTimerSeconds(180);
            setOtpArray(['', '', '', '', '', '', '', '']);
            setStep('otp');
            setSuccess('You have an active verification session. Resumed current session.');
            setIsLoading(false);
            return;
          }

          await authService.sendOTP(emailTrimmed);
          
          // Save active session
          saveActiveOtpSession(emailTrimmed, 60 * 1000);

          setResendTimer(60); 
          setSuccess('Verification code sent! Please check your inbox.');
          setTimerSeconds(180);
          setOtpArray(['', '', '', '', '', '', '', '']);
          setStep('otp');
        } else {
          // No user found in signin mode
          setError('We couldn\'t find a Frosty Bite account with that email. Please click "Create Account" below or register.');
        }
      } else { 
        //signup mode fallback (though signup typically goes directly via handleCreateAccount now)
        if (dbUser) {
          setError('User already exists. A Frosty Bite account is already registered with this email. Please switch to "Sign In" above to access your account.');
        } else {
          setIsNewUser(true);
          setStep('name');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(parseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Password login handler
  const handlePasswordLogin = async () => {
    if (isLoading) return;

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setError('Invalid email. Please enter a valid email address (e.g., baker@frostybite.com).');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // 1. Fetch user from Supabase to check password
      const { data: dbUser, error: dbErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailTrimmed)
        .maybeSingle();

      if (dbErr) {
        console.warn('DB check error during password login:', dbErr);
      }

      if (!dbUser) {
        setError('We couldn\'t find a Frosty Bite account with that email. Please check your spelling or register.');
        setIsLoading(false);
        return;
      }

      const storedPassword = dbUser.password || '';
      if (!storedPassword || storedPassword.trim() === '') {
        setError('This account does not have a password set up yet. Please select the "OTP Code" option to log in.');
        setIsLoading(false);
        return;
      }

      if (storedPassword.trim() !== password.trim()) {
        setError('Incorrect password. Please verify your spelling or click "Forgot?" to reset it.');
        setIsLoading(false);
        return;
      }

      // Store authenticating session email immediately to guarantee robust immediate login flow
      localStorage.setItem('frostybite_active_session_email', emailTrimmed);
      localStorage.setItem('frostybite_has_active_session', 'true');

      // Attempt background auth service sync with Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          authService.syncUserWithDatabase(user).catch(() => {});
        }
      } catch (_) {}

      if (dbUser) {
        // Celebratory Blast
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ff6b00', '#ffa500', '#ffffff']
        });

        setSuccess('Successfully logged in!');
        
        const targetIsAdmin = dbUser.role === 'admin' || ADMIN_EMAILS.includes(emailTrimmed);
        setTimeout(() => {
          if (targetIsAdmin) {
            navigate('/admin');
          } else {
            const hasLocation = localStorage.getItem('geofence_passed') === 'true' || localStorage.getItem('frostybite_selected_city_id') !== null;
            if (hasLocation) {
              navigate('/');
            } else {
              setStep('location');
            }
          }
        }, 800);
      } else {
        throw new Error('Authentication session could not be established.');
      }
    } catch (err: any) {
      console.error('[PasswordLogin] error:', err);
      setError(parseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Brand New Onboarding Details & Trigger OTP Dispatch
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!name.trim()) {
      setError('Please enter your full name to personalize your bakery orders.');
      return;
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setError('Invalid email format. Please enter a valid email address (e.g., baker@frostybite.com) without spaces.');
      return;
    }

    const cleanPhone = normalizePhone(phone);
    if (!phone.trim()) {
      setError('Please enter your mobile phone number so we can coordinate your bakery delivery.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter a password to safeguard your account.');
      return;
    }
    if (password.length < 6) {
      setError('Password too short. Your password must be at least 6 characters long to secure your account.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both password entries are identical.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (signupMethod === 'email') {
        // Check if email already exists
        const { data: dbUser, error: dbErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', emailTrimmed)
          .maybeSingle();

        if (dbErr) {
          console.warn('DB check error:', dbErr);
        }

        if (dbUser) {
          setError('User already exists. A Frosty Bite account is already registered with this email. Please switch to "Sign In" above to access your account.');
          setIsLoading(false);
          return;
        }

        setIsNewUser(true);
        setSignInMethod('otp');

        if (isOtpSessionActive(emailTrimmed)) {
          const remaining = getRemainingTime(emailTrimmed, 60);
          setResendTimer(remaining);
          setSuccess(`You have an active verification session. Resumed current session.`);
          setTimerSeconds(180);
          setOtpArray(['', '', '', '', '', '', '', '']);
          setStep('otp');
          setIsLoading(false);
          return;
        }

        // Send Email OTP
        await authService.sendOTP(emailTrimmed);
        saveActiveOtpSession(emailTrimmed, 60 * 1000);
        setResendTimer(60);
        setSuccess(`Verification code sent! Please check your email inbox at ${emailTrimmed}.`);
        setTimerSeconds(180);
        setOtpArray(['', '', '', '', '', '', '', '']);
        setStep('otp');
      } else {
        // Check if phone already exists
        const { data: dbUserByPhone, error: dbErr } = await supabase
          .from('users')
          .select('*')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (dbErr) {
          console.warn('DB phone check error:', dbErr);
        }

        if (dbUserByPhone) {
          setError('A Frosty Bite account is already registered with this mobile number. Please select "Sign In" above to access your account.');
          setIsLoading(false);
          return;
        }

        setIsNewUser(true);
        setSignInMethod('mobile_otp');

        if (isOtpSessionActive(cleanPhone)) {
          const remaining = getRemainingTime(cleanPhone, 180);
          setTimerSeconds(remaining);
          setOtpArray(['', '', '', '', '', '']);
          setStep('otp');
          setSuccess('You have an active verification session. Resumed current session.');
          setIsLoading(false);
          return;
        }

        // Send Mobile OTP
        const res = await authService.sendMobileOTP(cleanPhone, true, emailTrimmed, name.trim(), password.trim());
        saveActiveOtpSession(cleanPhone, 180 * 1000);
        setResendTimer(60);
        setTimerSeconds(180);
        setOtpArray(['', '', '', '', '', '']);
        if (res.dev_otp_hint) {
          setDevOtpHint(res.dev_otp_hint);
        } else {
          setDevOtpHint(null);
        }
        setStep('otp');
        if (res.local_dispatch_error) {
          setLocalDispatchOffline(true);
          setSuccess('A verification code has been dispatched to your device.');
        } else {
          setLocalDispatchOffline(false);
          setSuccess(res.message || 'Verification code sent successfully!');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(parseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtpCode = async (otpCode: string) => {
    let emailTrimmed = email.trim().toLowerCase();
    
    if (signInMethod === 'mobile_otp') {
      const cleanPhone = normalizePhone(phone);
      const result = await authService.verifyMobileOTP(cleanPhone, otpCode);
      return result;
    } else {
      const result = await authService.verifyOTP(emailTrimmed, otpCode, isNewUser);
      return result;
    }
  };

  const handleSuccessRedirect = async (result: any) => {
    let emailTrimmed = email.trim().toLowerCase();
    if (result && result.email) {
      emailTrimmed = result.email;
    } else if (result && result.user && result.user.email) {
      emailTrimmed = result.user.email;
    }
    
    // Clear active verification sessions
    removeActiveOtpSession(emailTrimmed);
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone) {
      removeActiveOtpSession(cleanPhone);
    }

    // Store active session indicators
    localStorage.setItem('frostybite_active_session_email', emailTrimmed);
    localStorage.setItem('frostybite_has_active_session', 'true');

    if (isNewUser && signInMethod !== 'mobile_otp') {
      try {
        await supabase
          .from('users')
          .update({ 
            name: name.trim(), 
            full_name: name.trim(),
            phone: normalizePhone(phone),
            password: password.trim()
          })
          .eq('email', emailTrimmed);
        console.log('[Onboarding] Synced user name, mobile number, and password successfully.');
      } catch (dbErr) {
        console.warn('[Onboarding] Error syncing profile metadata:', dbErr);
      }
    }

    // Immediately trigger AuthContext to resolve the newly authenticated session
    await refreshProfile().catch((syncErr) => {
      console.warn('[handleSuccessRedirect] Auth sync triggered warning:', syncErr);
    });

    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailTrimmed)
        .maybeSingle();

      const targetIsAdmin = dbUser?.role === 'admin' || ADMIN_EMAILS.includes(emailTrimmed);
      const hasLocation = localStorage.getItem('geofence_passed') === 'true' || localStorage.getItem('frostybite_selected_city_id') !== null;

      if (targetIsAdmin) {
        navigate('/admin');
      } else if (hasLocation) {
        navigate('/');
      } else {
        setStep('location');
      }
    } catch (dbErr) {
      console.warn('[VerifyOtp] Failed evaluating redirect target, falling back to location state:', dbErr);
      setStep('location');
    }
  };

  // Verify OTP and complete sign-in
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading || isVerifiedSuccess) return;

    const otpCode = otpArray.join('');
    const expectedLength = signInMethod === 'mobile_otp' ? 6 : 8;

    if (otpCode.length < expectedLength) {
      setError(`Incorrect or incomplete code. Please enter the full ${expectedLength}-digit verification code.`);
      setIsErrorShaking(true);
      setTimeout(() => setIsErrorShaking(false), 500);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      let emailTrimmed = email.trim().toLowerCase();
      
      if (signInMethod === 'mobile_otp') {
        const cleanPhone = normalizePhone(phone);
        const result = await authService.verifyMobileOTP(cleanPhone, otpCode);
        emailTrimmed = result.email || result.user?.email || emailTrimmed;
      } else {
        await authService.verifyOTP(emailTrimmed, otpCode, isNewUser);
      }

      // Store authenticating session email immediately to guarantee robust immediate login flow
      localStorage.setItem('frostybite_active_session_email', emailTrimmed);
      localStorage.setItem('frostybite_has_active_session', 'true');

      if (isNewUser && signInMethod !== 'mobile_otp') {
        try {
          // Keep database synced with onboarding user name, phone, and password
          await supabase
            .from('users')
            .update({ 
              name: name.trim(), 
              full_name: name.trim(),
              phone: normalizePhone(phone),
              password: password.trim()
            })
            .eq('email', emailTrimmed);
          console.log('[Onboarding] Synced user name, mobile number, and password successfully.');
        } catch (dbErr) {
          console.warn('[Onboarding] Error syncing profile metadata:', dbErr);
        }
      }

      // Sync/Refresh Auth State immediately
      await refreshProfile().catch(() => {});

      // Premium Success State Transition
      setIsVerifiedSuccess(true);

      // Celebratory Blast
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ff6b00', '#ffa500', '#ffffff']
      });

      setSuccess('Account verified successfully!');
      
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', emailTrimmed)
          .maybeSingle();

        const targetIsAdmin = dbUser?.role === 'admin' || ADMIN_EMAILS.includes(emailTrimmed);
        const hasLocation = localStorage.getItem('geofence_passed') === 'true' || localStorage.getItem('frostybite_selected_city_id') !== null;

        setTimeout(() => {
          if (targetIsAdmin) {
            navigate('/admin');
          } else if (hasLocation) {
            navigate('/');
          } else {
            setStep('location');
          }
        }, 1200); // 1.2s delay for glorious success check animation!
      } catch (dbErr) {
        console.warn('[VerifyOtp] Failed evaluating redirect target, falling back to location state:', dbErr);
        setTimeout(() => {
          setStep('location');
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      setError(parseAuthError(err));
      // Trigger error shake animation
      setIsErrorShaking(true);
      setTimeout(() => setIsErrorShaking(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    // Cooldown check
    if (signInMethod === 'mobile_otp') {
      if (timerSeconds > 0 || isLoading) return;
    } else {
      if (resendTimer > 0 || isLoading) return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      if (signInMethod === 'mobile_otp') {
        const cleanPhone = normalizePhone(phone);
        const res = await authService.resendMobileOTP(cleanPhone);
        
        // Save active session
        saveActiveOtpSession(cleanPhone, 180 * 1000);
        
        // WhatsApp reset timers and clear inputs
        setTimerSeconds(180); // 3 minutes reset
        setOtpArray(['', '', '', '', '', '']);
        if (res.dev_otp_hint) {
          setDevOtpHint(res.dev_otp_hint);
        } else {
          setDevOtpHint(null);
        }
        if (res.local_dispatch_error) {
          setLocalDispatchOffline(true);
          setSuccess('A fresh verification code was sent! Please check your device.');
        } else {
          setLocalDispatchOffline(false);
          setSuccess(res.message || 'A fresh WhatsApp verification code was sent! Please check your device.');
        }
      } else {
        const emailTrimmed = email.trim().toLowerCase();
        await authService.sendOTP(emailTrimmed);
        
        // Save active session
        saveActiveOtpSession(emailTrimmed, 60 * 1000);
        
        setResendTimer(60);
        setOtpArray(['', '', '', '', '', '', '', '']);
        setSuccess('A fresh code was sent! Check your inbox.');
      }
    } catch (err: any) {
      console.error(err);
      setError(parseAuthError(err));
      setIsErrorShaking(true);
      setTimeout(() => setIsErrorShaking(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Geolocation triggers
  const handleEnableLocation = () => {
    setError(null);
    setIsLoading(true);

    if (!navigator.geolocation) {
      setError('GPS and Geolocation services are not supported on this browser.');
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        localStorage.setItem('cached_latitude', String(coords.lat));
        localStorage.setItem('cached_longitude', String(coords.lng));
        localStorage.setItem('geofence_passed', 'true');
        
        setSuccess('Location permissions verified!');
        const targetIsAdmin = user?.role === 'admin' || isAdmin || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
        setTimeout(() => {
          if (targetIsAdmin) navigate('/admin');
          else navigate('/');
        }, 800);
      },
      (geoErr) => {
        console.warn('Geolocation failed code:', geoErr.code, geoErr.message);
        setError('Location Access Denied. Please enable GPS permissions in browser settings or proceed manually.');
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleManualLocation = () => {
    // Proceed manually with default active city zone
    const targetId = (allowedZonesList && allowedZonesList.length > 0)
      ? allowedZonesList[0].id
      : 'zone_cuttack';
    selectManualCity(targetId);
    const targetIsAdmin = user?.role === 'admin' || isAdmin || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
    if (targetIsAdmin) navigate('/admin');
    else navigate('/');
  };

  // Handle digital box transitions
  const handleOtpChange = (index: number, val: string) => {
    if (/[^\d]/.test(val)) return; // Only allow digits
    
    const nextArr = [...otpArray];
    nextArr[index] = val;
    setOtpArray(nextArr);

    // Auto focus next box
    if (val !== '' && index < 7) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto submit if complete
    if (nextArr.every(cell => cell !== '')) {
      setTimeout(() => {
        // Verify code
        otpRefs.current[index]?.blur();
      }, 50);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpArray[index] === '' && index > 0) {
        const nextArr = [...otpArray];
        nextArr[index - 1] = '';
        setOtpArray(nextArr);
        otpRefs.current[index - 1]?.focus();
      } else {
        const nextArr = [...otpArray];
        nextArr[index] = '';
        setOtpArray(nextArr);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#040405] text-white select-none">
      {/* Visual background ambience */}
      <VideoBackground urls={BACKGROUND_VIDEOS} />

      {/* Animated glowing plasma blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#ef4444]/10 rounded-full blur-[140px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#f97316]/10 rounded-full blur-[140px] animate-pulse delay-1000" />

      {/* Glossy Header Back Button */}
      {step !== 'welcome' && step !== 'location' && (
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => {
            setError(null);
            setSuccess(null);
            if (step === 'email') setStep('welcome');
            if (step === 'name') setStep('email');
            if (step === 'otp') {
              setStep(isNewUser ? 'name' : 'email');
              setOtpArray(['', '', '', '', '', '']);
            }
          }}
          className="absolute top-8 left-6 sm:left-10 z-20 flex items-center gap-2 text-zinc-400 hover:text-white transition-all cursor-pointer group"
          id="auth_back_btn"
        >
          <div className="w-9 h-9 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 flex items-center justify-center transition-all">
            <ArrowLeft size={16} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Go Back</span>
        </motion.button>
      )}

      {/* Main Glassmorphism 3.0 Container Card */}
      <div className="relative z-10 w-full max-w-[430px] px-4">
        <motion.div 
          layout
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white/[0.02] backdrop-blur-[35px] border border-white/10 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.8)] overflow-hidden text-center relative"
          id="auth_card"
        >
          {/* Subtle glossy border shimmer */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none rounded-[2.5rem]" />

          {/* Alert/Status overlays */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-2 text-red-400 text-xs text-left"
                id="auth_error_box"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500 animate-pulse" />
                  {renderErrorMessage(error)}
                </div>
                {error.includes("register an account first") && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setStep('name');
                      setError(null);
                    }}
                    className="ml-7 mt-1 text-orange-400 hover:text-orange-300 font-bold underline text-[11px] self-start cursor-pointer transition-all active:scale-95"
                  >
                    👉 Click here to register your account now
                  </button>
                )}
              </motion.div>
            )}
            
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-xs text-left"
                id="auth_success_box"
              >
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                <p>{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic Step Controller */}
          <AnimatePresence mode="wait">
            
            {/* STEP 1: WELCOME SLIDE */}
            {step === 'welcome' && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-8"
              >
                {/* Brand Logo & Title */}
                <div className="space-y-3">
                  <div className="inline-flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-orange-500/25 blur-xl rounded-full scale-125" />
                    <img 
                      src="https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg" 
                      alt="Frosty Bite Luxury Patisserie" 
                      className="h-28 w-28 object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.5)] rounded-2xl border border-white/5 relative z-10"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
                      🍰 Frosty Bite
                    </h1>
                    <p className="text-zinc-400 text-xs uppercase tracking-[0.25em] font-medium font-sans">
                      Fresh Bakery Delivered
                    </p>
                  </div>
                </div>

                {/* Login Strategy Selection Buttons */}
                <div className="space-y-3.5 pt-4">
                  
                  {/* Google Authenticator */}
                  <button
                    onClick={handleGoogleAuth}
                    disabled={isLoading}
                    className="w-full h-14 rounded-2xl bg-white text-zinc-950 font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_10px_25px_rgba(255,255,255,0.06)] cursor-pointer hover:bg-neutral-50"
                    id="btn_google_auth"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span className="font-sans font-black tracking-wide text-sm">Continue with Google</span>
                  </button>

                  {/* Email OTP Auth Link */}
                  <button
                    onClick={() => {
                      setAuthMode('signin');
                      setSignInMethod('password');
                      setStep('email');
                    }}
                    className="w-full h-14 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white font-bold tracking-wide border border-white/10 hover:border-white/15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer"
                    id="btn_email_init"
                  >
                    <Mail size={18} className="text-zinc-300" />
                    <span className="font-sans font-bold tracking-wide text-sm text-zinc-200">Continue with Email</span>
                  </button>

                  {/* Continue with Mobile (Unlocked & Beautifully Styled) */}
                  <button
                    onClick={() => {
                      setAuthMode('signin');
                      setSignInMethod('mobile_otp');
                      setStep('email');
                    }}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-orange-600/90 to-amber-600/90 hover:from-orange-500 hover:to-amber-500 text-white font-bold tracking-wide border border-white/10 hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_25px_rgba(249,115,22,0.15)] hover:shadow-[0_15px_30px_rgba(249,115,22,0.25)] transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer"
                    id="btn_mobile_init"
                  >
                    <Phone size={18} className="text-white shrink-0" />
                    <span className="font-sans font-bold tracking-wide text-sm">Continue with Mobile</span>
                    <span className="bg-white/15 border border-white/10 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none ml-1 shrink-0">
                      ⚡ OTP
                    </span>
                  </button>



                  {/* Create Account Selector Link */}
                  <div className="text-center pt-2">
                    <span className="text-xs text-zinc-400">
                      New to Frosty Bite?{' '}
                      <button
                        onClick={() => {
                          setAuthMode('signup');
                          setStep('name');
                        }}
                        className="text-orange-500 hover:text-orange-400 font-bold focus:outline-none underline cursor-pointer p-1"
                        id="btn_create_account_init"
                      >
                        Create an Account
                      </button>
                    </span>
                  </div>

                </div>

                {/* Terms disclaimer footer */}
                <p className="text-[10px] text-zinc-500 leading-relaxed font-sans max-w-[280px] mx-auto mt-4 pt-4 border-t border-white/5">
                  By continuing, you agree to Frosty Bite's <br />
                  <a href="https://frosty-bite-privacy-and-policy.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 underline hover:text-white transition-all">Terms of Service</a> & <a href="https://frosty-bite-privacy-and-policy.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-zinc-400 underline hover:text-white transition-all">Privacy Policy</a>.
                </p>
              </motion.div>
            )}

            {/* STEP 2: EMAIL INPUT SUBMISSION */}
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5 text-left"
              >
                <div className="space-y-1 text-center">
                  <h2 className="text-2xl font-bold tracking-tight text-white">
                    {signInMethod === 'mobile_otp' ? 'Continue with Mobile' : (authMode === 'signin' ? 'Sign In' : 'Create Account')}
                  </h2>
                  <p className="text-zinc-400 text-xs">
                    {signInMethod === 'mobile_otp' 
                      ? 'Enter your mobile number to check-in or register instantly via OTP.' 
                      : (authMode === 'signin' 
                          ? 'Sign in to access your luxury patisserie account'
                          : 'Create an account to start ordering gourmet bakery delights')}
                  </p>
                </div>

                {/* Premium Auth Mode Tabs Switcher */}
                {signInMethod !== 'mobile_otp' && (
                  <div className="flex p-1 bg-white/[0.03] border border-white/10 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setError(null);
                      }}
                      className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                        authMode === 'signin' 
                          ? 'bg-orange-600/90 text-white shadow-[0_5px_15px_rgba(249,115,22,0.25)] border border-white/10' 
                          : 'text-zinc-400 hover:text-white bg-transparent'
                      }`}
                    >
                      🔐 Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setError(null);
                        setStep('name');
                      }}
                      className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                        authMode === 'signup' 
                          ? 'bg-orange-600/90 text-white shadow-[0_5px_15px_rgba(249,115,22,0.25)] border border-white/10' 
                          : 'text-zinc-400 hover:text-white bg-transparent'
                      }`}
                    >
                      ✨ Register
                    </button>
                  </div>
                )}

                {/* Sub-Switch for Sign-In Option: Password vs Email OTP vs Mobile OTP */}
                {authMode === 'signin' && signInMethod !== 'mobile_otp' && (
                  <div className="flex p-1 bg-white/[0.01] border border-white/5 rounded-2xl gap-1 animate-in fade-in duration-200">
                    <button
                      type="button"
                      onClick={() => {
                        setSignInMethod('password');
                        setError(null);
                      }}
                      className={`flex-1 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                        signInMethod === 'password' 
                          ? 'bg-zinc-800 text-white border border-white/5 shadow-inner' 
                          : 'text-zinc-500 hover:text-zinc-300 bg-transparent'
                      }`}
                    >
                      🔑 Password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSignInMethod('otp');
                        setError(null);
                      }}
                      className={`flex-1 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                        signInMethod === 'otp' 
                          ? 'bg-zinc-800 text-white border border-white/5 shadow-inner' 
                          : 'text-zinc-500 hover:text-zinc-300 bg-transparent'
                      }`}
                    >
                      ✉️ Email OTP
                    </button>
                  </div>
                )}

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (authMode === 'signin' && signInMethod === 'password') {
                      handlePasswordLogin();
                    } else if (authMode === 'signin' && signInMethod === 'mobile_otp') {
                      handleSendMobileOtp(e);
                    } else {
                      handleCheckEmail(e);
                    }
                  }} 
                  className="space-y-4"
                >
                  {signInMethod === 'mobile_otp' ? (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Mobile Phone Number</label>
                      <div className="relative flex items-center">
                        <div className="absolute left-4 flex items-center gap-1.5 pointer-events-none text-zinc-500">
                          <Phone size={18} />
                          <span className="text-sm font-semibold border-r border-white/10 pr-2 font-mono text-zinc-400 leading-none">+91</span>
                        </div>
                        <input
                          type="tel"
                          placeholder="9876543210"
                          value={phone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 pl-[5.5rem] pr-4 text-white text-sm font-sans focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-zinc-500 transition-all font-mono"
                          required
                          autoFocus
                          id="auth_phone_input"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="email"
                          placeholder="e.g. wasif@domain.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 pl-12 pr-4 text-white text-sm font-sans focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-zinc-500 transition-all"
                          required
                          autoFocus
                          id="auth_email_input"
                        />
                      </div>
                    </div>
                  )}

                  {authMode === 'signin' && signInMethod === 'password' && (
                    <div className="space-y-1.5 animate-in fade-in duration-200 text-left">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Your Password</label>
                        <button
                          type="button"
                          onClick={() => navigate('/forgot-password')}
                          className="text-[10px] font-black text-orange-500 hover:text-orange-400 focus:outline-none transition-colors uppercase tracking-widest cursor-pointer"
                          id="forgot_password_link"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 pl-12 pr-4 text-white text-sm font-sans focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-zinc-500 transition-all"
                          required
                          id="auth_signin_password_input"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-2 group shadow-[0_10px_30px_rgba(249,115,22,0.15)] disabled:opacity-50 disabled:pointer-events-none"
                    id="auth_email_submit"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="font-sans font-black tracking-wide text-sm">Continue</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 3: NEW USER NAME ONBOARDING */}
            {step === 'name' && (
              <motion.div
                key="name"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6 text-left"
              >
                <div className="space-y-2 text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-500 mb-1">
                    <ChefHat size={28} className="animate-bounce" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Create Account</h2>
                  <p className="text-zinc-400 text-xs text-center">Enter your details to register and verify your account</p>
                </div>

                {/* Premium Auth Mode Tabs Switcher */}
                <div className="flex p-1 bg-white/[0.03] border border-white/10 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setError(null);
                      setStep('email');
                    }}
                    className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                      authMode === 'signin' 
                        ? 'bg-orange-600/90 text-white shadow-[0_5px_15px_rgba(249,115,22,0.25)] border border-white/10' 
                        : 'text-zinc-400 hover:text-white bg-transparent'
                    }`}
                  >
                    🔐 Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setError(null);
                    }}
                    className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                      authMode === 'signup' 
                        ? 'bg-orange-600/90 text-white shadow-[0_5px_15px_rgba(249,115,22,0.25)] border border-white/10' 
                        : 'text-zinc-400 hover:text-white bg-transparent'
                    }`}
                  >
                    ✨ Register
                  </button>
                </div>

                <form onSubmit={handleCreateAccount} className="space-y-4">
                  {/* Signup Verification Method Selection: Email OTP vs Mobile OTP */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Registration Verification Option</label>
                    <div className="flex p-1 bg-white/[0.01] border border-white/5 rounded-2xl gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSignupMethod('email');
                          setError(null);
                        }}
                        className={`flex-1 py-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                          signupMethod === 'email' 
                            ? 'bg-zinc-800 text-white border border-white/5 shadow-inner' 
                            : 'text-zinc-500 hover:text-zinc-300 bg-transparent'
                        }`}
                      >
                        ✉️ Email OTP
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSignupMethod('mobile_otp');
                          setError(null);
                        }}
                        className={`flex-1 py-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer ${
                          signupMethod === 'mobile_otp' 
                            ? 'bg-zinc-800 text-white border border-white/5 shadow-inner' 
                            : 'text-zinc-500 hover:text-zinc-300 bg-transparent'
                        }`}
                      >
                        📱 Mobile OTP
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Your Full Name</label>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="e.g. Wasif Mohammad"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 pl-12 pr-4 text-white text-sm font-sans focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-zinc-500 transition-all"
                        required
                        autoFocus
                        id="auth_name_input"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Mobile Phone Number</label>
                    <div className="relative flex items-center">
                      <div className="absolute left-4 flex items-center gap-1.5 pointer-events-none text-zinc-500">
                        <Phone size={18} />
                        <span className="text-sm font-semibold border-r border-white/10 pr-2 font-mono text-zinc-400 leading-none">+91</span>
                      </div>
                      <input
                        type="tel"
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 pl-[5.5rem] pr-4 text-white text-sm font-sans focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-zinc-500 transition-all font-mono"
                        required
                        id="auth_phone_input"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Email ID</label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        placeholder="e.g. wasif@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 pl-12 pr-4 text-white text-sm font-sans focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-zinc-500 transition-all"
                        required
                        id="auth_email_input_signup"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Choose Password</label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="password"
                        placeholder="Minimum 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 pl-12 pr-4 text-white text-sm font-sans focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-zinc-500 transition-all"
                        required
                        id="auth_password_input"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Confirm Password</label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 pl-12 pr-4 text-white text-sm font-sans focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 placeholder-zinc-500 transition-all"
                        required
                        id="auth_confirm_password_input"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-2 group shadow-[0_10px_30px_rgba(249,115,22,0.15)] disabled:opacity-50 disabled:pointer-events-none"
                    id="auth_name_submit"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="font-sans font-black tracking-wide text-sm">Send Dispatch OTP</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* STEP 4: VERIFY ACCOUNT / OTP CONFIRMATION SCREEN */}
            {step === 'otp' && (
              <OtpSuccessAnimation
                otpArray={otpArray}
                setOtpArray={setOtpArray}
                signInMethod={signInMethod}
                email={email}
                phone={phone}
                error={error}
                setError={setError}
                onVerify={verifyOtpCode}
                onSuccessRedirect={handleSuccessRedirect}
                onBack={() => {
                  setStep(isNewUser ? 'name' : 'email');
                }}
                timerSeconds={timerSeconds}
                resendTimer={resendTimer}
                handleResendOtp={handleResendOtp}
              />
            )}

            {/* STEP 5: LOCATION PERMISSION SCREEN */}
            {step === 'location' && (
              <motion.div
                key="location"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div className="space-y-2 text-center">
                  <div className="relative inline-flex mb-2">
                    <div className="absolute inset-0 bg-orange-500/30 blur-2xl rounded-full scale-150 animate-pulse" />
                    <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500 relative z-10 animate-pulse">
                      <Navigation size={32} className="rotate-45" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Location Services</h2>
                  <p className="text-zinc-400 text-xs leading-relaxed max-w-[280px] mx-auto">
                    We use GPS to check geofence zones and customize your patisserie delivery experience.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <button
                    onClick={handleEnableLocation}
                    disabled={isLoading}
                    className="w-full h-14 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_35px_rgba(249,115,22,0.2)] disabled:opacity-50"
                    id="btn_detect_gps"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Compass size={18} />
                        <span className="font-sans font-black tracking-wide text-sm">Agree & Detect GPS</span>
                      </>
                    )}
                  </button>

                  <div className="relative flex py-2 items-center justify-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink mx-4 text-[9px] font-black uppercase tracking-widest text-[#FFD6A5]">Or Pick Your City</span>
                    <div className="flex-grow border-t border-white/10"></div>
                  </div>

                  {/* High Quality City Selection Buttons Grid */}
                  <div className="grid grid-cols-2 gap-3.5">
                    {(() => {
                      const displayZones = (allowedZonesList && allowedZonesList.length > 0)
                        ? allowedZonesList.filter(z => z.enabled)
                        : [
                            { id: 'zone_cuttack', name: 'Cuttack', enabled: true },
                            { id: 'zone_bhubaneswar', name: 'Bhubaneswar', enabled: true }
                          ];
                      return displayZones.map((zone) => (
                        <button
                          key={zone.id}
                          type="button"
                          disabled={isLoading}
                          onClick={() => {
                            const ok = selectManualCity(zone.id);
                            if (ok) {
                              setSuccess(`Welcome to ${zone.name}!`);
                              const targetIsAdmin = user?.role === 'admin' || isAdmin || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
                              setTimeout(() => {
                                if (targetIsAdmin) navigate('/admin');
                                else navigate('/');
                              }, 800);
                            }
                          }}
                          className="h-16 rounded-2xl bg-white/[0.02] hover:bg-white/[0.08] hover:border-orange-500/40 text-white font-bold border border-white/10 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 flex flex-col items-center justify-center gap-0.5 cursor-pointer disabled:opacity-50"
                        >
                          <span className="text-xs font-sans tracking-tight text-white">{zone.name}</span>
                          <span className="text-[7.5px] text-emerald-400 uppercase tracking-widest font-black">Kitchen Active</span>
                        </button>
                      ));
                    })()}
                  </div>

                  <button
                    onClick={handleManualLocation}
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl bg-transparent hover:bg-white/[0.03] text-zinc-400 font-bold tracking-wide border border-dashed border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer text-xs"
                    id="btn_manual_gps"
                  >
                    <span className="font-sans font-bold text-xs text-zinc-500">Auto Select Nearest City</span>
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
