import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, MessageSquare, X, ExternalLink, ShieldCheck } from 'lucide-react';
import { Order } from '../../types';
import { normalizePhoneNumber, openCancellationWhatsApp } from '../../utils/whatsapp';
import toast from 'react-hot-toast';

interface AdminCancellationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  cancellationReason?: string;
}

export const AdminCancellationSuccessModal: React.FC<AdminCancellationSuccessModalProps> = ({
  isOpen,
  onClose,
  order,
  cancellationReason
}) => {
  const [hasOpenedWhatsApp, setHasOpenedWhatsApp] = useState(false);

  if (!isOpen || !order) return null;

  const customerName = (order.customer_name || order.customerName || 'Customer').trim();
  const orderIdShort = order.id ? (order.id.length > 8 ? order.id.slice(-6).toUpperCase() : order.id.toUpperCase()) : 'N/A';
  const amount = order.total ?? order.total_amount ?? 0;
  const reason = cancellationReason || order.cancellation_reason || 'Cancelled by Administrator';

  const normalizedPhone = normalizePhoneNumber(order.phone);
  const hasValidPhone = Boolean(normalizedPhone);

  const handleSendWhatsApp = () => {
    const result = openCancellationWhatsApp(order.phone, order, reason);
    if (result.success) {
      setHasOpenedWhatsApp(true);
      toast.success('✓ WhatsApp opened with the cancellation message', {
        duration: 4000,
        style: {
          background: '#121212',
          color: '#ffffff',
          border: '1px solid rgba(34, 197, 94, 0.3)',
        }
      });
    } else {
      toast.error(result.error || 'Unable to open WhatsApp.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6 overflow-hidden"
        >
          {/* Ambient Top Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-rose-500 to-amber-500" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>

          {/* Header Status */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 size={24} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-extrabold text-lg tracking-tight">✓ Order Cancelled</span>
              </div>
              <p className="text-zinc-400 text-xs font-mono">Order #{orderIdShort}</p>
            </div>
          </div>

          {/* Order Details Summary Box */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500 font-medium">Customer:</span>
              <span className="font-bold text-white">{customerName}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-500 font-medium">Order Total:</span>
              <span className="font-mono font-bold text-amber-400">₹{amount}</span>
            </div>
            <div className="pt-2 border-t border-white/5">
              <span className="text-zinc-500 font-medium block mb-1">Reason:</span>
              <p className="text-zinc-300 italic bg-black/40 p-2.5 rounded-xl border border-white/5 font-sans">
                "{reason}"
              </p>
            </div>
          </div>

          {/* Customer Notification Section */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">
              Customer notification
            </h4>

            {hasValidPhone ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="w-full min-h-[44px] py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-900/30 active:scale-[0.98] cursor-pointer"
                >
                  <MessageSquare size={18} className="fill-current" />
                  <span>{hasOpenedWhatsApp ? '📱 WhatsApp Opened (Send again)' : '📱 Send via WhatsApp'}</span>
                  <ExternalLink size={14} className="opacity-70 ml-auto" />
                </button>
                <p className="text-[11px] text-zinc-400 leading-relaxed text-center">
                  Clicking will open WhatsApp with the pre-filled cancellation message. You will manually press send.
                </p>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-1.5 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <AlertTriangle size={16} />
                  <span>⚠️ No customer phone number is available.</span>
                </div>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  WhatsApp notification cannot be sent for this order because no phone number was registered.
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider border border-white/10 transition-colors cursor-pointer"
            >
              Done / Back to Orders
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
