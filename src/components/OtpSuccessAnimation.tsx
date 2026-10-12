import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles, 
  Mail, 
  Phone, 
  RefreshCw, 
  Edit3, 
  AlertCircle, 
  ArrowRight, 
  Clock, 
  HelpCircle, 
  ChevronDown, 
  RotateCcw,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

interface OtpSuccessAnimationProps {
  otpArray: string[];
  setOtpArray: (otp: string[]) => void;
  signInMethod: 'password' | 'otp' | 'mobile_otp';
  email: string;
  phone: string;
  error: string | boolean | null;
  setError: (err: string | null) => void;
  onVerify: (otpCode: string) => Promise<any>;
  onSuccessRedirect: (result: any) => void;
  onBack: () => void;
  timerSeconds: number;
  resendTimer: number;
  handleResendOtp: () => void;
}

type AnimStatus = 'entering' | 'verifying' | 'loading' | 'success' | 'exiting';

// Web Audio API Sound Synthesizer for Micro-Interactions
const playKeypressTick = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  } catch (_) {}
};

const playSuccessChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonic Chord (C5, E5, G5, C6)
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    const delays = [0, 0.06, 0.12, 0.18];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + delays[i];

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, startTime + 0.4);

      gain.gain.setValueAtTime(0.08, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 1.2);
    });
  } catch (_) {}
};

const playErrorThump = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch (_) {}
};

