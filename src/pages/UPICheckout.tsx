import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  Smartphone, 
  Clock, 
  ShoppingBag, 
  ShieldCheck, 
  BadgeCheck, 
  ArrowRight, 
  Download, 
  MessageCircle,
  Loader2,
  Lock,
  QrCode,
  CreditCard,
  Image as ImageIcon,
  Camera,
  Trash2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { supabaseService } from '../services/supabaseService';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { OrderConfirmation } from '../components/OrderConfirmation';
import { openWhatsAppOrder } from '../utils/whatsapp';
import { useNotifications } from '../context/NotificationContext';

const PAYMENT_EXPIRY_SECONDS = 600;
const UPI_ID = "7735800239@ibl";
const MERCHANT_NAME = "FrostyBite";

export const UPICheckout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { 
    orderId: string; 
    totalPrice: number; 
    name: string; 
    phone: string; 
    address: string;
    discount?: number;
    couponCode?: string;
    delivery_charge?: number;
    scrollToQR?: boolean;
  } | null;

  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [timeLeft, setTimeLeft] = useState(PAYMENT_EXPIRY_SECONDS);
  const expiryTimeRef = useRef<number>(Date.now() + PAYMENT_EXPIRY_SECONDS * 1000);
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const utrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) {
      navigate('/checkout');
      return;
    }

    // Smooth scroll to QR section if requested
    let scrollTimer: NodeJS.Timeout;
    if (state?.scrollToQR) {
      scrollTimer = setTimeout(() => {
        document.getElementById('qr-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 800);
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiryTimeRef.current - now) / 1000));
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
      clearInterval(timer);
    };
  }, [state, navigate]);
  
  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for base64
        toast.error('File too large. Please upload an image under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
        toast.success('Screenshot uploaded!');
      };
      reader.readAsDataURL(file);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerify = async () => {
    if (!utr || utr.length < 10) {
      toast.error('Please enter a valid UTR number (10-12 digits)');
      utrInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      utrInputRef.current?.focus();
      return;
    }

    setIsVerifying(true);
    try {
      // Check for duplicate UTR in Supabase
      const { data: duplicateOrders, error: dupError } = await supabase
        .from('orders')
        .select('*')
        .eq('utr', utr);
      
      if (duplicateOrders && duplicateOrders.length > 0) {
        const dupOrder = duplicateOrders[0];
        // Only error if it's a DIFFERENT order than the current one
        if (duplicateOrders.some((d: any) => d.id !== state!.orderId)) {
          toast.error(`This UTR has already been used for an order of ₹${dupOrder.total}. Please check again.`);
          setIsVerifying(false);
          return;
        }
      }

      // Supabase update
      try {
        await supabaseService.updateData('orders', state!.orderId, {
          utr: utr,
          payment_screenshot: screenshot,
          status: 'pending',
          payment_status: 'pending_verification',
          updated_at: new Date().toISOString()
        });
      } catch (supabaseError: any) {
        console.error('Supabase order update failed:', supabaseError);
        throw new Error('Failed to update order in Supabase');
      }
      
      const orderSummary = {
        orderId: state!.orderId,
        customerName: state!.name,
        phone: state!.phone,
        address: state!.address,
        method: 'upi' as const,
        amount: state!.totalPrice,
        delivery_charge: state!.delivery_charge || 0,
        discount: state!.discount || 0,
        couponCode: state!.couponCode || null,
        utr: utr,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        estimatedDelivery: 45 // Default estimate
      };

      setConfirmedOrder(orderSummary);
      setShowConfirmation(true);
      
      if (user) {
        addNotification({
          title: 'Payment Submitted',
          message: `UTR for order #${state!.orderId.slice(-6).toUpperCase()} submitted for verification.`,
          type: 'order',
          user_id: user.uid,
          link: `/order-tracking/${state!.orderId}`
        });
      }

      openWhatsAppOrder(orderSummary);
      clearCart();
      toast.success('Payment Submitted for Verification! 🍰');
    } catch (error: any) {
      console.error('Verification failed:', error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `orders/${state!.orderId}`);
      }
      toast.error('Verification failed. Please check UTR.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (showConfirmation && confirmedOrder) {
    return (
      <OrderConfirmation 
        isOpen={showConfirmation}
        orderData={confirmedOrder}
        onClose={() => {
          setShowConfirmation(false);
          navigate('/orders');
        }}
      />
    );
  }

  if (!state) return null;

  return (
    <div className="min-h-svh flex flex-col bg-background">
      <AnimatePresence>
        {isVerifying && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-12"
          >
            <div className="relative">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [360, 270, 180, 90, 0],
                  borderRadius: ["20%", "50%", "20%"]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="w-32 h-32 bg-emerald-500/20 border-2 border-emerald-500/50"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ 
                    scale: [0.8, 1.2, 0.8],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <ShieldCheck size={48} className="text-emerald-500" />
                </motion.div>
              </div>
            </div>

            <div className="space-y-4">
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-4xl md:text-6xl font-black text-white italic tracking-tighter uppercase leading-none"
              >
                Verifying <br />
                <span className="text-emerald-500 italic">Payment</span>
              </motion.h2>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]"
              >
                Validating Transaction Reference...
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto max-w-2xl mx-auto px-4 py-8 md:py-16 space-y-8 pb-40">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-white/5 rounded-2xl text-zinc-400 hover:text-primary transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tighter italic uppercase">UPI Payment</h1>
            <p className="text-zinc-500 font-medium text-xs uppercase tracking-widest">Complete your payment to confirm order</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Main Payment Card */}
          <div className="bakery-card overflow-hidden">
            {/* Header with Timer */}
            <div className="bg-zinc-800 p-6 text-white flex justify-between items-center border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <Clock size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Time Remaining</p>
                  <p className="text-xl font-black italic tracking-tight">{formatTime(timeLeft)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Order ID</p>
                <p className="font-black tracking-tight text-primary">#{state.orderId.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {/* QR Code Section - Replicated PhonePe Sticker Design */}
              <div id="qr-section" className="flex flex-col items-center">
                <div className="w-full max-w-[320px] bg-white rounded-3xl p-8 flex flex-col items-center space-y-6 shadow-2xl relative overflow-hidden">
                  {/* Payment Info */}
                  <div className="flex flex-col items-center space-y-1">
                    <p className="text-zinc-600 font-black text-[10px] uppercase tracking-widest">Scan & Pay Using Any UPI App</p>
                    <div className="flex flex-col items-center gap-1 mt-1">
                      {state.discount && state.discount > 0 && (
                        <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest">
                            Coupon {state.couponCode} Applied: -₹{state.discount}
                          </p>
                        </div>
                      )}
                      {state.delivery_charge && state.delivery_charge > 0 && (
                        <div className="px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-full">
                          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">
                            Delivery Fee: ₹{state.delivery_charge}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="relative group">
                    <div className="absolute -inset-4 bg-primary/5 rounded-[40px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ 
                        repeat: Infinity, 
                        duration: 3,
                        ease: "easeInOut" 
                      }}
                      className="relative p-2 bg-white rounded-3xl"
                    >
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${state.totalPrice}&cu=INR`)}`}
                        alt="UPI QR Code"
                        className="w-[200px] h-[200px] rounded-2xl"
                      />
                    </motion.div>
                  </div>

                  {/* Pay Button for Mobile */}
                  <div className="w-full space-y-4">
                    <a
                      href={`upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${state.totalPrice}&cu=INR`}
                      className="flex items-center justify-center gap-3 w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-emerald-500/20"
                    >
                      <Smartphone size={18} />
                      Pay via UPI App
                    </a>
                    
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter text-center">
                      Scan with GPay, PhonePe, Paytm or Any UPI App
                    </p>
                  </div>

                  <div className="text-center pt-4">
                    <h3 className="text-lg font-black text-[#202020] uppercase tracking-tighter italic">{MERCHANT_NAME}</h3>
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-center space-y-2">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
                    <Smartphone size={14} className="text-primary" />
                    <span className="text-xs font-bold text-zinc-400 font-mono">{UPI_ID}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest max-w-[240px] text-center leading-relaxed">
                    Scan the QR code using any UPI app like GPay, PhonePe, or Paytm
                  </p>
                </div>
              </div>

              {/* Screenshot & UTR Input Section */}
              <div id="utr-section" className="space-y-8 pt-6 border-t border-white/5">
                {/* Screenshot Upload Row */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Camera size={12} className="text-primary" /> Upload Payment Screenshot
                      </label>
                      <button 
                        onClick={() => document.getElementById('qr-section')?.scrollIntoView({ behavior: 'smooth' })}
                        className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline"
                      >
                        <QrCode size={10} /> View QR Code
                      </button>
                    </div>
                    <div className="flex gap-4">
                      <label className={cn(
                        "flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer group",
                        screenshot 
                          ? "border-emerald-500/50 bg-emerald-500/5" 
                          : "border-white/10 bg-white/5 hover:border-primary/50 hover:bg-white/10"
                      )}>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleScreenshotUpload}
                        />
                        {screenshot ? (
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl overflow-hidden border border-emerald-500/30 shadow-lg">
                              <img src={screenshot} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-black text-emerald-500 uppercase tracking-tight">Screenshot Attached!</p>
                              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none mt-1">Tap to change image</p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <ImageIcon size={20} className="text-zinc-500 mb-1 group-hover:text-primary transition-colors" />
                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-primary transition-colors italic">Attach screenshot (Recommended)</p>
                          </>
                        )}
                      </label>
                      {screenshot && (
                        <button 
                          onClick={() => setScreenshot(null)}
                          className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-lg active:scale-95"
                          title="Remove Screenshot"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <QrCode size={12} className="text-primary" /> Enter 12-Digit UTR Number
                    </label>
                  <div className="relative">
                    <input
                      ref={utrInputRef}
                      type="text"
                      maxLength={12}
                      placeholder="0000 0000 0000"
                      className="w-full bg-white/5 border-2 border-white/10 focus:border-primary focus:ring-8 focus:ring-primary/5 p-5 rounded-3xl transition-all font-black text-center text-xl tracking-[0.2em] text-white placeholder:text-zinc-800"
                      value={utr}
                      onChange={(e) => setUtr(e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                  <p className="text-[9px] text-center text-zinc-500 font-bold uppercase tracking-widest">
                    You'll find the UTR/Ref number in your payment confirmation
                  </p>
                </div>

                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className={cn(
                    "w-full btn-premium group h-16 transition-all",
                    isVerifying && "opacity-80 cursor-not-allowed bg-zinc-700"
                  )}
                >
                  <div className="flex items-center justify-center gap-3">
                    {isVerifying ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span className="font-black uppercase tracking-widest text-sm">Verifying UTR...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-black uppercase tracking-widest">Verify Payment</span>
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Help/Incentive Footer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-bakery p-6 rounded-[32px] flex flex-col items-center text-center space-y-2 border border-emerald-500/10">
              <BadgeCheck className="text-emerald-500" size={24} />
              <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Instant</p>
              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Confirmation</p>
            </div>
            <div className="glass-bakery p-6 rounded-[32px] flex flex-col items-center text-center space-y-2 border border-primary/10">
              <Lock className="text-primary" size={24} />
              <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Secure</p>
              <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Transactions</p>
            </div>
          </div>

          <button 
            onClick={() => navigate(-1)}
            className="w-full py-4 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors"
          >
            Cancel Payment & Go Back
          </button>
        </div>
      </div>

      {/* Sticky Bottom Bar for Mobile Verification */}
      {!showConfirmation && !isVerifying && (
        <div className="lg:hidden sticky bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className={cn(
                "w-full h-14 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all active:scale-105 shadow-xl shadow-emerald-500/20",
                isVerifying && "opacity-50 pointer-events-none"
              )}
            >
              {isVerifying ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Verify Payment</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UPICheckout;
