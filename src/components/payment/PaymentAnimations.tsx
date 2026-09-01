import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  HelpCircle,
  Smartphone,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AnimationProps {
  amount?: number;
  onRetry?: () => void;
  onViewOrder?: () => void;
  onRestartPayment?: () => void;
  onBackToCheckout?: () => void;
  reducedMotion?: boolean;
}

// 1. WAITING FOR PAYMENT ANIMATION
export const PaymentWaitingAnimation: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-36 sm:h-36 mx-auto my-2">
      {/* Subtle pulsing rings */}
      {!reducedMotion && (
        <>
          <motion.div
            animate={{ scale: [1, 1.35, 1], opacity: [0.12, 0.35, 0.12] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-emerald-500/20 border border-emerald-500/30"
          />
          <motion.div
            animate={{ scale: [1.1, 1.5, 1.1], opacity: [0.08, 0.22, 0.08] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            className="absolute inset-0 rounded-full bg-cyan-500/20 border border-cyan-500/30"
          />
          {/* Subtle rotating dash border */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-1 rounded-full border border-dashed border-emerald-500/30"
          />
        </>
      )}

      {/* Center glowing device badge */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-zinc-900/80 backdrop-blur-md border border-emerald-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)]">
        <motion.div
          animate={reducedMotion ? {} : { scale: [0.96, 1.04, 0.96] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center justify-center text-emerald-400"
        >
          <Smartphone className="w-8 h-8 sm:w-10 sm:h-10" />
        </motion.div>
      </div>
    </div>
  );
};

// 2. PAYMENT DETECTED ANIMATION
export const PaymentDetectedAnimation: React.FC<{ amount?: number; reducedMotion?: boolean }> = ({ amount, reducedMotion }) => {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-36 sm:h-36 mx-auto my-2">
      {!reducedMotion && (
        <motion.div
          animate={{ scale: [1, 1.35, 1], opacity: [0.25, 0.6, 0.25] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-amber-500/20 border border-amber-500/40"
        />
      )}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 backdrop-blur-md border border-amber-500/40 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.25)]">
        <motion.div
          animate={reducedMotion ? {} : { rotate: [0, 12, -12, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-amber-400"
        >
          <Sparkles className="w-8 h-8 sm:w-10 sm:h-10" />
        </motion.div>
      </div>
    </div>
  );
};

// 3. PAYMENT VERIFYING ANIMATION
export const PaymentVerifyingAnimation: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-36 sm:h-36 mx-auto my-2">
      {!reducedMotion && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 border-r-cyan-400"
        />
      )}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 backdrop-blur-md border border-emerald-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.25)]">
        <motion.div
          animate={reducedMotion ? {} : { scale: [0.94, 1.06, 0.94] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="text-emerald-400"
        >
          <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10" />
        </motion.div>
      </div>
    </div>
  );
};

// 4. PAYMENT SUCCESS ANIMATION
export const PaymentSuccessAnimation: React.FC<{ 
  amount?: number; 
  onViewOrder?: () => void; 
  reducedMotion?: boolean;
}> = ({ 
  amount, 
  onViewOrder,
  reducedMotion 
}) => {
  useEffect(() => {
    if (!reducedMotion) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.55 },
          colors: ['#10B981', '#34D399', '#06B6D4', '#FBBF24']
        });
      } catch (e) {}
    }
  }, [reducedMotion]);

  return (
    <div className="space-y-6 text-center py-2">
      <div className="relative flex items-center justify-center w-36 h-36 sm:w-40 sm:h-40 mx-auto">
        {/* Soft Glow expansion */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.8, 1.2, 1.05], opacity: [0, 0.5, 0.35] }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full bg-emerald-500/20 border border-emerald-400/30 shadow-[0_0_50px_rgba(16,185,129,0.35)]"
        />

        {/* Checkmark drawing container */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 }}
          className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.4)] border-2 border-emerald-300/40"
        >
          <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" viewBox="0 0 52 52" fill="none">
            <motion.path
              fill="none"
              strokeWidth="5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 27l7 7 17-17"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease: 'easeInOut' }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="space-y-2"
      >
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest">
          <CheckCircle2 size={13} />
          <span>Payment Verified</span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tight">
          Payment Verified
        </h3>

        {amount !== undefined && (
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight font-mono">
            ₹{amount.toFixed(2)}
          </p>
        )}

        <p className="text-xs sm:text-sm text-zinc-300 font-medium max-w-xs mx-auto leading-relaxed">
          Your payment was received successfully. Order confirmed.
        </p>
      </motion.div>

      {onViewOrder && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="pt-2"
        >
          <button
            onClick={onViewOrder}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-95 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} />
            <span>View Order</span>
            <ArrowRight size={16} />
          </button>
        </motion.div>
      )}
    </div>
  );
};

// 5. PAYMENT EXPIRED ANIMATION
export const PaymentExpiredAnimation: React.FC<AnimationProps> = ({ 
  onRestartPayment, 
  onBackToCheckout,
  onRetry 
}) => {
  return (
    <div className="space-y-5 text-center py-2">
      <div className="relative flex items-center justify-center w-28 h-28 mx-auto">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <Clock className="w-10 h-10" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-widest">
          Window Expired
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">
          Payment Window Expired
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
          Your payment verification window has ended.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
        {onRestartPayment && (
          <button
            onClick={onRestartPayment}
            className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <RefreshCw size={14} />
            <span>Try Payment Again</span>
          </button>
        )}
        {onBackToCheckout && (
          <button
            onClick={onBackToCheckout}
            className="py-3.5 px-4 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ArrowLeft size={14} />
            <span>Back to Checkout</span>
          </button>
        )}
        {onRetry && !onBackToCheckout && (
          <button
            onClick={onRetry}
            className="py-3.5 px-4 bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            <span>Check Status</span>
          </button>
        )}
      </div>
    </div>
  );
};

// 6. PAYMENT AMBIGUOUS ANIMATION
export const PaymentAmbiguousAnimation: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <div className="space-y-5 text-center py-2">
      <div className="relative flex items-center justify-center w-28 h-28 mx-auto">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <HelpCircle className="w-10 h-10" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest">
          Verification Pending
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">
          Payment received
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
          We're verifying your payment.
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full py-3.5 px-4 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black uppercase tracking-widest rounded-xl text-xs transition-all hover:bg-amber-500/30 flex items-center justify-center gap-2 active:scale-95"
        >
          <RefreshCw size={14} />
          <span>Check Again</span>
        </button>
      )}
    </div>
  );
};

// 7. PAYMENT ERROR ANIMATION (Terminal or Serious issue)
export const PaymentErrorAnimation: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <div className="space-y-5 text-center py-2">
      <div className="relative flex items-center justify-center w-28 h-28 mx-auto">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
          <AlertTriangle className="w-10 h-10" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-black text-white italic uppercase tracking-tight">
          Unable to Load Session
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
          We're having trouble connecting to the payment server. Please try again.
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full py-3.5 px-4 bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <RefreshCw size={14} />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