export const OtpSuccessAnimation: React.FC<OtpSuccessAnimationProps> = ({
  otpArray,
  setOtpArray,
  signInMethod,
  email,
  phone,
  error,
  setError,
  onVerify,
  onSuccessRedirect,
  onBack,
  timerSeconds,
  resendTimer,
  handleResendOtp,
}) => {
  const [animStatus, setAnimStatus] = useState<AnimStatus>('entering');
  const [activeBox, setActiveBox] = useState<number | null>(0);
  const [rippleIndex, setRippleIndex] = useState<number | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showTips, setShowTips] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoRedirectProgress, setAutoRedirectProgress] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpLength = 6;

  // Floating ambient golden/champagne confectioner's dust particles
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; duration: number; delay: number }[]>([]);
  const [sparkles, setSparkles] = useState<{ id: number; top: string; left: string; scale: number; delay: number }[]>([]);

  useEffect(() => {
    const pList = Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 3,
    }));
    setParticles(pList);

    const sList = Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 60 + 20}%`,
      left: `${Math.random() * 75 + 12}%`,
      scale: Math.random() * 0.5 + 0.6,
      delay: Math.random() * 1.5,
    }));
    setSparkles(sList);
  }, []);

  // Focus on the first empty box on mount
  useEffect(() => {
    const firstEmptyIndex = otpArray.findIndex(digit => digit === '');
    const targetIdx = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
    const timer = setTimeout(() => {
      otpRefs.current[targetIdx]?.focus();
      setActiveBox(targetIdx);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // React to error prop changes to trigger subtle shake animation and highlight
  useEffect(() => {
    if (error) {
      setHasError(true);
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 600);
      return () => clearTimeout(timer);
    } else {
      setHasError(false);
    }
  }, [error]);

  // Optical ripple wave across slots
  const triggerRippleSequence = useCallback(async () => {
    for (let i = 0; i < otpLength; i++) {
      setRippleIndex(i);
      await new Promise((r) => setTimeout(r, 40));
    }
    setRippleIndex(null);
  }, [otpLength]);

  // Main submission and verification handler
  const submitOtpCode = useCallback(async (code: string) => {
    if (isSubmitting || animStatus === 'loading' || animStatus === 'success') return;
    setIsSubmitting(true);
    setError(null);
    setHasError(false);
    setAnimStatus('verifying');

    await triggerRippleSequence();
    
    // Pause for smooth visual transition
    await new Promise((resolve) => setTimeout(resolve, 320));
    setAnimStatus('loading');

    try {
      const res = await onVerify(code);
      setVerificationResult(res);

      // Transition to award-winning celebratory success state
      setAnimStatus('success');
      playSuccessChime();

      // Confetti burst
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#F59E0B', '#F97316', '#10B981', '#FDE68A', '#FFFFFF', '#14B8A6'],
        ticks: 260,
        gravity: 0.9,
      });

      // Mobile Haptic Feedback
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate([40, 30, 40]);
        }
      } catch (_) {}

    } catch (err: any) {
      playErrorThump();
      setIsShaking(true);
      setHasError(true);
      setAnimStatus('entering');
      setIsSubmitting(false);

      const errorMessage = err?.message || 'Incorrect verification code. Please check your email and try again.';
      setError(errorMessage);
      toast.error(errorMessage, { id: 'otp-error-toast' });

      // Mobile Haptic Error Buzz
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate([80, 50, 80]);
        }
      } catch (_) {}

      setTimeout(() => setIsShaking(false), 600);
      setTimeout(() => {
        // Refocus on input #0 for immediate correction
        otpRefs.current[0]?.focus();
        setActiveBox(0);
      }, 120);
    }
  }, [isSubmitting, animStatus, onVerify, setError, triggerRippleSequence]);

  const handleInputChange = (val: string, idx: number) => {
    setError(null);
    setHasError(false);
    const cleaned = val.replace(/[^0-9]/g, '');

    playKeypressTick();

    const nextArr = [...otpArray];
    nextArr[idx] = cleaned ? cleaned.slice(-1) : '';
    setOtpArray(nextArr);

    // Auto advance to next slot
    if (cleaned !== '' && idx < otpLength - 1) {
      otpRefs.current[idx + 1]?.focus();
      setActiveBox(idx + 1);
    }

    // Auto verify when all 6 digits are filled
    const isComplete = nextArr.slice(0, otpLength).every((cell) => cell !== '');
    if (isComplete) {
      submitOtpCode(nextArr.slice(0, otpLength).join(''));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    setHasError(false);
    setError(null);
    if (e.key === 'Backspace') {
      playKeypressTick();
      if (otpArray[idx] === '' && idx > 0) {
        const nextArr = [...otpArray];
        nextArr[idx - 1] = '';
        setOtpArray(nextArr);
        otpRefs.current[idx - 1]?.focus();
        setActiveBox(idx - 1);
      } else {
        const nextArr = [...otpArray];
        nextArr[idx] = '';
        setOtpArray(nextArr);
        setActiveBox(idx);
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
      setActiveBox(idx - 1);
    } else if (e.key === 'ArrowRight' && idx < otpLength - 1) {
      otpRefs.current[idx + 1]?.focus();
      setActiveBox(idx + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setHasError(false);
    setError(null);
    const rawDigits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!rawDigits) return;

    const pasted = rawDigits.slice(0, 6);

    playKeypressTick();
    const nextArr = [...otpArray];
    for (let i = 0; i < 6; i++) {
      nextArr[i] = pasted[i] || '';
    }
    setOtpArray(nextArr);

    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
    setActiveBox(focusIndex);

    if (nextArr.slice(0, 6).every((cell) => cell !== '')) {
      submitOtpCode(nextArr.slice(0, 6).join(''));
    }
  };

  const handleClearCode = () => {
    setHasError(false);
    setError(null);
    setOtpArray(Array(otpLength).fill(''));
    setTimeout(() => {
      otpRefs.current[0]?.focus();
      setActiveBox(0);
    }, 100);
  };

  const handleContinue = () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([30, 20, 30]);
      }
    } catch (_) {}
    setAnimStatus('exiting');
    setTimeout(() => {
      onSuccessRedirect(verificationResult);
    }, 450);
  };

  // Auto redirect countdown on success
  useEffect(() => {
    if (animStatus === 'success') {
      const interval = setInterval(() => {
        setAutoRedirectProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            handleContinue();
            return 100;
          }
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [animStatus]);

  const isEmail = signInMethod !== 'mobile_otp';
  const targetRecipient = isEmail ? email : `+91 ${phone}`;
  const currentCooldown = isEmail ? resendTimer : timerSeconds;

  return (
    <div className="relative w-full overflow-hidden min-h-[460px] flex flex-col justify-between p-1 select-none">
      
      {/* Ambient Bokeh and Confectioner's Shimmer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
        {particles.map((p) => (
          <motion.div
            key={`otp-ambient-particle-${p.id}`}
            className="absolute bg-gradient-to-tr from-amber-400/20 to-orange-300/10 rounded-full blur-[1px]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
            }}
            animate={
              animStatus === 'success'
                ? {
                    y: ['0vh', '35vh'],
                    opacity: [0.7, 0.9, 0],
                    scale: [1, 1.8, 0.5],
                  }
                : {
                    y: [0, -18, 0],
                    x: [0, 8, 0],
                    opacity: [0.3, 0.7, 0.3],
                  }
            }
            transition={{
              duration: animStatus === 'success' ? 4 : p.duration,
              repeat: animStatus === 'success' ? 0 : Infinity,
              delay: p.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {animStatus === 'entering' || animStatus === 'verifying' ? (
          <motion.div
            key="otp-passkey-entry"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 flex-1 flex flex-col justify-between relative z-10"
          >
            {/* Top Navigation & Context Bar */}
            <div className="relative pt-1">
              <button
                type="button"
                onClick={onBack}
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-amber-500/30 text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 group shadow-sm"
                title="Back to previous screen"
                id="btn_otp_back"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <div className="space-y-1.5 text-center px-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-widest shadow-inner">
                  <Sparkles size={11} className="text-amber-400 animate-pulse" />
                  <span>Security Passkey</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white font-sans">Verify Passkey</h2>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-[260px] mx-auto">
                  {isEmail ? 'Enter the 6-digit verification code dispatched to' : 'Enter the 6-digit WhatsApp code dispatched to'}
                </p>
              </div>
            </div>

            {/* Target Address Card with Inline Edit Action */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-500/30 transition-all backdrop-blur-md max-w-[340px] mx-auto w-full shadow-inner group"
            >
              <div className="flex items-center gap-2.5 overflow-hidden pl-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  {isEmail ? <Mail size={15} /> : <Phone size={15} />}
                </div>
                <div className="overflow-hidden text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    {isEmail ? 'Recipient Email' : 'Recipient Phone'}
                  </p>
                  <p className="text-xs font-bold text-white font-mono truncate max-w-[190px] sm:max-w-[210px]">
                    {targetRecipient}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer shrink-0 text-[11px] font-bold flex items-center gap-1"
                title="Change address"
                id="btn_change_otp_recipient"
              >
                <Edit3 size={13} />
                <span className="text-[10px] uppercase font-bold tracking-wider">Edit</span>
              </button>
            </motion.div>

            {/* 6-Digit Luxury Passkey Grid with Shake Animation */}
            <div className="space-y-3 py-1">
              <div className="flex justify-between items-center max-w-[340px] mx-auto px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  6-Digit Passkey
                </span>
                <span className="text-[10px] font-medium text-zinc-500 font-mono">
                  {otpArray.slice(0, 6).filter(Boolean).length}/6
                </span>
              </div>

              <motion.div 
                animate={isShaking ? { x: [-10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="grid grid-cols-6 gap-1.5 sm:gap-2.5 max-w-[340px] mx-auto py-1 w-full"
              >
                {Array.from({ length: 6 }).map((_, idx) => {
                  const digit = otpArray[idx] || '';
                  const isFocused = activeBox === idx;
                  const isRippled = rippleIndex === idx;
                  const isFilled = digit !== '';
                  const isSlotError = hasError || !!error;

                  return (
                    <div 
                      key={`otp-digit-slot-${idx}`} 
                      className="relative w-full min-w-0 flex items-center justify-center"
                    >
                      <input
                        ref={(el) => { otpRefs.current[idx] = el; }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onFocus={() => {
                          setActiveBox(idx);
                          setHasError(false);
                          setError(null);
                        }}
                        onBlur={() => setActiveBox(null)}
                        onChange={(e) => handleInputChange(e.target.value, idx)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        onPaste={handlePaste}
                        className={`w-full h-12 sm:h-14 text-center border rounded-xl sm:rounded-2xl text-lg sm:text-xl font-black font-mono focus:outline-none transition-all select-all duration-200 cursor-text p-0 min-w-0
                          ${isSlotError
                            ? 'border-rose-500 bg-rose-500/10 text-rose-300 ring-2 ring-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                            : isFocused 
                              ? 'border-amber-400 bg-amber-500/[0.08] shadow-[0_0_20px_rgba(245,158,11,0.35)] scale-105 text-amber-300 ring-2 ring-amber-400/20' 
                              : isFilled
                                ? 'border-amber-500/40 text-white bg-white/[0.05]'
                                : 'border-white/10 text-white hover:border-white/20'
                          }
                          ${isRippled ? 'border-amber-300 bg-amber-500/20 scale-110 shadow-[0_0_25px_rgba(245,158,11,0.5)]' : ''}
                        `}
                        autoComplete="one-time-code"
                        pattern="\d*"
                        inputMode="numeric"
                        id={`otp_slot_${idx}`}
                      />

                      {/* Glowing underline indicator */}
                      {isSlotError ? (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-rose-500 rounded-full blur-[0.4px]" />
                      ) : isFilled && !isFocused ? (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-[2px] bg-amber-400/90 rounded-full blur-[0.4px]" />
                      ) : null}

                      {/* Ripple pulse on final digit completion */}
                      {idx === otpLength - 1 && isFilled && animStatus === 'verifying' && (
                        <div className="absolute inset-0 border-2 border-amber-400 rounded-2xl animate-ping pointer-events-none" />
                      )}
                    </div>
                  );
                })}
              </motion.div>

              {/* Dynamic Non-Blocking Inline Error Banner with Instant Clear */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="otp_inline_error_notice"
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs max-w-[340px] mx-auto w-full shadow-inner">
                      <div className="flex items-center gap-2 overflow-hidden text-left">
                        <AlertCircle size={15} className="text-rose-400 shrink-0 animate-pulse" />
                        <span className="truncate leading-tight text-[11px] sm:text-xs">
                          {typeof error === 'string' ? error : 'Incorrect verification code. Please check & try again.'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearCode}
                        className="ml-2 shrink-0 px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                        title="Clear code and re-type"
                      >
                        <RotateCcw size={10} />
                        <span>Clear</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Buttons & Cooldown */}
            <div className="space-y-4 pt-1">
              <button
                type="button"
                onClick={() => submitOtpCode(otpArray.slice(0, otpLength).join(''))}
                disabled={otpArray.slice(0, otpLength).some(d => d === '') || animStatus === 'verifying' || isSubmitting}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_12px_30px_rgba(245,158,11,0.25)] hover:shadow-[0_16px_36px_rgba(245,158,11,0.35)] disabled:opacity-30 disabled:pointer-events-none transform active:scale-[0.98] group overflow-hidden"
                id="btn_submit_otp_passkey"
              >
                {animStatus === 'verifying' ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="font-sans font-bold text-xs uppercase tracking-widest">Validating Passkey...</span>
                  </div>
                ) : (
                  <>
                    <ShieldCheck size={18} className="text-amber-200 group-hover:scale-110 transition-transform" />
                    <span className="font-sans font-black tracking-wide text-sm">Verify & Unlock Patisserie</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform text-amber-200" />
                  </>
                )}
              </button>

              {/* Cooldown Timer & Resend Controls */}
              <div className="flex flex-col items-center justify-center space-y-2 py-1 text-xs">
                {currentCooldown > 0 ? (
                  <div className="flex items-center gap-2 text-zinc-400 font-sans">
                    <div className="relative flex items-center justify-center">
                      <Clock size={13} className="text-amber-400 animate-pulse" />
                    </div>
                    <span>Resend passkey in</span>
                    <span className="text-amber-400 font-mono font-black text-xs px-1.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      {isEmail 
                        ? `${currentCooldown}s`
                        : `${Math.floor(currentCooldown / 60).toString().padStart(2, '0')}:${(currentCooldown % 60).toString().padStart(2, '0')}`
                      }
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Didn't receive the passkey?</span>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-amber-400 hover:text-amber-300 font-extrabold focus:outline-none transition-colors cursor-pointer flex items-center gap-1 underline underline-offset-4 decoration-amber-500/40 hover:decoration-amber-400"
                      id="btn_resend_otp_code"
                    >
                      <RefreshCw size={12} className="animate-spin-slow" />
                      <span>Resend Code</span>
                    </button>
                  </div>
                )}

                {/* Delivery Tip Accordion */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTips(!showTips)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer mx-auto"
                  >
                    <HelpCircle size={12} />
                    <span>Need help with your passkey?</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showTips ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showTips && (
                      <motion.div
                        key="otp-help-tips-dropdown"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-2"
                      >
                        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[10px] text-zinc-400 space-y-1.5 text-left max-w-[320px] mx-auto leading-relaxed">
                          <p>• Check your <strong>Spam</strong> or <strong>Promotions</strong> folder.</p>
                          <p>• Verification emails are sent instantly from <strong>auth@frostybite.com</strong>.</p>
                          <p>• If you mistyped your address, tap <strong>Edit</strong> above to correct it.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        ) : animStatus === 'loading' ? (
          /* =========================================================================
             HYPNOTIC ULTRA-LUXURY CONFECTIONERY VAULT LOADING ANIMATION
             ========================================================================= */
          <motion.div
            key="otp-loading-confectionery"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col items-center justify-center py-10 space-y-8 relative z-10"
          >
            {/* Multi-Orbital Radiant Vault Core */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Outer soft ambient halo */}
              <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 via-orange-500/25 to-amber-300/10 blur-3xl rounded-full scale-150 animate-pulse" />

              {/* Orbital Ring 1: Clockwise Outer Amber Ring with Ticks */}
              <motion.div
                className="absolute inset-0 rounded-full border border-dashed border-amber-400/40 shadow-[0_0_25px_rgba(245,158,11,0.2)]"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
              />

              {/* Orbital Ring 2: Counter-Clockwise Precision Neon Ring */}
              <motion.div
                className="absolute inset-3 rounded-full border-2 border-transparent border-t-orange-400 border-r-amber-300"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
              />

              {/* Orbital Ring 3: Fast Inner Shimmer Ring */}
              <motion.div
                className="absolute inset-6 rounded-full border border-amber-400/20 border-b-amber-300 border-l-orange-400"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
              />

              {/* Central Glowing Bakery Vault Crest */}
              <motion.div 
                className="relative z-20 w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/30 via-orange-600/20 to-zinc-900/90 border border-amber-400/50 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.45)] backdrop-blur-md"
                animate={{ scale: [0.96, 1.05, 0.96] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              >
                <ShieldCheck size={28} className="text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.8)]" />
              </motion.div>

              {/* Orbiting Golden Light Sparks */}
              {[0, 120, 240].map((angle, i) => (
                <motion.div
                  key={`vault-spark-${angle}-${i}`}
                  className="absolute w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_10px_#F59E0B]"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, delay: i * 0.4, ease: 'linear' }}
                  style={{ transformOrigin: '72px 72px' }}
                />
              ))}
            </div>

            <div className="text-center space-y-2 max-w-[280px] mx-auto z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                <Sparkles size={11} className="animate-pulse text-amber-400" />
                <span>Validating Security Crypt</span>
              </div>
              <h3 className="text-lg font-black text-white tracking-tight">Authenticating Passkey...</h3>
              <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                Connecting securely to the Frosty Bite patisserie vault
              </p>
            </div>
          </motion.div>
        ) : (
          /* =========================================================================
             AWARD-WINNING CELEBRATORY SUCCESS STATE (BEAUTIFUL ANIMATION)
             ========================================================================= */
          <motion.div
            key="otp-success-celebration"
            className="flex-1 flex flex-col justify-between relative z-10 py-3"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={
              animStatus === 'exiting'
                ? { opacity: 0, scale: 0.92, filter: 'blur(8px)' }
                : { opacity: 1, scale: 1 }
            }
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Shimmering Floating Starlight Particles */}
            <div className="absolute inset-0 pointer-events-none">
              {sparkles.map((s) => (
                <motion.div
                  key={`otp-sparkle-item-${s.id}`}
                  className="absolute text-amber-300/80"
                  style={{ top: s.top, left: s.left }}
                  initial={{ scale: 0, rotate: 0 }}
                  animate={{
                    scale: [0, s.scale * 1.2, 0],
                    rotate: [0, 90, 180],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    delay: s.delay,
                  }}
                >
                  <Sparkles size={16} />
                </motion.div>
              ))}
            </div>

            {/* Central Celebration Crest & Medallion */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
              
              {/* Expanding Double Emerald & Gold Radial Corona */}
              <div className="relative flex items-center justify-center">
                {/* Outer Ripple Wave */}
                <motion.div
                  initial={{ scale: 0.7, opacity: 0.8 }}
                  animate={{ scale: [0.8, 2.2], opacity: [0.8, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute w-28 h-28 border-2 border-emerald-400/60 rounded-full"
                />

                {/* Secondary Warm Gold Wave */}
                <motion.div
                  initial={{ scale: 0.7, opacity: 0.6 }}
                  animate={{ scale: [0.8, 1.8], opacity: [0.6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 0.45, ease: 'easeOut' }}
                  className="absolute w-28 h-28 border border-amber-400/50 rounded-full"
                />

                {/* Ambient Deep Emerald Glow Bloom */}
                <div className="absolute w-36 h-36 bg-gradient-to-tr from-emerald-500/30 via-teal-400/25 to-amber-400/20 blur-2xl rounded-full scale-150" />

                {/* 3D Royal Patisserie Master Seal Medallion */}
                <motion.div
                  initial={{ scale: 0.2, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 13, stiffness: 200 }}
                  className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/25 via-zinc-950/90 to-teal-900/30 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_45px_rgba(16,185,129,0.5)] backdrop-blur-md"
                >
                  {/* Decorative Inner Golden Trim */}
                  <div className="absolute inset-1.5 rounded-2xl border border-amber-400/40 pointer-events-none" />

                  {/* Animated Spring SVG Checkmark */}
                  <svg
                    className="w-12 h-12 text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="3.5"
                  >
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.65, delay: 0.25, ease: 'easeOut' }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              </div>

              {/* Title & Welcome Message */}
              <motion.div
                initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-2 z-10"
              >
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest shadow-inner">
                  <Award size={13} className="text-emerald-400" />
                  <span>Passkey Verified • Access Granted</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans">
                  Welcome to Frosty Bite
                </h3>
                <p className="text-zinc-300 text-xs sm:text-sm font-sans leading-relaxed max-w-[280px] mx-auto">
                  Your artisanal bakery session has been authenticated successfully
                </p>
              </motion.div>

              {/* Auto Redirect Countdown Bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="w-full max-w-[240px] mx-auto space-y-1.5 pt-1"
              >
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden p-0.5">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 rounded-full"
                    style={{ width: `${autoRedirectProgress}%` }}
                    transition={{ ease: 'linear' }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 font-mono tracking-wider">
                  Entering patisserie in a moment...
                </p>
              </motion.div>
            </div>

            {/* Shimmering Luxury Continue Button */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65, ease: 'easeOut' }}
              className="pt-4"
            >
              <button
                type="button"
                onClick={handleContinue}
                className="relative w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 shadow-[0_16px_36px_rgba(16,185,129,0.3)] hover:shadow-[0_20px_45px_rgba(16,185,129,0.4)] transition-all duration-300 transform active:scale-95 group overflow-hidden cursor-pointer"
                id="btn_continue_to_patisserie"
              >
                {/* Shiny glass sweep reflection */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                <span>Enter Frosty Bite Now</span>
                <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
