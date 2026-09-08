import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface PaymentLeaveModalProps {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export const PaymentLeaveModal: React.FC<PaymentLeaveModalProps> = ({
  isOpen,
  onStay,
  onLeave
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 text-center"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 10 }}
            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5 text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white italic uppercase tracking-tight">
                Leave Payment?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your payment verification window is currently active. If you already made a payment, leaving will not cancel your payment, but staying lets you see live confirmation instantly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={onStay}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all text-center"
              >
                Stay & Verify
              </button>
              <button
                onClick={onLeave}
                className="py-3 px-4 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={14} />
                <span>Leave</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
