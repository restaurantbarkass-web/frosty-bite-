import React, { useEffect } from 'react';
import { Toaster, toast, resolveValue, Toast } from 'react-hot-toast';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Sparkles,
  Tag
} from 'lucide-react';
import { playSuccessChime, playErrorShakeSound, playPopSound } from '../utils/soundEffects';

interface CustomToastProps {
  t: Toast;
}

const CustomToast: React.FC<CustomToastProps> = ({ t }) => {
  // Play appropriate sound effect on toast spawn
  useEffect(() => {
    if (t.visible) {
      if (t.type === 'success') {
        playSuccessChime();
      } else if (t.type === 'error') {
        playErrorShakeSound();
      } else {
        playPopSound();
      }
    }
  }, [t.id, t.type, t.visible]);

  const isError = t.type === 'error';
  const isSuccess = t.type === 'success';
  const isLoading = t.type === 'loading';
  const msgText = typeof t.message === 'string' ? t.message : '';
  const isCoupon = msgText.toLowerCase().includes('coupon') || msgText.toLowerCase().includes('offer');

  // Custom icon selection
  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />;
    }
    if (isCoupon) {
      return <Tag className={`w-4 h-4 ${isError ? 'text-rose-400' : 'text-amber-400'}`} />;
    }
    if (isSuccess) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
    if (isError) {
      return <XCircle className="w-4 h-4 text-rose-400" />;
    }
    return <Sparkles className="w-4 h-4 text-orange-400" />;
  };

  // Color theme classes
  const getBorderAndGlow = () => {
    if (isLoading) {
      return 'border-orange-500/30 bg-[#121118]/95 shadow-[0_12px_32px_-8px_rgba(249,115,22,0.3)]';
    }
    if (isSuccess) {
      return 'border-emerald-500/30 bg-[#0c1812]/95 shadow-[0_12px_32px_-8px_rgba(34,197,94,0.3)]';
    }
    if (isError) {
      return 'border-rose-500/30 bg-[#1a0a0d]/95 shadow-[0_12px_32px_-8px_rgba(244,63,94,0.35)]';
    }
    return 'border-amber-500/30 bg-[#18140c]/95 shadow-[0_12px_32px_-8px_rgba(245,158,11,0.3)]';
  };

  const getIconBg = () => {
    if (isLoading) return 'bg-orange-500/20 ring-1 ring-orange-500/40';
    if (isSuccess) return 'bg-emerald-500/20 ring-1 ring-emerald-500/40';
    if (isError) return 'bg-rose-500/20 ring-1 ring-rose-500/40';
    return 'bg-amber-500/20 ring-1 ring-amber-500/40';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.85 }}
      animate={{
        opacity: t.visible ? 1 : 0,
        y: t.visible ? 0 : -16,
        scale: t.visible ? 1 : 0.9,
      }}
      exit={{ opacity: 0, y: -20, scale: 0.85 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 380,
      }}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl text-white font-sans max-w-md w-full sm:w-auto ${getBorderAndGlow()}`}
    >
      {/* Icon Pill */}
      <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${getIconBg()}`}>
        {getIcon()}
      </div>

      {/* Message Content */}
      <div className="flex-1 text-xs font-bold leading-relaxed text-zinc-100 pr-1 tracking-wide">
        {resolveValue(t.message, t)}
      </div>

      {/* Dismiss Button */}
      <button
        onClick={() => toast.dismiss(t.id)}
        className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

export const CustomToaster: React.FC = () => {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3500,
      }}
      containerStyle={{
        top: 24,
        left: 16,
        right: 16,
        zIndex: 99999,
      }}
    >
      {(t) => <CustomToast t={t} />}
    </Toaster>
  );
};
