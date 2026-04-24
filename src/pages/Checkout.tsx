import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, CreditCard, Smartphone, ChevronRight, CheckCircle2, ShoppingBag, Tag, X, Sparkles, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { assignRider } from '../services/riderAssignmentService';
import { sendWhatsAppMessage } from "../utils/whatsapp";
import { RESTAURANT_WHATSAPP } from '../constants';
import { appConfigService, AppConfig } from '../services/appConfigService';

const SuccessOverlay: React.FC<{ orderId: string }> = ({ orderId }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black overflow-hidden"
    >
      {/* Background Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: window.innerHeight + 100,
              scale: Math.random() * 0.5 + 0.5,
              opacity: 0.8
            }}
            animate={{ 
              y: -100,
              rotate: 360,
              opacity: 0
            }}
            transition={{ 
              duration: Math.random() * 2 + 2, 
              repeat: Infinity,
              delay: Math.random() * 2
            }}
            className="absolute w-2 h-2 bg-primary rounded-full"
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-4">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.2 }}
          className="w-32 h-32 bg-primary rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(249,115,22,0.4)]"
        >
          <CheckCircle2 size={64} className="text-white" />
        </motion.div>

        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-4 italic uppercase">
            Order <span className="text-primary">Confirmed</span>
          </h1>
          <p className="text-xl text-muted font-medium mb-8">
            Your Frosty Bite treats are being prepared.
          </p>
          
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-secondary/50 border border-border rounded-2xl backdrop-blur-xl">
            <ShoppingBag size={20} className="text-primary" />
            <span className="text-sm font-bold tracking-widest uppercase text-white">
              Order ID: <span className="text-primary">{orderId}</span>
            </span>
          </div>
        </motion.div>
      </div>

      {/* Decorative Logo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        className="absolute bottom-[-10%] left-[-5%] w-[50vw] pointer-events-none select-none flex items-center justify-center"
      >
        <img 
          src="https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg" 
          alt="" 
          className="w-full h-auto object-contain grayscale brightness-0 invert"
          referrerPolicy="no-referrer"
        />
      </motion.div>
    </motion.div>
  );
};

export const Checkout: React.FC = () => {
  const { cart, totalPrice, subtotal, discount, appliedCoupon, applyCoupon, removeCoupon, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState('');
  const [address, setAddress] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'cod' | null>('upi');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [showCouponSuccess, setShowCouponSuccess] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    const unsubscribe = appConfigService.subscribeToConfig((data) => {
      setConfig(data);
    });
    return () => unsubscribe();
  }, []);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    setIsApplyingCoupon(true);
    setCouponError(null);
    
    try {
      const q = query(
        collection(db, 'coupons'), 
        where('code', '==', couponCode.toUpperCase()),
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setCouponError('Invalid or expired coupon code');
        setIsApplyingCoupon(false);
        return;
      }

      const couponDoc = querySnapshot.docs[0];
      const couponData = { id: couponDoc.id, ...couponDoc.data() } as any;

      // Validate expiry
      const now = new Date();
      const expiry = new Date(couponData.expiryDate);
      if (expiry < now) {
        setCouponError('This coupon has expired');
        setIsApplyingCoupon(false);
        return;
      }

      // Validate usage limit
      if (couponData.usageCount >= couponData.usageLimit) {
        setCouponError('Coupon usage limit reached');
        setIsApplyingCoupon(false);
        return;
      }

      // Validate min order
      if (subtotal < couponData.minOrder) {
        setCouponError(`Minimum order of ₹${couponData.minOrder} required`);
        setIsApplyingCoupon(false);
        return;
      }

      applyCoupon(couponData);
      setShowCouponSuccess(true);
      setCouponCode('');
      setTimeout(() => setShowCouponSuccess(false), 3000);
    } catch (err) {
      console.error('Error applying coupon:', err);
      setCouponError('Failed to apply coupon');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setAddress(`Located via GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setIsLocating(false);
          setError(null);
        } catch (err) {
          setError('Failed to get your location details');
          setIsLocating(false);
        }
      },
      (err) => {
        setError('Please enable location permissions to use this feature');
        setIsLocating(false);
      }
    );
  };

  const handleOrderSuccess = (order: any) => {
    const itemsList = order.items.map((item: any) => `- ${item.name} x ${item.quantity} (₹${item.price * item.quantity})`).join('\n');
    
    const message = `
🧁 *Frosty Bite Order Confirmed!*

*Customer Details:*
Name: ${order.customerName}
Phone: ${order.phone}
Address: ${order.address}
Payment: ${order.paymentMethod.toUpperCase()}

*Order Summary:*
${itemsList}

*Total Amount: ₹${order.total}*

Order ID: ${order.id || 'Pending'}
Thank you for choosing Frosty Bite! 🥯
    `;

    sendWhatsAppMessage(RESTAURANT_WHATSAPP, message);
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (config && !config.isOrderingOpen) {
      setError('🚫 Online orders are currently closed. Please try again later.');
      return;
    }

    if (!fullName.trim() || !phone.trim() || !address.trim() || !paymentMethod) {
      setError('Please fill in all mandatory fields: Name, Phone, Address, and Payment Method.');
      return;
    }

    if (phone.trim().length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    try {
      const deliveryLocation = {
        lat: 17.3850 + (Math.random() - 0.5) * 0.01,
        lng: 78.4867 + (Math.random() - 0.5) * 0.01
      };

      const gstAmount = Math.round(totalPrice * 0.05);
      const deliveryCharge = 0; // Currently free

      const orderData = {
        userId: user.uid,
        customerName: fullName.trim(),
        phone: phone.trim(),
        items: cart,
        subtotal: subtotal,
        discount: discount,
        gst: gstAmount,
        deliveryCharge: deliveryCharge,
        total: totalPrice,
        couponId: appliedCoupon?.id || null,
        couponCode: appliedCoupon?.code || null,
        status: 'pending',
        address: address.trim(),
        notes: notes.trim(),
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
        deliveryLocation: deliveryLocation,
        createdAt: serverTimestamp(),
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);
      const orderId = orderRef.id;

      // Update coupon usage count if applied
      if (appliedCoupon) {
        await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
          usageCount: increment(1)
        });
      }

      await assignRider(orderId, deliveryLocation);
      handleOrderSuccess({ ...orderData, id: orderId });
      
      setConfirmedOrderId(orderId);
      setShowSuccess(true);
      clearCart();

      // Navigate after animation
      setTimeout(() => {
        navigate(`/order-tracking/${orderId}`);
      }, 4000);

    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (cart.length === 0 && !isProcessing && !showSuccess) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold mb-4">Your cart is empty</h2>
        <button onClick={() => navigate('/')} className="bg-primary text-white px-8 py-3 rounded-xl font-bold">
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <AnimatePresence>
        {showSuccess && <SuccessOverlay orderId={confirmedOrderId} />}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Address Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-dark p-8 rounded-3xl border border-border"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <MapPin size={20} />
              </div>
              <h2 className="text-2xl font-bold">Delivery Address</h2>
            </div>
            <div className="space-y-4">
              {config && !config.isOrderingOpen && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-6 rounded-2xl flex items-center gap-4 animate-pulse">
                  <AlertTriangle size={24} />
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase tracking-widest">Ordering Disabled</span>
                    <span className="text-xs font-bold opacity-80">Online orders are currently closed. Please try again later.</span>
                  </div>
                </div>
              )}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm font-medium">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-secondary border-border rounded-xl p-4 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-secondary border-border rounded-xl p-4 focus:ring-primary"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted">Complete Address *</label>
                  <button 
                    onClick={handleLocateMe}
                    disabled={isLocating}
                    className="text-xs font-bold text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
                  >
                    {isLocating ? (
                      <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <MapPin size={12} />
                    )}
                    Locate Me
                  </button>
                </div>
                <textarea
                  placeholder="House No, Street, Landmark, Area"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-secondary border-border rounded-xl p-4 h-32 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1">Order Notes (Optional)</label>
                <textarea
                  placeholder="Any special instructions for the kitchen or delivery partner?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-secondary border-border rounded-xl p-4 h-24 focus:ring-primary"
                />
              </div>
            </div>
          </motion.div>

          {/* Payment Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-dark p-8 rounded-3xl border border-border"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <CreditCard size={20} />
              </div>
              <h2 className="text-2xl font-bold">Payment Method *</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button 
                onClick={() => setPaymentMethod('upi')}
                className={`flex items-center justify-between p-4 bg-secondary border-2 rounded-2xl transition-all ${paymentMethod === 'upi' ? 'border-primary' : 'border-transparent'}`}
              >
                <div className="flex items-center space-x-3">
                  <Smartphone className={paymentMethod === 'upi' ? 'text-primary' : 'text-muted'} />
                  <span className={`font-bold ${paymentMethod === 'upi' ? 'text-white' : 'text-muted'}`}>UPI / GPay</span>
                </div>
                {paymentMethod === 'upi' && <CheckCircle2 className="text-primary" size={20} />}
              </button>
              <button 
                onClick={() => setPaymentMethod('cod')}
                className={`flex items-center justify-between p-4 bg-secondary border-2 rounded-2xl transition-all ${paymentMethod === 'cod' ? 'border-primary' : 'border-transparent'}`}
              >
                <div className="flex items-center space-x-3">
                  <CreditCard className={paymentMethod === 'cod' ? 'text-primary' : 'text-muted'} />
                  <span className={`font-bold ${paymentMethod === 'cod' ? 'text-white' : 'text-muted'}`}>Cash on Delivery</span>
                </div>
                {paymentMethod === 'cod' && <CheckCircle2 className="text-primary" size={20} />}
              </button>
              <button 
                className="flex items-center justify-between p-4 bg-secondary border border-border rounded-2xl opacity-50 cursor-not-allowed"
                disabled
              >
                <div className="flex items-center space-x-3">
                  <CreditCard className="text-muted" />
                  <span className="font-bold text-muted">Card</span>
                </div>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Order Summary */}
        <div className="space-y-8">
          {/* Coupon Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-dark p-6 rounded-3xl border border-border relative overflow-hidden"
          >
            <AnimatePresence>
              {showCouponSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 z-10 bg-green-500/90 backdrop-blur-sm flex flex-col items-center justify-center text-white"
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                  >
                    <Sparkles size={40} />
                  </motion.div>
                  <span className="text-lg font-black uppercase tracking-tighter mt-2 italic">Coupon Applied!</span>
                  <span className="text-xs font-bold opacity-80">You saved ₹{discount}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Promo Code</h3>
              </div>
              {appliedCoupon && (
                <button 
                  onClick={removeCoupon}
                  className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1"
                >
                  <X size={12} />
                  Remove
                </button>
              )}
            </div>

            {!appliedCoupon ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="ENTER CODE"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-secondary border-border rounded-xl px-4 py-3 text-sm font-bold tracking-widest focus:ring-primary uppercase"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={isApplyingCoupon || !couponCode.trim()}
                    className="bg-primary text-white px-6 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isApplyingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
                {couponError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-bold text-red-500 ml-1"
                  >
                    {couponError}
                  </motion.p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white tracking-widest uppercase italic">{appliedCoupon.code}</p>
                    <p className="text-[10px] font-bold text-green-500 uppercase">Discount Applied</p>
                  </div>
                </div>
                <span className="text-sm font-black text-white italic">-₹{discount}</span>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-dark p-8 rounded-3xl border border-border sticky top-24"
          >
            <h3 className="text-xl font-bold mb-6">Order Summary</h3>
            <div className="space-y-4 mb-8 max-h-60 overflow-y-auto scrollbar-hide">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-muted">{item.quantity}x</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-6 border-t border-border">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>₹{subtotal}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-500">
                  <div className="flex items-center gap-1">
                    <span>Discount</span>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded-full">
                      {appliedCoupon?.code}
                    </span>
                  </div>
                  <span>-₹{discount}</span>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <span>Delivery Fee</span>
                <span className="text-green-500">FREE</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-3">
                <span>Total</span>
                <span className="text-primary">₹{totalPrice}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={isProcessing || (config !== null && !config.isOrderingOpen)}
              className="w-full mt-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Place Order</span>
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
