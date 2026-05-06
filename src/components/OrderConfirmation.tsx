import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Package, MapPin, CreditCard, Clock, MessageCircle, Truck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FrostyAnimation } from './LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';
import { openWhatsAppOrder } from '../utils/whatsapp';
import { RESTAURANT_WHATSAPP } from '../constants';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

interface OrderConfirmationProps {
  isOpen: boolean;
  orderData: {
    orderId: string;
    customerName: string;
    phone: string;
    address: string;
    notes?: string;
    method: 'upi' | 'cod';
    amount: number;
    delivery_charge?: number;
    discount?: number;
    items?: OrderItem[];
    estimatedDelivery?: number;
    id?: string; // Add optional id for backward compatibility
    total?: number; // Add optional total for backward compatibility
    utr?: string;
  };
  onClose: () => void;
}

export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ 
  isOpen, 
  orderData, 
  onClose 
}) => {
  const navigate = useNavigate();
  const idValue = orderData?.orderId || orderData?.id || '';
  const amountValue = orderData?.amount || orderData?.total || 0;
  const deliveryTime = orderData?.estimatedDelivery || 45;

  useEffect(() => {
    if (isOpen) {
      const duration = 4 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 45, spread: 360, ticks: 100, zIndex: 10000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 60 * (timeLeft / duration);
        confetti({ 
          ...defaults, 
          particleCount, 
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#F97316', '#FFFFFF', '#059669']
        });
        confetti({ 
          ...defaults, 
          particleCount, 
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#F97316', '#FFFFFF', '#059669']
        });
      }, 300);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleWhatsAppShare = () => {
    openWhatsAppOrder(orderData as any);
  };

  if (!isOpen) return null;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.8, y: 100, opacity: 0, rotate: -2 }}
          animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            damping: 18, 
            stiffness: 120,
            mass: 0.8
          }}
          className="w-full max-w-2xl my-auto bg-zinc-900 border border-white/5 rounded-[40px] p-6 md:p-10 relative shadow-[0_0_120px_-20px_rgba(249,115,22,0.2)]"
        >
          {/* Decorative Elements */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative"
          >
            {/* Header Animation Section */}
            <motion.div variants={itemVariants} className="flex flex-col items-center text-center -mt-4">
              <motion.div 
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, 0, -5, 0]
                }}
                transition={{ 
                  duration: 6, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-40 h-40 md:w-56 md:h-56 -mb-6"
              >
                <FrostyAnimation 
                  url={LOTTIE_ANIMATIONS.ORDER_CONFIRMED}
                  className="w-full h-full"
                />
              </motion.div>

              <div className="space-y-4">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full"
                >
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Order Successfully Received</span>
                </motion.div>
                
                <motion.h2 variants={itemVariants} className="text-5xl md:text-7xl font-black text-white italic tracking-tighter uppercase leading-[0.85]">
                  {orderData.method === 'upi' ? (
                    <>Verification <br /><span className="text-primary italic">Started</span></>
                  ) : (
                    <>Order <br /><span className="text-primary italic">Confirmed</span></>
                  )}
                </motion.h2>
                
                <motion.p variants={itemVariants} className="text-zinc-500 font-bold uppercase tracking-[0.15em] text-[9px] md:text-[10px] max-w-xs mx-auto leading-relaxed">
                  {orderData.method === 'upi' 
                    ? "We're validating your transaction. Your fresh treats will be ready in 45-60 mins!"
                    : "Hang tight! Our chefs are already mixing the magic for your cravings."
                  }
                </motion.p>
              </div>
            </motion.div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
              {/* Payment Summary */}
              <motion.div variants={itemVariants} className="space-y-3 md:col-span-2">
                 <div className="flex items-center justify-between bg-primary/5 p-6 rounded-3xl border border-primary/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-1000" />
                    <div className="relative flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/20">
                        <CreditCard size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Amount to Pay</p>
                        <p className="text-2xl font-black text-white italic">₹{amountValue}</p>
                        {(orderData.delivery_charge || orderData.discount) && (
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                            {orderData.delivery_charge ? `Incl. ₹${orderData.delivery_charge} delivery` : ''}
                            {orderData.discount ? `${orderData.delivery_charge ? ' • ' : ''}-₹${orderData.discount} discount` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{orderData.method === 'upi' ? 'UPI Method' : 'COD Method'}</p>
                       <p className="text-[11px] font-black text-primary uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                         {orderData.method === 'upi' ? 'Pending Approval' : 'Payment on Delivery'}
                       </p>
                    </div>
                 </div>
              </motion.div>

              {/* Order Meta */}
              <motion.div variants={itemVariants} className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-primary">
                      <Package size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Order Ref</p>
                      <p className="text-xs font-black text-white uppercase tracking-tight">#{idValue?.toString().slice(-8).toUpperCase()}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-primary">
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">ETA</p>
                      <p className="text-xs font-black text-white uppercase tracking-tight">{deliveryTime} Mins</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-primary">
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Ship To</p>
                      <p className="text-xs font-bold text-white uppercase tracking-tight truncate shrink-0">{orderData.address}</p>
                    </div>
                 </div>
              </motion.div>

              {/* UTR Info (if UPI) */}
              <motion.div variants={itemVariants} className="bg-white/5 p-5 rounded-3xl border border-white/5 flex flex-col justify-center text-center md:text-left relative overflow-hidden group">
                 {orderData.method === 'upi' ? (
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-2 text-emerald-500">
                           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                           <span className="text-[9px] font-black uppercase tracking-widest">UTR Registered</span>
                        </div>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      </div>
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 group-hover:border-primary/30 transition-colors">
                         <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Reference ID</p>
                         <p className="text-lg font-mono font-black text-white tracking-widest">{orderData.utr || 'NOT PROVIDED'}</p>
                      </div>
                   </div>
                 ) : (
                   <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Freshness Guaranteed</p>
                      <p className="text-xs font-medium text-zinc-400 leading-relaxed italic">Our chef starts your order immediately. Please be ready for delivery!</p>
                   </div>
                 )}
              </motion.div>
            </div>

            {/* Action Buttons */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mt-8">
              <button
                onClick={handleWhatsAppShare}
                className="md:col-span-2 group relative h-16 bg-emerald-500 rounded-2xl overflow-hidden shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <MessageCircle size={20} className="text-white" />
                <span className="text-sm font-black text-white uppercase tracking-[0.1em]">Share via WhatsApp</span>
              </button>
              
              <button
                 onClick={() => {
                   onClose();
                   navigate(`/order-tracking/${idValue}`);
                 }}
                 className="h-16 bg-white border border-white/10 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Truck size={16} />
                Track
              </button>

              <button
                onClick={onClose}
                className="md:col-span-3 h-14 text-zinc-600 font-black uppercase tracking-[0.4em] text-[8px] hover:text-white transition-colors"
              >
                Dismiss Overview
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
