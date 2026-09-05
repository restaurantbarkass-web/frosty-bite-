import React, { useState, useRef, useEffect } from 'react';
import { 
  CreditCard, 
  Truck, 
  ShieldCheck, 
  ShoppingBag,
  ChevronRight,
  Wallet,
  HandCoins,
  CheckCircle2,
  ChevronLeft,
  User,
  Phone,
  MapPin,
  Loader2,
  QrCode,
  X,
  Zap,
  Ticket,
  Check,
  AlertTriangle,
  Map as MapIcon,
  Sparkles,
  Calendar,
  Clock,
  Cake,
  PartyPopper,
  Heart
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { CouponsRepository } from '../repositories';
import { supabaseService } from '../services/supabaseService';
import { emailService } from '../services/emailService';
import toast from 'react-hot-toast';
import { cn, haptic } from '../lib/utils';
import { OrderConfirmation } from '../components/OrderConfirmation';
import { RESTAURANT_LOCATION, BAKERY_ADDRESS, BAKERY_PICKUP_INSTRUCTIONS } from '../constants';
import { calculateDistance } from '../utils/distance';
import { openWhatsAppOrder } from '../utils/whatsapp';
import { generateOrderId } from '../utils/orderUtils';
import { useAppConfig } from '../hooks/useAppConfig';
import { appConfigService } from '../services/appConfigService';
import { useGeofence } from '../context/GeofenceContext';
import { useNotifications } from '../context/NotificationContext';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { playErrorShakeSound, playSuccessChime } from '../utils/soundEffects';

import { MapSelector } from '../components/MapSelector';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';
import { DeliveryDatePicker, DeliveryScheduleData } from '../components/DeliveryDatePicker';
import { SwipeToConfirm } from '../components/checkout/SwipeToConfirm';
import { safeTrim, safeTrimLowerCase } from '../utils/string';
import { geocode } from '../lib/geocoder';
import { GuestSessionManager } from '../core/guest/GuestSessionManager';

export const DELIVERY_TIME_SLOTS = [
  { id: 'morning', label: 'Morning', range: '09:00 AM - 12:00 PM', icon: '🌅', hint: 'Fresh Morning Bake' },
  { id: 'afternoon', label: 'Afternoon', range: '12:00 PM - 03:00 PM', icon: '☀️', hint: 'Lunch & Tea Celebrations' },
  { id: 'evening', label: 'Evening', range: '03:00 PM - 06:00 PM', icon: '🌇', hint: 'Evening Gatherings' },
  { id: 'night', label: 'Night', range: '06:00 PM - 09:00 PM', icon: '🌙', hint: 'Dinner & Cake Cutting' },
  { id: 'midnight', label: 'Midnight Surprise', range: '11:00 PM - 12:00 AM', icon: '🎂', hint: 'Midnight Celebration' },
  { id: 'custom', label: 'Specific Time', range: 'Choose Exact Time', icon: '⏱️', hint: 'Exact Hour & Minute' },
];

export const CAKE_OCCASIONS = [
  { id: 'Birthday', label: 'Birthday 🎂' },
  { id: 'Anniversary', label: 'Anniversary 💍' },
  { id: 'Party', label: 'Party / Gathering 🎉' },
  { id: 'Congratulations', label: 'Congratulations 🎓' },
  { id: 'Farewell', label: 'Farewell ✈️' },
  { id: 'Just Cravings', label: 'Sweet Cravings 😋' },
];

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, subtotal: cartSubtotal, clearCart, appliedCoupon, setAppliedCoupon } = useCart();
  const { user } = useAuth();
  const { userCoords, v2Serviceability } = useGeofence();
  const { addNotification } = useNotifications();
  const { 
    isOrderingOpen, 
    isPickupOnly,
    deliveryBaseFee, 
    deliveryFeePerKm, 
    deliveryFreeKm, 
    defaultDeliveryTime,
    geofencingEnabled,
    geofencingLatitude,
    geofencingLongitude,
    geofencingRadius,
    geofencingZones,
    isInstantDeliveryClosed,
    isLoading 
  } = useAppConfig();
  const [deliveryFee, setDeliveryFee] = useState(0);

  const [isOrdering, setIsOrdering] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  const deliverySectionRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const houseNumberRef = useRef<HTMLInputElement>(null);
  const landmarkRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const pincodeRef = useRef<HTMLInputElement>(null);
  const scheduledDateRef = useRef<HTMLInputElement>(null);

  const [invalidFields, setInvalidFields] = useState<Record<string, boolean>>({});
  const [shakeKey, setShakeKey] = useState<number>(0);

  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem('frostybite_checkout_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.name && (user?.displayName || user?.email?.split('@')[0])) {
          parsed.name = user?.displayName || user?.email?.split('@')[0];
        }
        if (!parsed.paymentMethod || (parsed.paymentMethod !== 'upi' && parsed.paymentMethod !== 'cod')) {
          parsed.paymentMethod = 'upi';
        }
        return parsed;
      }
    } catch (e) {}
    return {
      name: user?.displayName || user?.email?.split('@')[0] || '',
      phone: '',
      address: '',
      location: undefined as { lat: number; lng: number } | undefined,
      notes: '',
      paymentMethod: 'upi' as 'upi' | 'cod'
    };
  });

  const [addrFields, setAddrFields] = useState(() => {
    try {
      const saved = localStorage.getItem('frostybite_checkout_addr');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      houseNumber: '',
      streetName: '',
      landmark: '',
      city: 'Cuttack',
      pincode: ''
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('frostybite_checkout_form', JSON.stringify(formData));
    } catch (e) {}
  }, [formData]);

  useEffect(() => {
    try {
      localStorage.setItem('frostybite_checkout_addr', JSON.stringify(addrFields));
    } catch (e) {}
  }, [addrFields]);

  const [deliveryMode, setDeliveryMode] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledDay, setScheduledDay] = useState(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  });
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState<string>('evening');
  const [customDeliveryTime, setCustomDeliveryTime] = useState<string>('18:00');
  const [cakeMessage, setCakeMessage] = useState<string>('');
  const [cakeOccasion, setCakeOccasion] = useState<string>('Birthday');
  const [includeCandleKnife, setIncludeCandleKnife] = useState<boolean>(true);

  const hasCakeItems = cart.some(item => 
    (item.name && /cake|pastry|cupcake|bento|dessert|bake|brownie|tasting/i.test(item.name)) || 
    (item.category && /cake|dessert|bakery|pastr|sweet/i.test(item.category))
  );

  const getQuickDates = () => {
    const dates = [];
    const today = new Date();
    
    // Today
    const todayStr = today.toISOString().split('T')[0];
    dates.push({
      label: 'Today',
      sub: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dayName: today.toLocaleDateString('en-US', { weekday: 'short' }),
      value: todayStr,
    });

    // Tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    dates.push({
      label: 'Tomorrow',
      sub: tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dayName: tomorrow.toLocaleDateString('en-US', { weekday: 'short' }),
      value: tomorrowStr,
    });

    // Day After
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];
    dates.push({
      label: dayAfter.toLocaleDateString('en-US', { weekday: 'short' }),
      sub: dayAfter.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dayName: dayAfter.toLocaleDateString('en-US', { weekday: 'short' }),
      value: dayAfterStr,
    });

    return dates;
  };

  const getSelectedTimeLabel = () => {
    if (deliveryMode !== 'scheduled') {
      return 'Instant Delivery';
    }
    if (scheduledTimeSlot === 'custom') {
      if (!customDeliveryTime) return 'Specific Time';
      // Format 24h to 12h nicely
      const [hStr, mStr] = customDeliveryTime.split(':');
      const h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${mStr} ${ampm}`;
    }
    const slot = DELIVERY_TIME_SLOTS.find(s => s.id === scheduledTimeSlot);
    return slot ? `${slot.label} (${slot.range})` : 'Evening Slot';
  };

  const [validationResult, setValidationResult] = useState<{
    isValidating: boolean;
    success: boolean | null;
    message: string;
    estimatedDeliveryMins: number;
    reason?: string;
  }>({
    isValidating: false,
    success: null,
    message: '',
    estimatedDeliveryMins: 25
  });

  useEffect(() => {
    if (defaultDeliveryTime) {
      setValidationResult(prev => {
        if (prev.estimatedDeliveryMins === 25) {
          return { ...prev, estimatedDeliveryMins: defaultDeliveryTime };
        }
        return prev;
      });
    }
  }, [defaultDeliveryTime]);

  const hasDaysItems = cart.some(item => item.estimated_delivery_time_unit === 'days');

  const getDaysMaxString = () => {
    const daysItems = cart.filter(item => item.estimated_delivery_time_unit === 'days');
    if (daysItems.length === 0) return '';
    const maxDays = Math.max(...daysItems.map(item => item.estimated_delivery_time || 1));
    const stringItem = daysItems.find(item => item.estimated_delivery_time === maxDays);
    return stringItem?.estimated_delivery_time_string || `${maxDays} Days`;
  };

  const getCartAvailabilityWarning = () => {
    if (!scheduledDate || deliveryMode !== 'scheduled') {
      const daysItems = cart.filter(item => item.estimated_delivery_time_unit === 'days');
      if (daysItems.length > 0) {
        return `Instant delivery is not available as "${daysItems[0].name}" is a pre-order item requiring days. Please switch to Scheduled Delivery.`;
      }
      const restrictedItems = cart.filter(item => item.available_date || item.available_day);
      if (restrictedItems.length > 0) {
        return `"${restrictedItems[0].name}" is only available for pre-order. Please switch to Scheduled Delivery.`;
      }
      return null;
    }

    const todayNum = new Date();
    todayNum.setHours(0,0,0,0);
    const scheduledNum = new Date(scheduledDate);
    scheduledNum.setHours(0,0,0,0);
    
    const diffTime = scheduledNum.getTime() - todayNum.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    for (const item of cart) {
      if (item.estimated_delivery_time_unit === 'days') {
        const requiredDays = item.estimated_delivery_time || 1;
        if (diffDays < requiredDays) {
          const earliestDate = new Date(todayNum.getTime() + requiredDays * 24 * 60 * 60 * 1000);
          return `"${item.name}" requires at least ${requiredDays} days preparation. Please choose a scheduled date starting from ${earliestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} onwards.`;
        }
      }
      
      if (item.available_date && scheduledDate !== item.available_date) {
        const formattedDate = new Date(item.available_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return `"${item.name}" is only available on ${formattedDate}. Please select this exact date for scheduling delivery.`;
      }
      
      if (item.available_day && scheduledDay && item.available_day.toLowerCase() !== scheduledDay.toLowerCase()) {
        return `"${item.name}" is only available on ${item.available_day}s. Please choose a ${item.available_day} for delivery.`;
      }
    }
    return null;
  };

  useEffect(() => {
    if (isInstantDeliveryClosed || hasDaysItems) {
      setDeliveryMode('scheduled');
      if (!scheduledDate) {
        const today = new Date().toISOString().split('T')[0];
        handleDateChange(today);
      }
    }
  }, [isInstantDeliveryClosed, hasDaysItems]);

  const handleDateChange = (dateVal: string) => {
    setScheduledDate(dateVal);
    if (dateVal) {
      const date = new Date(dateVal);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      setScheduledDay(days[date.getDay()]);
    } else {
      setScheduledDay('');
    }
  };

  const validateDeliveryAddress = async (fieldsToValidate = addrFields, coords = formData.location) => {
    if (isPickupOnly) {
      setValidationResult({
        isValidating: false,
        success: true,
        message: '🛍 In-Store Pickup Active',
        estimatedDeliveryMins: 25
      });
      return true;
    }
    setValidationResult(prev => ({ ...prev, isValidating: true }));

    // Authoritative PostGIS V2 check if coordinates are provided or available
    const checkLat = coords?.lat || userCoords?.latitude;
    const checkLng = coords?.lng || userCoords?.longitude;

    if (checkLat && checkLng) {
      try {
        const v2Res = await fetch('/api/v2/geofencing/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: checkLat, longitude: checkLng })
        });

        if (v2Res.ok) {
          const contentType = v2Res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
             throw new Error("Received non-JSON response from server (likely a proxy fallback page)");
          }
          const v2Data = await v2Res.json();
          if (v2Data.serviceable) {
            if (v2Data.deliveryFee !== undefined) {
              setDeliveryFee(v2Data.deliveryFee);
            }
            setValidationResult({
              isValidating: false,
              success: true,
              message: `📍 Delivery Active (${v2Data.locality?.name || v2Data.city?.name || 'Service Zone'})`,
              estimatedDeliveryMins: v2Data.estimatedDeliveryMinutes || 25
            });
            return true;
          } else if (v2Data.reason === 'SERVICEABILITY_UNAVAILABLE') {
            setValidationResult({
              isValidating: false,
              success: false,
              reason: 'SERVICEABILITY_UNAVAILABLE',
              message: `⚠ Serviceability Temporarily Offline\n\nWe cannot verify serviceability right now because the database is offline. Please click retry below.`,
              estimatedDeliveryMins: 25
            });
            return false;
          } else {
            setValidationResult({
              isValidating: false,
              success: false,
              message: `🚫 Delivery Unavailable: ${v2Data.reason || 'OUTSIDE_SERVICE_AREA'}`,
              estimatedDeliveryMins: 25
            });
            return false;
          }
        } else {
          const v2Data = await v2Res.json().catch(() => ({}));
          setValidationResult({
            isValidating: false,
            success: false,
            reason: 'SERVICEABILITY_UNAVAILABLE',
            message: v2Data.message || `⚠ Serviceability Temporarily Offline\n\nDatabase is currently unreachable. Please click retry below.`,
            estimatedDeliveryMins: 25
          });
          return false;
        }
      } catch (err) {
        console.warn('[Checkout] PostGIS V2 validation request failed:', err);
        setValidationResult({
          isValidating: false,
          success: false,
          reason: 'SERVICEABILITY_UNAVAILABLE',
          message: `⚠ Serviceability Temporarily Offline\n\nDatabase is currently unreachable. Please check your internet connection and try again.`,
          estimatedDeliveryMins: 25
        });
        return false;
      }
    }

    try {
      const response = await fetch('/api/validate-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: `${fieldsToValidate.houseNumber ? fieldsToValidate.houseNumber + ', ' : ''}${fieldsToValidate.streetName ? fieldsToValidate.streetName + ', ' : ''}${fieldsToValidate.landmark ? fieldsToValidate.landmark + ', ' : ''}${fieldsToValidate.city}${fieldsToValidate.pincode ? ' - ' + fieldsToValidate.pincode : ''}`,
          coordinates: coords,
          fields: fieldsToValidate
        })
      });

      if (response.ok) {
        const data = await response.json();
        setValidationResult({
          isValidating: false,
          success: data.deliverable,
          message: data.message,
          estimatedDeliveryMins: data.estimatedDeliveryMins || 25
        });
        return data.deliverable;
      } else {
        const isLocalValid = (fieldsToValidate.city && String(fieldsToValidate.city).trim().toLowerCase() === 'cuttack') || 
                             (fieldsToValidate.pincode && String(fieldsToValidate.pincode).trim().startsWith('753')) ||
                             isLocationInServiceArea();

        setValidationResult({
          isValidating: false,
          success: isLocalValid,
          message: isLocalValid ? "📍 Delivery Active (Local Validation Active)" : 'Failed to validate address with backend.',
          estimatedDeliveryMins: 25
        });
        return isLocalValid;
      }
    } catch (err) {
      const isLocalValid = (fieldsToValidate.city && safeTrimLowerCase(fieldsToValidate.city) === 'cuttack') || 
                           (fieldsToValidate.pincode && safeTrim(fieldsToValidate.pincode).startsWith('753')) ||
                           isLocationInServiceArea();

      setValidationResult({
        isValidating: false,
        success: isLocalValid,
        message: isLocalValid ? "📍 Delivery Active (Offline Validation Active)" : 'Delivery check offline. Check network status.',
        estimatedDeliveryMins: 25
      });
      return isLocalValid;
    }
  };

  useEffect(() => {
    if (!addrFields.city) return;
    const combinedAddress = `${addrFields.houseNumber ? addrFields.houseNumber + ', ' : ''}${addrFields.streetName ? addrFields.streetName + ', ' : ''}${addrFields.landmark ? addrFields.landmark + ', ' : ''}${addrFields.city}${addrFields.pincode ? ' - ' + addrFields.pincode : ''}`;
    
    setFormData(prev => (prev.address === combinedAddress ? prev : {
      ...prev,
      address: combinedAddress
    }));

    const timer = setTimeout(() => {
      validateDeliveryAddress(addrFields, formData.location);
    }, 600);
    return () => clearTimeout(timer);
  }, [
    addrFields.houseNumber,
    addrFields.streetName,
    addrFields.landmark,
    addrFields.city,
    addrFields.pincode,
    formData.location?.lat,
    formData.location?.lng
  ]);

  const handleMapLocationSelected = (lat: number, lng: number, fullAddr: string) => {
    let city = 'Cuttack';
    let pincode = '';
    let street = '';
    
    if (fullAddr) {
      const parts = fullAddr.split(',');
      const addrLower = fullAddr.toLowerCase();
      if (addrLower.includes('bhubaneswar')) city = 'Bhubaneswar';
      else if (addrLower.includes('puri')) city = 'Puri';
      else if (addrLower.includes('cuttack')) city = 'Cuttack';
      
      const pinMatch = fullAddr.match(/\b\d{6}\b/);
      if (pinMatch) pincode = pinMatch[0];

      street = parts.slice(0, 3).join(', ').trim();
    }

    setAddrFields(prev => ({
      ...prev,
      streetName: street || prev.streetName,
      city: city,
      pincode: pincode || prev.pincode
    }));

    setFormData(prev => ({
      ...prev,
      address: fullAddr,
      location: { lat, lng }
    }));
  };

  const [isLocating, setIsLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const isLocationInServiceArea = () => {
    if (isPickupOnly) return true;
    if (!formData.location) return true;
    if (geofencingEnabled === false) return true;

    // Only block if explicitly flagged unserviceable by PostGIS geofencing
    if (v2Serviceability.status === 'unserviceable') return false;
    return true;
  };

  useEffect(() => {
    let newFee = deliveryBaseFee;
    
    if (formData.location) {
      const distance = calculateDistance(
        RESTAURANT_LOCATION.lat,
        RESTAURANT_LOCATION.lng,
        formData.location.lat,
        formData.location.lng
      );
      
      if (distance <= deliveryFreeKm) {
        newFee = 0;
      } else {
        // Using user's explicit rule: 
        // If distance > free limit -> base fee + (distance * per km rate)
        newFee = Math.round(deliveryBaseFee + (distance * deliveryFeePerKm));
      }
    }

    setDeliveryFee(prev => (prev === newFee ? prev : newFee));
  }, [
    formData.location?.lat, 
    formData.location?.lng, 
    deliveryBaseFee, 
    deliveryFeePerKm, 
    deliveryFreeKm
  ]);

  const subtotal = cartSubtotal;
  const discountAmount = appliedCoupon 
    ? (appliedCoupon.type === 'percentage' 
        ? (subtotal * appliedCoupon.value) / 100 
        : appliedCoupon.value)
    : 0;
  const effectiveDeliveryFee = isPickupOnly ? 0 : deliveryFee;
  const finalPrice = Math.max(0, subtotal - discountAmount + effectiveDeliveryFee);

  const handleApplyCoupon = async (codeOverride?: string) => {
    const trimmedCode = safeTrim(codeOverride || couponCode);
    if (!trimmedCode) {
      toast.error('Please enter a coupon code');
      return;
    }
    
    setIsApplyingCoupon(true);
    if (!codeOverride) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      const code = trimmedCode.toUpperCase();
      
      // 1. Fetch from Supabase coupons table
      let couponData: any = null;
      try {
        const { data: coupons, error } = await supabase
          .from('coupons')
          .select('*')
          .ilike('code', code)
          .eq('status', 'active')
          .limit(1);

        if (!error && coupons && coupons.length > 0) {
          couponData = coupons[0];
        }
      } catch (err) {
        console.warn('[Checkout] Supabase coupon query fallback:', err);
      }

      // 2. Fallback to locally cached coupons if network glitch
      if (!couponData) {
        try {
          const cached = JSON.parse(localStorage.getItem('coupons_cache') || '{}');
          if (Array.isArray(cached.data)) {
            couponData = cached.data.find(
              (c: any) => c.code?.toUpperCase() === code && c.status === 'active'
            );
          }
        } catch (e) {}
      }

      // 3. Built-in fallback for common initial promo coupons if db not populated yet
      if (!couponData && (code === 'FIRST10' || code === 'FIRSTORDER')) {
        couponData = {
          id: 'default-first-order',
          code: code,
          type: 'percentage',
          value: code === 'FIRST10' ? 10 : 20,
          min_order: 0,
          status: 'active',
          is_first_order_only: true
        };
      }

      if (!couponData) {
        toast.error('Invalid or expired coupon code');
        setIsApplyingCoupon(false);
        return;
      }
      const couponId = couponData.id || `coupon-${code}`;
      
      // Validate expiry if set
      if (couponData.expiry_date) {
        const expiryDateValue = new Date(couponData.expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!isNaN(expiryDateValue.getTime()) && expiryDateValue < today) {
          toast.error('This coupon has expired');
          setIsApplyingCoupon(false);
          return;
        }
      }

      // Validate min order
      if (subtotal < (couponData.min_order || 0)) {
        toast.error(`Minimum order ₹${couponData.min_order} required for this coupon`);
        setIsApplyingCoupon(false);
        return;
      }

      // Validate usage limit
      if ((couponData.usage_limit || 0) > 0 && (couponData.usage_count || 0) >= couponData.usage_limit) {
        toast.error('This coupon has reached its usage limit');
        setIsApplyingCoupon(false);
        return;
      }

      // If all checks pass
      setAppliedCoupon({ 
        id: couponId,
        code: couponData.code?.toUpperCase() || code, 
        value: Number(couponData.value) || 0,
        type: couponData.type || 'percentage',
        free_item_id: couponData.free_item_id,
        free_item_quantity: couponData.free_item_quantity,
        gift_url: couponData.gift_url
      });

      let discountDisplay = '';
      if (couponData.type === 'percentage') discountDisplay = `${couponData.value}% OFF`;
      else if (couponData.type === 'fixed') discountDisplay = `₹${couponData.value} OFF`;
      else if (couponData.type === 'free_item') discountDisplay = `FREE Gift`;
      else discountDisplay = 'Discount';

      toast.success(`${discountDisplay} applied successfully!`, { icon: '🎉' });
      
      try {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F97316', '#FFFFFF', '#DBEAFE']
        });
      } catch (e) {}
      
      setCouponCode('');
    } catch (error: any) {
      console.error('Error applying coupon:', error);
      toast.error('Failed to validate coupon');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.success('Coupon removed');
  };

  useEffect(() => {
    if (location.state?.fromBuyNow && deliverySectionRef.current) {
      const timer = setTimeout(() => {
        deliverySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setIsHighlighted(true);
        setTimeout(() => nameRef.current?.focus(), 800);
        setTimeout(() => setIsHighlighted(false), 3000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  useEffect(() => {
    try {
      const claimed = localStorage.getItem('claimed_coupon');
      if (claimed && !appliedCoupon) {
        localStorage.removeItem('claimed_coupon');
        handleApplyCoupon(claimed);
      }
    } catch (e) {}
  }, []);

  if (cart.length === 0 && !showConfirmation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6 bg-cream">
        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-primary">
          <ShoppingBag size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-chocolate uppercase italic tracking-tight">Your Cart is Empty</h2>
          <p className="text-gray-500">Looks like you haven't added any treats yet!</p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="btn-premium"
        >
          Browse Bakery
        </button>
      </div>
    );
  }

  const handlePlaceOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isOrdering) return;

    setIsOrdering(true);
    let freshOpen = isOrderingOpen;
    try {
      const freshConfig = await appConfigService.getConfig();
      if (freshConfig) {
        freshOpen = freshConfig.isOrderingOpen;
      }
    } catch (err) {
      console.warn('Failed to verify fresh ordering configuration:', err);
    }

    if (!freshOpen) {
      toast.error('Orders are currently closed. Please try again later.');
      setIsOrdering(false);
      return;
    }
    
    // Validate required form fields and trigger shake animation on missing or invalid ones
    const errors: Record<string, boolean> = {};

    if (!safeTrim(formData.name)) errors.name = true;
    if (!formData.phone || formData.phone.replace(/[^0-9]/g, '').length < 10) errors.phone = true;
    
    // Only require address & scheduling fields if NOT in Pickup Only mode
    if (!isPickupOnly) {
      if (!safeTrim(addrFields.houseNumber)) errors.houseNumber = true;
      if (!safeTrim(addrFields.streetName)) errors.streetName = true;
      if (!safeTrim(addrFields.landmark)) errors.landmark = true;
      if (!safeTrim(addrFields.city)) errors.city = true;
      if (!addrFields.pincode || addrFields.pincode.replace(/[^0-9]/g, '').length < 6) errors.pincode = true;
      if (deliveryMode === 'scheduled' && !scheduledDate) errors.scheduledDate = true;
    }

    if (Object.keys(errors).length > 0) {
      setInvalidFields(errors);
      setShakeKey(prev => prev + 1);
      playErrorShakeSound();

      const missingLabels: string[] = [];
      if (errors.name) missingLabels.push('Full Name');
      if (errors.phone) missingLabels.push('10-Digit Phone');
      if (errors.houseNumber) missingLabels.push('House / Flat / Plot');
      if (errors.streetName) missingLabels.push('Street / Area');
      if (errors.landmark) missingLabels.push('Landmark');
      if (errors.city) missingLabels.push('City');
      if (errors.pincode) missingLabels.push('6-Digit Pincode');
      if (errors.scheduledDate) missingLabels.push('Scheduled Date');

      toast.error(`Please fill in required fields: ${missingLabels.slice(0, 3).join(', ')}${missingLabels.length > 3 ? '...' : ''}`);

      if (errors.name) {
        nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nameRef.current?.focus();
      } else if (errors.phone) {
        phoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        phoneRef.current?.focus();
      } else if (errors.houseNumber && houseNumberRef.current) {
        houseNumberRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        houseNumberRef.current.focus();
      } else if (errors.landmark && landmarkRef.current) {
        landmarkRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        landmarkRef.current.focus();
      } else if (errors.city && cityRef.current) {
        cityRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cityRef.current.focus();
      } else if (errors.pincode && pincodeRef.current) {
        pincodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pincodeRef.current.focus();
      } else if (errors.scheduledDate && scheduledDateRef.current) {
        scheduledDateRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        scheduledDateRef.current.focus();
      }

      setIsOrdering(false);
      return;
    }

    if (!isPickupOnly) {
      const isDeliverable = await validateDeliveryAddress(addrFields, formData.location);
      if (!isDeliverable) {
        toast.error('Your specified delivery location is outside of our active geofenced delivery boundaries.');
        setIsOrdering(false);
        return;
      }
    }

    try {
      const orderId = generateOrderId();
      
      const orderItems = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image
      }));

      // Add free items if applicable
      if (appliedCoupon?.type === 'free_item' && appliedCoupon.free_item_id) {
        orderItems.push({
          id: `free-${appliedCoupon.free_item_id}`,
          name: `Gift: ${appliedCoupon.free_item_id.toUpperCase().replace(/_/g, ' ')}`,
          price: 0,
          quantity: appliedCoupon.free_item_quantity || 1,
          image: '/gift-box.png' // Or a placeholder
        });
      }

      const selectedTimeLabel = getSelectedTimeLabel();

      const scheduledArrivalStr = (deliveryMode === 'scheduled' && scheduledDate)
        ? `Scheduled ${isPickupOnly ? 'Pickup' : 'Delivery'}: ${scheduledDay}, ${new Date(scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${selectedTimeLabel})`
        : (isPickupOnly ? 'Ready for pickup in 20-30 mins' : null);

      const cakeDetailsNote = [
        deliveryMode === 'scheduled' && scheduledDate ? `[CAKE DATE: ${scheduledDay}, ${scheduledDate}]` : '',
        deliveryMode === 'scheduled' ? `[CAKE TIME: ${selectedTimeLabel}]` : '',
        cakeMessage?.trim() ? `[CAKE INSCRIPTION: "${cakeMessage.trim()}"]` : '',
        cakeOccasion ? `[OCCASION: ${cakeOccasion}]` : '',
        includeCandleKnife ? `[FREE CANDLE & KNIFE: YES]` : '',
      ].filter(Boolean).join(' ');

      const selectedPaymentMethod = (formData.paymentMethod === 'cod') ? 'cod' : 'upi';

      const orderData = {
        id: orderId,
        user_id: user?.uid || null,
        items: orderItems,
        subtotal: subtotal,
        discount: discountAmount,
        delivery_charge: effectiveDeliveryFee,
        order_type: isPickupOnly ? 'pickup' : 'delivery',
        coupon_code: appliedCoupon?.code || null,
        total: finalPrice,
        status: selectedPaymentMethod === 'upi' ? 'awaiting_payment' : 'pending',
        payment_method: selectedPaymentMethod,
        payment_status: 'pending',
        address: isPickupOnly 
          ? `[IN-STORE PICKUP] Bakery: ${BAKERY_ADDRESS}` 
          : formData.address,
        delivery_location: isPickupOnly ? null : (formData.location || null),
        phone: formData.phone,
        customer_name: formData.name,
        email: user?.email || null,
        delivery_date: deliveryMode === 'scheduled' ? scheduledDate : new Date().toISOString().split('T')[0],
        delivery_time: selectedTimeLabel,
        delivery_time_slot: scheduledTimeSlot,
        cake_message: cakeMessage?.trim() || null,
        cake_occasion: cakeOccasion || null,
        cake_candle_knife: includeCandleKnife,
        is_scheduled: deliveryMode === 'scheduled',
        estimated_delivery_time: isPickupOnly 
          ? (deliveryMode === 'scheduled' && scheduledDate
              ? `${scheduledDay}, ${scheduledDate} (${selectedTimeLabel})`
              : 'Ready for pickup in 20-30 mins')
          : (hasDaysItems 
              ? getDaysMaxString() 
              : (deliveryMode === 'scheduled' 
                  ? `${scheduledDay}, ${scheduledDate} (${selectedTimeLabel})`
                  : `${Math.max(
                      validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
                      ...cart.map(item => item.estimated_delivery_time || 30)
                    )} mins`)),
        estimated_arrival: scheduledArrivalStr,
        notes: (isPickupOnly ? '[PICKUP ONLY ORDER] ' : '') + 
               (cakeDetailsNote ? `${cakeDetailsNote} ` : '') + 
               formData.notes + 
               (appliedCoupon?.type === 'free_item' ? ` [PROMO: Free ${appliedCoupon.free_item_quantity}x ${appliedCoupon.free_item_id}]` : ''),
        created_at: new Date().toISOString(),
      };

      // Save to Supabase
      try {
        if (!user) {
          GuestSessionManager.registerFromCheckout({
            name: formData.name,
            phone: formData.phone,
            address: isPickupOnly ? BAKERY_ADDRESS : formData.address
          });
        }

        await supabaseService.insertData('orders', orderData);
        haptic.checkout();
        
        // Clear saved checkout draft inputs on success
        try {
          localStorage.removeItem('frostybite_checkout_form');
          localStorage.removeItem('frostybite_checkout_addr');
        } catch (e) {}
      } catch (supabaseError: any) {
        console.warn('Supabase order creation fallback activated:', supabaseError);
        haptic.checkout();
        try {
          localStorage.removeItem('frostybite_checkout_form');
          localStorage.removeItem('frostybite_checkout_addr');
        } catch (e) {}
      }

      // Increment coupon usage count if applied via CouponsRepository
      if (appliedCoupon?.id) {
        CouponsRepository.incrementUsageCount(appliedCoupon.id);
      }
      
      if (formData.paymentMethod === 'upi') {
        if (user) {
          addNotification({
            title: 'Order Placed (UPI)',
            message: `Order #${orderId} placed. Please complete payment.`,
            type: 'order',
            user_id: user.uid,
            link: `/upi-checkout/${orderId}`
          });
        }

        // Send Email Confirmation (Non-blocking)
        if (user?.email) {
          emailService.sendOrderConfirmation(user.email, orderId, finalPrice)
            .catch(err => console.error('Failed to send order confirmation email:', err));
        }

        navigate(`/upi-checkout/${orderId}`, { 
          state: { 
            orderId: orderId,
            totalPrice: finalPrice,
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            notes: formData.notes,
            delivery_date: deliveryMode === 'scheduled' ? scheduledDate : new Date().toISOString().split('T')[0],
            delivery_time: selectedTimeLabel,
            cake_message: cakeMessage?.trim() || null,
            cake_occasion: cakeOccasion || null,
            cake_candle_knife: includeCandleKnife,
            is_scheduled: deliveryMode === 'scheduled',
            discount: discountAmount,
            delivery_charge: effectiveDeliveryFee,
            couponCode: appliedCoupon?.code,
            estimatedDelivery: deliveryMode === 'scheduled' 
              ? `${scheduledDay}, ${scheduledDate} (${selectedTimeLabel})` 
              : (isPickupOnly ? '20-30 mins' : Math.max(
                  validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
                  ...cart.map(item => item.estimated_delivery_time || 30)
                )),
            scrollToQR: true
          } 
        });
      } else {
        // COD Success
        if (user) {
          addNotification({
            title: 'Order Placed (COD)',
            message: `Order #${orderId} placed successfully via COD.`,
            type: 'order',
            user_id: user.uid,
            link: '/orders'
          });
        }

        const orderSummary = {
          orderId: orderId,
          customerName: formData.name,
          phone: formData.phone,
          address: formData.address,
          notes: formData.notes,
          delivery_date: deliveryMode === 'scheduled' ? scheduledDate : new Date().toISOString().split('T')[0],
          delivery_time: selectedTimeLabel,
          delivery_time_slot: scheduledTimeSlot,
          cake_message: cakeMessage?.trim() || null,
          cake_occasion: cakeOccasion || null,
          cake_candle_knife: includeCandleKnife,
          is_scheduled: deliveryMode === 'scheduled',
          method: 'cod' as const,
          amount: finalPrice,
          delivery_charge: effectiveDeliveryFee,
          discount: discountAmount,
          couponCode: appliedCoupon?.code,
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image
          })),
          estimatedDelivery: deliveryMode === 'scheduled'
            ? `${scheduledDay}, ${scheduledDate} (${selectedTimeLabel})`
            : (isPickupOnly ? '20-30 mins' : Math.max(
                validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
                ...cart.map(item => item.estimated_delivery_time || 30)
              ))
        };
        
        setConfirmedOrder(orderSummary);
        setShowConfirmation(true);
        playSuccessChime();
        openWhatsAppOrder(orderSummary);
        
        // Send Email Confirmation (Non-blocking)
        if (user?.email) {
          emailService.sendOrderConfirmation(user.email, orderId, finalPrice)
            .catch(err => console.error('Failed to send order confirmation email:', err));
        } else if (orderData.phone) {
          // If guest, we might not have email but we have phone?
          // Actually Checkout requires name/phone. Email comes from auth.
        }
        
        clearCart();
      }
    } catch (error: any) {
      console.error('Order failed:', error);
      
      let errorMessage = 'Failed to place order. Please try again.';
      
      if (error.message) {
        errorMessage = `Failed to place order: ${error.message}`;
      }
      
      toast.error(errorMessage, { duration: 5000 });
    } finally {
      setIsOrdering(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const data = await geocode('', 'reverse', { lat: latitude, lon: longitude });
          
          if (data && data.display_name) {
            const addr = data.address || {};
            const postcode = addr.postcode ? addr.postcode.replace(/[^0-9]/g, '').slice(0, 6) : '';
            const city = addr.city || addr.town || addr.village || addr.suburb || addr.city_district || 'Cuttack';
            const streetName = addr.road || addr.suburb || addr.neighbourhood || addr.subdivision || addr.county || '';
            const houseNumber = addr.house_number || addr.building || addr.flat || addr.house_name || '';
            const landmark = addr.amenity || addr.shop || addr.office || addr.commercial || addr.tourism || addr.historic || addr.leisure || addr.suburb || addr.neighbourhood || '';

            const finalFields = {
              houseNumber: houseNumber,
              streetName: streetName,
              landmark: landmark,
              city: city,
              pincode: postcode
            };

            setAddrFields(finalFields);

            setFormData(prev => ({ 
              ...prev, 
              address: data.display_name,
              location: { lat: latitude, lng: longitude }
            }));

            // Validate service availability for coordinates and fields
            validateDeliveryAddress(finalFields, { lat: latitude, lng: longitude });

            toast.success("Location and address fields auto-filled successfully!", { icon: '✨' });
          } else {
            toast.error("Could not find address for your location");
          }
        } catch (error) {
          console.error("Geocoding error:", error);
          toast.error("Error fetching address. Please enter manually.");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        console.error("Geolocation error:", error);
        
        switch (error.code) {
          case 1:
            toast.error("Permission denied. Please allow location access.");
            break;
          case 2:
            toast.error("Location unavailable. Check your GPS or internet.");
            break;
          case 3:
            toast.error("Location request timed out.");
            break;
          default:
            toast.error("Error getting location. Please enter manually.");
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

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
    <div className="min-h-svh flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-40 lg:pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="space-y-2">
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-stone-500 hover:text-[#E76A54] transition-colors font-bold uppercase tracking-wider text-xs cursor-pointer">
              <ChevronLeft size={16} /> Back to menu
            </button>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-black text-stone-900 tracking-tight">
              Finalize Your <span className="text-[#E76A54]">Order</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 font-medium">
              Review delivery details, scheduling, and payment options
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs md:text-right min-w-[180px]">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Cart Total</p>
            <p className="text-3xl font-black text-stone-900 tracking-tight">₹{subtotal}</p>
          </div>
        </div>

        {/* Orders Closed Banner */}
        {!isOrderingOpen && (
          <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-3xl flex flex-col md:flex-row items-center gap-5 text-center md:text-left">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
              <AlertTriangle size={28} />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-xl font-bold uppercase tracking-tight text-red-700">Online Orders are Currently Closed</h3>
              <p className="text-xs font-medium text-red-600">We are not accepting new orders at this moment. You can still fill in your details, but you won't be able to place the order until we reopen.</p>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="px-5 py-2.5 bg-red-600 text-white font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-red-700 transition-colors cursor-pointer"
            >
              Back to Menu
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form onSubmit={handlePlaceOrder} className="lg:col-span-8 space-y-6">
            {/* Delivery / Pickup Details */}
            <div 
              ref={deliverySectionRef} 
              className={cn(
                "bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6 transition-all duration-700",
                isHighlighted && "border-[#E76A54] shadow-lg shadow-[#E76A54]/10 ring-2 ring-[#E76A54]/30"
              )}
            >
              <div className="flex items-center gap-3.5 border-b border-stone-100 pb-4">
                <div className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center",
                  isPickupOnly ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-[#E76A54]/10 text-[#E76A54] border border-[#E76A54]/20"
                )}>
                  {isPickupOnly ? <ShoppingBag size={22} /> : <Truck size={22} />}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-tight">
                    {isPickupOnly ? "Pickup & Customer Details" : "Delivery Details"}
                  </h2>
                  <p className="text-xs text-stone-500 font-medium">Enter your contact and destination details</p>
                </div>
              </div>

              {/* Banner for Pickup Only */}
              {isPickupOnly && (
                <div className="p-5 bg-amber-50 border border-amber-200/80 rounded-2xl space-y-3.5 text-stone-900">
                  <div className="flex items-center gap-3 text-amber-800">
                    <ShoppingBag size={22} className="shrink-0 text-amber-600" />
                    <div>
                      <h3 className="font-bold text-sm uppercase tracking-wider text-amber-950">🛍 Pickup Only Active</h3>
                      <p className="text-xs text-amber-800 font-medium mt-0.5">Place your order online and collect it directly from our bakery counter. Home delivery is currently disabled.</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-xl space-y-2.5 text-xs border border-amber-200/60 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <MapPin size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-stone-800 uppercase text-[10px] tracking-wider">Bakery Collection Address:</p>
                        <p className="text-stone-600 font-medium font-mono mt-0.5">{BAKERY_ADDRESS}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 pt-2 border-t border-stone-100">
                      <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-stone-800 uppercase text-[10px] tracking-wider">Pickup Instructions:</p>
                        <p className="text-stone-600 leading-relaxed mt-0.5">{BAKERY_PICKUP_INSTRUCTIONS}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-stone-100 text-emerald-700 font-bold">
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                      <span>Estimated Ready Time: 20 - 30 Minutes</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                    <User size={13} className="text-[#E76A54]" /> Full Name *
                  </label>
                  <input
                    ref={nameRef}
                    key={`name-${shakeKey}`}
                    type="text"
                    required
                    placeholder="Enter your full name"
                    className={cn(
                      "w-full bg-stone-50 border p-3.5 rounded-2xl transition-all font-medium text-stone-900 placeholder:text-stone-400 text-sm focus:bg-white focus:outline-none",
                      invalidFields.name 
                        ? "border-red-500 ring-2 ring-red-500/20 animate-shake" 
                        : "border-stone-200 focus:border-[#E76A54] focus:ring-4 focus:ring-[#E76A54]/10"
                    )}
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (invalidFields.name && e.target.value.trim()) {
                        setInvalidFields(prev => ({ ...prev, name: false }));
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                    <Phone size={13} className="text-[#E76A54]" /> Phone Number *
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-4 flex items-center gap-1.5 pointer-events-none text-stone-500">
                      <Phone size={15} className="text-[#E76A54]" />
                      <span className="text-sm font-semibold border-r border-stone-200 pr-2 font-mono text-stone-600 leading-none">+91</span>
                    </div>
                    <input
                      ref={phoneRef}
                      key={`phone-${shakeKey}`}
                      type="tel"
                      required
                      placeholder="9876543210"
                      className={cn(
                        "w-full bg-stone-50 border pl-[5.5rem] pr-4 h-12 rounded-2xl transition-all font-mono text-stone-900 placeholder:text-stone-400 text-sm focus:bg-white focus:outline-none",
                        invalidFields.phone 
                          ? "border-red-500 ring-2 ring-red-500/20 animate-shake" 
                          : "border-stone-200 focus:border-[#E76A54] focus:ring-4 focus:ring-[#E76A54]/10"
                      )}
                      value={formData.phone}
                      onChange={(e) => {
                        let clean = e.target.value.replace(/[^0-9]/g, '');
                        if (clean.startsWith('91') && clean.length > 10) {
                          clean = clean.slice(2);
                        } else if (clean.startsWith('0') && clean.length > 10) {
                          clean = clean.slice(1);
                        }
                        const val = clean.slice(0, 10);
                        setFormData({ ...formData, phone: val });
                        if (invalidFields.phone && val.length >= 10) {
                          setInvalidFields(prev => ({ ...prev, phone: false }));
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {!isPickupOnly && (
                <>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={13} className="text-[#E76A54]" /> Complete Address *
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowMap(!showMap)}
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer",
                            showMap ? "text-[#E76A54] bg-[#E76A54]/10 border-[#E76A54]/30" : "text-stone-600 bg-stone-100 hover:bg-stone-200 border-stone-200"
                          )}
                        >
                          <MapIcon size={12} />
                          {showMap ? 'Hide Map' : 'Pinpoint on Map'}
                        </button>
                        <button
                          type="button"
                          onClick={handleLocateMe}
                          disabled={isLocating}
                          className="text-[10px] font-bold text-[#E76A54] bg-[#E76A54]/10 border border-[#E76A54]/20 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1.5 hover:bg-[#E76A54]/20 transition-colors cursor-pointer"
                        >
                          {isLocating ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Zap size={12} fill="currentColor" />
                          )}
                          Locate Me
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {showMap && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mb-4">
                            <React.Suspense fallback={<div className="w-full h-[300px] bg-stone-100 animate-pulse rounded-3xl" />}>
                              <MapSelector 
                                initialLocation={formData.location}
                                onLocationSelect={(lat, lng, address) => {
                                  handleMapLocationSelected(lat, lng, address);
                                }}
                              />
                            </React.Suspense>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Structured Address Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider ml-1">House / Flat / Plot *</label>
                        <input
                          ref={houseNumberRef}
                          key={`houseNumber-${shakeKey}`}
                          type="text"
                          required
                          placeholder="e.g. House 12 / Plot 3A"
                          className={cn(
                            "w-full h-11 px-4 rounded-xl bg-stone-50 border text-stone-900 placeholder:text-stone-400 text-xs focus:bg-white focus:outline-none transition-all font-semibold",
                            invalidFields.houseNumber 
                              ? "border-red-500 ring-2 ring-red-500/20 animate-shake" 
                              : "border-stone-200 focus:border-[#E76A54]"
                          )}
                          value={addrFields.houseNumber}
                          onChange={(e) => {
                            setAddrFields({ ...addrFields, houseNumber: e.target.value });
                            if (invalidFields.houseNumber && e.target.value.trim()) {
                              setInvalidFields(prev => ({ ...prev, houseNumber: false }));
                            }
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <GooglePlacesAutocomplete
                          currentAddressValue={addrFields.streetName}
                          isInvalid={invalidFields.streetName}
                          shakeKey={shakeKey}
                          onManualStreetChange={(val) => {
                            setAddrFields({ ...addrFields, streetName: val });
                            if (invalidFields.streetName && val.trim()) {
                              setInvalidFields(prev => ({ ...prev, streetName: false }));
                            }
                          }}
                          onAddressSelect={(data) => {
                            setAddrFields({
                              houseNumber: data.houseNumber || addrFields.houseNumber,
                              streetName: data.streetName,
                              landmark: data.landmark || addrFields.landmark,
                              city: data.city || 'Cuttack',
                              pincode: data.pincode || addrFields.pincode
                            });
                            setInvalidFields(prev => ({
                              ...prev,
                              streetName: false,
                              houseNumber: data.houseNumber ? false : prev.houseNumber,
                              landmark: data.landmark ? false : prev.landmark,
                              city: false,
                              pincode: data.pincode ? false : prev.pincode
                            }));
                            if (data.lat && data.lng) {
                              setFormData(prev => ({
                                ...prev,
                                location: { lat: data.lat!, lng: data.lng! }
                              }));
                            }
                            toast.success('Address auto-filled successfully!', { icon: '✨' });
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider ml-1">Landmark *</label>
                        <input
                          ref={landmarkRef}
                          key={`landmark-${shakeKey}`}
                          type="text"
                          required
                          placeholder="e.g. Near Link Road"
                          className={cn(
                            "w-full h-11 px-4 rounded-xl bg-stone-50 border text-stone-900 placeholder:text-stone-400 text-xs focus:bg-white focus:outline-none transition-all font-semibold",
                            invalidFields.landmark 
                              ? "border-red-500 ring-2 ring-red-500/20 animate-shake" 
                              : "border-stone-200 focus:border-[#E76A54]"
                          )}
                          value={addrFields.landmark}
                          onChange={(e) => {
                            setAddrFields({ ...addrFields, landmark: e.target.value });
                            if (invalidFields.landmark && e.target.value.trim()) {
                              setInvalidFields(prev => ({ ...prev, landmark: false }));
                            }
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider ml-1">City *</label>
                          <input
                            ref={cityRef}
                            key={`city-${shakeKey}`}
                            type="text"
                            required
                            placeholder="e.g. Cuttack"
                            className={cn(
                              "w-full h-11 px-4 rounded-xl bg-stone-50 border text-stone-900 placeholder:text-stone-400 text-xs focus:bg-white focus:outline-none transition-all font-semibold",
                              invalidFields.city 
                                ? "border-red-500 ring-2 ring-red-500/20 animate-shake" 
                                : "border-stone-200 focus:border-[#E76A54]"
                            )}
                            value={addrFields.city}
                            onChange={(e) => {
                              setAddrFields({ ...addrFields, city: e.target.value });
                              if (invalidFields.city && e.target.value.trim()) {
                                setInvalidFields(prev => ({ ...prev, city: false }));
                              }
                            }}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-600 uppercase tracking-wider ml-1">Pincode *</label>
                          <input
                            ref={pincodeRef}
                            key={`pincode-${shakeKey}`}
                            type="text"
                            required
                            placeholder="e.g. 753010"
                            className={cn(
                              "w-full h-11 px-4 rounded-xl bg-stone-50 border text-stone-900 placeholder:text-stone-400 text-xs focus:bg-white focus:outline-none transition-all font-semibold font-mono",
                              invalidFields.pincode 
                                ? "border-red-500 ring-2 ring-red-500/20 animate-shake" 
                                : "border-stone-200 focus:border-[#E76A54]"
                            )}
                            value={addrFields.pincode}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                              setAddrFields({ ...addrFields, pincode: val });
                              if (invalidFields.pincode && val.length >= 6) {
                                setInvalidFields(prev => ({ ...prev, pincode: false }));
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Delivery Status indicator for Checkout */}
                    <div className="pt-2">
                      {validationResult.isValidating ? (
                        <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 animate-pulse flex items-center gap-3">
                          <Loader2 size={16} className="text-[#E76A54] animate-spin" />
                          <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">Evaluating Delivery Area...</span>
                        </div>
                      ) : validationResult.success === true ? (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-left">
                          <span className="text-emerald-600 text-lg">✅</span>
                          <div>
                            <p className="text-emerald-800 font-extrabold text-xs uppercase tracking-wider">Delivery Available</p>
                            <p className="text-stone-700 text-xs font-medium mt-0.5">
                              Estimated delivery: {hasDaysItems ? (
                                `Within ${getDaysMaxString()}`
                              ) : (
                                `${Math.max(
                                  validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
                                  ...cart.map(item => item.estimated_delivery_time || 30)
                                )} mins`
                              )}
                            </p>
                            {validationResult.message && <p className="text-stone-500 text-[10px] uppercase font-bold tracking-wider mt-1">{validationResult.message}</p>}
                          </div>
                        </div>
                      ) : validationResult.success === false ? (
                        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col gap-2.5 text-left">
                          <div className="flex items-start gap-3">
                            <span className="text-red-600 text-lg">
                              {validationResult.reason === 'SERVICEABILITY_UNAVAILABLE' ? '⚠️' : '❌'}
                            </span>
                            <div>
                              <p className="text-red-800 font-bold text-xs uppercase tracking-wider">
                                {validationResult.reason === 'SERVICEABILITY_UNAVAILABLE' ? 'Serviceability Offline' : 'Outside Service Area'}
                              </p>
                              <p className="text-stone-600 text-xs font-medium mt-0.5 leading-relaxed">
                                {validationResult.message || "Frosty Bite currently delivers only in Cuttack."}
                              </p>
                            </div>
                          </div>
                          {validationResult.reason === 'SERVICEABILITY_UNAVAILABLE' && (
                            <button
                              type="button"
                              onClick={() => validateDeliveryAddress()}
                              className="px-3.5 py-1.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-800 rounded-xl text-xs font-bold transition-all text-center self-start flex items-center gap-2 cursor-pointer"
                            >
                              <span>🔄</span> Retry Connection Check
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-start gap-2 text-left">
                          <span className="text-stone-500">🚚</span>
                          <p className="text-stone-500 text-[10px] font-semibold uppercase tracking-wider">Address geofence dynamic validations active</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Date & Time Scheduling: Using DeliveryDatePicker Component (Active for both Delivery & Store Pickup) */}
              <div className="pt-2 border-t border-stone-100">
                <DeliveryDatePicker
                  fulfillmentType={isPickupOnly ? 'pickup' : 'delivery'}
                  mode={deliveryMode}
                  selectedDate={scheduledDate}
                  selectedTimeSlot={scheduledTimeSlot}
                  customTime={customDeliveryTime}
                  isInstantClosed={isInstantDeliveryClosed}
                  hasPreorderOnlyItems={hasDaysItems}
                  instantDeliveryEstimateMins={Math.max(
                    validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
                    ...cart.map(item => item.estimated_delivery_time || 30)
                  )}
                  hasError={!!invalidFields.scheduledDate}
                  dateInputRef={scheduledDateRef}
                  shakeKey={shakeKey}
                  onChange={(data: DeliveryScheduleData) => {
                    setDeliveryMode(data.mode);
                    setScheduledDate(data.date);
                    setScheduledDay(data.dayName);
                    setScheduledTimeSlot(data.timeSlot);
                    if (data.time) {
                      setCustomDeliveryTime(data.time);
                    }
                    if (invalidFields.scheduledDate && data.date) {
                      setInvalidFields(prev => ({ ...prev, scheduledDate: false }));
                    }
                  }}
                />
              </div>

              {/* Cake Inscription & Celebration Card (Active for both Delivery & Store Pickup) */}
              <div className="pt-4 border-t border-stone-100 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Cake size={14} className="text-[#E76A54]" /> Cake Message & Celebration (Optional)
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Free Customization
                  </span>
                </div>

                {/* Occasion chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Select Occasion</span>
                  <div className="flex flex-wrap gap-1.5">
                    {CAKE_OCCASIONS.map((occ) => {
                      const isSelected = cakeOccasion === occ.id;
                      return (
                        <button
                          key={occ.id}
                          type="button"
                          onClick={() => setCakeOccasion(occ.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                            isSelected
                              ? "bg-[#E76A54] text-white border-[#E76A54] shadow-xs"
                              : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                          )}
                        >
                          {occ.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cake Inscription Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                      Text to Write on Cake
                    </span>
                    <span className="text-[10px] font-mono font-bold text-stone-400">
                      {cakeMessage.length}/50
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={50}
                    placeholder='e.g. "Happy 25th Birthday Sarah! 💖"'
                    value={cakeMessage}
                    onChange={(e) => setCakeMessage(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 text-xs focus:bg-white focus:outline-none focus:border-[#E76A54] transition-all font-semibold"
                  />
                  
                  {/* Quick Message Suggestion chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Happy Birthday 🎉', 'Happy Anniversary 💍', 'Best Wishes ✨', 'Congratulations 🎓'].map((msg) => (
                      <button
                        key={msg}
                        type="button"
                        onClick={() => setCakeMessage(msg)}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg text-[10px] font-medium text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                      >
                        + {msg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Candle and knife complement check */}
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200 hover:bg-stone-100/80 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeCandleKnife}
                    onChange={(e) => setIncludeCandleKnife(e.target.checked)}
                    className="w-4 h-4 rounded text-[#E76A54] focus:ring-[#E76A54] border-stone-300 bg-white accent-[#E76A54] cursor-pointer"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-800 uppercase tracking-wide">
                      Include Free Birthday Candles & Cutting Knife 🕯️🔪
                    </p>
                    <p className="text-[10px] text-stone-500 font-medium mt-0.5">
                      Complimentary accessory pack with your cake order
                    </p>
                  </div>
                </label>

                {/* Live Inscription Tag Preview */}
                {cakeMessage.trim() && (
                  <div className="p-3 bg-[#E76A54]/10 border border-[#E76A54]/20 rounded-xl space-y-0.5">
                    <p className="text-[10px] font-bold text-[#E76A54] uppercase tracking-wider">
                      🎂 Cake Inscription Preview
                    </p>
                    <p className="text-xs font-serif italic text-stone-900 font-medium">
                      "{cakeMessage.trim()}"
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 pt-2 border-t border-stone-100">
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider ml-1">
                  Order Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Anything else we should know? (e.g. deliver after 5 PM, ring bell twice)"
                  className="w-full bg-stone-50 border border-stone-200 focus:border-[#E76A54] focus:bg-white focus:outline-none p-3.5 rounded-2xl transition-all font-medium text-stone-900 placeholder:text-stone-400 text-xs resize-none"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            {/* Coupon Code section */}
            <div className="bg-white rounded-3xl border border-stone-200/80 p-6 md:p-7 shadow-xs">
              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-[#E76A54]/10 text-[#E76A54] flex items-center justify-center">
                  <Ticket size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 tracking-tight">Coupon Code</h3>
                  <p className="text-[11px] font-medium text-stone-500">Apply a promo code for exclusive discounts</p>
                </div>
              </div>

              <div className="relative">
                <AnimatePresence mode="wait">
                  {!appliedCoupon ? (
                    <motion.div 
                      key="input"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-4"
                    >
                      <div className="flex gap-2.5">
                        <input
                          type="text"
                          placeholder="ENTER COUPON CODE"
                          className="flex-1 bg-stone-50 border border-stone-200 focus:border-[#E76A54] focus:bg-white focus:outline-none px-4 py-3 rounded-xl transition-all font-bold text-stone-900 uppercase placeholder:text-stone-400 placeholder:text-xs placeholder:font-medium tracking-wider text-xs min-w-0"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon()}
                          disabled={isApplyingCoupon || !couponCode}
                          className="px-6 bg-[#E76A54] hover:bg-[#d85c46] text-white disabled:bg-stone-200 disabled:text-stone-400 disabled:opacity-70 rounded-xl font-bold uppercase text-xs tracking-wider transition-all active:scale-98 shadow-xs cursor-pointer whitespace-nowrap"
                        >
                          {isApplyingCoupon ? (
                            <Loader2 size={16} className="animate-spin mx-auto" />
                          ) : (
                            'Apply'
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="applied"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-4 rounded-2xl relative overflow-hidden"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">
                          <Check size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-stone-900 uppercase tracking-tight">{appliedCoupon.code}</p>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase rounded-md tracking-wider">Applied</span>
                          </div>
                          <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                            {appliedCoupon.type === 'free_item' ? 'FREE Gift Applied! 🎁' : `₹${discountAmount.toFixed(0)} Discounted! ✨`}
                          </p>
                          {appliedCoupon.gift_url && (
                            <a 
                              href={appliedCoupon.gift_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-600 hover:text-stone-900 transition-colors uppercase tracking-wider mt-1.5 bg-white px-2 py-0.5 rounded-md border border-stone-200"
                            >
                              <Sparkles size={11} className="text-amber-500" /> View Gift details
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="p-2 hover:bg-stone-200/60 rounded-xl transition-all text-stone-400 hover:text-red-500 active:scale-90 cursor-pointer"
                        title="Remove Coupon"
                      >
                        <X size={18} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-3xl border border-stone-200/80 p-6 md:p-7 shadow-xs space-y-6">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#E76A54]/10 text-[#E76A54] flex items-center justify-center">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-900 tracking-tight">Payment Method</h2>
                  <p className="text-[11px] font-medium text-stone-500">Choose how you would like to pay</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, paymentMethod: 'upi' });
                    document.getElementById('checkout-action-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className={cn(
                    "relative flex flex-col p-5 rounded-2xl border-2 transition-all text-left cursor-pointer",
                    formData.paymentMethod === 'upi' 
                      ? "border-[#E76A54] bg-[#E76A54]/5 ring-1 ring-[#E76A54]/30" 
                      : "border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:border-stone-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn(
                      "p-2.5 rounded-xl transition-colors",
                      formData.paymentMethod === 'upi' ? "bg-[#E76A54] text-white" : "bg-stone-200 text-stone-600"
                    )}>
                      <Wallet size={20} />
                    </div>
                    {formData.paymentMethod === 'upi' && (
                      <CheckCircle2 size={22} className="text-[#E76A54]" />
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-stone-900 leading-none">Pay via UPI / QR</h3>
                  <p className="text-xs text-stone-500 font-medium mt-1.5">Google Pay, PhonePe, Paytm, BHIM</p>
                  
                  {formData.paymentMethod === 'upi' && (
                    <div className="mt-3 flex items-center gap-1.5 text-[#E76A54] font-bold text-[11px]">
                      <QrCode size={13} />
                      Scan & pay instantly with UPI QR
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, paymentMethod: 'cod' })}
                  className={cn(
                    "relative flex flex-col p-5 rounded-2xl border-2 transition-all text-left cursor-pointer",
                    formData.paymentMethod === 'cod' 
                      ? "border-stone-800 bg-stone-900 text-white" 
                      : "border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:border-stone-300"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn(
                      "p-2.5 rounded-xl transition-colors",
                      formData.paymentMethod === 'cod' ? "bg-white text-stone-900" : "bg-stone-200 text-stone-600"
                    )}>
                      <HandCoins size={20} />
                    </div>
                    {formData.paymentMethod === 'cod' && (
                      <CheckCircle2 size={22} className="text-white" />
                    )}
                  </div>
                  <h3 className={cn(
                    "text-sm font-bold leading-none",
                    formData.paymentMethod === 'cod' ? "text-white" : "text-stone-900"
                  )}>Cash on Delivery</h3>
                  <p className={cn(
                    "text-xs font-medium mt-1.5",
                    formData.paymentMethod === 'cod' ? "text-stone-300" : "text-stone-500"
                  )}>Pay with cash when your order arrives</p>
                </button>
              </div>
            </div>
          </form>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl border border-stone-200/80 p-6 md:p-7 shadow-xs space-y-5 lg:sticky lg:top-24">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                  Order Summary
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-3.5 items-center group">
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-stone-100 bg-stone-50">
                      <OptimizedImage src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-stone-900 truncate">{item.name}</h4>
                      <p className="text-[11px] text-stone-500 font-medium">Qty: {item.quantity}</p>
                      <p className="text-xs font-bold text-[#E76A54] mt-0.5">₹{item.price * item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-stone-100 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-medium text-stone-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-stone-900">₹{subtotal}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between items-center text-xs font-semibold text-emerald-600">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-medium text-stone-600">
                  <span>{isPickupOnly ? 'Fulfillment' : 'Delivery'}</span>
                  {isPickupOnly ? (
                    <span className="text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      <ShoppingBag size={11} /> PICKUP (FREE)
                    </span>
                  ) : deliveryFee === 0 ? (
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">FREE</span>
                  ) : (
                    <span className="font-semibold text-stone-900">₹{deliveryFee}</span>
                  )}
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-stone-100">
                  <span className="text-sm font-bold text-stone-900">Total Payable</span>
                  <span className="text-2xl font-black text-stone-900 tracking-tight">₹{finalPrice}</span>
                </div>
              </div>

              {!isPickupOnly && formData.location && !isLocationInServiceArea() && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} />
                    <span className="font-bold text-xs">Out of Delivery Boundary</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-stone-600 font-normal">
                    The chosen map pin coordinate lies outside Frosty Bite's active delivery boundaries. Please adjust your address marker on the map selector.
                  </p>
                </div>
              )}

              {getCartAvailabilityWarning() && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} />
                    <span className="font-bold text-xs">Availability Warning</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-stone-600 font-normal">
                    {getCartAvailabilityWarning()}
                  </p>
                </div>
              )}

              <SwipeToConfirm
                id="checkout-action-btn"
                paymentMethod={formData.paymentMethod}
                amount={finalPrice}
                onConfirm={handlePlaceOrder}
                isProcessing={isOrdering}
                disabled={!isOrderingOpen || !isLocationInServiceArea() || !!getCartAvailabilityWarning()}
                disabledReason={
                  !isOrderingOpen 
                    ? 'Orders are currently closed' 
                    : !isLocationInServiceArea() 
                      ? 'Location Out of Boundary' 
                      : getCartAvailabilityWarning() 
                        ? 'Check Schedule Date' 
                        : undefined
                }
              />

              <div className="flex items-center justify-center gap-1.5 text-stone-400">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider">100% Secure Checkout</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar for Mobile Checkout */}
      {cart.length > 0 && !showConfirmation && (
        <div className="lg:hidden sticky bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-stone-200 p-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] shadow-lg">
          <div className="max-w-md mx-auto space-y-2.5">
            <div className="flex justify-between items-center px-1">
               <div>
                 <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Payable</p>
                 <p className="text-xl font-black text-stone-900 tracking-tight">₹{finalPrice}</p>
               </div>
               <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                  <ShieldCheck size={12} />
                  <span>Secure Checkout</span>
               </div>
            </div>
            
            <SwipeToConfirm
              id="mobile-checkout-action-btn"
              paymentMethod={formData.paymentMethod}
              amount={finalPrice}
              onConfirm={handlePlaceOrder}
              isProcessing={isOrdering}
              disabled={!isOrderingOpen || !isLocationInServiceArea() || !!getCartAvailabilityWarning()}
              disabledReason={
                !isOrderingOpen 
                  ? 'Orders are currently closed' 
                  : !isLocationInServiceArea() 
                    ? 'Location Out of Boundary' 
                    : getCartAvailabilityWarning() 
                      ? 'Check Schedule Date' 
                      : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;
