import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, X, ArrowRight, ShoppingCart, Clock, ArrowLeft } from 'lucide-react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';
import { Order } from '../../types';
import { cn } from '../../lib/utils';
import { SlideToConfirm } from '../ui/SlideToConfirm';
import { AdminCancellationSuccessModal } from './AdminCancellationSuccessModal';

interface OrderActionPopupProps {
  order: Order | null;
  onClose: () => void;
  onAction: (status: 'confirmed' | 'cancelled') => void;
}

export const OrderActionPopup: React.FC<OrderActionPopupProps> = ({ order, onClose, onAction }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSlideCancel, setShowSlideCancel] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('Out of Stock');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // 1 minute to act

  useEffect(() => {
    if (!order) return;

    // play sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(() => {});

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [order, onClose]);

  if (!order) return null;

  const handleAction = async (status: 'confirmed' | 'cancelled') => {
    setIsProcessing(true);
    const finalReason = rejectionReason.trim() || 'Order rejected by store manager';

    try {
      const updateData: any = { status };
      if (status === 'cancelled') {
        updateData.cancellation_reason = finalReason;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;
      
      toast.success(status === 'confirmed' ? 'Order accepted!' : 'Order rejected.');
      if (status === 'cancelled') {
        setShowWhatsAppModal(true);
      } else {
        onAction(status);
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 50 }}
        transition={{ type: "spring", damping: 20, stiffness: 320 }}
        className="fixed bottom-8 right-4 sm:right-8 z-[100] w-full max-w-[400px]"
      >
        <div className="mx-4 sm:mx-0 bg-[#111] border border-orange-500/30 rounded-[2.5rem] shadow-2xl shadow-orange-500/20 overflow-hidden">
          {/* Header */}
          <div className="bg-orange-500 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
                <ShoppingCart className="text-white" size={20} />
              </div>
              <div>
                <h3 className="text-white font-black uppercase tracking-widest text-sm">New Order 🍰</h3>
                <p className="text-white/80 text-[10px] font-bold"># {order.id.slice(-6).toUpperCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full">
              <Clock size={12} className="text-white" />
              <span className="text-white text-xs font-black italic">{timeLeft}s</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Customer</p>
                <p className="text-white font-black">{order.customer_name || 'Guest'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Amount</p>
                <p className="text-orange-500 text-xl font-black italic">₹{order.total}</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-2">Order Items</p>
              <div className="space-y-1">
                {order.items.slice(0, 2).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-xs text-gray-300">
                    <span className="font-bold">{item.quantity}x {item.name}</span>
                  </div>
                ))}
                {order.items.length > 2 && (
                  <p className="text-[10px] text-orange-500 font-bold italic">+ {order.items.length - 2} more items</p>
                )}
              </div>
            </div>

            {/* Actions */}
            {showSlideCancel ? (
              <div className="pt-2 space-y-3">
                <div className="bg-black/40 border border-rose-500/30 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-left">
                    <label className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1">
                      <span>Rejection Reason</span>
                      <span className="text-rose-400 font-extrabold">*</span>
                    </label>
                    <span className="text-[9px] text-zinc-400 font-medium">Mandatory</span>
                  </div>

                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Type reason (e.g. Out of stock)..."
                    className="w-full bg-[#18161f] text-white text-xs px-3 py-2 rounded-xl border border-white/15 focus:border-rose-500 focus:outline-none placeholder:text-zinc-500 font-medium"
                  />

                  <div className="flex flex-wrap gap-1">
                    {['Out of Stock', 'Kitchen Busy', 'Store Closed', 'Invalid Address'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRejectionReason(preset)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                          rejectionReason === preset
                            ? 'bg-rose-500 text-white'
                            : 'bg-white/5 text-zinc-300 border border-white/10'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {!rejectionReason.trim() && (
                    <p className="text-[10px] font-bold text-rose-400 text-left">
                      ⚠️ Rejection reason is required
                    </p>
                  )}
                </div>

                <SlideToConfirm
                  disabled={!rejectionReason.trim()}
                  onConfirm={async () => {
                    if (!rejectionReason.trim()) {
                      toast.error('Rejection reason is required');
                      return;
                    }
                    await handleAction('cancelled');
                  }}
                  label="Slide to Reject Order"
                  releaseLabel="Release to Reject"
                  processingLabel="Rejecting Order..."
                  successLabel="Order Rejected!"
                  variant="danger"
                />
                
                <button
                  type="button"
                  onClick={() => setShowSlideCancel(false)}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-full text-xs font-extrabold uppercase tracking-widest border border-white/10 flex items-center justify-center gap-2 group transition-all cursor-pointer"
                >
                  <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
                  <span>Back</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-3 pt-2">
                <button
                  disabled={isProcessing}
                  onClick={() => handleAction('confirmed')}
                  className="flex-1 bg-white hover:bg-gray-100 text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Check size={16} />
                  Accept
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => setShowSlideCancel(true)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all border border-white/10 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <X size={16} />
                  Reject
                </button>
              </div>
            )}
            
            <button 
              onClick={onClose}
              className="w-full text-center text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] pt-2 hover:text-white transition-colors cursor-pointer"
            >
              Dismiss for now
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="h-1 bg-white/5 w-full">
            <motion.div 
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 60, ease: 'linear' }}
              className="h-full bg-orange-500"
            />
          </div>
        </div>
      </motion.div>

      {/* WhatsApp Cancellation Success Modal */}
      <AdminCancellationSuccessModal
        isOpen={showWhatsAppModal}
        onClose={() => {
          setShowWhatsAppModal(false);
          onAction('cancelled');
        }}
        order={order ? { ...order, status: 'cancelled', cancellation_reason: rejectionReason.trim() } : null}
        cancellationReason={rejectionReason.trim() || 'Order rejected by store manager'}
      />
    </AnimatePresence>
  );
};
