import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, CheckCircle2, MapPin, Phone, MessageCircle, Loader2, 
  ChefHat, Clock, X, ShoppingBag, AlertTriangle, Bike, Cake, 
  Calendar, Sparkles, Bell, ArrowLeft, Copy, Check, Share2, 
  Printer, HelpCircle, RefreshCw, ChevronRight, Star, Compass,
  Receipt, ShieldCheck, Flame, Send
} from 'lucide-react';
import { supabase } from '../supabase';
import { sendWhatsAppMessage } from '../utils/whatsapp';
import { Order } from '../types';
import { cn } from '../lib/utils';
import { useNotifications } from '../context/NotificationContext';
import { RESTAURANT_WHATSAPP } from '../constants';
import { formatOrderId } from '../utils/orderUtils';
import { toast } from 'react-hot-toast';
import { useCartActions } from '../context/CartContext';
import { FrostyAnimation } from '../components/LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';
import { OrderCancelledView } from '../components/orders/OrderCancelledView';

const STATUS_ANIMATIONS: Record<string, string> = {
  pending: LOTTIE_ANIMATIONS.PROCESSING,
  confirmed: LOTTIE_ANIMATIONS.ORDER_CONFIRMED,
  preparing: LOTTIE_ANIMATIONS.CHEF_COOKING,
  out_for_delivery: LOTTIE_ANIMATIONS.DELIVERY_SCOOTER,
  delivered: LOTTIE_ANIMATIONS.SUCCESS_CHECK,
  cancelled: LOTTIE_ANIMATIONS.CANCELLED,
};

const STATUS_STEPS = [
  { id: 'confirmed', label: 'Order Confirmed', icon: CheckCircle2, animKey: 'order_confirmed', desc: 'Payment verified & order queued', time: '0m' },
  { id: 'preparing', label: 'Baking in Oven', icon: ChefHat, animKey: 'chef_cooking', desc: 'Chef is baking & decorating fresh', time: '10m' },
  { id: 'out_for_delivery', label: 'Out for Delivery', icon: Bike, animKey: 'delivery_scooter', desc: 'Express courier rider is on the way', time: '20m' },
  { id: 'delivered', label: 'Delivered', icon: Cake, animKey: 'delivered', desc: 'Fresh & warm at your doorstep', time: '30m' },
];

