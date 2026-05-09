import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Package, Truck, CheckCircle, MapPin, Phone, MessageCircle, User as UserIcon, Loader2, ChefHat, Clock, X, ShoppingBag, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { supabase } from '../supabase';
import { safeFirestore } from '../services/firestoreService';
import { sendWhatsAppMessage } from '../utils/whatsapp';
import { Order, Rider } from '../types';
import { cn } from '../lib/utils';
import { FrostyAnimation } from '../components/LottiePlayer';
import { ReviewForm } from '../components/ReviewForm';

const MapView = React.lazy(() => import('../components/rider/MapView').then(m => ({ default: m.MapView })));

import { LOTTIE_ANIMATIONS } from '../constants/animations';
import { RESTAURANT_WHATSAPP } from '../constants';

const STATUS_ANIMATIONS: Record<string, string> = {
  pending: LOTTIE_ANIMATIONS.PROCESSING,
  confirmed: LOTTIE_ANIMATIONS.PROCESSING,
  assigned: LOTTIE_ANIMATIONS.PROCESSING,
  preparing: LOTTIE_ANIMATIONS.COOKING,
  out_for_delivery: LOTTIE_ANIMATIONS.DELIVERY_TRUCK,
  delivered: LOTTIE_ANIMATIONS.SUCCESS_CHECK,
  cancelled: "https://assets10.lottiefiles.com/packages/lf20_mye7bg9j.json", // We can use something else or fallback
};

