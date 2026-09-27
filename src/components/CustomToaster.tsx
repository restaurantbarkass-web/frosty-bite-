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
      return <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />;
    }
    if (isCoupon) {
      return <Tag className={`w-4 h-4 ${isError ? 'text-rose-600' : 'text-amber-600'}`} />;
    }
    if (isSuccess) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    }
    if (isError) {
      return <XCircle className="w-4 h-4 text-rose-600" />;
    }
    return <Sparkles className="w-4 h-4 text-primary" />;
  };

  // Color theme classes
  const getBorderAndGlow = () => {
    if (isLoading) {
      return 'border-orange-200 bg-white/98 shadow-[0_12px_32px_-8px_rgba(231,106,84,0.25)]';
    }
    if (isSuccess) {
      return 'border-emerald-200 bg-white/98 shadow-[0_12px_32px_-8px_rgba(16,185,129,0.2)]';
    }
    if (isError) {
      return 'border-rose-200 bg-white/98 shadow-[0_12px_32px_-8px_rgba(244,63,94,0.25)]';
    }
    return 'border-amber-200 bg-white/98 shadow-[0_12px_32px_-8px_rgba(245,158,11,0.2)]';
  };

  const getIconBg = () => {
    if (isLoading) return 'bg-orange-50 ring-1 ring-orange-200';
    if (isSuccess) return 'bg-emerald-50 ring-1 ring-emerald-200';
    if (isError) return 'bg-rose-50 ring-1 ring-rose-200';
    return 'bg-amber-50 ring-1 ring-amber-200';
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
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border text-stone-900 font-sans max-w-md w-full sm:w-auto ${getBorderAndGlow()}`}
    >
      {/* Icon Pill */}
      <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${getIconBg()}`}>
        {getIcon()}
      </div>

      {/* Message Content */}
      <div className="flex-1 text-xs font-bold leading-relaxed text-stone-900 pr-1 tracking-wide">
        {resolveValue(t.message, t)}
      </div>

      {/* Dismiss Button */}
      <button
        onClick={() => toast.dismiss(t.id)}
        className="p-1 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors shrink-0"
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
