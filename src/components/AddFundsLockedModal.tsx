import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Lock, X, Hammer, Clock } from 'lucide-react';

interface AddFundsLockedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddFundsLockedModal: React.FC<AddFundsLockedModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal panel container */}
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 15, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-[2.5rem] p-8 text-white overflow-hidden shadow-2xl shadow-orange-500/5 text-center"
        >
          {/* Top orange ambient light/border */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400 opacity-80" />
          <div className="absolute top-0 left-12 right-12 h-20 bg-orange-500/10 blur-3xl rounded-full" />

          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative z-10 flex flex-col items-center py-4">
            {/* Animated Under Construction Icon Badge */}
            <motion.div 
              initial={{ rotate: -10 }}
              animate={{ rotate: 10 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 2, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-primary mb-6 animate-pulse"
            >
              <CreditCard className="w-8 h-8 text-orange-500" />
            </motion.div>

            {/* Title / Badge status */}
            <span className="text-[10px] bg-red-500/10 text-rose-400 border border-red-500/20 px-3 py-1 rounded-full uppercase font-black tracking-widest leading-none mb-3 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Gateway Locked
            </span>
            <h3 className="text-2xl font-black tracking-tight leading-none mb-4">ADD WALLET FUNDS</h3>

            {/* Inner info container */}
            <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl mb-6 w-full space-y-4">
              <div className="flex items-center gap-2 justify-center text-amber-500/80">
                <Hammer className="w-4 h-4 animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider">Under Construction</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans font-medium">
                The actual payment gateway integration (UPI, NetBanking, Credit/Debit cards via Razorpay/Stripe) is securely locked under development. Adding real-world funds to your bite wallet is under construction and coming soon!
              </p>
              <div className="pt-2 flex items-center justify-center gap-1.5 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                <Clock className="w-3.5 h-3.5" /> Coming Soon to Your Wallet
              </div>
            </div>

            {/* Return action button */}
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-primary hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/15"
            >
              Understand, Go Back
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