const STATUS_FALLBACKS: Record<string, React.ReactNode> = {
  pending: (
    <motion.div
      animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <Clock className="text-primary" size={64} strokeWidth={1.5} />
    </motion.div>
  ),
  confirmed: (
    <motion.div
      animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <CheckCircle className="text-primary" size={64} strokeWidth={1.5} />
    </motion.div>
  ),
  assigned: (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <UserIcon className="text-primary" size={64} strokeWidth={1.5} />
    </motion.div>
  ),
  preparing: (
    <motion.div
      animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <ChefHat className="text-primary" size={64} strokeWidth={1.5} />
    </motion.div>
  ),
  out_for_delivery: (
    <motion.div
      animate={{ x: [-20, 20, -20] }}
      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
    >
      <Truck className="text-primary" size={64} strokeWidth={1.5} />
    </motion.div>
  ),
  delivered: (
    <motion.div
      initial={{ scale: 0, rotate: -20 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", damping: 12 }}
    >
      <CheckCircle className="text-emerald-500" size={64} strokeWidth={1.5} />
    </motion.div>
  ),
  cancelled: (
    <motion.div
      initial={{ scale: 0, rotate: 20 }}
      animate={{ scale: 1, rotate: 0 }}
      className="flex flex-col items-center"
    >
      <div className="relative">
        <Package className="text-red-500 opacity-20" size={80} strokeWidth={1} />
        <X className="text-red-500 absolute inset-0 m-auto" size={48} strokeWidth={3} />
      </div>
      <p className="text-red-500 font-black uppercase tracking-widest mt-4 text-xs">Order Rejected</p>
    </motion.div>
  ),
};

const STATUS_STEPS = [
  { id: 'pending', label: 'Pending', icon: Package, description: 'Waiting for payment confirmation' },
  { id: 'confirmed', label: 'Confirmed', icon: CheckCircle, description: 'Payment confirmed, preparing order' },
  { id: 'assigned', label: 'Rider Assigned', icon: UserIcon, description: 'A rider is coming to pick up' },
  { id: 'preparing', label: 'Preparing', icon: Package, description: 'Chef is working their magic' },
  { id: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, description: 'Rider is on the way' },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle, description: 'Enjoy your meal!' },
];

export const OrderTracking: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrderAndRider = async () => {
      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError) throw orderError;
        if (orderData) {
          setOrder(orderData as Order);
          if (orderData.rider_id) {
            const { data: riderData } = await supabase
              .from('riders')
              .select('*')
              .eq('id', orderData.rider_id)
              .single();
            if (riderData) setRider(riderData as Rider);
          }
        }
      } catch (err) {
        console.error('Error fetching order/rider:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderAndRider();

    // Subscribe to order changes
    const orderChannel = supabase
      .channel(`tracking_order_${orderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        const newOrder = payload.new as Order;
        setOrder(newOrder);
        
        // If rider assigned/changed, we might need to subscribe to rider too
        if (newOrder.rider_id) {
          fetchRider(newOrder.rider_id);
        }
      })
      .subscribe();

    const fetchRider = async (riderId: string) => {
      const { data } = await supabase
        .from('riders')
        .select('*')
        .eq('id', riderId)
        .single();
      if (data) setRider(data as Rider);
    };

    // Review check - Try Supabase first
    const checkReview = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle();
        
        if (data) {
          setHasReviewed(true);
        } else {
          // Fallback to Firestore check
          const q = query(
            collection(db, 'reviews'),
            where('order_id', '==', orderId),
            limit(1)
          );
          const reviews = await safeFirestore.getCollection<any>(q, `review_check_${orderId}`, 'reviews');
          setHasReviewed(reviews && reviews.length > 0);
        }
      } catch (e: any) {
        console.error('Error checking review:', e);
      }
    };
    checkReview();

    return () => {
      supabase.removeChannel(orderChannel);
    };
  }, [orderId]);

  // Subscribe to rider location updates if rider exists
  useEffect(() => {
    if (!rider?.id) return;

    const riderChannel = supabase
      .channel(`tracking_rider_${rider.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'riders',
        filter: `id=eq.${rider.id}`
      }, (payload) => {
        setRider(payload.new as Rider);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(riderChannel);
    };
  }, [rider?.id]);

  // Use a ref-like approach for getRemainingTime to avoid it changing on every render
  const getRemainingTime = React.useCallback(() => {
    if (!order || !order.created_at || !order.estimated_delivery_time) return null;
    
    try {
      const startTime = new Date(order.created_at).getTime();
      const estimatedEndTime = startTime + (order.estimated_delivery_time * 60 * 1000);
      const now = Date.now();
      const diff = estimatedEndTime - now;
      
      if (diff <= 0) return "Arriving soon";
      
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    } catch (e) {
      return null;
    }
  }, [order]);

  useEffect(() => {
    setCountdown(getRemainingTime());
    const timer = setInterval(() => {
      setCountdown(getRemainingTime());
    }, 1000);
    return () => clearInterval(timer);
  }, [getRemainingTime]);

  const currentStatusIndex = order ? STATUS_STEPS.findIndex(step => step.id === (order.status || 'pending')) : 0;
  const safeStatusIndex = currentStatusIndex === -1 ? 0 : currentStatusIndex;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="text-primary animate-spin mb-4" size={40} />
        <p className="text-muted">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <Package className="text-zinc-800" size={120} strokeWidth={1} />
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="absolute -top-2 -right-2 bg-amber-500 text-white p-2 rounded-full shadow-xl shadow-amber-500/40"
            >
              <AlertTriangle size={40} strokeWidth={3} />
            </motion.div>
          </div>
        </motion.div>
        
        <h2 className="text-4xl font-black italic tracking-tighter text-white mb-4 uppercase">Order Not Found</h2>
        <div className="space-y-4 mb-12">
          <p className="text-zinc-500 max-w-md mx-auto">
            We couldn't locate the order with ID: <span className="text-primary font-mono">{orderId}</span>. 
            It might still be processing or the link is incorrect.
          </p>
          <div className="bg-white/5 p-4 rounded-2xl max-w-sm mx-auto text-[10px] font-black uppercase tracking-widest text-zinc-600 border border-white/5">
            Check your profile or order history
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button 
            onClick={() => navigate('/')} 
            className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all text-sm shadow-xl"
          >
            Back to Menu
          </button>
          <button 
            onClick={() => window.location.reload()} 
            className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-700 transition-all text-sm border border-white/10"
          >
            Retry Search
          </button>
        </div>
      </div>
    );
  }

  if (order.status === 'cancelled') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            <motion.div
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Package className="text-zinc-800" size={120} strokeWidth={1} />
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-xl shadow-red-500/40"
            >
              <X size={40} strokeWidth={3} />
            </motion.div>
          </div>
        </motion.div>
        
        <h2 className="text-4xl font-black italic tracking-tighter text-white mb-4 uppercase">Order Rejected</h2>
        <div className="space-y-4 mb-12">
          <p className="text-zinc-500 max-w-md mx-auto">
            We're sorry, but your order has been cancelled by the restaurant. 
            If you have already paid for this order, your money will be refunded according to our refund policy within the next 24 hours.
          </p>
          {order.notes && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl max-w-md mx-auto">
              <p className="text-red-500 font-bold text-xs uppercase tracking-widest mb-1">Status Note:</p>
              <p className="text-white text-sm italic">"{order.notes}"</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button 
            onClick={() => navigate('/')} 
            className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all text-sm"
          >
            Back to Menu
          </button>
          <button 
            onClick={() => sendWhatsAppMessage(RESTAURANT_WHATSAPP, `Hi, my order #${orderId} was rejected. Can you help?`)}
            className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all text-sm flex items-center justify-center gap-2"
          >
            <Phone size={18} />
            Support
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">Track Order</h1>
          <p className="text-muted">Order ID: <span className="text-primary font-mono">{orderId}</span></p>
        </div>
        {order.status !== 'delivered' && (
          <div className="mt-4 md:mt-0 glass px-6 py-3 rounded-2xl flex flex-col items-end gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Estimated Arrival</span>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              <span className="text-xl font-black text-white tabular-nums">
                {countdown || (order.estimated_delivery_time ? `${order.estimated_delivery_time} mins` : 'Calculating...')}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status Timeline */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-dark p-8 rounded-3xl border border-border overflow-hidden relative">
            {/* Main Status Animation */}
            <div className="flex flex-col items-center justify-center py-6 mb-8 border-b border-white/5">
              <div className="w-56 h-56 relative">
                 <FrostyAnimation 
                    url={STATUS_ANIMATIONS[order.status] || STATUS_ANIMATIONS.pending}
                    className="w-full h-full"
                    fallback={STATUS_FALLBACKS[order.status] || STATUS_FALLBACKS.pending}
                  />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                    {(order.status === 'pending' && order.utr) 
                      ? 'Verifying Payment' 
                      : STATUS_STEPS[safeStatusIndex].label}
                  </div>
              </div>
            </div>

            <div className="relative space-y-12 px-2">
              {/* Vertical Line */}
              <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-border" />

              {STATUS_STEPS.map((step, index) => {
                const isActive = index <= safeStatusIndex;
                const isCurrent = index === safeStatusIndex;

                let label = step.label;
                let description = step.description;

                if (step.id === 'pending' && order.status === 'pending' && order.utr) {
                  label = 'Verifying Payment';
                  description = 'Admin is currently verifying your UPI UTR number';
                }

                return (
                  <div key={step.id} className="relative flex items-start space-x-6">
                    <div className={cn(
                      "relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-500",
                      isActive ? "bg-primary text-white" : "bg-secondary text-muted"
                    )}>
                      <step.icon size={24} />
                      {isCurrent && (
                        <motion.div
                          layoutId="pulse"
                          className="absolute inset-0 rounded-full bg-primary/30"
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        />
                      )}
                    </div>
                    <div>
                      <h3 className={cn("font-bold text-lg", isActive ? "text-white" : "text-muted")}>
                        {label}
                      </h3>
                      <p className="text-muted text-sm">{description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivery OTP Section */}
          {order.status === 'out_for_delivery' && order.delivery_otp && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-dark p-8 rounded-3xl border-2 border-primary/30 bg-primary/5 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary">
                <CheckCircle size={32} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tight text-white mb-1">Delivery OTP</h3>
                <p className="text-zinc-500 text-sm">Share this code with the rider to confirm delivery</p>
              </div>
              <div className="flex justify-center gap-3">
                {String(order.delivery_otp || '').split('').map((digit, i) => (
                  <div key={i} className="w-12 h-16 bg-zinc-900 border border-white/10 rounded-xl flex items-center justify-center text-3xl font-black text-primary shadow-xl">
                    {digit}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Rider Info */}
          {rider ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-dark p-6 rounded-3xl border border-border flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-secondary rounded-full flex items-center justify-center overflow-hidden">
                  <UserIcon size={30} className="text-muted" />
                </div>
                <div>
                  <h4 className="font-bold">{rider.name}</h4>
                  <p className="text-muted text-xs">Your Delivery Partner</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <a 
                  href={`tel:${rider.phone || ''}`}
                  className="p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary/20 transition-colors"
                  title="Call Rider"
                >
                  <Phone size={20} />
                </a>
                <button 
                  onClick={() => sendWhatsAppMessage(rider.phone || '', `Hello ${rider.name}, I'm checking on my Frosty Bite order #${orderId}.`)}
                  className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500/20 transition-colors"
                  title="WhatsApp Rider"
                >
                  <MessageCircle size={20} />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="glass-dark p-6 rounded-3xl border border-border text-center">
              <p className="text-muted text-sm">Searching for a nearby rider...</p>
            </div>
          )}
        </div>

        {/* Map Placeholder */}
        <div className="space-y-8">
          <div className="aspect-square rounded-3xl overflow-hidden relative border border-border shadow-2xl bg-zinc-900">
            <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}>
              <MapView 
                riderLocation={rider?.location || null} 
                customerLocation={order.delivery_location || null} 
              />
            </React.Suspense>
          </div>

          <div className="glass-dark p-6 rounded-3xl border border-border">
            <h4 className="font-bold mb-4">Delivery Address</h4>
            <p className="text-sm text-muted">
              {order.address || 'No address provided'}
            </p>
          </div>

          <div className="glass-dark p-6 rounded-3xl border border-border">
            <h4 className="font-bold mb-4 italic uppercase tracking-widest text-xs underline decoration-primary underline-offset-8">Order Summary</h4>
            <div className="space-y-3">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-primary font-black px-1.5 py-0.5 bg-primary/10 rounded-md text-[10px]">{item.quantity}x</span>
                    <span className="text-zinc-300 font-bold uppercase tracking-tight">{item.name}</span>
                  </div>
                  <span className="text-zinc-500 font-mono">₹{item.price * item.quantity}</span>
                </div>
              ))}
              
              <div className="pt-4 border-t border-white/5 space-y-2">
                <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>₹{(order.total || 0) + (order.discount || 0) - (order.delivery_charge || 0)}</span>
                </div>
                {order.discount && order.discount > 0 && (
                  <div className="flex justify-between text-[10px] text-primary font-bold uppercase tracking-widest">
                    <span>Discount</span>
                    <span>-₹{order.discount}</span>
                  </div>
                )}
                {order.delivery_charge !== undefined && order.delivery_charge > 0 && (
                  <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    <span>Delivery Fee</span>
                    <span>₹{order.delivery_charge}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black text-white italic uppercase tracking-tighter pt-2 border-t border-white/10 mt-2">
                  <span>Grand Total</span>
                  <span>₹{order.total}</span>
                </div>
              </div>
            </div>
          </div>

          {order.status === 'delivered' && !hasReviewed && orderId && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-8 space-y-6"
            >
              <ReviewForm 
                orderId={orderId} 
                onSuccess={() => setHasReviewed(true)} 
              />
              
              <button 
                onClick={() => navigate('/orders')}
                className="w-full flex items-center justify-center gap-2 py-4 text-zinc-500 font-black uppercase tracking-[0.2em] text-[10px] hover:text-white transition-colors"
              >
                <ShoppingBag size={14} />
                View Order History
              </button>
            </motion.div>
          )}

          {order.status === 'delivered' && hasReviewed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-8"
            >
              <button 
                onClick={() => navigate('/orders')}
                className="w-full bg-white/5 border border-white/10 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95 shadow-xl"
              >
                <ShoppingBag size={18} className="text-primary" />
                View Full Order History
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;
