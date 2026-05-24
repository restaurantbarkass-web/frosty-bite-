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
import { supabaseService } from '../services/supabaseService';
import { emailService } from '../services/emailService';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { OrderConfirmation } from '../components/OrderConfirmation';
import { RESTAURANT_LOCATION } from '../constants';
import { calculateDistance } from '../utils/distance';
import { openWhatsAppOrder } from '../utils/whatsapp';
import { useAppConfig } from '../hooks/useAppConfig';
import { useNotifications } from '../context/NotificationContext';

const MapSelector = React.lazy(() => import('../components/MapSelector').then(m => ({ default: m.MapSelector })));

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, subtotal: cartSubtotal, clearCart, appliedCoupon, setAppliedCoupon } = useCart();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { isOrderingOpen, deliveryBaseFee, deliveryFeePerKm, deliveryFreeKm } = useAppConfig();
  const [deliveryFee, setDeliveryFee] = useState(0);

  const [isOrdering, setIsOrdering] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  const deliverySectionRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({
    name: user?.displayName || user?.email?.split('@')[0] || '',
    phone: '',
    address: '',
    location: undefined as { lat: number; lng: number } | undefined,
    notes: '',
    paymentMethod: 'upi' as 'upi' | 'cod'
  });
  const [isLocating, setIsLocating] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

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

    // Only update if the fee has actually changed to prevent infinite loops
    if (newFee !== deliveryFee) {
      setDeliveryFee(newFee);
    }
  }, [
    formData.location?.lat, 
    formData.location?.lng, 
    deliveryBaseFee, 
    deliveryFeePerKm, 
    deliveryFreeKm, 
    deliveryFee
  ]);

  const subtotal = cartSubtotal;
  const discountAmount = appliedCoupon 
    ? (appliedCoupon.type === 'percentage' 
        ? (subtotal * appliedCoupon.value) / 100 
        : appliedCoupon.value)
    : 0;
  const finalPrice = Math.max(0, subtotal - discountAmount + deliveryFee);

  const handleApplyCoupon = async (codeOverride?: string) => {
    const trimmedCode = (codeOverride || couponCode).trim();
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
    // This local logic for 'claimed_coupon' might be redundant if handles globally
    const claimed = localStorage.getItem('claimed_coupon');
    if (claimed && !appliedCoupon) {
      handleApplyCoupon(claimed);
      localStorage.removeItem('claimed_coupon');
    }
  }, [appliedCoupon]);

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

    if (!isOrderingOpen) {
      toast.error('Orders are currently closed. Please try again later.');
      return;
    }
    
    if (!formData.name) {
      toast.error('Please enter your full name');
      nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameRef.current?.focus();
      return;
    }
    
    if (!formData.phone || formData.phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      phoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      phoneRef.current?.focus();
      return;
    }
    
    if (!formData.address) {
      toast.error('Please enter your delivery address');
      addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      addressRef.current?.focus();
      return;
    }

    setIsOrdering(true);
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

      const orderData = {
        id: orderId,
        user_id: user?.uid || 'guest',
        items: orderItems,
        subtotal: subtotal,
        discount: discountAmount,
        delivery_charge: deliveryFee,
        coupon_code: appliedCoupon?.code || null,
        total: finalPrice,
        status: formData.paymentMethod === 'upi' ? 'awaiting_payment' : 'pending',
        payment_method: formData.paymentMethod,
        payment_status: 'pending',
        address: formData.address,
        delivery_location: formData.location || null,
        phone: formData.phone,
        customer_name: formData.name,
        email: user?.email || null,
        notes: formData.notes + (appliedCoupon?.type === 'free_item' ? ` [PROMO: Free ${appliedCoupon.free_item_quantity}x ${appliedCoupon.free_item_id}]` : ''),
        created_at: new Date().toISOString(),
      };

      // Save to Supabase
      try {
        await supabaseService.insertData('orders', orderData);
      } catch (supabaseError: any) {
        console.error('Supabase order creation failed:', supabaseError);
        // Extract specific message if possible
        const errorMsg = supabaseError.message || 'Database error occurred';
        throw new Error(`Order insertion failed: ${errorMsg}`);
      }

      // Increment coupon usage count if applied
      if (appliedCoupon?.id) {
        try {
          const { data: currentCoupon } = await supabase.from('coupons').select('usage_count').eq('id', appliedCoupon.id).single();
          const newCount = (currentCoupon?.usage_count || 0) + 1;
          await supabase.from('coupons').update({ usage_count: newCount }).eq('id', appliedCoupon.id);
        } catch (err: any) {
          console.error('Failed to increment coupon usage:', err);
        }
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
          estimatedDelivery: 45 // Default estimate
        };
        
        setConfirmedOrder(orderSummary);
        setShowConfirmation(true);
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
      
      // Handle Supabase column missing or schema errors specifically
      if (error.message?.includes('column') || error.code === '42703' || error.message?.includes('schema cache')) {
        errorMessage = 'Database schema mismatch. Please run the latest migration script in Supabase SQL Editor.';
      } else if (error.message) {
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
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          
          if (data.display_name) {
            setFormData(prev => ({ 
              ...prev, 
              address: data.display_name,
              location: { lat: latitude, lng: longitude }
            }));
            toast.success("Location updated!");
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
            {/* Delivery Details */}
            <div 
              ref={deliverySectionRef} 
              className={cn(
                "bakery-card p-8 md:p-10 space-y-8 transition-all duration-1000",
                isHighlighted && "border-primary shadow-[0_0_50px_rgba(249,115,22,0.15)] ring-1 ring-primary/50"
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Truck size={24} />
                </div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Delivery Details</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <User size={12} className="text-primary" /> Full Name *
                  </label>
                  <input
                    ref={nameRef}
                    type="text"
                    required
                    placeholder="Enter your full name"
                    className="w-full bg-white/5 border border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/5 p-4 rounded-2xl transition-all font-medium text-white"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Phone size={12} className="text-primary" /> Phone Number *
                  </label>
                  <input
                    ref={phoneRef}
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    className="w-full bg-white/5 border border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/5 p-4 rounded-2xl transition-all font-medium text-white"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })}
                  />
                </div>
              </div>

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
                              setFormData(prev => ({ 
                                ...prev, 
                                address,
                                location: { lat, lng }
                              }));
                            }}
                          />
                        </React.Suspense>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <textarea
                  ref={addressRef}
                  required
                  rows={3}
                  placeholder="House No, Street, Landmark, Area"
                  className="w-full bg-white/5 border border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/5 p-4 rounded-2xl transition-all font-medium text-white resize-none"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

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
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
                  <span>Delivery</span>
                  {deliveryFee === 0 ? (
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

              <button
                id="checkout-action-btn"
                onClick={handlePlaceOrder}
                disabled={isOrdering || !isOrderingOpen}
                className={cn(
                  "w-full btn-premium group h-16 transition-all",
                  (isOrdering || !isOrderingOpen) && "opacity-80 cursor-not-allowed bg-zinc-700 hover:scale-100 shadow-none border-zinc-600"
                )}
              >
                <div className="flex items-center justify-center gap-3">
                  {isOrdering ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span className="font-black uppercase tracking-widest text-sm">Processing Order...</span>
                    </>
                  ) : !isOrderingOpen ? (
                    <>
                      <X size={20} />
                      <span className="font-black uppercase tracking-widest">Orders Closed</span>
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
              disabled={isOrdering || !isOrderingOpen}
              className={cn(
                "w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-primary/20",
                (!isOrderingOpen || isOrdering) && "bg-zinc-800 opacity-50 shadow-none pointer-events-none"
              )}
            >
              {isOrdering ? (
                <Loader2 className="animate-spin" size={18} />
              ) : !isOrderingOpen ? (
                'Orders Closed'
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
