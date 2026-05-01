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
  AlertTriangle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, increment, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { OrderConfirmation } from '../components/OrderConfirmation';
import { openWhatsAppOrder } from '../utils/whatsapp';
import { useAppConfig } from '../hooks/useAppConfig';
import { useNotifications } from '../context/NotificationContext';

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const { isOrderingOpen } = useAppConfig();
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
    notes: '',
    paymentMethod: 'upi' as 'upi' | 'cod'
  });
  const [isLocating, setIsLocating] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ 
    id: string;
    code: string; 
    value: number; 
    type: 'percentage' | 'fixed' 
  } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const subtotal = cartSubtotal;
  const discountAmount = appliedCoupon 
    ? (appliedCoupon.type === 'percentage' 
        ? (subtotal * appliedCoupon.value) / 100 
        : appliedCoupon.value)
    : 0;
  const finalPrice = Math.max(0, subtotal - discountAmount);

  const handleApplyCoupon = async () => {
    const trimmedCode = couponCode.trim();
    if (!trimmedCode) {
      toast.error('Please enter a coupon code');
      return;
    }
    
    setIsApplyingCoupon(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const code = trimmedCode.toUpperCase();
      
      const q = query(
        collection(db, 'coupons'),
        where('code', '==', code),
        where('status', '==', 'active'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.error('Invalid or expired coupon code');
        setIsApplyingCoupon(false);
        return;
      }

      const couponDoc = snapshot.docs[0];
      const couponData = couponDoc.data();
      
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
        id: couponDoc.id,
        code: couponData.code, 
        value: couponData.value,
        type: couponData.type
      });

      const discountDisplay = couponData.type === 'percentage' ? `${couponData.value}%` : `₹${couponData.value}`;
      toast.success(`${discountDisplay} discount applied!`, { icon: '🎉' });
      
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
      const orderData = {
        user_id: user?.uid || 'guest',
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        subtotal: subtotal,
        discount: discountAmount,
        coupon_code: appliedCoupon?.code || null,
        total: finalPrice,
        status: 'pending',
        payment_method: formData.paymentMethod,
        payment_status: formData.paymentMethod === 'upi' ? 'pending_verification' : 'pending',
        address: formData.address,
        phone: formData.phone,
        customer_name: formData.name,
        notes: formData.notes,
        created_at: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = docRef.id;

      // Increment coupon usage count if applied
      if (appliedCoupon?.id) {
        try {
          await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
            usage_count: increment(1)
          });
        } catch (err) {
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

        navigate(`/upi-checkout/${orderId}`, { 
          state: { 
            orderId: orderId,
            totalPrice: finalPrice,
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            notes: formData.notes,
            discount: discountAmount,
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
        clearCart();
      }
    } catch (error: any) {
      console.error('Order failed:', error);
      toast.error('Failed to place order. Please try again.');
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
            setFormData(prev => ({ ...prev, address: data.display_name }));
            toast.success("Location updated!");
          } else {
            toast.error("Could not find address for your location");
          }
        } catch (error) {
          toast.error("Error fetching address. Please enter manually.");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === 1) {
          toast.error("Location permission denied. Please enable it in browser settings.");
        } else {
          toast.error("Error getting location. Please enter manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
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

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} className="text-primary" /> Complete Address *
                  </label>
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
                          onClick={handleApplyCoupon}
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
                          <p className="text-[11px] font-bold text-primary uppercase mt-1 tracking-wider italic">₹{discountAmount.toFixed(0)} Discounted! ✨</p>
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
                  <span className="text-emerald-500">FREE</span>
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
    </div>
  );
};

export default Checkout;
