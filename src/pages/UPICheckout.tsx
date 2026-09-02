import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { GuestSessionManager } from '../core/guest/GuestSessionManager';

const DEFAULT_UPI_ID = "7735800239@ibl";
const DISPLAY_UPI_ID = "frostybite@upi";
const MERCHANT_NAME = "FrostyBite";
const PAYMENT_DURATION_MS = 6 * 60 * 1000; // 6 minutes

function cleanOrderIdString(rawOrderId?: string | null): string {
  if (!rawOrderId || typeof rawOrderId !== 'string') return '';
  let cleaned = rawOrderId.trim();
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch (e) {}
  cleaned = cleaned.trim();
  if (cleaned.includes(' ')) {
    cleaned = cleaned.split(/\s+/)[0];
  }
  cleaned = cleaned.replace(/[^a-zA-Z0-9_-]+$/, '');
  return cleaned;
}

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

  const rawOrderId = state?.orderId || paramOrderId || '';
  const effectiveOrderId = useMemo(() => cleanOrderIdString(rawOrderId), [rawOrderId]);

  const { cart, clearCart } = useCart();
  const { user, authStatus, loading: authLoading, openAuthModal, getAuthToken } = useAuth();
  const { addNotification } = useNotifications();

  // Core Payment State
  const [paymentState, setPaymentState] = useState<PaymentState>('IDLE');
  const [orderDetails, setOrderDetails] = useState<any>(state || null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [consecutiveFailures, setConsecutiveFailures] = useState<number>(0);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Diagnostic & Fallback tracking states
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  const [launchTime, setLaunchTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pageVisibility, setPageVisibility] = useState<string>(document.visibilityState);
  const [diagnosticLaunchMethod, setDiagnosticLaunchMethod] = useState<string>('None yet');

  const utrInputRef = useRef<HTMLInputElement>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Tracks time elapsed since component load
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Syncs page visibility state dynamically
  useEffect(() => {
    const updateVisibility = () => {
      setPageVisibility(document.visibilityState);
    };
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  // Synchronized refs to avoid stale closures and prevent timer/polling teardowns on re-renders
  const expiresAtMsRef = useRef<number | null>(expiresAtMs);
  const paymentStateRef = useRef<PaymentState>(paymentState);
  const orderDetailsRef = useRef<any>(orderDetails);

  useEffect(() => {
    expiresAtMsRef.current = expiresAtMs;
  }, [expiresAtMs]);

  useEffect(() => {
    paymentStateRef.current = paymentState;
  }, [paymentState]);

  useEffect(() => {
    orderDetailsRef.current = orderDetails;
  }, [orderDetails]);

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

    if (authStatus === 'loading' || authLoading) {
      console.log('[UPICheckout] AuthContext is still loading. Suppressing payment initialization.');
      return;
    }

    setPaymentState('CREATING_ATTEMPT');
    setIsReconnecting(false);

    try {
      // Step A: Fetch order from database to inspect owner user_id
      let currentOrder = orderDetailsRef.current;
      let dbOrder: any = null;
      try {
        const { data } = await supabase
          .from('orders')
          .select('id, user_id, customer_name, phone, customer_phone, address, delivery_address, notes, discount, delivery_charge, payment_status, status, total')
          .or(`id.ilike.${effectiveOrderId},id.ilike.FB-${effectiveOrderId}`)
          .maybeSingle();
        dbOrder = data;

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
      } catch (e) {
        console.warn('[UPICheckout] Error pre-fetching order details:', e);
      }

      if (currentOrder && (currentOrder.payment_status === 'paid' || currentOrder.status === 'confirmed')) {
        setPaymentState('PAYMENT_VERIFIED');
        return;
      }

      // Step B: Determine order type path based on database state
      const isRegisteredOrder = !!(dbOrder && dbOrder.user_id && !dbOrder.user_id.startsWith('guest_'));

      // Step C: Retrieve fresh active token (Supabase or Firebase) via unified AuthContext
      let sessionPresent = authStatus === 'authenticated';
      let accessTokenPresent = false;
      let safeUserId = user?.uid || '';
      let authHeader: Record<string, string> = {};

      if (isRegisteredOrder) {
        try {
          console.log('[UPICheckout] Registered order: Obtaining current valid Supabase session...');
          const { AuthManager } = await import('../core/auth/AuthManager');
          await AuthManager.restoreSession();
          await AuthManager.refreshSession();
        } catch (sessionErr) {
          console.warn('[UPICheckout] Failed to restore/refresh Supabase session:', sessionErr);
        }
      }

      try {
        const token = await getAuthToken();
        if (token) {
          accessTokenPresent = true;
          authHeader = { Authorization: `Bearer ${token}` };
        }
      } catch (e) {
        console.warn('[UPICheckout] Error fetching current unified auth token:', e);
      }

      // Safe diagnostics log
      console.log('[UPI DIAGNOSTIC LOG]', {
        authState: authStatus,
        sessionPresent,
        accessTokenPresent,
        userId: safeUserId || 'none',
        orderId: effectiveOrderId
      });

      let guestSessionId = '';
      try {
        const guestState = GuestSessionManager.get();
        if (guestState?.guestSessionId) {
          guestSessionId = guestState.guestSessionId;
        }
      } catch (e) {}

      // Separation of registered vs guest headers
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (isRegisteredOrder) {
        if (accessTokenPresent && authHeader.Authorization) {
          reqHeaders['Authorization'] = authHeader.Authorization;
        } else {
          console.warn('[UPICheckout] Registered order but no access token is available.');
          setErrorStatus(401);
          setErrorMessage('Authentication required for registered customer order. Please log in.');
          setPaymentState('ERROR');
          return;
        }
      } else {
        if (guestSessionId) {
          reqHeaders['X-Guest-Session'] = guestSessionId;
        } else {
          console.warn('[UPICheckout] Guest order but no guest session ID is found.');
          setErrorStatus(400);
          setErrorMessage('Guest session is missing or expired.');
          setPaymentState('ERROR');
          return;
        }
      }

      const payload = {
        order_id: effectiveOrderId,
        guest_session_id: !isRegisteredOrder ? (guestSessionId || undefined) : undefined,
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
            headers: reqHeaders,
            body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (response.ok && data.success && data.payment_attempt) {
            const attempt = data.payment_attempt;
            const srvOrder = data.order;
            setAttemptId(attempt.id);

            const expMs = Date.parse(attempt.expires_at);
            const nowMs = Date.now();
            const remainingMs = expMs - nowMs;
            const remSecs = Math.max(0, Math.ceil(remainingMs / 1000));

            console.log('[UPI DIAGNOSTIC] attempt loaded:', {
              attempt_id: attempt.id,
              status: attempt.status,
              created_at: attempt.created_at,
              expires_at: attempt.expires_at,
              nowMs,
              expiresAtMs: expMs,
              remainingMs,
              remSecs
            });

            setExpiresAtMs(expMs);
            setTimeLeftSeconds(remSecs);

            // Populate orderDetails from server order payload if client DB query returned empty
            const totalPaise = attempt.amount_paise ? Number(attempt.amount_paise) / 100 : 0;
            const resolvedTotal = srvOrder?.total ?? totalPaise;
            if ((!currentOrder || !currentOrder.totalPrice) && resolvedTotal > 0) {
              currentOrder = {
                orderId: srvOrder?.id || attempt.order_id || effectiveOrderId,
                totalPrice: resolvedTotal,
                name: srvOrder?.customer_name || 'Customer',
                phone: srvOrder?.phone || '',
                address: srvOrder?.address || '',
                payment_status: srvOrder?.payment_status || 'pending',
                status: srvOrder?.status || 'pending'
              };
              setOrderDetails(currentOrder);
            }

            if (remSecs <= 0 || attempt.status === 'expired') {
              console.warn('[UPI DIAGNOSTIC] attempt is expired, transition to PAYMENT_EXPIRED');
              setPaymentState('PAYMENT_EXPIRED');
            } else {
              setPaymentState('WAITING_FOR_PAYMENT');
            }

            setConsecutiveFailures(0);
            setErrorStatus(null);
            setErrorMessage(null);
            created = true;
            break;
          } else if (response.status === 401 && isRegisteredOrder) {
            console.warn('[UPICheckout] Received 401 for registered order. Fetching fresh token and retrying once...');
            
            // Retry Rule: Retrieve a fresh token using getAuthToken
            let freshHeaders = { ...reqHeaders };
            try {
              const freshToken = await getAuthToken();
              if (freshToken) {
                freshHeaders['Authorization'] = `Bearer ${freshToken}`;
                console.log('[UPICheckout] Retrieved fresh token during retry path.');
              }
            } catch (e) {
              console.warn('[UPICheckout] Exception during retry token fetch:', e);
            }

            // Retry the request ONCE with the fresh access token
            try {
              const retryResponse = await fetch('/api/payment/create-attempt', {
                method: 'POST',
                headers: freshHeaders,
                body: JSON.stringify(payload)
              });

              const retryData = await retryResponse.json();

              if (retryResponse.ok && retryData.success && retryData.payment_attempt) {
                console.log('[UPICheckout] Retry succeeded!');
                const attempt = retryData.payment_attempt;
                const srvOrder = retryData.order;
                setAttemptId(attempt.id);

                const expMs = Date.parse(attempt.expires_at);
                const nowMs = Date.now();
                const remainingMs = expMs - nowMs;
                const remSecs = Math.max(0, Math.ceil(remainingMs / 1000));

                setExpiresAtMs(expMs);
                setTimeLeftSeconds(remSecs);

                const totalPaise = attempt.amount_paise ? Number(attempt.amount_paise) / 100 : 0;
                const resolvedTotal = srvOrder?.total ?? totalPaise;
                if ((!currentOrder || !currentOrder.totalPrice) && resolvedTotal > 0) {
                  currentOrder = {
                    orderId: srvOrder?.id || attempt.order_id || effectiveOrderId,
                    totalPrice: resolvedTotal,
                    name: srvOrder?.customer_name || 'Customer',
                    phone: srvOrder?.phone || '',
                    address: srvOrder?.address || '',
                    payment_status: srvOrder?.payment_status || 'pending',
                    status: srvOrder?.status || 'pending'
                  };
                  setOrderDetails(currentOrder);
                }

                if (remSecs <= 0 || attempt.status === 'expired') {
                  setPaymentState('PAYMENT_EXPIRED');
                } else {
                  setPaymentState('WAITING_FOR_PAYMENT');
                }

                setConsecutiveFailures(0);
                setErrorStatus(null);
                setErrorMessage(null);
                created = true;
                break;
              } else {
                console.error('[UPICheckout] Retry failed with status:', retryResponse.status);
                setErrorStatus(retryResponse.status);
                setErrorMessage(retryData.message || 'Session / Auth Problem. Please sign in again.');
                setPaymentState('ERROR');
                created = true;
                break;
              }
            } catch (retryErr: any) {
              console.error('[UPICheckout] Retry network/unexpected error:', retryErr);
              setErrorStatus(500);
              setErrorMessage(retryErr.message || 'Verification failed. Please try again.');
              setPaymentState('ERROR');
              created = true;
              break;
            }
          } else if (response.status === 400) {
            const isAlreadyPaid = data.message?.toLowerCase().includes('already paid');
            if (isAlreadyPaid) {
              setPaymentState('PAYMENT_VERIFIED');
            } else {
              console.warn('[UPICheckout] Non-retryable payment creation response (400):', data.message || data.error);
              setErrorStatus(400);
              setErrorMessage(data.message || 'Payment attempts are only allowed for online/UPI payments.');
              setPaymentState('ERROR');
            }
            created = true;
            break;
          } else if (attemptNum < maxAttempts) {
            console.warn(`[UPICheckout] Attempt ${attemptNum} creation failed, retrying in ${delayMs}ms...`);
            await new Promise((res) => setTimeout(res, delayMs));
            delayMs *= 2;
          } else {
            console.error('[UPICheckout] Final attempt creation failed:', data);
            setErrorStatus(response.status);
            setErrorMessage(data.message || 'Unable to create payment session');
            setPaymentState('ERROR');
          }
        } catch (err: any) {
          console.warn(`[UPICheckout] Creation network error on attempt ${attemptNum}:`, err);
          if (attemptNum < maxAttempts) {
            await new Promise((res) => setTimeout(res, delayMs));
            delayMs *= 2;
          } else {
            setErrorStatus(0);
            setErrorMessage('Network connection failed. Please check your internet connection and retry.');
            setPaymentState('ERROR');
          }
        }
      }
    } catch (err: any) {
      console.error('[UPICheckout] Initialization unexpected error:', err);
      setErrorStatus(500);
      setErrorMessage(err.message || 'Unexpected initialization error.');
      setPaymentState('ERROR');
    }
  }, [effectiveOrderId, navigate, authStatus, authLoading]);

  useEffect(() => {
    initializePaymentSession();
  }, [initializePaymentSession]);

  // 2. Timer Countdown Effect (1000ms tick derived from authoritative expiresAtMs)
  useEffect(() => {
    if (!expiresAtMs) return;

    const tick = () => {
      const targetMs = expiresAtMsRef.current;
      const currentState = paymentStateRef.current;

      if (
        !targetMs ||
        currentState === 'PAYMENT_VERIFIED' ||
        currentState === 'IDLE' ||
        currentState === 'PAYMENT_EXPIRED' ||
        currentState === 'ERROR'
      ) {
        return;
      }

      const nowMs = Date.now();
      const remainingMs = targetMs - nowMs;
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

      console.log('[TIMER]', {
        expiresAtMs: targetMs,
        nowMs,
        remainingMs,
        remainingSeconds
      });

      setTimeLeftSeconds(remainingSeconds);

      if (remainingMs <= 0 || remainingSeconds <= 0) {
        console.log('[UPI TIMER] Timer hit 0, setting PAYMENT_EXPIRED');
        setTimeLeftSeconds(0);
        setPaymentState('PAYMENT_EXPIRED');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [expiresAtMs]);

  // 3. Realtime Subscription & Resilient Fallback Polling Loop
  const checkAuthoritativeStatus = useCallback(async () => {
    const currentState = paymentStateRef.current;
    if (!effectiveOrderId || currentState === 'PAYMENT_VERIFIED' || currentState === 'PAYMENT_EXPIRED') return;

    console.log('[UPI STATUS] request started');

    // Primary: Call server-side payment status endpoint
    try {
      let authHeader: Record<string, string> = {};
      try {
        const token = await getAuthToken();
        if (token) {
          authHeader = { Authorization: `Bearer ${token}` };
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

        if (data.total && (!orderDetails || !orderDetails.totalPrice)) {
          setOrderDetails((prev: any) => ({
            ...prev,
            orderId: data.order_id || effectiveOrderId,
            totalPrice: Number(data.total),
            payment_status: data.payment_status,
            status: data.status
          }));
        }

        if (data.expires_at) {
          const expMs = Date.parse(data.expires_at);
          const nowMs = Date.now();
          if (expMs <= nowMs) {
            setPaymentState('PAYMENT_EXPIRED');
            return;
          }
          setExpiresAtMs((prev) => (prev !== expMs ? expMs : prev));
        }

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
        } else if (data.attempt_status === 'waiting') {
          if (currentState !== 'WAITING_FOR_PAYMENT' && currentState !== 'PAYMENT_DETECTED' && currentState !== 'VERIFYING') {
            setPaymentState('WAITING_FOR_PAYMENT');
          }
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
        .or(`id.ilike.${effectiveOrderId},id.ilike.FB-${effectiveOrderId}`)
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
        .or(`order_id.ilike.${effectiveOrderId},order_id.ilike.FB-${effectiveOrderId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (att) {
        setConsecutiveFailures(0);
        setIsReconnecting(false);

        if (att.expires_at) {
          const expMs = Date.parse(att.expires_at);
          const nowMs = Date.now();
          if (expMs <= nowMs || att.status === 'expired') {
            setPaymentState('PAYMENT_EXPIRED');
            return;
          }
          setExpiresAtMs((prev) => (prev !== expMs ? expMs : prev));
        }

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
  }, [effectiveOrderId]);

  useEffect(() => {
    if (!effectiveOrderId || paymentStateRef.current === 'PAYMENT_VERIFIED') return;

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
  }, [effectiveOrderId, checkAuthoritativeStatus]);

  // Resilient focus & visibility observer that refreshes transaction status without mutating local state
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[UPI_BROWSER_RETURN] Browser became visible. Authoritative polling triggered.');
        checkAuthoritativeStatus();
      }
    };

    const handleFocus = () => {
      console.log('[UPI_BROWSER_RETURN] Browser window refocused. Authoritative polling triggered.');
      checkAuthoritativeStatus();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkAuthoritativeStatus]);

  // Log QR availability when waiting for payment
  useEffect(() => {
    if (paymentState === 'WAITING_FOR_PAYMENT') {
      console.log('[QR_AVAILABLE] Authoritative payment QR is fully loaded, rendered, and active.');
    }
  }, [paymentState]);

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
  const upiUri = `upi://pay?pa=${DEFAULT_UPI_ID}&pn=${encodeURIComponent("Frosty Bite")}&am=${totalPrice.toFixed(2)}&cu=INR&tn=${encodeURIComponent(effectiveOrderId)}`;

  // Developer Diagnostics Launcher
  const handleLaunchTestUri = (variant: 'A' | 'B' | 'C' | 'INTENT') => {
    let testUri = '';
    const paVal = DEFAULT_UPI_ID;
    const pnVal = "Frosty Bite";
    
    if (variant === 'A') {
      testUri = `upi://pay?pa=${paVal}&pn=${encodeURIComponent(pnVal)}&am=1.00&cu=INR`;
    } else if (variant === 'B' || variant === 'INTENT') {
      testUri = `upi://pay?pa=${paVal}&pn=${encodeURIComponent(pnVal)}&am=1.00&cu=INR&tn=TEST`;
    } else {
      // Variant C (Real URI)
      testUri = upiUri;
    }

    const paMasked = `***@${paVal.split('@')[1] || 'upi'}`;
    const scheme = 'upi://pay';
    const amVal = variant === 'C' ? totalPrice.toFixed(2) : '1.00';
    const tnVal = (variant === 'C') ? effectiveOrderId : (variant === 'A' ? '' : 'TEST');
    const fullUriMasked = `${scheme}?pa=${paMasked}&pn=${encodeURIComponent(pnVal)}&am=${amVal}&cu=INR${tnVal ? `&tn=${encodeURIComponent(tnVal)}` : ''}`;

    console.log(`[UPI DEV TEST ${variant}] Sanitized URI:`, {
      scheme,
      paMasked,
      pn: pnVal,
      am: amVal,
      cu: 'INR',
      tn: tnVal,
      fullUriMasked
    });

    try {
      window.location.href = testUri;
      toast.success(`Launched Test ${variant}!`);
    } catch (err) {
      console.error(`[UPI DEV TEST ${variant}] Error:`, err);
      toast.error(`Failed to launch Test ${variant}`);
    }
  };

  const handleOpenUpiApp = () => {
    haptic.medium();
    setDiagnosticLaunchMethod('window.location.href');
    setLaunchTime(Date.now());
    
    // Log intent attempt
    console.log('[UPI_INTENT_ATTEMPT] User triggered UPI App launcher. Payload preview:', {
      orderId: effectiveOrderId,
      amount: totalPrice.toFixed(2),
      vpaMasked: `***@${DEFAULT_UPI_ID.split('@')[1] || 'upi'}`
    });

    const scheme = 'upi://pay';
    const paMasked = `***@${DEFAULT_UPI_ID.split('@')[1] || 'upi'}`;
    const pnVal = "Frosty Bite";
    const amVal = totalPrice.toFixed(2);
    const cuVal = "INR";
    const tnVal = effectiveOrderId;
    const fullUriMasked = `${scheme}?pa=${paMasked}&pn=${encodeURIComponent(pnVal)}&am=${amVal}&cu=${cuVal}&tn=${encodeURIComponent(tnVal)}`;

    // Log intent dispatched
    console.log('[UPI_INTENT_DISPATCHED] Redirecting browser to UPI protocol scheme:', {
      scheme,
      paMasked,
      pn: pnVal,
      am: amVal,
      cu: cuVal,
      tn: tnVal,
      fullUriMasked
    });

    try {
      // Execute launch via window.location.href
      window.location.href = upiUri;

      // Start a 3-second gentle timeout to show the UI fallback notice
      setTimeout(() => {
        // Safe check to verify we are still waiting for payment
        if (paymentStateRef.current === 'WAITING_FOR_PAYMENT') {
          console.log('[UPI_LAUNCHER_FALLBACK] 3-second launcher timeout triggered. Activating visual QR/UPI helper banner on screen.');
          setShowFallbackNotice(true);
        }
      }, 3000);

    } catch (err) {
      console.error('[UPI_LAUNCHER_FALLBACK] Programmatic redirection failed immediately:', err);
      setShowFallbackNotice(true);
      toast.error("Unable to start payment in this app. Please scan the QR code or try another UPI app.", {
        duration: 6000
      });
    }
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

  if (authStatus === 'loading' || authLoading) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-zinc-950 text-white p-6">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-4" />
        <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Restoring secure session...</p>
      </div>
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
          errorStatus={errorStatus}
          errorMessage={errorMessage}
          onRetry={paymentState === 'ERROR' ? () => initializePaymentSession() : checkAuthoritativeStatus}
          onViewOrder={handleViewOrder}
          onRestartPayment={() => initializePaymentSession()}
          onBackToCheckout={() => navigate('/checkout')}
          reducedMotion={reducedMotion}
          onLogin={() => openAuthModal('Sign In to Pay', 'Authentication is required to complete payment for this registered customer order.')}
        />

        {/* Main Payment Options (QR Code & Deep Link) */}
        {(paymentState === 'WAITING_FOR_PAYMENT' ||
          paymentState === 'PAYMENT_DETECTED' ||
          paymentState === 'VERIFYING' ||
          paymentState === 'PAYMENT_AMBIGUOUS' ||
          paymentState === 'PAYMENT_NOT_MATCHED') && (
          <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 sm:space-y-6 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h2 className="text-base font-black text-white italic uppercase tracking-tight flex items-center gap-2">
                  <QrCode size={18} className="text-emerald-400" /> Pay securely using any UPI app
                </h2>
                <p className="text-xs text-zinc-400">Scan the QR code or tap the button below</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Auto Verify</span>
              </div>
            </div>

            {/* QR Code Section */}
            <div id="qr-section" className="flex flex-col items-center space-y-5">
              <div className="relative group bg-white rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center border border-zinc-100/20 w-full max-w-sm">
                <div className="text-center mb-3">
                  <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest mb-1 text-center bg-zinc-100 py-1.5 px-3 rounded-xl border border-zinc-200">
                    Scan QR with any UPI app
                  </h3>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mt-2">Frosty Bite Official UPI</p>
                  <p className="text-xs font-black text-zinc-900 font-mono tracking-tight">{DEFAULT_UPI_ID}</p>
                </div>

                <motion.div
                  animate={reducedMotion ? {} : { y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                  className="p-2 bg-white rounded-2xl border border-zinc-100 shadow-inner"
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`}
                    alt="UPI Payment QR Code"
                    className="w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] rounded-xl object-contain"
                  />
                </motion.div>

                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-3">
                  Scan to pay ₹{totalPrice.toFixed(2)}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full max-w-sm space-y-3">
                <button
                  onClick={handleOpenUpiApp}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2"
                >
                  <Smartphone size={18} />
                  <span>Open UPI App</span>
                  <ExternalLink size={14} className="opacity-70" />
                </button>

                {showFallbackNotice && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-amber-200 text-xs leading-relaxed space-y-1.5 shadow-md">
                    <p className="font-black uppercase tracking-wider text-[10px] text-amber-400">⚠️ App Switch Notice</p>
                    <p className="font-semibold text-amber-300">Unable to start payment in this app.</p>
                    <p className="text-zinc-300 font-medium">Please scan the QR code above or copy the UPI ID below to pay from any UPI app manually.</p>
                  </div>
                )}

                {/* Copy UPI ID */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">UPI ID</p>
                      <p className="text-xs font-black text-white font-mono">{DEFAULT_UPI_ID}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleCopyUpi}
                    className="py-2 px-3 bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-black uppercase tracking-widest text-white rounded-xl transition-all flex items-center gap-1.5"
                    aria-label="Copy UPI ID"
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

            {/* Crucial Safety Warning Notice */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center gap-2.5 text-amber-300 text-xs font-medium">
              <span className="text-base shrink-0">⚠️</span>
              <p className="leading-snug">
                Do not close or refresh this page while payment is processing.
              </p>
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

        {/* DEV-ONLY Diagnostic Controls */}
        <div className="mt-4 p-5 bg-zinc-950 border border-red-500/25 rounded-3xl space-y-5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="text-sm">🔧</span>
            <h3 className="text-xs font-black uppercase tracking-widest text-red-400">
              [DEV ONLY] UPI Intent Diagnostic Tools
            </h3>
          </div>
          
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Investigate deep-link app-switching and custom scheme handlers. Test programmatic launchers vs direct anchor links to bypass browser restrictions.
          </p>

          {/* Section: Live Diagnostic Metadata Grid */}
          <div className="p-3 bg-zinc-900 rounded-2xl border border-white/5 space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-red-400 block mb-1">
              Active Session Metadata
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono leading-tight">
              <div>
                <p className="text-zinc-500 uppercase text-[8px] font-bold">Launch Method</p>
                <p className="text-zinc-200 mt-0.5">{diagnosticLaunchMethod}</p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase text-[8px] font-bold">App Environment</p>
                <p className="text-zinc-200 mt-0.5">
                  {window.matchMedia('(display-mode: standalone)').matches ? "Standalone PWA" : "Normal Browser"}
                </p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase text-[8px] font-bold">URI Scheme</p>
                <p className="text-emerald-400 mt-0.5">upi://pay</p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase text-[8px] font-bold">Masked Payee VPA</p>
                <p className="text-zinc-200 mt-0.5">{`***@${DEFAULT_UPI_ID.split('@')[1] || 'upi'}`}</p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase text-[8px] font-bold">Reference (tn)</p>
                <p className="text-zinc-200 mt-0.5">{effectiveOrderId}</p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase text-[8px] font-bold">Amount (am)</p>
                <p className="text-zinc-200 mt-0.5">₹{totalPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase text-[8px] font-bold">Elapsed Time</p>
                <p className="text-zinc-200 mt-0.5">{elapsedSeconds}s</p>
              </div>
              <div>
                <p className="text-zinc-500 uppercase text-[8px] font-bold">Visibility State</p>
                <p className="text-amber-400 mt-0.5">{pageVisibility}</p>
              </div>
              <div className="col-span-2">
                <p className="text-zinc-500 uppercase text-[8px] font-bold">Last Attempt Timestamp</p>
                <p className="text-zinc-200 mt-0.5">
                  {launchTime ? new Date(launchTime).toLocaleTimeString() : 'Not triggered yet'}
                </p>
              </div>
              <div className="col-span-2 border-t border-white/5 pt-2 mt-1">
                <p className="text-zinc-500 uppercase text-[8px] font-bold">User Agent (Browser)</p>
                <p className="text-zinc-300 text-[9px] mt-0.5 break-all leading-normal">{navigator.userAgent}</p>
              </div>
            </div>
          </div>

          {/* Section 1: Programmatic JavaScript buttons */}
          <div className="space-y-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">
              Method 1: Programmatic JS (window.location.href)
            </span>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => {
                  setDiagnosticLaunchMethod('Programmatic JS (Test)');
                  setLaunchTime(Date.now());
                  handleLaunchTestUri('INTENT');
                }}
                className="w-full py-2.5 px-4 bg-red-950/40 hover:bg-red-900/50 text-red-200 border border-red-500/20 hover:border-red-500/40 font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all"
              >
                Test UPI Intent (Minimal 1.00 INR + tn=TEST)
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setDiagnosticLaunchMethod('Programmatic JS (Test A)');
                    setLaunchTime(Date.now());
                    handleLaunchTestUri('A');
                  }}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold uppercase tracking-widest text-[9px] rounded-lg border border-white/5 transition-all"
                >
                  TEST A (No tn)
                </button>
                <button
                  onClick={() => {
                    setDiagnosticLaunchMethod('Programmatic JS (Test B)');
                    setLaunchTime(Date.now());
                    handleLaunchTestUri('B');
                  }}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold uppercase tracking-widest text-[9px] rounded-lg border border-white/5 transition-all"
                >
                  TEST B (tn=TEST)
                </button>
                <button
                  onClick={() => {
                    setDiagnosticLaunchMethod('Programmatic JS (Test C)');
                    setLaunchTime(Date.now());
                    handleLaunchTestUri('C');
                  }}
                  className="py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold uppercase tracking-widest text-[9px] rounded-lg border border-white/5 transition-all"
                >
                  TEST C (Real)
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: HTML Anchor links for direct comparison */}
          <div className="space-y-2 pt-2.5 border-t border-white/5">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">
              Method 2: HTML Anchor Comparison (Direct Anchor click)
            </span>
            <div className="grid grid-cols-1 gap-2.5">
              <a
                href={`upi://pay?pa=${DEFAULT_UPI_ID}&pn=${encodeURIComponent("Frosty Bite")}&am=1.00&cu=INR&tn=TEST`}
                onClick={() => {
                  setDiagnosticLaunchMethod('Direct HTML Anchor (Test Intent)');
                  setLaunchTime(Date.now());
                  console.log('[UPI_INTENT_ATTEMPT] Direct HTML Anchor Test click triggered.');
                }}
                className="w-full py-2.5 px-4 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 border border-emerald-500/20 hover:border-emerald-500/40 font-bold uppercase tracking-widest text-[10px] rounded-xl block text-center transition-all"
              >
                Anchor: Test UPI Intent (1.00 INR + tn=TEST)
              </a>

              <div className="grid grid-cols-3 gap-2 text-center">
                <a
                  href={`upi://pay?pa=${DEFAULT_UPI_ID}&pn=${encodeURIComponent("Frosty Bite")}&am=1.00&cu=INR`}
                  onClick={() => {
                    setDiagnosticLaunchMethod('Direct HTML Anchor (Anchor A)');
                    setLaunchTime(Date.now());
                    console.log('[UPI_INTENT_ATTEMPT] Direct HTML Anchor A click triggered.');
                  }}
                  className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase tracking-widest text-[9px] rounded-lg border border-white/5 block transition-all"
                >
                  Anchor A (No tn)
                </a>
                <a
                  href={`upi://pay?pa=${DEFAULT_UPI_ID}&pn=${encodeURIComponent("Frosty Bite")}&am=1.00&cu=INR&tn=TEST`}
                  onClick={() => {
                    setDiagnosticLaunchMethod('Direct HTML Anchor (Anchor B)');
                    setLaunchTime(Date.now());
                    console.log('[UPI_INTENT_ATTEMPT] Direct HTML Anchor B click triggered.');
                  }}
                  className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase tracking-widest text-[9px] rounded-lg border border-white/5 block transition-all"
                >
                  Anchor B (tn=TEST)
                </a>
                <a
                  href={upiUri}
                  onClick={() => {
                    setDiagnosticLaunchMethod('Direct HTML Anchor (Anchor C - Real)');
                    setLaunchTime(Date.now());
                    console.log('[UPI_INTENT_ATTEMPT] Direct HTML Anchor C click triggered.');
                  }}
                  className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold uppercase tracking-widest text-[9px] rounded-lg border border-white/5 block transition-all"
                >
                  Anchor C (Real)
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UPICheckout;
