import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowLeft, ShieldCheck, Sparkles, Mail, Phone, RefreshCw, Edit3, Lock, AlertCircle, ArrowRight, Clock, HelpCircle, ChevronDown, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

interface OtpSuccessAnimationProps {
  otpArray: string[];
  setOtpArray: (otp: string[]) => void;
  signInMethod: 'password' | 'otp' | 'mobile_otp';
  email: string;
  phone: string;
  error: string | null;
  setError: (err: string | null) => void;
  onVerify: (otpCode: string) => Promise<any>;
  onSuccessRedirect: (result: any) => void;
  onBack: () => void;
  timerSeconds: number;
  resendTimer: number;
  handleResendOtp: () => void;
}

type AnimStatus = 'entering' | 'verifying' | 'loading' | 'success' | 'exiting';

// Web Audio API Sound Synthesizer for High-End Micro-Interactions
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

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
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
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showTips, setShowTips] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const otpLength = 6;

  // Floating ambient golden/champagne confectioner's dust particles
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; duration: number; delay: number }[]>([]);
  const [sparkles, setSparkles] = useState<{ id: number; top: string; left: string; scale: number; delay: number }[]>([]);

  useEffect(() => {
    const pList = Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 3,
    }));
    setParticles(pList);

    const sList = Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 70 + 15}%`,
      left: `${Math.random() * 80 + 10}%`,
      scale: Math.random() * 0.5 + 0.6,
      delay: Math.random() * 1.5,
    }));
    setSparkles(sList);
  }, []);

  // Focus on the first empty box on mount
  useEffect(() => {
    const firstEmptyIndex = otpArray.findIndex(digit => digit === '');
    const targetIdx = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
    setTimeout(() => {
      otpRefs.current[targetIdx]?.focus();
      setActiveBox(targetIdx);
    }, 150);
  }, []);

  // Trigger optical ripple wave across slots
  const triggerRippleSequence = useCallback(async () => {
    for (let i = 0; i < otpLength; i++) {
      setRippleIndex(i);
      await new Promise((r) => setTimeout(r, 45));
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
    
    // Aesthetic morphing pause for high-end micro-interaction
    await new Promise((resolve) => setTimeout(resolve, 380));
    setAnimStatus('loading');

    try {
      const res = await onVerify(code);
      setVerificationResult(res);

      // Transition to award-winning celebratory success state
      setAnimStatus('success');
      playSuccessChime();

      // Confetti burst
      confetti({
        particleCount: 110,
        spread: 75,
        origin: { y: 0.55 },
        colors: ['#F59E0B', '#F97316', '#10B981', '#FDE68A', '#FFFFFF', '#FB923C'],
        ticks: 240,
        gravity: 0.9,
      });

      // Mobile Haptic Feedback
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate([40, 30, 40]);
        }
      } catch (_) {}

    } catch (err: any) {
      console.error('[GodLevelOtp] Verification Failed:', err);
      playErrorThump();
      setIsShaking(true);
      setHasError(true);
      setIsErrorModalOpen(true);
      setAnimStatus('entering');
      setIsSubmitting(false);

      const errorMessage = err?.message || 'Incorrect verification code. Please check your email and try again.';
      setError(errorMessage);
      toast.error(errorMessage, { id: 'otp-error-toast' });

      setTimeout(() => setIsShaking(false), 550);
      setTimeout(() => {
        // Refocus on the first input for frictionless retry
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
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength);
    if (!pasted) return;

    playKeypressTick();
    const nextArr = [...otpArray];
    for (let i = 0; i < otpLength; i++) {
      nextArr[i] = pasted[i] || '';
    }
    setOtpArray(nextArr);

    const focusIndex = Math.min(pasted.length, otpLength - 1);
    otpRefs.current[focusIndex]?.focus();
    setActiveBox(focusIndex);

    if (nextArr.slice(0, otpLength).every((cell) => cell !== '')) {
      submitOtpCode(nextArr.slice(0, otpLength).join(''));
    }
  };

  const handleClearAndRetry = () => {
    setIsErrorModalOpen(false);
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
    }, 500);
  };

  const isEmail = signInMethod !== 'mobile_otp';
  const targetRecipient = isEmail ? email : `+91 ${phone}`;
  const currentCooldown = isEmail ? resendTimer : timerSeconds;

  return (
    <div className="relative w-full overflow-hidden min-h-[480px] flex flex-col justify-between p-1 select-none">
      
      {/* Ambient Bokeh and Confectioner's Shimmer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.5rem]">
        {particles.map((p) => (
          <motion.div
            key={p.id}
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
                title="Back to email screen"
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
                  {isEmail ? 'We dispatched a 6-digit recipe code to' : 'We dispatched a 6-digit WhatsApp code to'}
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

            {/* Error Message banner with physics shake */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 text-left max-w-[340px] mx-auto w-full"
                id="otp_error_banner"
              >
                <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </motion.div>
            )}

            {/* 6-Digit Luxury Passkey Grid */}
            <div className="space-y-3 py-2">
              <div className="flex justify-between items-center max-w-[340px] mx-auto px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  6-Digit Passkey
                </span>
                <span className="text-[10px] font-medium text-zinc-500 font-mono">
                  {otpArray.slice(0, otpLength).filter(Boolean).length}/{otpLength}
                </span>
              </div>

              <div 
                className={`flex justify-center gap-2 sm:gap-2.5 max-w-[340px] mx-auto py-1 ${
                  isShaking ? 'animate-[shake_0.5s_cubic-bezier(.36,.07,.19,.97)_both]' : ''
                }`}
              >
                {Array.from({ length: otpLength }).map((_, idx) => {
                  const digit = otpArray[idx] || '';
                  const isFocused = activeBox === idx;
                  const isRippled = rippleIndex === idx;
                  const isFilled = digit !== '';
                  const isSlotError = hasError || !!error;

                  return (
                    <div 
                      key={idx} 
                      className="relative flex-1 aspect-square max-w-[48px] min-w-[38px] h-14 sm:h-16"
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
                        className={`absolute inset-0 w-full h-full text-center border rounded-2xl text-xl sm:text-2xl font-black font-mono focus:outline-none transition-all select-all duration-200 cursor-text
                          ${isSlotError
                            ? 'border-red-500 bg-red-500/10 text-red-400 ring-2 ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
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
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-red-500 rounded-full blur-[0.4px]" />
                      ) : isFilled && !isFocused ? (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-[2px] bg-amber-400/90 rounded-full blur-[0.4px]" />
                      ) : null}

                      {/* Last digit ripple pulse indicator */}
                      {idx === otpLength - 1 && isFilled && animStatus === 'verifying' && (
                        <div className="absolute inset-0 border-2 border-amber-400 rounded-2xl animate-ping pointer-events-none" />
                      )}
                    </div>
                  );
                })}
              </div>
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

                {/* Helpful Delivery Tip Accordion */}
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
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-2"
                      >
                        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-[10px] text-zinc-400 space-y-1.5 text-left max-w-[320px] mx-auto leading-relaxed">
                          <p>• Check your <strong>Spam</strong> or <strong>Promotions</strong> folder.</p>
                          <p>• Verification emails are sent instantly from <strong>auth@frostybite.com</strong>.</p>
                          <p>• If you mistyped your address, tap <strong>Edit</strong> above to fix it.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        ) : animStatus === 'loading' ? (
          <motion.div
            key="otp-loading-confectionery"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col items-center justify-center py-12 space-y-7 relative z-10"
          >
            {/* Morphing Dual-Orbital Confectionery Loader */}
            <div className="relative">
              {/* Outer soft ambient glow */}
              <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full scale-150 animate-pulse" />

              {/* Counter-rotating orbital rings */}
              <motion.div
                className="w-24 h-24 rounded-full border-2 border-amber-500/10 border-t-amber-400 border-r-amber-400/50 relative z-10 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.25)]"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.3, ease: 'linear' }}
              />

              <motion.div
                className="absolute inset-2 rounded-full border-2 border-orange-500/10 border-b-orange-400 border-l-orange-400/40 z-10"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
              />

              {/* Central glowing patisserie crest icon */}
              <div className="absolute inset-0 m-auto w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/40 flex items-center justify-center z-20 shadow-inner">
                <Lock size={18} className="text-amber-300 animate-pulse" />
              </div>
            </div>

            <div className="text-center space-y-2 max-w-[260px] mx-auto z-10">
              <h3 className="text-lg font-black text-white tracking-tight">Authenticating Passkey...</h3>
              <p className="text-zinc-400 text-xs leading-relaxed font-sans">
                Verifying your cryptographic credentials with the Frosty Bite patisserie vault
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="otp-success-celebration"
            className="flex-1 flex flex-col justify-between relative z-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={
              animStatus === 'exiting'
                ? { opacity: 0, scale: 0.92, filter: 'blur(8px)' }
                : { opacity: 1, scale: 1 }
            }
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Shimmering Sparkles Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {sparkles.map((s) => (
                <motion.div
                  key={s.id}
                  className="absolute text-amber-300/60"
                  style={{ top: s.top, left: s.left }}
                  initial={{ scale: 0, rotate: 0 }}
                  animate={{
                    scale: [0, s.scale, 0],
                    rotate: [0, 90, 180],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    delay: s.delay,
                  }}
                >
                  <Sparkles size={14} />
                </motion.div>
              ))}
            </div>

            {/* Checkmark, Mascot & Congratulations */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 pt-2 text-center">
              
              {/* Expanding Golden/Emerald Halo Ring */}
              <div className="relative">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.7 }}
                  animate={{ scale: [0.8, 1.8], opacity: [0.7, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.5, ease: 'easeOut' }}
                  className="absolute inset-0 border-2 border-emerald-400 rounded-full"
                />

                <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full scale-150" />

                {/* Animated SVG Checkmark */}
                <motion.div
                  initial={{ scale: 0.2, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                  className="w-18 h-18 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-emerald-600/15 to-teal-500/10 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 relative z-10 shadow-[0_0_35px_rgba(16,185,129,0.35)]"
                >
                  <svg
                    className="w-9 h-9 text-emerald-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="3.5"
                  >
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              </div>

              {/* Verified Title & Welcome Subtitle */}
              <motion.div
                initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-1.5 z-10"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest">
                  <span>Passkey Verified</span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white">
                  Welcome to Frosty Bite
                </h3>
                <p className="text-zinc-400 text-xs font-sans leading-relaxed max-w-[250px] mx-auto">
                  Your confectionery session has been securely established
                </p>
              </motion.div>

              {/* Animated Frosty Bite Pastry Chef Mascot */}
              <motion.div
                initial={{ opacity: 0, y: 25, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 13, delay: 0.55 }}
                className="relative w-28 h-28 flex items-center justify-center"
              >
                <div className="absolute w-20 h-20 bg-amber-500/10 rounded-full blur-xl animate-pulse" />

                <svg className="w-24 h-24 drop-shadow-[0_12px_20px_rgba(0,0,0,0.4)]" viewBox="0 0 100 100">
                  {/* Cupcake Wrapper / Base */}
                  <path d="M30 65 L35 85 Q37 88 40 88 L60 88 Q63 88 65 85 L70 65 Z" fill="#FFA858" stroke="#E07C24" strokeWidth="2" />
                  <line x1="40" y1="65" x2="43" y2="88" stroke="#E07C24" strokeWidth="2" />
                  <line x1="50" y1="65" x2="50" y2="88" stroke="#E07C24" strokeWidth="2" />
                  <line x1="60" y1="65" x2="57" y2="88" stroke="#E07C24" strokeWidth="2" />

                  {/* Frosting Swirl */}
                  <path d="M25 65 Q20 55 30 50 Q35 48 40 50 Q45 42 55 45 Q65 40 70 50 Q80 55 75 65 Z" fill="#FFF8F2" stroke="#FF7A00" strokeWidth="2" />
                  <path d="M35 58 Q40 54 50 56 Q60 52 65 58" fill="none" stroke="#FFD54F" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Baker Chef Hat */}
                  <g className="origin-bottom-center">
                    <rect x="42" y="27" width="16" height="6" rx="2" fill="#FFFFFF" stroke="#FF7A00" strokeWidth="2" />
                    <path d="M38 28 Q34 20 44 18 Q50 14 56 18 Q66 20 62 28 Z" fill="#FFFFFF" stroke="#FF7A00" strokeWidth="2" />
                  </g>

                  {/* Sparkling Eyes */}
                  <circle cx="42" cy="58" r="3.5" fill="#1A1A1A" />
                  <circle cx="42.5" cy="56.5" r="1.2" fill="#FFFFFF" />
                  
                  <circle cx="58" cy="58" r="3.5" fill="#1A1A1A" />
                  <circle cx="58.5" cy="56.5" r="1.2" fill="#FFFFFF" />

                  {/* Cheeks */}
                  <circle cx="37" cy="62" r="3" fill="#FF5E5E" opacity="0.6" />
                  <circle cx="63" cy="62" r="3" fill="#FF5E5E" opacity="0.6" />

                  {/* Smile */}
                  <path d="M47 62 Q50 65 53 62" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Left hand */}
                  <circle cx="23" cy="68" r="4" fill="#FFF8F2" stroke="#FF7A00" strokeWidth="2" />
                  
                  {/* Right hand waving */}
                  <motion.g
                    animate={{ rotate: [0, -22, 0, -22, 0] }}
                    transition={{
                      repeat: Infinity,
                      repeatDelay: 1.2,
                      duration: 0.8,
                      delay: 0.8,
                    }}
                    style={{ originX: '77px', originY: '68px' }}
                  >
                    <line x1="77" y1="68" x2="85" y2="60" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="85" cy="60" r="4" fill="#FFF8F2" stroke="#FF7A00" strokeWidth="2" />
                  </motion.g>
                </svg>
              </motion.div>
            </div>

            {/* Shimmering Luxury Continue Button */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8, ease: 'easeOut' }}
              className="pt-3"
            >
              <button
                type="button"
                onClick={handleContinue}
                className="relative w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 shadow-[0_16px_36px_rgba(16,185,129,0.3)] hover:shadow-[0_20px_45px_rgba(16,185,129,0.4)] transition-all duration-300 transform active:scale-95 group overflow-hidden cursor-pointer"
                id="btn_continue_to_patisserie"
              >
                {/* Shiny glass sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                <span>Enter Frosty Bite</span>
                <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incorrect OTP Error Popup Modal */}
      <AnimatePresence>
        {isErrorModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setIsErrorModalOpen(false)}
            id="otp_error_modal_backdrop"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-red-500/30 p-6 text-center shadow-[0_0_50px_rgba(239,68,68,0.25)] relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              id="otp_error_modal"
            >
              {/* Ambient Top Glow */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-24 bg-red-500/20 blur-3xl pointer-events-none" />

              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <AlertCircle size={32} className="animate-pulse" />
              </div>

              <h3 className="text-lg font-black text-white tracking-tight mb-2">
                Incorrect Verification Code
              </h3>

              <p className="text-xs text-zinc-300 leading-relaxed mb-6">
                {error || 'The 6-digit verification code you entered is invalid or has expired. Please check your email and try again.'}
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleClearAndRetry}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                  id="btn_retry_otp"
                >
                  <RefreshCw size={14} />
                  <span>Clear & Try Again</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsErrorModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-medium text-xs transition-colors cursor-pointer"
                  id="btn_dismiss_otp_error"
                >
                  Close & Review Code
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
