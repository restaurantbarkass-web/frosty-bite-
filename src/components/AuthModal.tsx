import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, User, ShieldCheck, ArrowRight, X, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  title = "Unlock more with an account",
  subtitle = "Create a free account or sign in to sync your activity, save favorites, and track orders across devices."
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleNavigateLogin = (mode: 'signin' | 'signup') => {
    onClose();
    navigate('/login', { state: { defaultMode: mode } });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Card / Bottom Sheet */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full sm:max-w-md bg-zinc-900 border border-white/10 rounded-t-[32px] sm:rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden z-10 text-center"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-b from-orange-500/15 via-primary/10 to-transparent blur-3xl rounded-full pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10"
            id="btn_close_auth_modal"
          >
            <X size={18} />
          </button>

          {/* Icon Header */}
          <div className="relative mx-auto w-16 h-16 bg-gradient-to-br from-orange-500/20 via-primary/20 to-amber-500/10 border border-orange-500/30 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
            <Sparkles className="text-orange-400 animate-pulse" size={28} />
          </div>

          <h3 className="font-sans font-black text-2xl text-white tracking-tight mb-2">
            {title}
          </h3>
          <p className="font-sans text-xs sm:text-sm text-zinc-300 leading-relaxed mb-8 max-w-sm mx-auto">
            {subtitle}
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleNavigateLogin('signup')}
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-primary via-orange-500 to-amber-500 text-white font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-primary/30 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              id="btn_modal_create_account"
            >
              <span>Create Free Account</span>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => handleNavigateLogin('signin')}
              className="w-full h-13 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold text-sm tracking-wide border border-white/10 hover:border-white/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              id="btn_modal_sign_in"
            >
              <Mail size={16} className="text-zinc-300" />
              <span>Sign In with Existing Account</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-3 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer pt-2"
              id="btn_modal_dismiss"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
