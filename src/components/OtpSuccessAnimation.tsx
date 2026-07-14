import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

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

// Helper to play premium success chime
const playSuccessChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // High premium chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15); // C6
    
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Harmonious sweet major fifth
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.08); // G5
    osc2.frequency.exponentialRampToValueAtTime(1567.98, now + 0.22); // G6
    
    gain2.gain.setValueAtTime(0.1, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.8);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.9);
  } catch (e) {
    console.warn('AudioContext blocked or not supported:', e);
  }
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
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  const [frostParticles, setFrostParticles] = useState<{ id: number; x: number; y: number; size: number; duration: number; delay: number }[]>([]);
  const [sparkles, setSparkles] = useState<{ id: number; top: string; left: string; scale: number; delay: number }[]>([]);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const otpLength = signInMethod === 'mobile_otp' ? 6 : 8;

  // Initialize random frost particles
  useEffect(() => {
    const particles = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 5 + 3,
      duration: Math.random() * 6 + 5,
      delay: Math.random() * 2,
    }));
    setFrostParticles(particles);

    const sList = Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 60 + 20}%`,
      left: `${Math.random() * 80 + 10}%`,
      scale: Math.random() * 0.6 + 0.5,
      delay: Math.random() * 0.8,
    }));
    setSparkles(sList);
  }, []);

  // Trigger ripple effect sequentially
  const triggerRipple = async () => {
    for (let i = 0; i < otpLength; i++) {
      setRippleIndex(i);
      await new Promise((r) => setTimeout(r, 60));
    }
    setRippleIndex(null);
  };

  const handleInputChange = (val: string, idx: number) => {
    setError(null);
    const cleaned = val.replace(/[^0-9]/g, '');
    const nextArr = [...otpArray];
    nextArr[idx] = cleaned;
    setOtpArray(nextArr);

    // Auto focus next
    if (cleaned !== '' && idx < otpLength - 1) {
      otpRefs.current[idx + 1]?.focus();
      setActiveBox(idx + 1);
    }

    // Check if fully entered
    const isComplete = nextArr.slice(0, otpLength).every((cell) => cell !== '');
    if (isComplete) {
      submitOtpCode(nextArr.slice(0, otpLength).join(''));
    }
  };

  const submitOtpCode = async (code: string) => {
    setAnimStatus('verifying');
    await triggerRipple();
    
    // Pause briefly for glowing effect (400-700ms)
    await new Promise((resolve) => setTimeout(resolve, 550));
    
    setAnimStatus('loading');

    try {
      const res = await onVerify(code);
      setVerificationResult(res);
      
      // Success triggers beautiful checkmark
      setAnimStatus('success');
      playSuccessChime();

      // Trigger Confetti explosion
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.55 },
        colors: ['#FF7A00', '#FFB347', '#22C55E', '#FFFFFF'],
      });

      // Try device haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
    } catch (err: any) {
      console.error('[OTP Verification Error]', err);
      setIsShaking(true);
      setAnimStatus('entering');
      setTimeout(() => setIsShaking(false), 500);
      // Ensure we highlight the active block to input again
      setTimeout(() => {
        otpRefs.current[0]?.focus();
        setActiveBox(0);
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
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
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength);
    if (!pasted) return;

    const nextArr = [...otpArray];
    for (let i = 0; i < otpLength; i++) {
      if (i < pasted.length) {
        nextArr[i] = pasted[i];
      }
    }
    setOtpArray(nextArr);

    const focusIndex = Math.min(pasted.length, otpLength - 1);
    otpRefs.current[focusIndex]?.focus();
    setActiveBox(focusIndex);

    if (nextArr.slice(0, otpLength).every((cell) => cell !== '')) {
      submitOtpCode(nextArr.slice(0, otpLength).join(''));
    }
  };

  const handleContinue = () => {
    if (navigator.vibrate) {
      navigator.vibrate([40, 20, 40]);
    }
    setAnimStatus('exiting');
    setTimeout(() => {
      onSuccessRedirect(verificationResult);
    }, 600);
  };

  return (
    <div className="relative w-full overflow-hidden min-h-[460px] flex flex-col justify-between p-1">
      
      {/* Floating frost particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2rem]">
        {frostParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute bg-sky-200/20 rounded-full blur-[1px]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
            }}
            animate={
              animStatus === 'success'
                ? {
                    y: ['0vh', '40vh'],
                    x: ['0vw', `${(p.id % 2 === 0 ? 1 : -1) * 20}px`],
                    opacity: [0.6, 0.9, 0],
                  }
                : {
                    y: [0, -15, 0],
                    x: [0, 10, 0],
                  }
            }
            transition={{
              duration: animStatus === 'success' ? 5 : p.duration,
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
            key="otp-entry-screen"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-6 flex-1 flex flex-col justify-between"
          >
            {/* Header section with back button */}
            <div className="relative pt-1">
              <button
                type="button"
                onClick={onBack}
                className="absolute left-0 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-center active:scale-95"
                title="Back to previous screen"
              >
                <ArrowLeft size={16} />
              </button>
              
              <div className="space-y-1 text-center">
                <h2 className="text-xl font-bold tracking-tight text-white font-sans">Verify Account</h2>
                <p className="text-zinc-400 text-xs max-w-[260px] mx-auto leading-normal">
                  {signInMethod === 'mobile_otp' ? (
                    <>We've sent a 6-digit WhatsApp verification code to</>
                  ) : (
                    <>We've sent an 8-digit verification code to</>
                  )}
                </p>
                <p className="text-orange-400 text-xs font-black truncate max-w-[280px] mx-auto font-sans mt-0.5">
                  {signInMethod === 'mobile_otp' ? `+${phone.replace(/\D/g, '')}` : email}
                </p>
              </div>
            </div>

            {/* OTP Boxes Grid */}
            <div className="space-y-3 py-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-center block">
                Enter {otpLength}-Digit Code
              </label>

              <div className={`flex justify-center gap-1.5 sm:gap-2 max-w-[340px] mx-auto py-2 ${isShaking ? 'animate-shake' : ''}`}>
                {Array.from({ length: otpLength }).map((_, idx) => {
                  const digit = otpArray[idx] || '';
                  const isFocused = activeBox === idx;
                  const isRippled = rippleIndex === idx;

                  return (
                    <div key={idx} className="relative flex-1 aspect-square max-w-[42px] min-w-[32px]">
                      <input
                        ref={(el) => { otpRefs.current[idx] = el; }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onFocus={() => setActiveBox(idx)}
                        onBlur={() => setActiveBox(null)}
                        onChange={(e) => handleInputChange(e.target.value, idx)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        onPaste={handlePaste}
                        className={`absolute inset-0 w-full h-full text-center bg-white/[0.02] border rounded-xl text-lg font-black font-mono focus:outline-none transition-all select-all duration-200
                          ${isFocused 
                            ? 'border-orange-500 shadow-[0_0_15px_rgba(255,122,0,0.3)] scale-105 text-orange-400' 
                            : 'border-white/10 text-white hover:border-white/20'
                          }
                          ${isRippled ? 'border-orange-400 bg-orange-500/10 scale-110' : ''}
                        `}
                        autoComplete="one-time-code"
                        pattern="\d*"
                        inputMode="numeric"
                        id={`otp_box_${idx}`}
                      />
                      {/* Last digit glow styling requested */}
                      {idx === otpLength - 1 && digit !== '' && animStatus === 'verifying' && (
                        <div className="absolute inset-0 border border-orange-400 rounded-xl animate-pulse shadow-[0_0_15px_rgba(255,122,0,0.6)] pointer-events-none" />
                      )}
                      {digit !== '' && !isFocused && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-orange-500/80 rounded-full blur-[0.5px]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Continue or Trigger verification button */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => submitOtpCode(otpArray.slice(0, otpLength).join(''))}
                disabled={otpArray.slice(0, otpLength).some(d => d === '') || animStatus === 'verifying'}
                className="w-full h-13 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_25px_rgba(249,115,22,0.15)] disabled:opacity-30 disabled:pointer-events-none"
                id="auth_otp_submit"
              >
                {animStatus === 'verifying' ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="font-sans font-black tracking-wide text-xs flex items-center gap-2">
                    <ShieldCheck size={16} />
                    Verify & Proceed
                  </span>
                )}
              </button>

              {/* Cooldown Timer */}
              <div className="flex flex-col items-center justify-center space-y-1.5 py-1 text-[11px]">
                {signInMethod === 'mobile_otp' ? (
                  <>
                    {timerSeconds > 0 ? (
                      <div className="flex items-center gap-1.5 text-zinc-500 font-sans">
                        <span className="w-1.5 h-1.5 bg-orange-500/75 rounded-full animate-ping" />
                        <span>WhatsApp code expires in </span>
                        <span className="text-orange-400 font-mono font-black">
                          {Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:
                          {(timerSeconds % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    ) : (
                      <div className="text-zinc-500">
                        Didn't receive the WhatsApp text?{' '}
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          className="text-orange-500 hover:text-orange-400 font-bold focus:outline-none underline cursor-pointer"
                        >
                          Send Again via WhatsApp
                        </button>
                      </div>
                    )
                    }
                  </>
                ) : (
                  <div className="text-zinc-500">
                    Didn’t receive the email code?{' '}
                    {resendTimer > 0 ? (
                      <span className="text-zinc-400 font-mono font-medium">
                        Resend in {resendTimer}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="text-orange-500 hover:text-orange-400 font-bold focus:outline-none underline cursor-pointer"
                      >
                        Send Again
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : animStatus === 'loading' ? (
          <motion.div
            key="otp-loading-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center py-10 space-y-6"
          >
            {/* Smooth circular rotation loader */}
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/10 blur-2xl rounded-full scale-150 animate-pulse" />
              
              {/* Outer glowing loader ring */}
              <motion.div
                className="w-20 h-20 rounded-full border-4 border-orange-500/10 border-t-orange-500 relative z-10 flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
              />
              
              {/* Inner glowing particle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full animate-ping" />
              </div>
            </div>

            <div className="text-center space-y-1.5 z-10">
              <h3 className="text-md font-bold text-white tracking-wide">Securing Confectionery Link...</h3>
              <p className="text-zinc-400 text-[11px] leading-relaxed max-w-[240px] mx-auto font-sans">
                Verifying secure credentials on the patisserie blockchain database
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="otp-success-screen"
            className="flex-1 flex flex-col justify-between"
            initial={{ opacity: 0 }}
            animate={
              animStatus === 'exiting'
                ? { opacity: 0, scale: 0.93, filter: 'blur(8px)' }
                : { opacity: 1, scale: 1 }
            }
            transition={{ duration: 0.6, ease: [0.645, 0.045, 0.355, 1.0] }}
          >
            {/* Sparkles list rendering */}
            <div className="absolute inset-0 pointer-events-none">
              {sparkles.map((s) => (
                <motion.div
                  key={s.id}
                  className="absolute text-amber-300/40"
                  style={{ top: s.top, left: s.left }}
                  initial={{ scale: 0, rotate: 0 }}
                  animate={{
                    scale: [0, s.scale, 0],
                    rotate: [0, 90, 180],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: s.delay,
                  }}
                >
                  <Sparkles size={12} />
                </motion.div>
              ))}
            </div>

            {/* Checkmark, Mascot & Success messaging container */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-6 pt-4 text-center">
              
              {/* Green checkmark drawn stroke animation */}
              <div className="relative">
                {/* Expanding success ring */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.5 }}
                  animate={{ scale: [0.8, 1.6], opacity: [0.5, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.8, ease: 'easeOut' }}
                  className="absolute inset-0 border-2 border-emerald-500 rounded-full"
                />

                <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full scale-150" />

                {/* Main Checkmark container */}
                <motion.div
                  initial={{ scale: 0.3 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 relative z-10"
                >
                  <svg
                    className="w-8 h-8 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="3.5"
                  >
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              </div>

              {/* TEXT ANIMATION: Fade up, blur to clear, slight scale */}
              <motion.div
                initial={{ opacity: 0, y: 15, filter: 'blur(10px)', scale: 0.95 }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-1 z-10"
              >
                <h3 className="text-xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5">
                  <span className="text-emerald-400">✓</span> Verified Successfully
                </h3>
                <p className="text-zinc-400 text-[11px] font-sans leading-relaxed max-w-[240px] mx-auto">
                  Welcome back to Frosty Bite
                </p>
              </motion.div>

              {/* MASCOT ANIMATION: Cute bakery cupcake mascot appears */}
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.6 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 100, damping: 12, delay: 0.7 }}
                className="relative w-28 h-28 flex items-center justify-center"
              >
                {/* Subtle pulse behind mascot */}
                <div className="absolute w-20 h-20 bg-orange-500/5 rounded-full blur-xl animate-pulse" />

                <svg className="w-24 h-24 drop-shadow-[0_10px_15px_rgba(0,0,0,0.3)]" viewBox="0 0 100 100">
                  {/* Cupcake Wrapper / Base */}
                  <path d="M30 65 L35 85 Q37 88 40 88 L60 88 Q63 88 65 85 L70 65 Z" fill="#FFA858" stroke="#E07C24" strokeWidth="2" />
                  <line x1="40" y1="65" x2="43" y2="88" stroke="#E07C24" strokeWidth="2" />
                  <line x1="50" y1="65" x2="50" y2="88" stroke="#E07C24" strokeWidth="2" />
                  <line x1="60" y1="65" x2="57" y2="88" stroke="#E07C24" strokeWidth="2" />

                  {/* Frosting Base / Swirl */}
                  <path d="M25 65 Q20 55 30 50 Q35 48 40 50 Q45 42 55 45 Q65 40 70 50 Q80 55 75 65 Z" fill="#FFF8F2" stroke="#FF7A00" strokeWidth="2" />
                  {/* Dynamic orange frosting highlight swirl */}
                  <path d="M35 58 Q40 54 50 56 Q60 52 65 58" fill="none" stroke="#FFD54F" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Baker Chef Hat */}
                  <g className="origin-bottom-center">
                    {/* Hat Base band */}
                    <rect x="42" y="27" width="16" height="6" rx="2" fill="#FFFFFF" stroke="#FF7A00" strokeWidth="2" />
                    {/* Hat Puff */}
                    <path d="M38 28 Q34 20 44 18 Q50 14 56 18 Q66 20 62 28 Z" fill="#FFFFFF" stroke="#FF7A00" strokeWidth="2" />
                  </g>

                  {/* Eyes */}
                  <circle cx="42" cy="58" r="3.5" fill="#1A1A1A" />
                  <circle cx="42.5" cy="56.5" r="1.2" fill="#FFFFFF" /> {/* Sparkle */}
                  
                  <circle cx="58" cy="58" r="3.5" fill="#1A1A1A" />
                  <circle cx="58.5" cy="56.5" r="1.2" fill="#FFFFFF" /> {/* Sparkle */}

                  {/* Rosy Cheeks */}
                  <circle cx="37" cy="62" r="3" fill="#FF5E5E" opacity="0.6" />
                  <circle cx="63" cy="62" r="3" fill="#FF5E5E" opacity="0.6" />

                  {/* Smiling Mouth Path */}
                  <path d="M47 62 Q50 65 53 62" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Left hand holding baker tray / cookie */}
                  <circle cx="23" cy="68" r="4" fill="#FFF8F2" stroke="#FF7A00" strokeWidth="2" />
                  
                  {/* Right hand waving */}
                  <motion.g
                    animate={{ rotate: [0, -18, 0, -18, 0] }}
                    transition={{
                      repeat: Infinity,
                      repeatDelay: 1.5,
                      duration: 0.8,
                      delay: 1.0,
                    }}
                    style={{ originX: '77px', originY: '68px' }}
                  >
                    <line x1="77" y1="68" x2="85" y2="60" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="85" cy="60" r="4" fill="#FFF8F2" stroke="#FF7A00" strokeWidth="2" />
                  </motion.g>
                </svg>
              </motion.div>
            </div>

            {/* CONTINUE BUTTON: Premium luxury glass glassmorphic button with gradient background */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9, ease: 'easeOut' }}
              className="pt-2"
            >
              <button
                type="button"
                onClick={handleContinue}
                className="relative w-full h-13 rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2 border border-white/10 hover:border-white/20 shadow-[0_15px_30px_rgba(249,115,22,0.25)] hover:shadow-[0_20px_40px_rgba(249,115,22,0.35)] transition-all duration-300 transform active:scale-95 group overflow-hidden"
              >
                {/* Shiny glass overlay highlight */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                <span>Continue</span>
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                >
                  →
                </motion.span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
