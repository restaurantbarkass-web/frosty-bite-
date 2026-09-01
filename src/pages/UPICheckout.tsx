import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  Smartphone, 
  Clock, 
  ShoppingBag, 
  ShieldCheck, 
  BadgeCheck, 
  Copy,
  Check,
  QrCode,
  Image as ImageIcon,
  Camera,
  Trash2,
  Loader2,
  Lock,
  ArrowRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { supabaseService } from '../services/supabaseService';
import toast from 'react-hot-toast';
import { cn, haptic } from '../lib/utils';
import { OrderConfirmation } from '../components/OrderConfirmation';
import { openWhatsAppOrder } from '../utils/whatsapp';
import { formatOrderId } from '../utils/orderUtils';
import { useNotifications } from '../context/NotificationContext';

import { PaymentStatusCard, PaymentState } from '../components/payment/PaymentStatusCard';
import { PaymentLeaveModal } from '../components/payment/PaymentLeaveModal';

const DEFAULT_UPI_ID = "7735800239@ibl";
const DISPLAY_UPI_ID = "frostybite@upi";
const MERCHANT_NAME = "FrostyBite";
const PAYMENT_DURATION_MS = 6 * 60 * 1000; // 6 minutes

export const UPICheckout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId: paramOrderId } = useParams<{ orderId: string }>();

  const state = location.state as { 
    orderId: string; 
    totalPrice: number; 
    name: string; 
    phone: string; 
    address: string;
    notes?: string;
    discount?: number;
    couponCode?: string;
    delivery_charge?: number;
    estimatedDelivery?: number;
    scrollToQR?: boolean;
  } | null;

  const effectiveOrderId = state?.orderId || paramOrderId || '';

  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  // Core Payment State
  const [paymentState, setPaymentState] = useState<PaymentState>('IDLE');
  const [orderDetails, setOrderDetails] = useState<any>(state || null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(360);
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  // UI States
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showManualSection, setShowManualSection] = useState(false);
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isVerifyingManual, setIsVerifyingManual] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const utrInputRef = useRef<HTMLInputElement>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } catch (e) {}
  }, []);

  // 1. Fetch Order & Restore/Create Payment Attempt with Exponential Backoff Retries
  const initializePaymentSession = useCallback(async () => {
    if (!effectiveOrderId) {
      navigate('/checkout');
      return;
    }

    setPaymentState('CREATING_ATTEMPT');
    setIsReconnecting(false);

    try {
      // Step A: Fetch order from database if state missing
      let currentOrder = orderDetails;
      if (!currentOrder || !currentOrder.totalPrice) {
        const { data: dbOrder, error: orderErr } = await supabase
          .from('orders')
          .select('*')
          .or(`id.eq.${effectiveOrderId},id.eq.FB-${effectiveOrderId}`)
          .maybeSingle();

        if (dbOrder) {
          currentOrder = {
            orderId: dbOrder.id,
            totalPrice: Number(dbOrder.total) || 0,
            name: dbOrder.customer_name || 'Customer',
            phone: dbOrder.phone || dbOrder.customer_phone || '',
            address: dbOrder.address || dbOrder.delivery_address || '',
            notes: dbOrder.notes || '',
            discount: Number(dbOrder.discount) || 0,
            delivery_charge: Number(dbOrder.delivery_charge) || 0,
            payment_status: dbOrder.payment_status,
            status: dbOrder.status
          };
          setOrderDetails(currentOrder);
        }
      }

      if (currentOrder && (currentOrder.payment_status === 'paid' || currentOrder.status === 'confirmed')) {
        setPaymentState('PAYMENT_VERIFIED');
        return;
      }

      // Step B: Call secure server endpoint with retry strategy (attempt 1: 0s, attempt 2: 2s, attempt 3: 4s)
      let authHeader: Record<string, string> = {};
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          authHeader = { Authorization: `Bearer ${sessionData.session.access_token}` };
        }
      } catch (e) {}

      const payload = {
        order_id: effectiveOrderId,
        order_details: currentOrder ? {
          id: effectiveOrderId,
          totalPrice: currentOrder.totalPrice,
          total: currentOrder.totalPrice,
          name: currentOrder.name,
          phone: currentOrder.phone,
          address: currentOrder.address,
          payment_method: 'upi'
        } : undefined
      };

      let maxAttempts = 3;
      let delayMs = 2000;
      let created = false;

      for (let attemptNum = 1; attemptNum <= maxAttempts; attemptNum++) {
        try {
          const response = await fetch('/api/payment/create-attempt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeader
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (response.ok && data.success && data.payment_attempt) {
            const attempt = data.payment_attempt;
            setAttemptId(attempt.id);
            const expMs = new Date(attempt.expires_at).getTime();
            setExpiresAtMs(expMs);
            const nowMs = Date.now();
            const remSecs = Math.max(0, Math.floor((expMs - nowMs) / 1000));
            setTimeLeftSeconds(remSecs);
            setPaymentState('WAITING_FOR_PAYMENT');
            setConsecutiveFailures(0);
            created = true;
            break;
          } else if (response.status === 400 && data.message?.toLowerCase().includes('already paid')) {
            setPaymentState('PAYMENT_VERIFIED');
            created = true;
            break;
          } else if (attemptNum < maxAttempts) {
            console.warn(`[UPICheckout] Attempt ${attemptNum} creation failed, retrying in ${delayMs}ms...`);
            await new Promise((res) => setTimeout(res, delayMs));
            delayMs *= 2;
          } else {
            console.error('[UPICheckout] Final attempt creation failed:', data);
            toast.error(data.message || 'Unable to create payment session');
            setPaymentState('ERROR');
          }
        } catch (err) {
          console.warn(`[UPICheckout] Creation network error on attempt ${attemptNum}:`, err);
          if (attemptNum < maxAttempts) {
            await new Promise((res) => setTimeout(res, delayMs));
            delayMs *= 2;
          } else {
            setPaymentState('ERROR');
          }
        }
      }
    } catch (err: any) {
      console.error('[UPICheckout] Initialization unexpected error:', err);
      setPaymentState('ERROR');
    }
  }, [effectiveOrderId, navigate, orderDetails]);

  useEffect(() => {
    initializePaymentSession();
  }, [initializePaymentSession]);

  // 2. Timer Countdown Effect
  useEffect(() => {
    if (!expiresAtMs || paymentState === 'PAYMENT_VERIFIED' || paymentState === 'IDLE') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const rem = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
      setTimeLeftSeconds(rem);

      if (rem === 0) {
        clearInterval(interval);
        setPaymentState('PAYMENT_EXPIRED');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAtMs, paymentState]);

  // 3. Realtime Subscription & Resilient Fallback Polling Loop
  const checkAuthoritativeStatus = useCallback(async () => {
    if (!effectiveOrderId || paymentState === 'PAYMENT_VERIFIED') return;

    console.log('[UPI STATUS] request started');

    // Primary: Call server-side payment status endpoint
    try {
      let authHeader: Record<string, string> = {};
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          authHeader = { Authorization: `Bearer ${sessionData.session.access_token}` };
        }
      } catch (e) {}

      const res = await fetch(`/api/payment/status/${encodeURIComponent(effectiveOrderId)}`, {
        headers: {
          'Accept': 'application/json',
          ...authHeader
        }
      });

      console.log(`[UPI STATUS] response ${res.status}`);

      if (res.ok || res.status === 304) {
        let data: any = {};
        if (res.status !== 304) {
          try {
            data = await res.json();
          } catch (e) {
            data = {};
          }
        } else {
          data = { verified: false, payment_status: 'pending' };
        }

        const isVerified = Boolean(data.verified || data.payment_status === 'paid' || data.status === 'confirmed' || data.attempt_status === 'matched');
        console.log(`[UPI STATUS] verified=${isVerified}`);

        setConsecutiveFailures(0);
        setIsReconnecting(false);

        if (isVerified) {
          setPaymentState('PAYMENT_VERIFIED');
          haptic.checkout();
          return;
        }

        if (data.attempt_status === 'detected') {
          setPaymentState('PAYMENT_DETECTED');
          setTimeout(() => setPaymentState('VERIFYING'), 2000);
        } else if (data.attempt_status === 'ambiguous') {
          setPaymentState('PAYMENT_AMBIGUOUS');
        } else if (data.attempt_status === 'expired') {
          setPaymentState('PAYMENT_EXPIRED');
        }
        return;
      }

      // Handle HTTP error codes without breaking payment UI
      if (res.status === 401 || res.status === 403) {
        console.warn('[UPI STATUS] authorization issue:', res.status);
      } else if (res.status === 404) {
        console.warn('[UPI STATUS] order not found:', effectiveOrderId);
      } else if (res.status === 429 || res.status >= 500) {
        console.warn('[UPI STATUS] temporary server/rate issue:', res.status);
      }
    } catch (fetchErr) {
      console.warn('[UPI STATUS] temporary failure:', fetchErr);
    }

    // Secondary Fallback: Query Supabase client directly
    try {
      const { data: ord } = await supabase
        .from('orders')
        .select('payment_status, status, utr')
        .or(`id.eq.${effectiveOrderId},id.eq.FB-${effectiveOrderId}`)
        .maybeSingle();

      if (ord && (ord.payment_status === 'paid' || ord.status === 'confirmed')) {
        console.log('[UPI STATUS] verified=true (fallback db)');
        setPaymentState('PAYMENT_VERIFIED');
        setConsecutiveFailures(0);
        setIsReconnecting(false);
        haptic.checkout();
        return;
      }

      const { data: att } = await supabase
        .from('payment_attempts')
        .select('status, expires_at')
        .or(`order_id.eq.${effectiveOrderId},order_id.eq.FB-${effectiveOrderId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (att) {
        setConsecutiveFailures(0);
        setIsReconnecting(false);

        if (att.status === 'matched') {
          console.log('[UPI STATUS] verified=true (fallback attempt)');
          setPaymentState('PAYMENT_VERIFIED');
          haptic.checkout();
        } else if (att.status === 'detected') {
          setPaymentState('PAYMENT_DETECTED');
          setTimeout(() => setPaymentState('VERIFYING'), 2000);
        } else if (att.status === 'ambiguous') {
          setPaymentState('PAYMENT_AMBIGUOUS');
        } else if (att.status === 'expired') {
          setPaymentState('PAYMENT_EXPIRED');
        }
        return;
      }
    } catch (e) {
      console.warn('[UPI STATUS] fallback DB poll warning:', e);
    }

    // Gentle failure counter (does NOT crash session, does NOT reset timer, does NOT show full error card)
    console.log('[UPI STATUS] retrying');
    setConsecutiveFailures((prev) => {
      const next = prev + 1;
      if (next >= 2) {
        setIsReconnecting(true);
      }
      return next;
    });
  }, [effectiveOrderId, paymentState]);

  useEffect(() => {
    if (!effectiveOrderId || paymentState === 'PAYMENT_VERIFIED') return;

    // Realtime subscription setup
    try {
      const channel = supabase
        .channel(`payment_verification_${effectiveOrderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${effectiveOrderId}`
          },
          (payload) => {
            const newOrd = payload.new;
            if (newOrd?.payment_status === 'paid' || newOrd?.status === 'confirmed') {
              setPaymentState('PAYMENT_VERIFIED');
              haptic.checkout();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payment_attempts',
            filter: `order_id=eq.${effectiveOrderId}`
          },
          (payload) => {
            const newAtt = payload.new as any;
            if (newAtt?.status === 'matched') {
              setPaymentState('PAYMENT_VERIFIED');
              haptic.checkout();
            } else if (newAtt?.status === 'detected') {
              setPaymentState('PAYMENT_DETECTED');
              setTimeout(() => setPaymentState('VERIFYING'), 2000);
            } else if (newAtt?.status === 'ambiguous') {
              setPaymentState('PAYMENT_AMBIGUOUS');
            }
          }
        )
        .subscribe();

      realtimeChannelRef.current = channel;
    } catch (e) {
      console.warn('[UPICheckout] Realtime subscription warning:', e);
    }

    // 2.5-second fallback polling interval
    const pollInterval = setInterval(() => {
      checkAuthoritativeStatus();
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [effectiveOrderId, paymentState, checkAuthoritativeStatus]);

  // Handle Back Navigation with Modal Guard
  const handleBackClick = () => {
    if (paymentState === 'WAITING_FOR_PAYMENT' || paymentState === 'PAYMENT_DETECTED' || paymentState === 'VERIFYING') {
      setShowLeaveModal(true);
    } else {
      navigate(-1);
    }
  };

  // Copy UPI ID Action
  const handleCopyUpi = () => {
    navigator.clipboard.writeText(DEFAULT_UPI_ID);
    setCopiedUpi(true);
    haptic.light();
    toast.success('UPI ID copied to clipboard!');
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // Open UPI App Action
  const totalPrice = orderDetails?.totalPrice || orderDetails?.total || 0;
  const upiUri = `upi://pay?pa=${DEFAULT_UPI_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${totalPrice.toFixed(2)}&cu=INR`;

  const handleOpenUpiApp = () => {
    haptic.medium();
    window.location.href = upiUri;
  };

  // Manual Screenshot Upload & Verification
  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File too large. Please upload an image under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
        toast.success('Screenshot attached!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualVerify = async () => {
    if (!utr || utr.length < 10) {
      toast.error('Please enter a valid 10-12 digit UTR / Reference number');
      utrInputRef.current?.focus();
      return;
    }

    setIsVerifyingManual(true);
    try {
      // Check for duplicate UTR in Supabase
      const { data: duplicateOrders } = await supabase
        .from('orders')
        .select('id, total')
        .eq('utr', utr);

      if (duplicateOrders && duplicateOrders.length > 0) {
        if (duplicateOrders.some((d: any) => d.id !== effectiveOrderId)) {
          toast.error(`This UTR has already been used for order #${formatOrderId(duplicateOrders[0].id)}.`);
          setIsVerifyingManual(false);
          return;
        }
      }

      await supabaseService.updateData('orders', effectiveOrderId, {
        utr: utr,
        payment_screenshot: screenshot,
        status: 'pending',
        payment_status: 'pending_verification',
        updated_at: new Date().toISOString()
      });

      const orderSummary = {
        orderId: effectiveOrderId,
        customerName: orderDetails?.name || 'Customer',
        phone: orderDetails?.phone || '',
        address: orderDetails?.address || '',
        method: 'upi' as const,
        amount: totalPrice,
        delivery_charge: orderDetails?.delivery_charge || 0,
        discount: orderDetails?.discount || 0,
        couponCode: orderDetails?.couponCode || null,
        utr: utr,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        estimatedDelivery: orderDetails?.estimatedDelivery || 25
      };

      setConfirmedOrder(orderSummary);
      setShowConfirmation(true);
      haptic.checkout();

      if (user) {
        addNotification({
          title: 'Payment Reference Submitted',
          message: `UTR #${utr} submitted for order #${formatOrderId(effectiveOrderId)}.`,
          type: 'order',
          user_id: user.uid,
          link: `/order-tracking/${effectiveOrderId}`
        });
      }

      openWhatsAppOrder(orderSummary);
      clearCart();
      toast.success('Payment Reference Submitted!');
    } catch (error: any) {
      console.error('Manual verification failed:', error);
      toast.error('Submission failed. Please try again.');
    } finally {
      setIsVerifyingManual(false);
    }
  };

  const handleViewOrder = () => {
    clearCart();
    navigate(user ? '/orders' : `/order-tracking/${effectiveOrderId}`);
  };

  // Order Confirmation screen if manual reference confirmed
  if (showConfirmation && confirmedOrder) {
    return (
      <OrderConfirmation 
        isOpen={showConfirmation}
        orderData={confirmedOrder}
        onClose={() => {
          setShowConfirmation(false);
          navigate(user ? '/orders' : `/order-tracking/${confirmedOrder.orderId}`);
        }}
      />
    );
  }

  return (
    <div className="min-h-svh flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Leave Guard Modal */}
      <PaymentLeaveModal
        isOpen={showLeaveModal}
        onStay={() => setShowLeaveModal(false)}
        onLeave={() => {
          setShowLeaveModal(false);
          navigate(-1);
        }}
      />

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto max-w-2xl mx-auto px-4 py-6 md:py-12 space-y-6 pb-36">
        
        {/* Navigation Bar Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={handleBackClick}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all active:scale-95"
            aria-label="Go back"
          >
            <ChevronLeft size={22} />
          </button>
          
          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight italic uppercase">
              Frosty Bite
            </h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              <ShieldCheck size={12} /> Secure UPI Payment
            </p>
          </div>

          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Order</p>
            <p className="text-xs font-black text-primary font-mono">#{formatOrderId(effectiveOrderId)}</p>
          </div>
        </div>

        {/* Prominent Payment Amount Card */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl p-6 text-center space-y-2 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
          <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Total Amount Payable</p>
          <div className="text-4xl md:text-5xl font-black text-white italic tracking-tight">
            ₹{totalPrice.toFixed(2)}
          </div>
          {orderDetails?.discount > 0 && (
            <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              Includes Discount -₹{orderDetails.discount}
            </div>
          )}
        </div>

        {/* Subtle Reconnecting Banner */}
        {isReconnecting && paymentState !== 'PAYMENT_VERIFIED' && paymentState !== 'ERROR' && (
          <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs font-bold animate-pulse shadow-lg text-center">
            <Loader2 size={14} className="animate-spin text-amber-400 shrink-0" />
            <span>Reconnecting to payment verification server...</span>
          </div>
        )}

        {/* Live Payment Verification Status Card */}
        <PaymentStatusCard
          paymentState={paymentState}
          amount={totalPrice}
          timeLeftSeconds={timeLeftSeconds}
          onRetry={paymentState === 'ERROR' ? () => initializePaymentSession() : checkAuthoritativeStatus}
          onViewOrder={handleViewOrder}
          onRestartPayment={() => initializePaymentSession()}
          reducedMotion={reducedMotion}
        />

        {/* Main Payment Options (QR Code & Deep Link) */}
        {paymentState !== 'PAYMENT_VERIFIED' && (
          <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h2 className="text-base font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                  <QrCode size={18} className="text-primary" /> Pay via Any UPI App
                </h2>
                <p className="text-xs text-zinc-400">Scan QR or tap to open app</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">UPI Auto-Verify</span>
              </div>
            </div>

            {/* QR Code Section */}
            <div id="qr-section" className="flex flex-col items-center space-y-5">
              <div className="relative group bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center">
                <div className="text-center mb-3">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Frosty Bite Official Payee</p>
                  <p className="text-xs font-black text-zinc-900 font-mono">{DEFAULT_UPI_ID}</p>
                </div>

                <motion.div
                  animate={reducedMotion ? {} : { y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  className="p-2 bg-white rounded-2xl border border-zinc-100"
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`}
                    alt="UPI Payment QR Code"
                    className="w-[190px] h-[190px] rounded-xl object-contain"
                  />
                </motion.div>

                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-3">
                  Scan with GPay, PhonePe, Paytm, or BHIM
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full max-w-sm space-y-3">
                <button
                  onClick={handleOpenUpiApp}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2.5"
                >
                  <Smartphone size={18} />
                  <span>Open UPI App (Pay ₹{totalPrice.toFixed(2)})</span>
                  <ExternalLink size={14} className="opacity-70" />
                </button>

                {/* Copy UPI ID */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Merchant UPI ID</p>
                      <p className="text-xs font-black text-white font-mono">{DEFAULT_UPI_ID}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyUpi}
                    className="py-2 px-3 bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-black uppercase tracking-widest text-white rounded-xl transition-all flex items-center gap-1.5"
                  >
                    {copiedUpi ? (
                      <>
                        <Check size={14} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>


          </div>
        )}

        {/* Footer Badges */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center space-y-1">
            <BadgeCheck className="text-emerald-400" size={20} />
            <p className="text-[10px] font-black text-white uppercase tracking-widest">Instant Detection</p>
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">FrostyPay Engine</p>
          </div>
          <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 flex flex-col items-center text-center space-y-1">
            <Lock className="text-primary" size={20} />
            <p className="text-[10px] font-black text-white uppercase tracking-widest">256-Bit Encrypted</p>
            <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Bank Grade Security</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UPICheckout;
