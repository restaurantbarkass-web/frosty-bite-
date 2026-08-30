import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ArrowRight, ShieldCheck, X, Loader2 } from 'lucide-react';
import { Order } from '../types';
import { supabaseService } from '../services/supabaseService';
import { whatsappService } from '../services/whatsappService';
import { useNotifications } from '../context/NotificationContext';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { formatOrderId } from '../utils/orderUtils';

interface CancelOrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onCancelSuccess: (updatedOrder: Order) => void;
  userId: string;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onCancelSuccess,
  userId
}) => {
  const [step, setStep] = useState<1 | 2>(1); // 1 = Select Reason, 2 = Confirm & Refund notice
  const [reason, setReason] = useState('Ordered by mistake');
  const [otherReasonText, setOtherReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [monthlyCount, setMonthlyCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (isOpen) {
      const fetchCount = async () => {
        setLoadingCount(true);
        try {
          const count = await supabaseService.getMonthlyCancellationCount(userId, order.phone);
          setMonthlyCount(count);
        } catch (err) {
          console.error("Failed to load monthly cancellation count:", err);
        } finally {
          setLoadingCount(false);
        }
      };
      fetchCount();
    }
  }, [isOpen, userId, order.phone]);

  const reasons = [
    'Ordered by mistake',
    'Delivery delay',
    'Change of mind',
    'Found better option',
    'Other'
  ];

  const handleReasonSelect = (r: string) => {
    setReason(r);
  };

  const finalReason = reason === 'Other' ? (otherReasonText.trim() || 'Other reason') : reason;
  const isOnlinePayment = order.payment_method === 'online' || order.payment_method === 'upi';

  const handleCancelSubmit = async () => {
    setSubmitting(true);
    const loadingToast = toast.loading('Processing order cancellation and restoring stock...', {
      style: {
        borderRadius: '16px',
        background: '#18181b',
        color: '#fff',
      }
    });

    try {
      // 1. Call centralized service to update DB, restore stock, insert cancellation log
      const updated = await supabaseService.cancelOrder(
        order.id,
        finalReason,
        'customer',
        userId
      );

      // 2. Add system notification
      await addNotification({
        title: 'Order Cancelled Successfully',
        message: `Order #${formatOrderId(order.id)} has been cancelled. Reason: ${finalReason}.`,
        type: 'order',
        user_id: userId,
        link: `/order-tracking/${order.id}`
      });

      // 3. Show dynamic toast notification
      toast.success('Your order was cancelled successfully. Inventory restored.', {
        id: loadingToast,
        icon: '🧁',
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
        }
      });

      // 4. Trigger Whatsapp alert (automatic check)
      whatsappService.sendCancellationMessage(updated, finalReason);

      // 5. Trigger customer callback to refresh dashboard
      onCancelSuccess(updated as Order);
      
      // Reset & exit
      setStep(1);
      onClose();
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      toast.error(err.message || 'Failed to cancel order. Please try again.', { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative max-w-lg w-full bg-[#0d0d0d]/90 border border-white/10 rounded-[35px] shadow-2xl overflow-hidden backdrop-blur-3xl z-10"
        >
          {/* Header */}
          <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5">
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-primary bg-primary/10 px-3 py-1 rounded-full">
                Order #{formatOrderId(order.id)}
              </span>
              <h3 className="text-2xl font-black text-white italic tracking-tight uppercase mt-2">
                {step === 1 ? "Cancel Order" : "Double Confirmation"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-3 bg-white/5 text-zinc-400 hover:text-white rounded-full hover:scale-105 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
            {step === 1 ? (
              // STEP 1: SELECT REASON
              <div className="space-y-4">
                {monthlyCount !== null && (
                  <div className={cn(
                    "flex items-start gap-3 p-4 rounded-2xl text-xs border transition-all",
                    monthlyCount >= 3 
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-500" 
                      : "bg-emerald-500/5 border-emerald-500/10 text-emerald-400"
                  )}>
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold uppercase tracking-wider text-[10px]">Monthly Limit Status</p>
                      <p className="mt-0.5 leading-relaxed font-semibold">
                        {monthlyCount >= 3 
                          ? `Verification failed: You have already cancelled 3 orders this calendar month.`
                          : `Verified: You have cancelled ${monthlyCount}/3 orders this month (${3 - monthlyCount} remaining).`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {monthlyCount !== null && monthlyCount >= 3 ? (
                  <div className="bg-rose-500/5 border border-rose-500/10 p-6 rounded-3xl text-center space-y-3">
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      To safeguard baking ingredients and maintain fair service for all foodies, customers are <span className="text-rose-400 font-bold font-mono">strictly limited to 3 order cancellations per month</span>.
                    </p>
                    <p className="text-zinc-500 text-xs">
                      If you need urgent assistance with change requests for your fresh items, please contact support immediately over WhatsApp.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 text-xs text-zinc-400">
                      <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Orders can only be cancelled within 24 hours. Your bakery bakes fresh daily - cancelling immediately allows us to restock inventory!
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-2">
                        Why are you cancelling this order?
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {reasons.map((r) => {
                          const isSelected = reason === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleReasonSelect(r)}
                              className={`flex items-center justify-between p-4 rounded-2xl border text-sm font-bold text-left transition-all ${
                                isSelected
                                  ? 'bg-primary/10 border-primary text-white shadow-lg shadow-primary/5'
                                  : 'bg-white/5 border-white/5 text-zinc-400 hover:border-white/10 hover:text-white'
                              }`}
                            >
                              <span>{r}</span>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-primary bg-primary' : 'border-zinc-700'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {reason === 'Other' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                      >
                        <textarea
                          placeholder="Please specify your cancellation reason..."
                          value={otherReasonText}
                          onChange={(e) => setOtherReasonText(e.target.value)}
                          rows={3}
                          className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-zinc-600"
                        />
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            ) : (
              // STEP 2: REFUND NOTIFICATION & DOUBLE CONFIRMATION
              <div className="space-y-6 text-center py-4">
                <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-500 mx-auto animate-pulse">
                  <AlertCircle size={36} />
                </div>

                <div className="space-y-2">
                  <h4 className="text-lg font-black text-rose-500 italic uppercase">Are you absolutely sure?</h4>
                  <p className="text-zinc-400 text-sm leading-relaxed px-4">
                    This action is irreversible. Once cancelled, we will automatically release your freshly reserved bakery items back to the shop, and update our baking schedule.
                  </p>
                </div>

                {isOnlinePayment ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-3xl text-left space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                      <ShieldCheck size={16} />
                      Refund System Ready
                    </div>
                    <p className="text-zinc-300 text-xs leading-relaxed">
                      Since you paid ₹{order.total} online/UPI, a credit refund notice has been generated. The amount will be transferred back to your account within 24 hours.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/5 p-5 rounded-3xl text-left space-y-2">
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      This is a Cash on Delivery (COD) order. No financial transactions/refunds are required for this cancellation.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 md:p-8 border-t border-white/5 bg-black/50 flex gap-4">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors"
                >
                  Close
                </button>
                {monthlyCount !== null && monthlyCount >= 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        window.open(`https://wa.me/${whatsappService.PHONE_NUMBER}?text=Hi%20Frosty%20Bite!%20My%20order%20%23${formatOrderId(order.id)}%20needs%20cancellation%20assistance%20please.`, '_blank');
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="flex-1 py-4 bg-[#25D366] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    WhatsApp Support
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={loadingCount || (reason === 'Other' && !otherReasonText.trim())}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loadingCount ? (
                      <Loader2 className="animate-spin" size={12} />
                    ) : (
                      <>
                        Continue
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubmit}
                  disabled={submitting}
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-rose-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin text-white" size={14} />
                      Restocking...
                    </>
                  ) : (
                    "Confirm Cancel"
                  )}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
