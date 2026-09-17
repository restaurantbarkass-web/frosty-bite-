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
            className="w-full max-w-sm bg-white border border-[#EFE8DD] rounded-3xl p-6 shadow-2xl space-y-5 text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-[#2C1810] tracking-tight">
                Leave Payment?
              </h3>
              <p className="text-xs text-[#6B4E3D] leading-relaxed">
                Your payment verification window is currently active. If you already made a payment, leaving will not cancel your payment, but staying lets you see live confirmation instantly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={onStay}
                className="flex-1 py-3 px-4 bg-[#2C1810] hover:bg-[#3E2415] text-[#FFF9EE] font-black uppercase tracking-widest text-xs rounded-xl shadow-md transition-all text-center active:scale-95"
              >
                Stay & Verify
              </button>
              <button
                onClick={onLeave}
                className="py-3 px-4 bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#EFE8DD] text-[#5A3D2D] hover:text-[#2C1810] font-black uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95"
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
