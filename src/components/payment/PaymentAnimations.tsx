import React from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  HelpCircle,
  Lock,
  Smartphone
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AnimationProps {
  amount?: number;
  onRetry?: () => void;
  onViewOrder?: () => void;
  onRestartPayment?: () => void;
  reducedMotion?: boolean;
}

// 1. WAITING FOR PAYMENT ANIMATION
export const PaymentWaitingAnimation: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  return (
    <div className="relative flex items-center justify-center w-36 h-36 mx-auto my-4">
      {/* Outer pulsing ring */}
      {!reducedMotion && (
        <>
          <motion.div
            animate={{ scale: [1, 1.35, 1], opacity: [0.15, 0.4, 0.15] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-emerald-500/20 border border-emerald-500/30"
          />
          <motion.div
            animate={{ scale: [1.1, 1.5, 1.1], opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
            className="absolute inset-0 rounded-full bg-cyan-500/20 border border-cyan-500/30"
          />
          {/* Rotating scanner ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-2 rounded-full border-2 border-dashed border-emerald-500/40"
          />
        </>
      )}

      {/* Center glowing core */}
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 backdrop-blur-md border border-emerald-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.25)]">
        <motion.div
          animate={reducedMotion ? {} : { scale: [0.95, 1.08, 0.95] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center justify-center"
        >
          <Smartphone className="w-10 h-10 text-emerald-400" />
        </motion.div>
      </div>
    </div>
  );
};

// 2. PAYMENT DETECTED ANIMATION
export const PaymentDetectedAnimation: React.FC<{ amount?: number; reducedMotion?: boolean }> = ({ amount, reducedMotion }) => {
  return (
    <div className="relative flex items-center justify-center w-36 h-36 mx-auto my-4">
      {!reducedMotion && (
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full bg-amber-500/20 border border-amber-500/40"
        />
      )}
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-md border border-amber-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)]">
        <motion.div
          animate={reducedMotion ? {} : { rotate: [0, 15, -15, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <Sparkles className="w-10 h-10 text-amber-400" />
        </motion.div>
      </div>
    </div>
  );
};

// 3. PAYMENT VERIFYING ANIMATION
export const PaymentVerifyingAnimation: React.FC<{ reducedMotion?: boolean }> = ({ reducedMotion }) => {
  return (
    <div className="relative flex items-center justify-center w-36 h-36 mx-auto my-4">
      {!reducedMotion && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 border-r-cyan-500"
        />
      )}
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-md border border-emerald-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
        <motion.div
          animate={reducedMotion ? {} : { scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ShieldCheck className="w-10 h-10 text-emerald-400" />
        </motion.div>
      </div>
    </div>
  );
};

// 4. PAYMENT SUCCESS ANIMATION
export const PaymentSuccessAnimation: React.FC<{ amount?: number; onViewOrder?: () => void; reducedMotion?: boolean }> = ({ 
  amount, 
  onViewOrder,
  reducedMotion 
}) => {
  React.useEffect(() => {
    if (!reducedMotion) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10B981', '#06B6D4', '#3B82F6', '#F59E0B']
        });
      } catch (e) {}
    }
  }, [reducedMotion]);

  return (
    <div className="space-y-6 text-center">
      <div className="relative flex items-center justify-center w-40 h-40 mx-auto">
        {/* Glow circle expansion */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.8, 1.25, 1.05], opacity: [0, 0.6, 0.4] }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full bg-emerald-500/25 border-2 border-emerald-400/40 shadow-[0_0_50px_rgba(16,185,129,0.4)]"
        />

        {/* Checkmark drawing container */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 }}
          className="relative w-28 h-28 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.5)] border-2 border-emerald-300/40"
        >
          <svg className="w-16 h-16 text-white" viewBox="0 0 52 52" fill="none">
            <motion.path
              fill="none"
              strokeWidth="5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 27l7 7 17-17"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35, ease: 'easeInOut' }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="space-y-2"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-widest">
          <CheckCircle2 size={14} /> Instant Verification Complete
        </div>
        <h3 className="text-3xl font-black text-white italic uppercase tracking-tight">
          Payment Verified <span className="text-emerald-400">✓</span>
        </h3>
        {amount !== undefined && (
          <p className="text-2xl font-black text-emerald-400">₹{amount.toFixed(2)}</p>
        )}
        <p className="text-xs text-zinc-400 font-medium max-w-xs mx-auto">
          Your payment was received successfully. Your order is confirmed and being prepared!
        </p>
      </motion.div>

      {onViewOrder && (
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          onClick={onViewOrder}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-600/20 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
        >
          <ShieldCheck size={18} />
          <span>View Order Details</span>
        </motion.button>
      )}
    </div>
  );
};

// 5. PAYMENT EXPIRED ANIMATION
export const PaymentExpiredAnimation: React.FC<AnimationProps> = ({ onRestartPayment, onRetry }) => {
  return (
    <div className="space-y-6 text-center">
      <div className="relative flex items-center justify-center w-32 h-32 mx-auto">
        <div className="w-24 h-24 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
          <Clock className="w-12 h-12 text-rose-400" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-widest">
          Window Expired
        </div>
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">
          Payment Window Expired
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
          Your 6-minute payment verification window has ended. If you already made the payment, tap retry to verify.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="py-3.5 px-4 bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            Check Payment Again
          </button>
        )}
        {onRestartPayment && (
          <button
            onClick={onRestartPayment}
            className="py-3.5 px-4 bg-primary hover:bg-primary-hover text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            Try Payment Again
          </button>
        )}
      </div>
    </div>
  );
};

// 6. PAYMENT NOT MATCHED / AMBIGUOUS
export const PaymentAmbiguousAnimation: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <div className="space-y-6 text-center">
      <div className="relative flex items-center justify-center w-32 h-32 mx-auto">
        <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <HelpCircle className="w-12 h-12 text-amber-400" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest">
          Manual Check Required
        </div>
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">
          Payment Received
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
          We received a payment notification, but we need a little more time to confirm your exact order.
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full py-3.5 px-4 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black uppercase tracking-widest rounded-xl text-xs transition-all hover:bg-amber-500/30 flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} />
          Retry Auto-Verification
        </button>
      )}
    </div>
  );
};

// 7. PAYMENT ERROR ANIMATION
export const PaymentErrorAnimation: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <div className="space-y-6 text-center">
      <div className="relative flex items-center justify-center w-32 h-32 mx-auto">
        <div className="w-24 h-24 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-rose-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-black text-white italic uppercase tracking-tight">
          Connection Issue
        </h3>
        <p className="text-xs text-zinc-400 max-w-xs mx-auto">
          We're having trouble checking your payment status right now. Don't worry, your payment attempt is still active.
        </p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full py-3.5 px-4 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest rounded-xl text-xs transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} />
          Retry Connection
        </button>
      )}
    </div>
  );
};