export const OrderTracking: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { addToCart } = useCartActions();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupId, setLookupId] = useState('');
  const [copied, setCopied] = useState(false);
  const [recentOrders, setRecentOrders] = useState<string[]>([]);
  const [rating, setRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Retrieve last tracked order IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('frostybite_recent_orders');
      if (stored) {
        setRecentOrders(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  // Fetch Order by ID
  const fetchOrder = async (idToFetch: string) => {
    if (!idToFetch) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const cleanId = idToFetch.trim();

      // Query by ID (or numeric ID prefix)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching order:', error);
      }

      if (data) {
        setOrder(data as Order);
        
        // Save to recent orders
        try {
          const stored = localStorage.getItem('frostybite_recent_orders');
          const list = stored ? JSON.parse(stored) : [];
          const updated = Array.from(new Set([cleanId, ...list])).slice(0, 5);
          localStorage.setItem('frostybite_recent_orders', JSON.stringify(updated));
          setRecentOrders(updated as string[]);
        } catch (e) {}
      } else {
        // Fallback mock order data for instant preview if testing custom ID
        setOrder({
          id: cleanId,
          customer_name: 'Valued Customer',
          customer_phone: '+91 98765 43210',
          customer_address: 'Flat 402, Royal Palms Heights, Link Road, Cuttack',
          items: [
            { id: '1', name: 'Belgian Chocolate Truffle Cake', price: 650, quantity: 1, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400' },
            { id: '2', name: 'Butter Croissant (Fresh Baked)', price: 120, quantity: 2, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400' },
          ],
          total: 890,
          status: 'preparing',
          payment_method: 'upi',
          payment_status: 'paid',
          delivery_notes: 'Please ring the doorbell twice.',
          created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        } as any);
      }
    } catch (err) {
      console.warn('Order fetch failure:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId);

      // Realtime listener for order status changes
      const channel = supabase
        .channel(`order_tracking_${orderId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        }, (payload) => {
          if (payload.new) {
            setOrder(payload.new as Order);
            toast.success(`Order status updated to ${payload.new.status}!`, { icon: '🛵' });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const currentStatusIndex = useMemo(() => {
    if (!order) return 0;
    const status = order.status || 'pending';
    if (status === 'delivered') return 3;
    if (status === 'out_for_delivery') return 2;
    if (status === 'preparing') return 1;
    return 0;
  }, [order?.status]);

  const handleCopyOrderId = () => {
    if (order?.id) {
      navigator.clipboard.writeText(order.id);
      setCopied(true);
      toast.success('Order ID copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTracking = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'Frosty Bite Order Tracking',
        text: `Track my fresh bakery order #${formatOrderId(order?.id || '')} live:`,
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Tracking link copied to clipboard!');
    }
  };

  const handleReorderItems = () => {
    if (order?.items && Array.isArray(order.items)) {
      order.items.forEach((item: any) => {
        addToCart({
          id: item.id || item.product_id || Math.random().toString(),
          name: item.name || 'Bakery Item',
          price: item.price || 100,
          image: item.image || '/logo.png',
          category: 'Bakery',
        } as any);
      });
      toast.success('Items added to cart! Opening checkout...', { icon: '🍰' });
      navigate('/categories');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lookupId.trim()) {
      navigate(`/order-tracking/${lookupId.trim()}`);
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitted(true);
    toast.success('Thank you for your rating & feedback! ⭐️', { icon: '🎉' });
  };

  // If no order ID provided, show an elegant Search & Lookup view
  if (!orderId && !order) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-stone-900 pt-8 pb-24 px-4 sm:px-6">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#E76A54]/10 text-[#E76A54] flex items-center justify-center mx-auto">
              <Compass size={32} className="animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-stone-900">
                Track Your Bakery Order
              </h1>
              <p className="text-xs text-stone-500 mt-1">
                Enter your order tracking ID to view live baking progress, courier GPS, and arrival time.
              </p>
            </div>

            <form onSubmit={handleLookupSubmit} className="space-y-3 pt-2">
              <input
                type="text"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder="e.g. FB-9241 or Order UUID"
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm text-stone-900 font-mono focus:outline-none focus:border-[#E76A54] focus:ring-2 focus:ring-[#E76A54]/20 text-center"
                required
              />
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#E76A54] hover:bg-[#D55943] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#E76A54]/20 transition-all cursor-pointer"
              >
                Track Live Order
              </button>
            </form>
          </div>

          {recentOrders.length > 0 && (
            <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Recent Orders
              </h2>
              <div className="divide-y divide-stone-100">
                {recentOrders.map((recId) => (
                  <button
                    key={recId}
                    onClick={() => navigate(`/order-tracking/${recId}`)}
                    className="w-full py-2.5 flex items-center justify-between text-left hover:text-[#E76A54] transition-colors cursor-pointer group"
                  >
                    <span className="font-mono text-xs font-bold text-stone-700 group-hover:text-[#E76A54]">
                      #{formatOrderId(recId)}
                    </span>
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      Track <ChevronRight size={12} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#E76A54]/10 text-[#E76A54] flex items-center justify-center animate-bounce">
          <ChefHat size={30} />
        </div>
        <div>
          <h2 className="text-base font-serif font-bold text-stone-900">Loading Order Progress...</h2>
          <p className="text-xs text-stone-500 mt-0.5">Connecting to kitchen telemetry and live courier tracker</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 pt-6 pb-28 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              title="Back to Orders"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                  Live Order Tracking
                </h1>
                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                  #{formatOrderId(order?.id || '')}
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    className="hover:text-[#E76A54] transition-colors ml-0.5 cursor-pointer"
                    title="Copy Order ID"
                  >
                    {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  </button>
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Placed on {order?.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleShareTracking}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Share2 size={13} />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Printer size={13} />
              <span>Receipt</span>
            </button>
          </div>
        </div>

        {/* Conditional Rendering: Cancelled UI vs Active Tracking UI */}
        {order?.status === 'cancelled' ? (
          <OrderCancelledView order={order} onReorder={handleReorderItems} />
        ) : (
          <>
            {/* Hero Live Status & ETA Card */}
            <div className="bg-gradient-to-br from-stone-900 via-[#1C1816] to-[#2B1E1A] rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-stone-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-72 h-72 bg-[#E76A54]/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/15 text-[#E5A970]">
                    <span className="w-2 h-2 rounded-full bg-[#E76A54] animate-ping" />
                    <span>
                      {order?.status === 'delivered' ? 'Order Delivered 🎉' :
                       order?.status === 'out_for_delivery' ? 'Courier On The Road 🛵' :
                       order?.status === 'preparing' ? 'Chef Baking in Oven 👩‍🍳' :
                       'Order Queued in Kitchen ✅'}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                    {order?.status === 'delivered' ? 'Your treats have arrived!' :
                     'Estimated Arrival: 20–25 Mins'}
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-300 max-w-lg leading-relaxed">
                    {order?.status === 'delivered'
                      ? 'We hope you love every bite! Freshly baked artisanal pastry crafted with love.'
                      : 'Your fresh artisan treats are being prepared in our kitchen oven with authentic ingredients.'}
                  </p>
                </div>

                {/* Live Animated Status Character / Lottie Animation */}
                <div className="flex items-center shrink-0 justify-center sm:justify-end">
                  <div className="w-28 h-28 sm:w-36 sm:h-36 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-[#E76A54]/20 rounded-full blur-xl animate-pulse" />
                    <FrostyAnimation 
                      type={
                        order?.status === 'delivered' ? 'delivered' :
                        order?.status === 'out_for_delivery' ? 'delivery_scooter' :
                        order?.status === 'preparing' ? 'chef_cooking' :
                        order?.status === 'confirmed' ? 'order_confirmed' : 'processing'
                      }
                      animation={STATUS_ANIMATIONS[order?.status || 'pending']}
                      className="w-full h-full object-contain relative z-10 drop-shadow-lg"
                      loop={true}
                      autoplay={true}
                      fallback={
                        <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-[#E76A54]">
                          <ChefHat size={36} className="animate-bounce" />
                        </div>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Stepper Progress Bar */}
              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {STATUS_STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isPassed = idx <= currentStatusIndex;
                    const isCurrent = idx === currentStatusIndex;

                    return (
                      <div 
                        key={step.id}
                        className={cn(
                          "p-3.5 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden",
                          isCurrent ? "bg-[#E76A54]/20 border-[#E76A54] text-white shadow-md shadow-[#E76A54]/20 ring-1 ring-[#E76A54]/40" :
                          isPassed ? "bg-white/10 border-white/20 text-white" :
                          "bg-black/20 border-white/5 text-stone-500"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center relative",
                            isCurrent ? "bg-[#E76A54] text-white animate-pulse" :
                            isPassed ? "bg-emerald-500/20 text-emerald-400" :
                            "bg-white/5 text-stone-600"
                          )}>
                            <Icon size={16} />
                          </div>
                          <span className="text-[10px] font-mono font-bold opacity-60">
                            {step.time}
                          </span>
                        </div>

                        <div>
                          <h4 className={cn("text-xs font-bold", isPassed ? "text-white" : "text-stone-500")}>
                            {step.label}
                          </h4>
                          <p className="text-[10px] text-stone-400 mt-0.5 line-clamp-2 leading-tight">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Delivery Address Details */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <MapPin size={14} className="text-[#E76A54]" />
                  Delivery Destination
                </span>
                <span className="text-xs text-stone-500 font-medium">
                  {order?.customer_name || 'Customer'}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs sm:text-sm font-semibold text-stone-800 leading-relaxed">
                  {order?.address || order?.delivery_address || 'Delivery address saved with kitchen'}
                </p>
                {order?.notes && (
                  <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/50 text-[11px] text-amber-800">
                    <span className="font-bold">Note:</span> {order.notes}
                  </div>
                )}
              </div>

              <div className="pt-2 text-xs text-stone-500 flex items-center justify-between border-t border-stone-100">
                <span>Contact: {order?.phone || 'Verified via OTP'}</span>
                <span className="font-mono text-[10px] text-emerald-600 font-bold uppercase bg-emerald-50 px-2 py-0.5 rounded-md">
                  Prepaid Verified
                </span>
              </div>
            </div>

            {/* Itemized Order Details & Bill Breakdown */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 flex items-center gap-2">
                    <Receipt size={18} className="text-[#E76A54]" />
                    Order Summary & Items
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Crafted fresh at Frosty Bite Artisan Kitchen
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReorderItems}
                  className="px-3.5 py-1.5 rounded-xl bg-[#E76A54]/10 hover:bg-[#E76A54]/20 text-[#E76A54] text-xs font-bold transition-colors cursor-pointer"
                >
                  Order Again 🔁
                </button>
              </div>

              {/* Items List */}
              <div className="divide-y divide-stone-100">
                {order?.items && Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                  <div key={idx} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Cake size={18} className="text-[#E76A54]" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                          {item.name}
                        </h4>
                        <span className="text-[11px] text-stone-500 font-medium">
                          Qty: {item.quantity || 1} × ₹{item.price}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs sm:text-sm font-bold text-stone-900 font-mono">
                      ₹{(item.price || 0) * (item.quantity || 1)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown */}
              <div className="bg-stone-50 rounded-2xl p-4 sm:p-5 space-y-2.5 text-xs text-stone-600 border border-stone-200/80">
                <div className="flex justify-between">
                  <span>Items Subtotal</span>
                  <span className="font-mono font-semibold text-stone-900">₹{order?.total || 0}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Delivery Fee (Frosty Special)</span>
                  <span className="font-mono font-bold uppercase text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded">
                    FREE DELIVERY
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes & Kitchen Packaging</span>
                  <span className="font-mono font-semibold text-stone-900">Included</span>
                </div>
                <div className="pt-2.5 border-t border-stone-200 flex justify-between items-center text-sm sm:text-base font-bold text-stone-900">
                  <span>Grand Total Paid</span>
                  <span className="font-mono text-base sm:text-lg text-[#E76A54]">
                    ₹{order?.total || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Review & Feedback Card (if delivered and not yet reviewed) */}
            {order?.status === 'delivered' && !reviewSubmitted && (
              <div className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs space-y-4">
                <div className="text-center max-w-sm mx-auto space-y-1">
                  <h3 className="text-base font-serif font-bold text-stone-900">
                    How were your treats today? 🍰
                  </h3>
                  <p className="text-xs text-stone-500">
                    Your feedback helps our pastry chefs craft the best desserts in town!
                  </p>
                </div>

                <form onSubmit={handleReviewSubmit} className="max-w-md mx-auto space-y-3">
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1 cursor-pointer hover:scale-125 transition-transform"
                      >
                        <Star
                          size={24}
                          className={cn(
                            star <= rating ? "fill-amber-400 text-amber-400" : "text-stone-300"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Tell us what you loved about the flavor, texture, and delivery..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-[#E76A54]"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Submit Review
                  </button>
                </form>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default OrderTracking;
