import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Package, 
  MapPin, 
  CreditCard, 
  Clock, 
  MessageCircle, 
  Truck, 
  CheckCircle2, 
  Sparkles, 
  Cake, 
  Calendar,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
  Flame,
  ChefHat,
  ArrowRight,
  ShieldCheck,
  HeartHandshake
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FrostyAnimation } from './LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';
import { openWhatsAppOrder } from '../utils/whatsapp';
import { useAuth } from '../context/AuthContext';
import { formatOrderId } from '../utils/orderUtils';
import { cn, haptic } from '../lib/utils';
import { playSuccessChime } from '../utils/soundEffects';

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
    delivery_date?: string;
    delivery_time?: string;
    delivery_time_slot?: string;
    cake_message?: string;
    cake_occasion?: string;
    cake_candle_knife?: boolean;
    is_scheduled?: boolean;
    method: 'upi' | 'cod';
    amount: number;
    delivery_charge?: number;
    discount?: number;
    couponCode?: string;
    items?: OrderItem[];
    estimatedDelivery?: number | string;
    id?: string;
    total?: number;
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
  const { user, openAuthModal } = useAuth();
  
  const idValue = orderData?.orderId || orderData?.id || '';
  const formattedId = formatOrderId(idValue);
  const amountValue = orderData?.amount || orderData?.total || 0;
  const deliveryTime = orderData?.estimatedDelivery || '35-45 mins';
  
  const [copied, setCopied] = useState(false);
  const [showItemDetails, setShowItemDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Play celebratory chime
      try {
        playSuccessChime();
      } catch (e) {}

      // Fire celebratory confetti bursts
      const duration = 3.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 40, spread: 360, ticks: 90, zIndex: 10000 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        // Frosty Bite Theme Palette: Warm Coral, Golden Amber, Emerald, Pure White
        const colors = ['#E76A54', '#F97316', '#F59E0B', '#10B981', '#FFFFFF'];
        
        confetti({ 
          ...defaults, 
          particleCount, 
          origin: { x: randomInRange(0.15, 0.35), y: Math.random() - 0.2 },
          colors
        });
        confetti({ 
          ...defaults, 
          particleCount, 
          origin: { x: randomInRange(0.65, 0.85), y: Math.random() - 0.2 },
          colors
        });
      }, 280);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleCopyOrderId = () => {
    if (!idValue) return;
    navigator.clipboard.writeText(formattedId || idValue);
    haptic.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    haptic.medium();
    openWhatsAppOrder(orderData as any);
  };

  if (!isOpen || !orderData) return null;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { y: 16, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 350, damping: 25 }
    }
  };

  const isUpi = orderData.method === 'upi';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-2xl overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.85, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ 
            type: "spring", 
            damping: 22, 
            stiffness: 200,
            mass: 0.9
          }}
          className="w-full max-w-2xl my-auto bg-[#1A1816] border border-stone-800 text-stone-100 rounded-3xl sm:rounded-[36px] p-5 sm:p-8 relative shadow-[0_20px_80px_-15px_rgba(231,106,84,0.3)] overflow-hidden"
        >
          {/* Ambient Warm Bakery Radial Glows */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#E76A54]/20 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-[110px] pointer-events-none" />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative space-y-6"
          >
            {/* Header Section */}
            <motion.div variants={itemVariants} className="flex flex-col items-center text-center">
              {/* Bakery Animation Badge */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.04, 1],
                  rotate: [0, 2, 0, -2, 0]
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-28 h-28 sm:w-36 sm:h-36 -mb-2 relative"
              >
                <FrostyAnimation 
                  url={LOTTIE_ANIMATIONS.ORDER_CONFIRMED}
                  className="w-full h-full drop-shadow-[0_10px_20px_rgba(231,106,84,0.3)]"
                />
              </motion.div>

              {/* Status Pill */}
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#E76A54]/15 border border-[#E76A54]/30 rounded-full mb-3"
              >
                <div className="w-2 h-2 bg-[#E76A54] rounded-full animate-ping" />
                <span className="text-[11px] font-black text-[#E76A54] uppercase tracking-wider">
                  {isUpi ? 'Payment Verified & Confirmed' : 'Order Confirmed (Cash on Delivery)'}
                </span>
                <Sparkles size={13} className="text-amber-400 animate-pulse" />
              </motion.div>

              {/* Grand Display Headline */}
              <motion.h2 
                variants={itemVariants} 
                className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight uppercase leading-tight"
              >
                Fresh Bakes <br className="sm:hidden" />
                <span className="bg-gradient-to-r from-[#E76A54] via-amber-400 to-[#F97316] bg-clip-text text-transparent italic font-serif ml-1.5">
                  Incoming!
                </span>
              </motion.h2>

              <motion.p 
                variants={itemVariants} 
                className="text-stone-400 font-medium text-xs sm:text-sm max-w-md mx-auto mt-2 leading-relaxed"
              >
                {orderData.is_scheduled ? (
                  <span>Scheduled with care! Our master chefs will prepare your fresh artisan bakes on time.</span>
                ) : (
                  <span>Your order has been received by our kitchen. Fresh ingredients are getting prepped right now!</span>
                )}
              </motion.p>
            </motion.div>

            {/* Bakery Kitchen Timeline Stepper */}
            <motion.div variants={itemVariants} className="bg-stone-900/80 border border-stone-800/80 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 bg-stone-800 z-0" />
                <div className="absolute top-1/2 left-6 w-1/4 -translate-y-1/2 h-0.5 bg-[#E76A54] z-0 transition-all duration-1000" />

                {/* Step 1: Confirmed */}
                <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
                  <div className="w-8 h-8 rounded-full bg-[#E76A54] text-white flex items-center justify-center shadow-md shadow-[#E76A54]/30 ring-4 ring-[#1A1816]">
                    <Check size={14} className="stroke-[3]" />
                  </div>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">Received</span>
                </div>

                {/* Step 2: In Oven */}
                <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
                  <div className="w-8 h-8 rounded-full bg-stone-800 border border-amber-500/40 text-amber-400 flex items-center justify-center ring-4 ring-[#1A1816]">
                    <ChefHat size={14} className="animate-pulse" />
                  </div>
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Baking</span>
                </div>

                {/* Step 3: Quality Check */}
                <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
                  <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 text-stone-500 flex items-center justify-center ring-4 ring-[#1A1816]">
                    <Package size={14} />
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Packaged</span>
                </div>

                {/* Step 4: Dispatch */}
                <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
                  <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 text-stone-500 flex items-center justify-center ring-4 ring-[#1A1816]">
                    <Truck size={14} />
                  </div>
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Dispatch</span>
                </div>
              </div>
            </motion.div>

            {/* Authoritative Order Card */}
            <motion.div variants={itemVariants} className="space-y-3">
              {/* Top Row: Order ID & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Order ID Box with 1-Click Copy */}
                <div className="bg-stone-900/90 border border-stone-800 p-4 rounded-2xl flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Order Reference</p>
                    <p className="text-base font-black text-white font-mono tracking-wider">
                      #{formattedId || idValue}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title="Copy Order ID"
                  >
                    {copied ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span className="text-[10px] text-stone-400">Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Payment Amount Box */}
                <div className="bg-stone-900/90 border border-stone-800 p-4 rounded-2xl flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      {isUpi ? 'Amount Paid' : 'Amount Due (COD)'}
                    </p>
                    <p className="text-xl font-black text-white tracking-tight">
                      ₹{amountValue}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
                      isUpi
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    )}>
                      {isUpi ? <ShieldCheck size={12} /> : <CreditCard size={12} />}
                      {isUpi ? 'UPI Verified' : 'Pay at Delivery'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Meta: Address & Estimated Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-stone-900/60 border border-stone-800/80 p-3.5 rounded-2xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#E76A54]/15 text-[#E76A54] flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Deliver To</p>
                    <p className="text-xs font-semibold text-white truncate">{orderData.customerName}</p>
                    <p className="text-[11px] text-stone-400 truncate">{orderData.address}</p>
                  </div>
                </div>

                <div className="bg-stone-900/60 border border-stone-800/80 p-3.5 rounded-2xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      {orderData.delivery_date ? 'Scheduled Time' : 'Estimated Time'}
                    </p>
                    <p className="text-xs font-bold text-white">
                      {orderData.delivery_date 
                        ? `${orderData.delivery_date} (${orderData.delivery_time || orderData.delivery_time_slot || 'Standard'})`
                        : (typeof deliveryTime === 'number' ? `${deliveryTime} Mins` : deliveryTime)}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-medium">Fresh from our oven</p>
                  </div>
                </div>
              </div>

              {/* Cake Inscription Card (If Cake Message Present) */}
              {orderData.cake_message && (
                <div className="bg-stone-900/60 border border-stone-800/80 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#E76A54] uppercase tracking-wider flex items-center gap-1.5">
                      <Cake size={13} /> Custom Cake Inscription
                    </span>
                    {orderData.cake_occasion && (
                      <span className="text-[9px] font-bold bg-[#E76A54]/10 text-[#E76A54] px-2 py-0.5 rounded-md border border-[#E76A54]/20">
                        {orderData.cake_occasion}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-serif italic text-white pl-1">
                    "{orderData.cake_message}"
                  </p>
                  {orderData.cake_candle_knife && (
                    <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <Check size={11} className="stroke-[3]" /> Complimentary Candle & Cake Knife Included
                    </p>
                  )}
                </div>
              )}

              {/* Items Breakdown Toggle */}
              {orderData.items && orderData.items.length > 0 && (
                <div className="border border-stone-800 rounded-2xl overflow-hidden bg-stone-900/40">
                  <button
                    type="button"
                    onClick={() => setShowItemDetails(!showItemDetails)}
                    className="w-full p-3 px-4 flex items-center justify-between text-stone-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <ShoppingBag size={14} className="text-[#E76A54]" />
                      <span>{orderData.items.length} {orderData.items.length === 1 ? 'Item' : 'Items'} Ordered</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-400">
                      <span>{showItemDetails ? 'Hide' : 'View Items'}</span>
                      {showItemDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>

                  {showItemDetails && (
                    <div className="p-3 pt-0 space-y-2 border-t border-stone-800/60 max-h-48 overflow-y-auto">
                      {orderData.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-stone-800/40 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {item.image && (
                              <img 
                                src={item.image} 
                                alt={item.name} 
                                className="w-8 h-8 rounded-lg object-cover bg-stone-800 shrink-0" 
                              />
                            )}
                            <span className="text-stone-200 font-medium truncate">{item.name}</span>
                            <span className="text-stone-400 text-[11px] font-bold">x{item.quantity}</span>
                          </div>
                          <span className="text-stone-100 font-bold shrink-0">₹{item.price * item.quantity}</span>
                        </div>
                      ))}

                      {/* Line Item Breakdown */}
                      <div className="pt-2 text-[11px] space-y-1 text-stone-400">
                        {orderData.delivery_charge !== undefined && (
                          <div className="flex justify-between">
                            <span>Delivery Fee</span>
                            <span className="text-stone-200 font-semibold">{orderData.delivery_charge === 0 ? 'FREE' : `₹${orderData.delivery_charge}`}</span>
                          </div>
                        )}
                        {orderData.discount ? (
                          <div className="flex justify-between text-emerald-400">
                            <span>Coupon Discount {orderData.couponCode ? `(${orderData.couponCode})` : ''}</span>
                            <span>-₹{orderData.discount}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Optional Account Creation Card for Guests */}
            {!user && (
              <motion.div 
                variants={itemVariants}
                className="p-4 rounded-2xl bg-gradient-to-r from-[#E76A54]/15 via-amber-500/10 to-transparent border border-[#E76A54]/25 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <Sparkles size={13} className="animate-pulse" />
                    <span>Free Bakery Rewards</span>
                  </div>
                  <p className="text-white font-extrabold text-xs sm:text-sm">
                    Create an account to track orders & earn reward treats!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openAuthModal('Create Account', 'Sign up in 10 seconds to track live orders!')}
                  className="px-4 py-2 rounded-xl bg-[#E76A54] hover:bg-[#d85c46] text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shrink-0 shadow-md shadow-[#E76A54]/20"
                >
                  Sign Up Free
                </button>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div variants={itemVariants} className="space-y-2.5 pt-2">
              {/* Share on WhatsApp CTA */}
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="w-full h-13 sm:h-14 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl font-black uppercase tracking-wider text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                <MessageCircle size={18} className="fill-current text-white" />
                <span>Share Order on WhatsApp</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Track Order CTA */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/order-tracking/${idValue}`);
                  }}
                  className="h-12 bg-stone-800 hover:bg-stone-700 active:scale-[0.99] text-white rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all border border-stone-700 cursor-pointer"
                >
                  <Truck size={15} className="text-[#E76A54]" />
                  <span>Track Order</span>
                </button>

                {/* Continue Shopping / Dismiss */}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-12 bg-white/10 hover:bg-white/15 active:scale-[0.99] text-stone-200 hover:text-white rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Done</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
