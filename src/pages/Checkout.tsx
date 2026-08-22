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
  Sparkles
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
import { useAppConfig } from '../hooks/useAppConfig';
import { appConfigService } from '../services/appConfigService';
import { useGeofence } from '../context/GeofenceContext';
import { useNotifications } from '../context/NotificationContext';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { playErrorShakeSound, playSuccessChime } from '../utils/soundEffects';

import { MapSelector } from '../components/MapSelector';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';
import { safeTrim, safeTrimLowerCase } from '../utils/string';
import { geocode } from '../lib/geocoder';

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

  const [formData, setFormData] = useState({
    name: user?.displayName || user?.email?.split('@')[0] || '',
    phone: '',
    address: '',
    location: undefined as { lat: number; lng: number } | undefined,
    notes: '',
    paymentMethod: 'upi' as 'upi' | 'cod'
  });

  const [addrFields, setAddrFields] = useState({
    houseNumber: '',
    streetName: '',
    landmark: '',
    city: 'Cuttack',
    pincode: ''
  });

  const [deliveryMode, setDeliveryMode] = useState<'instant' | 'scheduled'>('instant');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledDay, setScheduledDay] = useState('');

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

    // Use V2 Serviceability as the authoritative engine
    return v2Serviceability.status === 'serviceable';
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
  const finalPrice = Math.max(0, subtotal - discountAmount + deliveryFee);

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
      
      const { data: coupons, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('status', 'active')
        .limit(1);

      if (error || !coupons || coupons.length === 0) {
        toast.error('Invalid or expired coupon code');
        setIsApplyingCoupon(false);
        return;
      }
      const couponData = coupons[0];
      const couponId = couponData.id;
      
      // Validate expiry
      const expiryDateValue = new Date(couponData.expiry_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiryDateValue < today) {
        toast.error('This coupon has expired');
        setIsApplyingCoupon(false);
        return;
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
        code: couponData.code, 
        value: couponData.value || 0,
        type: couponData.type,
        free_item_id: couponData.free_item_id,
        free_item_quantity: couponData.free_item_quantity,
        gift_url: couponData.gift_url
      });

      let discountDisplay = '';
      if (couponData.type === 'percentage') discountDisplay = `${couponData.value}%`;
      else if (couponData.type === 'fixed') discountDisplay = `₹${couponData.value}`;
      else if (couponData.type === 'free_item') discountDisplay = `FREE Gift`;

      toast.success(`${discountDisplay} applied!`, { icon: '🎉' });
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F97316', '#FFFFFF', '#DBEAFE']
      });
      
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

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const orderId = Math.random().toString(36).substring(2, 10).toUpperCase();
      
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

      const scheduledArrivalStr = (!isPickupOnly && deliveryMode === 'scheduled' && scheduledDate)
        ? `Scheduled: ${scheduledDay}, ${new Date(scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : null;

      const orderData = {
        id: orderId,
        user_id: user?.uid || 'guest',
        items: orderItems,
        subtotal: subtotal,
        discount: discountAmount,
        delivery_charge: isPickupOnly ? 0 : deliveryFee,
        order_type: isPickupOnly ? 'pickup' : 'delivery',
        coupon_code: appliedCoupon?.code || null,
        total: isPickupOnly ? Math.max(0, subtotal - discountAmount) : finalPrice,
        status: formData.paymentMethod === 'upi' ? 'awaiting_payment' : 'pending',
        payment_method: formData.paymentMethod,
        payment_status: 'pending',
        address: isPickupOnly 
          ? `[IN-STORE PICKUP] Bakery: ${BAKERY_ADDRESS}` 
          : formData.address,
        delivery_location: isPickupOnly ? null : (formData.location || null),
        phone: formData.phone,
        customer_name: formData.name,
        email: user?.email || null,
        estimated_delivery_time: isPickupOnly 
          ? 'Ready for pickup in 20-30 mins' 
          : (hasDaysItems 
              ? getDaysMaxString() 
              : `${Math.max(
                  validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
                  ...cart.map(item => item.estimated_delivery_time || 30)
                )} mins`),
        estimated_arrival: isPickupOnly ? 'Ready for pickup in 20-30 mins' : scheduledArrivalStr,
        notes: (isPickupOnly ? '[PICKUP ONLY ORDER] ' : '') + (!isPickupOnly && deliveryMode === 'scheduled' && scheduledDate ? `[SCHEDULED: ${scheduledDay}, ${scheduledDate}] ` : '') + formData.notes + (appliedCoupon?.type === 'free_item' ? ` [PROMO: Free ${appliedCoupon.free_item_quantity}x ${appliedCoupon.free_item_id}]` : ''),
        created_at: new Date().toISOString(),
      };

      // Save to Supabase
      try {
        await supabaseService.insertData('orders', orderData);
        haptic.checkout();
      } catch (supabaseError: any) {
        console.warn('Supabase order creation fallback activated:', supabaseError);
        haptic.checkout();
      }

      // Increment coupon usage count if applied via CouponsRepository
      if (appliedCoupon?.id) {
        CouponsRepository.incrementUsageCount(appliedCoupon.id);
      }
      
      if (formData.paymentMethod === 'upi') {
        if (user) {
          addNotification({
            title: 'Order Placed (UPI)',
            message: `Order #${orderId.slice(-6).toUpperCase()} placed. Please complete payment.`,
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
            discount: discountAmount,
            delivery_charge: deliveryFee,
            couponCode: appliedCoupon?.code,
            estimatedDelivery: Math.max(
              validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
              ...cart.map(item => item.estimated_delivery_time || 30)
            ),
            scrollToQR: true
          } 
        });
      } else {
        // COD Success
        if (user) {
          addNotification({
            title: 'Order Placed (COD)',
            message: `Order #${orderId.slice(-6).toUpperCase()} placed successfully via COD.`,
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
          method: 'cod' as const,
          amount: finalPrice,
          delivery_charge: deliveryFee,
          discount: discountAmount,
          couponCode: appliedCoupon?.code,
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image
          })),
          estimatedDelivery: Math.max(
            validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
            ...cart.map(item => item.estimated_delivery_time || 30)
          )
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
          navigate('/orders');
        }}
      />
    );
  }

  return (
    <div className="min-h-svh flex flex-col bg-background">
      <AnimatePresence>
        {isOrdering && (
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
                  rotate: [0, 90, 180, 270, 360],
                  borderRadius: ["20%", "50%", "20%"]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="w-32 h-32 bg-primary/20 border-2 border-primary/50"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <ShoppingBag size={48} className="text-primary" />
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
                Confirming <br />
                <span className="text-primary italic">Your Cravings</span>
              </motion.h2>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]"
              >
                Connecting to Secure Kitchen...
              </motion.p>
            </div>
            
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 4 }}
              className="w-64 h-1 bg-white/10 rounded-full overflow-hidden"
            >
              <div className="w-full h-full bg-primary origin-left animate-shimmer" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 pb-40 lg:pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="space-y-4">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-400 hover:text-primary transition-colors font-black uppercase tracking-widest text-[10px]">
              <ChevronLeft size={14} /> Back to menu
            </button>
            <h1 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
              Finalize Your <br />
              <span className="text-primary">Order</span>
            </h1>
          </div>
          <div className="glass-bakery p-6 rounded-[32px] md:text-right">
            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Cart Total</p>
            <p className="text-4xl font-black text-white italic tracking-tighter leading-none">₹{subtotal}</p>
          </div>
        </div>

        {/* Orders Closed Banner */}
        {!isOrderingOpen && (
          <div className="mb-12 p-8 bg-red-500/10 border border-red-500/20 rounded-[32px] flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-red-500 italic">Online Orders are Currently Closed</h3>
              <p className="text-sm font-bold text-red-500/80">🚫 We are not accepting new orders at this moment. You can still fill in your details, but you won't be able to place the order until we reopen.</p>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-red-500 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-red-600 transition-colors"
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
                "bakery-card p-8 md:p-10 space-y-8 transition-all duration-1000",
                isHighlighted && "border-primary shadow-[0_0_50px_rgba(249,115,22,0.15)] ring-1 ring-primary/50"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  isPickupOnly ? "bg-amber-500/10 text-amber-400" : "bg-primary/10 text-primary"
                )}>
                  {isPickupOnly ? <ShoppingBag size={24} /> : <Truck size={24} />}
                </div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">
                  {isPickupOnly ? "Pickup & Customer Details" : "Delivery Details"}
                </h2>
              </div>

              {/* Banner for Pickup Only */}
              {isPickupOnly && (
                <div className="p-6 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3 text-amber-400">
                    <ShoppingBag size={24} className="animate-bounce shrink-0" />
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-wider text-white">🛍 Pickup Only Active</h3>
                      <p className="text-xs text-amber-200/90 font-medium mt-0.5">Place your order online and collect it directly from our bakery counter. Home delivery is currently disabled.</p>
                    </div>
                  </div>
                  <div className="p-4 bg-black/40 rounded-2xl space-y-3 text-xs border border-white/5">
                    <div className="flex items-start gap-2.5">
                      <MapPin size={18} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-white uppercase text-[10px] tracking-widest">Bakery Collection Address:</p>
                        <p className="text-amber-200 font-semibold font-mono mt-0.5">{BAKERY_ADDRESS}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 pt-3 border-t border-white/10">
                      <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-white uppercase text-[10px] tracking-widest">Pickup Instructions:</p>
                        <p className="text-zinc-300 leading-relaxed mt-0.5">{BAKERY_PICKUP_INSTRUCTIONS}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 pt-3 border-t border-white/10 text-emerald-400 font-bold">
                      <CheckCircle2 size={18} className="shrink-0" />
                      <span>Estimated Ready Time: 20 - 30 Minutes</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <User size={12} className="text-primary" /> Full Name *
                  </label>
                  <input
                    ref={nameRef}
                    key={`name-${shakeKey}`}
                    type="text"
                    required
                    placeholder="Enter your full name"
                    className={cn(
                      "w-full bg-white/5 border p-4 rounded-2xl transition-all font-medium text-white",
                      invalidFields.name 
                        ? "border-red-500 ring-2 ring-red-500/30 animate-shake" 
                        : "border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/5"
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Phone size={12} className="text-primary" /> Phone Number *
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-4 flex items-center gap-1.5 pointer-events-none text-zinc-500">
                      <Phone size={16} className="text-primary" />
                      <span className="text-sm font-semibold border-r border-white/10 pr-2 font-mono text-zinc-400 leading-none">+91</span>
                    </div>
                    <input
                      ref={phoneRef}
                      key={`phone-${shakeKey}`}
                      type="tel"
                      required
                      placeholder="9876543210"
                      className={cn(
                        "w-full bg-white/5 border pl-[5.5rem] pr-4 h-14 rounded-2xl transition-all font-mono text-white text-sm",
                        invalidFields.phone 
                          ? "border-red-500 ring-2 ring-red-500/30 animate-shake" 
                          : "border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/5"
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
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <MapPin size={12} className="text-primary" /> Complete Address *
                      </label>
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setShowMap(!showMap)}
                          className={cn(
                            "text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all",
                            showMap ? "text-primary bg-primary/10 px-2 py-0.5 rounded-md" : "text-zinc-500 hover:text-white"
                          )}
                        >
                          <MapIcon size={12} />
                          {showMap ? 'Hide Map' : 'Pinpoint on Map'}
                        </button>
                        <button
                          type="button"
                          onClick={handleLocateMe}
                          disabled={isLocating}
                          className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity"
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
                            <React.Suspense fallback={<div className="w-full h-[300px] bg-zinc-900 animate-pulse rounded-3xl" />}>
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
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">House / Flat / Plot *</label>
                        <input
                          ref={houseNumberRef}
                          key={`houseNumber-${shakeKey}`}
                          type="text"
                          required
                          placeholder="e.g. House 12 / Plot 3A"
                          className={cn(
                            "w-full h-12 px-4 rounded-xl bg-white/5 border text-white placeholder-zinc-650 text-xs focus:outline-none transition-all font-semibold",
                            invalidFields.houseNumber 
                              ? "border-red-500 ring-2 ring-red-500/30 animate-shake" 
                              : "border-white/10 focus:border-primary/50"
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
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Landmark *</label>
                        <input
                          ref={landmarkRef}
                          key={`landmark-${shakeKey}`}
                          type="text"
                          required
                          placeholder="e.g. Near Link Road"
                          className={cn(
                            "w-full h-12 px-4 rounded-xl bg-white/5 border text-white placeholder-zinc-650 text-xs focus:outline-none transition-all font-semibold",
                            invalidFields.landmark 
                              ? "border-red-500 ring-2 ring-red-500/30 animate-shake" 
                              : "border-white/10 focus:border-primary/50"
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
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">City *</label>
                          <input
                            ref={cityRef}
                            key={`city-${shakeKey}`}
                            type="text"
                            required
                            placeholder="e.g. Cuttack"
                            className={cn(
                              "w-full h-12 px-4 rounded-xl bg-white/5 border text-white placeholder-zinc-650 text-xs focus:outline-none transition-all font-semibold",
                              invalidFields.city 
                                ? "border-red-500 ring-2 ring-red-500/30 animate-shake" 
                                : "border-white/10 focus:border-primary/50"
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
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Pincode *</label>
                          <input
                            ref={pincodeRef}
                            key={`pincode-${shakeKey}`}
                            type="text"
                            required
                            placeholder="e.g. 753010"
                            className={cn(
                              "w-full h-12 px-4 rounded-xl bg-white/5 border text-white placeholder-zinc-650 text-xs focus:outline-none transition-all font-semibold font-mono",
                              invalidFields.pincode 
                                ? "border-red-500 ring-2 ring-red-500/30 animate-shake" 
                                : "border-white/10 focus:border-primary/50"
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
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse flex items-center gap-3">
                          <Loader2 size={16} className="text-primary animate-spin" />
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider animate-pulse">Evaluating Delivery Area...</span>
                        </div>
                      ) : validationResult.success === true ? (
                        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-left">
                          <span className="text-emerald-500 text-lg">✅</span>
                          <div>
                            <p className="text-emerald-400 font-extrabold text-[11px] uppercase tracking-wider">Delivery Available</p>
                            <p className="text-zinc-200 text-xs font-semibold mt-0.5">
                              Estimated delivery: {hasDaysItems ? (
                                `Within ${getDaysMaxString()}`
                              ) : (
                                `${Math.max(
                                  validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
                                  ...cart.map(item => item.estimated_delivery_time || 30)
                                )} mins`
                              )}
                            </p>
                            {validationResult.message && <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mt-1">{validationResult.message}</p>}
                          </div>
                        </div>
                      ) : validationResult.success === false ? (
                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-3 text-left">
                          <div className="flex items-start gap-3">
                            <span className="text-red-500 text-lg">
                              {validationResult.reason === 'SERVICEABILITY_UNAVAILABLE' ? '⚠️' : '❌'}
                            </span>
                            <div>
                              <p className="text-red-400 font-extrabold text-[11px] uppercase tracking-wider">
                                {validationResult.reason === 'SERVICEABILITY_UNAVAILABLE' ? 'Serviceability Offline' : 'Outside Service Area'}
                              </p>
                              <p className="text-zinc-200 text-xs font-medium mt-0.5 leading-relaxed">
                                {validationResult.message || "Frosty Bite currently delivers only in Cuttack."}
                              </p>
                            </div>
                          </div>
                          {validationResult.reason === 'SERVICEABILITY_UNAVAILABLE' && (
                            <button
                              type="button"
                              onClick={() => validateDeliveryAddress()}
                              className="px-4 py-2 bg-red-500/25 hover:bg-red-500/40 border border-red-500/30 text-white rounded-xl text-xs font-bold transition-all text-center self-start flex items-center gap-2"
                            >
                              <span>🔄</span> Retry Connection Check
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex items-start gap-2 text-left">
                          <span className="text-zinc-500">🚚</span>
                          <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">Address geofence dynamic validations active</p>
                        </div>
                      )}
                    </div>

                    {/* Delivery Scheduling: Set date and convert to day also */}
                    <div className="pt-4 border-t border-white/5 mt-2 text-left">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1 mb-2 block">
                        Delivery Schedule
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={isInstantDeliveryClosed || hasDaysItems}
                          onClick={() => !isInstantDeliveryClosed && !hasDaysItems && setDeliveryMode('instant')}
                          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all relative ${
                            isInstantDeliveryClosed || hasDaysItems
                              ? 'bg-zinc-900/40 border-zinc-900/50 text-zinc-650 cursor-not-allowed'
                              : deliveryMode === 'instant'
                                ? 'bg-[#f97316]/10 border-[#f97316] text-white'
                                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                          }`}
                        >
                          <Zap size={18} className={(isInstantDeliveryClosed || hasDaysItems) ? 'text-zinc-600' : (deliveryMode === 'instant' ? 'text-orange-500' : 'text-zinc-500')} />
                          <span className="text-[11px] font-black uppercase tracking-wider mt-2">Instant Delivery</span>
                          {isInstantDeliveryClosed ? (
                            <span className="text-[8px] bg-red-500/10 text-red-500 font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 border border-red-500/20 leading-none">CLOSED</span>
                          ) : hasDaysItems ? (
                            <span className="text-[8px] bg-sky-500/10 text-sky-400 font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 border border-sky-500/20 leading-none">PRE-ORDER ONLY</span>
                          ) : (
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                              {Math.max(
                                validationResult.estimatedDeliveryMins || defaultDeliveryTime || 25,
                                ...cart.map(item => item.estimated_delivery_time || 30)
                              )} mins
                            </span>
                          )}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryMode('scheduled');
                            if (!scheduledDate) {
                              const today = new Date().toISOString().split('T')[0];
                              handleDateChange(today);
                            }
                          }}
                          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                            deliveryMode === 'scheduled'
                              ? 'bg-[#f97316]/10 border-[#f97316] text-white'
                              : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-lg">📅</span>
                          <span className="text-[11px] font-black uppercase tracking-wider mt-2">Schedule Delivery</span>
                          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Set Date & Day</span>
                        </button>
                      </div>

                      {deliveryMode === 'scheduled' && (
                        <motion.div 
                          key="scheduling_picker"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3"
                        >
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                              Select Delivery Date
                            </label>
                            <input
                              ref={scheduledDateRef}
                              key={`scheduledDate-${shakeKey}`}
                              type="date"
                              min={new Date().toISOString().split('T')[0]}
                              value={scheduledDate}
                              onChange={(e) => {
                                handleDateChange(e.target.value);
                                if (invalidFields.scheduledDate && e.target.value) {
                                  setInvalidFields(prev => ({ ...prev, scheduledDate: false }));
                                }
                              }}
                              className={cn(
                                "w-full h-12 px-4 rounded-xl bg-white/5 border text-white text-xs focus:outline-none transition-all font-semibold uppercase",
                                invalidFields.scheduledDate
                                  ? "border-red-500 ring-2 ring-red-500/30 animate-shake"
                                  : "border-white/10 focus:border-orange-500/50"
                              )}
                            />
                          </div>

                          {scheduledDate && (
                            <div className="flex items-center gap-2 bg-[#f97316]/5 border border-[#f97316]/10 px-4 py-3 rounded-xl">
                              <span className="text-xs">📅</span>
                              <span className="text-[11px] font-extrabold text-zinc-300 uppercase tracking-wider">
                                Selected Day: <span className="text-orange-400 font-black">{scheduledDay}</span> ({new Date(scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                              </span>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Order Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Anything else we should know? (e.g. deliver after 5 PM)"
                  className="w-full bg-white/5 border border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/5 p-4 rounded-2xl transition-all font-medium text-white resize-none"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            {/* Coupon Code section */}
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 p-6 md:p-8 rounded-[2.5rem] overflow-hidden relative group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-[20px] bg-primary/10 flex items-center justify-center text-primary group-hover:rotate-12 transition-transform duration-500">
                  <Ticket size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tight leading-none">Coupon Code</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Unlock a delicious deal</p>
                </div>
              </div>

              <div className="relative">
                <AnimatePresence mode="wait">
                  {!appliedCoupon ? (
                    <motion.div 
                      key="input"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-4"
                    >
                      <div className="flex gap-2 sm:gap-3">
                        <input
                          type="text"
                          placeholder="ENTER CODE"
                          className="flex-1 bg-white/5 border border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/5 p-4 rounded-2xl transition-all font-black text-white uppercase placeholder:text-zinc-700 placeholder:text-[10px] tracking-widest min-w-0"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon()}
                          disabled={isApplyingCoupon || !couponCode}
                          className="px-6 sm:px-8 bg-primary text-white disabled:bg-zinc-800 disabled:opacity-50 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all hover:brightness-110 active:scale-95 shadow-lg shadow-primary/25 whitespace-nowrap"
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
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex items-center justify-between bg-primary/10 border border-primary/20 p-4 sm:p-5 rounded-2xl relative overflow-hidden"
                    >
                      <motion.div 
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/40 origin-left"
                      />
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                          <Check size={20} className="text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm sm:text-base font-black text-white uppercase italic tracking-tight">{appliedCoupon.code}</p>
                            <span className="px-2 py-0.5 bg-primary/20 text-primary text-[8px] font-black uppercase rounded-md tracking-widest border border-primary/30">Verified</span>
                          </div>
                          <p className="text-[11px] font-bold text-primary uppercase mt-1 tracking-wider italic">
                            {appliedCoupon.type === 'free_item' ? 'FREE Gift Applied! 🎁' : `₹${discountAmount.toFixed(0)} Discounted! ✨`}
                          </p>
                          {appliedCoupon.gift_url && (
                            <a 
                              href={appliedCoupon.gift_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[9px] font-black text-white/40 hover:text-primary transition-colors uppercase tracking-widest mt-2 bg-white/5 px-2 py-1 rounded-md border border-white/5"
                            >
                              <Sparkles size={10} /> View Gift details
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="p-3 hover:bg-white/10 rounded-xl transition-all text-zinc-500 hover:text-red-400 active:scale-90"
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
            <div className="bakery-card p-8 md:p-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <CreditCard size={24} />
                </div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Payment Method</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, paymentMethod: 'upi' });
                    // Scroll to final checkout button for better UX
                    document.getElementById('checkout-action-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className={cn(
                    "relative flex flex-col p-6 rounded-3xl border-2 transition-all group overflow-hidden text-left",
                    formData.paymentMethod === 'upi' 
                      ? "border-primary bg-primary/10" 
                      : "border-white/5 hover:border-primary/20 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className={cn(
                      "p-3 rounded-xl",
                      formData.paymentMethod === 'upi' ? "bg-primary text-white shadow-sm" : "bg-white/5 text-zinc-500"
                    )}>
                      <Wallet size={24} />
                    </div>
                    {formData.paymentMethod === 'upi' && (
                      <CheckCircle2 size={24} className="text-primary" />
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white uppercase italic tracking-tight leading-none relative z-10">Pay via UPI</h3>
                  <p className="text-xs text-zinc-500 font-bold tracking-widest mt-2 uppercase relative z-10">Google Pay, PhonePe, Paytm</p>
                  
                  {formData.paymentMethod === 'upi' && (
                    <div className="mt-4 relative z-10 flex items-center gap-2 text-primary font-black uppercase tracking-tighter text-[10px] animate-pulse">
                      <QrCode size={12} />
                      Click to Process & View QR
                    </div>
                  )}

                  <div className={cn(
                    "absolute bottom-0 right-0 w-32 h-32 blur-3xl -mb-16 -mr-16 transition-all",
                    formData.paymentMethod === 'upi' ? "bg-primary/20" : "bg-transparent"
                  )} />
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, paymentMethod: 'cod' })}
                  className={cn(
                    "relative flex flex-col p-6 rounded-3xl border-2 transition-all group overflow-hidden text-left",
                    formData.paymentMethod === 'cod' 
                      ? "border-white bg-white/10" 
                      : "border-white/5 hover:border-white/20 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className={cn(
                      "p-3 rounded-xl",
                      formData.paymentMethod === 'cod' ? "bg-white text-black shadow-sm" : "bg-white/5 text-zinc-500"
                    )}>
                      <HandCoins size={24} />
                    </div>
                    {formData.paymentMethod === 'cod' && (
                      <CheckCircle2 size={24} className="text-white" />
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white uppercase italic tracking-tight leading-none relative z-10">Cash on Delivery</h3>
                  <p className="text-xs text-zinc-500 font-bold tracking-widest mt-2 uppercase relative z-10">Pay when your order arrives</p>
                  <div className={cn(
                    "absolute bottom-0 right-0 w-32 h-32 blur-3xl -mb-16 -mr-16 transition-all",
                    formData.paymentMethod === 'cod' ? "bg-zinc-800/40" : "bg-transparent"
                  )} />
                </button>
              </div>
            </div>
          </form>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bakery-card p-8 space-y-6 lg:sticky lg:top-24">
              <h3 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
                Order Summary
                <span className="text-xs font-bold text-zinc-500">({cart.length} items)</span>
              </h3>

              <div className="space-y-4 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                {cart.map((item) => (
                  <div key={item.id} className="flex gap-4 group">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-white/5">
                      <OptimizedImage src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="flex-1 min-w-0 py-1">
                      <h4 className="text-sm font-black text-white uppercase italic tracking-tight truncate leading-tight">{item.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Qty: {item.quantity}</p>
                      <p className="text-xs font-black text-primary italic mt-1">₹{item.price * item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
                  <span>Subtotal</span>
                  <span>₹{subtotal}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-[0.1em] text-primary">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
                  <span>{isPickupOnly ? 'Fulfillment' : 'Delivery'}</span>
                  {isPickupOnly ? (
                    <span className="text-amber-400 font-extrabold flex items-center gap-1">
                      <ShoppingBag size={12} /> PICKUP (FREE)
                    </span>
                  ) : deliveryFee === 0 ? (
                    <span className="text-emerald-500">FREE</span>
                  ) : (
                    <span>₹{deliveryFee}</span>
                  )}
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-black text-white uppercase italic tracking-tight">Total Payable</span>
                  <span className="text-2xl font-black text-white italic tracking-tighter">₹{finalPrice}</span>
                </div>
              </div>

              {!isPickupOnly && formData.location && !isLocationInServiceArea() && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span className="font-black text-xs uppercase tracking-widest leading-none">Out of Delivery Boundary</span>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider leading-relaxed text-zinc-400 font-bold">
                    The chosen map pin coordinate lies outside Frosty Bite's active delivery boundaries. Please adjust your address marker on the map selector.
                  </p>
                </div>
              )}

              {getCartAvailabilityWarning() && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span className="font-black text-xs uppercase tracking-widest leading-none">Availability Warning</span>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider leading-relaxed text-zinc-400 font-bold">
                    {getCartAvailabilityWarning()}
                  </p>
                </div>
              )}

              <button
                id="checkout-action-btn"
                onClick={handlePlaceOrder}
                disabled={isLoading || isOrdering || !isOrderingOpen || !isLocationInServiceArea() || !!getCartAvailabilityWarning()}
                className={cn(
                  "w-full btn-premium group h-16 transition-all",
                  (isLoading || isOrdering || !isOrderingOpen || !isLocationInServiceArea() || !!getCartAvailabilityWarning()) && "opacity-80 cursor-not-allowed bg-zinc-700 hover:scale-100 shadow-none border-zinc-600"
                )}
              >
                <div className="flex items-center justify-center gap-3">
                  {isOrdering ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span className="font-black uppercase tracking-widest text-sm">Processing Order...</span>
                    </>
                  ) : isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span className="font-black uppercase tracking-widest text-sm">Checking status...</span>
                    </>
                  ) : !isOrderingOpen ? (
                    <>
                      <X size={20} />
                      <span className="font-black uppercase tracking-widest font-bold">Orders Closed</span>
                    </>
                  ) : !isLocationInServiceArea() ? (
                    <>
                      <AlertTriangle size={20} />
                      <span className="font-black uppercase tracking-widest font-bold">Location Out of Bounds</span>
                    </>
                  ) : (
                    <>
                      <span className="font-black uppercase tracking-widest">
                        {formData.paymentMethod === 'cod' ? 'Place COD Order' : 'Go to QR Code & Pay'}
                      </span>
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>

              <div className="flex items-center justify-center gap-2 text-zinc-500">
                <ShieldCheck size={14} className="text-primary" />
                <span className="text-[9px] font-black uppercase tracking-[0.15em]">100% Encrypted & Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar for Mobile Checkout */}
      {cart.length > 0 && !showConfirmation && !isOrdering && (
        <div className="lg:hidden sticky bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-md mx-auto space-y-4">
            <div className="flex justify-between items-center px-2">
               <div>
                 <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Payable</p>
                 <p className="text-2xl font-black text-white italic tracking-tighter">₹{finalPrice}</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">Secure</p>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Checkout</p>
               </div>
            </div>
            
            <button
              onClick={handlePlaceOrder}
              disabled={isLoading || isOrdering || !isOrderingOpen || !isLocationInServiceArea() || !!getCartAvailabilityWarning()}
              className={cn(
                "w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-primary/20",
                (isLoading || !isOrderingOpen || isOrdering || !isLocationInServiceArea() || !!getCartAvailabilityWarning()) && "bg-zinc-800 opacity-50 shadow-none pointer-events-none"
              )}
            >
              {isOrdering ? (
                <Loader2 className="animate-spin" size={18} />
              ) : isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Checking status...</span>
                </>
              ) : !isOrderingOpen ? (
                'Orders Closed'
              ) : !isLocationInServiceArea() ? (
                'Location Out of Boundary'
              ) : getCartAvailabilityWarning() ? (
                'Check Schedule Date'
              ) : (
                <>
                  <span>
                    {formData.paymentMethod === 'cod' ? 'Place COD Order' : 'Go to QR & Pay'}
                  </span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;
