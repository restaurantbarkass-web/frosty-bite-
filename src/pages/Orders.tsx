import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { Order, CartItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ChevronRight, Clock, MapPin, RotateCcw, Plus, AlertCircle, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { FrostyAnimation } from '../components/LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';
import { useCart } from '../context/CartContext';
import { CancelOrderModal } from '../components/CancelOrderModal';
import toast from 'react-hot-toast';

const Orders: React.FC = () => {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Order cancellation state
  const [selectedCancelOrder, setSelectedCancelOrder] = useState<Order | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [tick, setTick] = useState(0);

  // Interval updating every second for live countdown precision
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeLeft = (ms: number) => {
    if (ms <= 0) return "00h 00m 00s";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const hrsStr = hours.toString().padStart(2, '0');
    const minsStr = minutes.toString().padStart(2, '0');
    const secsStr = seconds.toString().padStart(2, '0');

    return `${hrsStr}h ${minsStr}m ${secsStr}s`;
  };

  const handleCancelSuccess = (updatedOrder: Order) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
  };


  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!user) return;

    const cacheKey = `orders_cache_${user.uid}`;
    
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false });

        if (error) {
          if (error.code === '22P02') {
            console.warn('Supabase is expecting a UUID but received a Firebase UID. Please update your database schema.');
            setLoading(false);
            return;
          }
          throw error;
        }
        
        if (data) {
          setOrders(data as Order[]);
          localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        }
      } catch (error) {
        console.error('Error fetching orders from Supabase:', error);
        
        // Fallback to cache
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setOrders(parsed.data || parsed);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // Fast polling fallback to guarantee status updates show within seconds without manual refresh
    const pollInterval = setInterval(() => {
      fetchOrders();
    }, 2500);

    // Set up real-time subscription for order status updates
    const channel = supabase
      .channel(`user_orders_${user.uid}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `user_id=eq.${user.uid}`
      }, (payload) => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleReorderItem = (e: React.MouseEvent, item: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Construct FoodItem from Order item
    const foodItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image,
      description: item.description || '',
      category: item.category || 'General',
      rating: item.rating || 5,
      stock_quantity: item.stock_quantity || 100,
      available: true
    };

    addToCart(foodItem);
    toast.success(`${item.name} added to cart!`, {
      icon: '🧁',
      style: {
        borderRadius: '16px',
        background: '#18181b',
        color: '#fff',
      }
    });
  };

  const handleReorderAll = (e: React.MouseEvent, order: Order) => {
    e.preventDefault();
    e.stopPropagation();

    if (!order.items || order.items.length === 0) return;

    order.items.forEach(item => {
      const foodItem = {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        description: item.description || '',
        category: item.category || 'General',
        rating: item.rating || 5,
        stock_quantity: item.stock_quantity || 100,
        available: true
      };
      
      // Add multiple if quantity was > 1
      for (let i = 0; i < (item.quantity || 1); i++) {
        addToCart(foodItem);
      }
    });

    toast.success('All items added to cart!', {
      icon: '🛍️',
      style: {
        borderRadius: '16px',
        background: '#18181b',
        color: '#fff',
      }
    });
    
    navigate('/');
  };

  const getStatusColor = (status: string, hasUtr?: boolean) => {
    if (status === 'pending' && hasUtr) return 'text-amber-500 bg-amber-500/10';
    switch (status) {
      case 'pending': return 'text-amber-500 bg-amber-500/10';
      case 'confirmed': return 'text-blue-500 bg-blue-500/10';
      case 'preparing': return 'text-purple-500 bg-purple-500/10';
      case 'out_for_delivery': return 'text-orange-500 bg-orange-500/10';
      case 'delivered': return 'text-emerald-500 bg-emerald-500/10';
      case 'cancelled': return 'text-red-500 bg-red-500/10';
      default: return 'text-zinc-500 bg-zinc-500/10';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Fetching Your History...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-8"
    >
      <div className="space-y-2">
        <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase">Order History</h1>
        <p className="text-zinc-500 font-medium">Revisit your favorite bakes and tracking details.</p>
      </div>

      {orders.length === 0 ? (
        <div className="glass-dark rounded-[40px] border border-white/5 p-16 text-center space-y-6">
          <div className="w-56 h-56 mx-auto">
            <FrostyAnimation 
              url={LOTTIE_ANIMATIONS.CAKE}
              className="w-full h-full"
              fallback={
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-full h-full flex items-center justify-center p-8"
                >
                  <ShoppingBag className="text-primary/20 w-48 h-48" strokeWidth={1} />
                </motion.div>
              }
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white italic tracking-tight">NO ORDERS YET</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto">It seems your history is as empty as a tray after a sale!</p>
          </div>
          <Link 
            to="/" 
            className="inline-block px-10 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all"
          >
            Explore Menu
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="glass-dark rounded-[2.5rem] border border-white/5 overflow-hidden group">
                  <div className="p-6 md:p-8 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                          <ShoppingBag size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="text-lg font-black text-white tracking-tight uppercase leading-none">Order #{order.id?.toString().slice(-6).toUpperCase() || 'UNKNOWN'}</h4>
                            <span className={cn(
                              "px-2 px-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest h-5 flex items-center",
                              getStatusColor(order.status || 'pending', !!order.utr)
                            )}>
                              {(order.status === 'pending' && order.utr) 
                                ? 'Verifying Payment' 
                                : (order.status || 'pending').replace(/-/g, ' ')}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Planted on {formatDate(order.created_at)}</p>
                          {order.status === 'cancelled' && order.notes && (
                            <p className="text-[10px] text-red-500 font-bold bg-red-500/5 px-2 py-1 rounded-lg border border-red-500/10 mt-2 italic">
                              Reason: {order.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Total Amount</p>
                          <p className="text-xl font-black text-white italic tracking-tighter">₹{order.total || 0}</p>
                          {(order.delivery_charge || order.discount) && (
                            <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-1">
                              {order.delivery_charge ? `Incl. ₹${order.delivery_charge} Del.` : ''}
                              {order.discount ? `${order.delivery_charge ? ' • ' : ''}-₹${order.discount} Disc.` : ''}
                            </p>
                          )}
                        </div>
                        <Link 
                          to={`/order-tracking/${order.id}`}
                          className="p-3 bg-white/5 rounded-xl text-zinc-400 hover:text-primary transition-colors"
                        >
                          <ChevronRight size={20} />
                        </Link>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Items Ordered</p>
                        <div className="space-y-2">
                          {(order.items || []).map((item, i) => (
                            <div key={i} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5 group/item">
                              <div className="flex items-center gap-3">
                                {item.image && (
                                  <img src={item.image} alt={item.name || 'Item'} className="w-10 h-10 rounded-xl object-cover" />
                                )}
                                <div>
                                  <p className="text-xs font-black text-white italic leading-tight uppercase">{item.name || 'Item'}</p>
                                  <p className="text-[9px] text-zinc-500 font-bold tracking-widest mt-0.5 uppercase">Qty: {item.quantity || 1} · ₹{item.price || 0}</p>
                                </div>
                              </div>
                              <button 
                                onClick={(e) => handleReorderItem(e, item)}
                                className="p-2 bg-white/5 rounded-xl text-zinc-400 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover/item:opacity-100"
                                title="Add to Cart"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-white/5 p-5 rounded-3xl border border-white/5 space-y-3">
                          <div className="flex items-start gap-3">
                            <MapPin size={14} className="text-primary mt-0.5" />
                            <div>
                              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Delivery Address</p>
                              <p className="text-xs text-white font-medium line-clamp-2 leading-relaxed">{order.address}</p>
                            </div>
                          </div>
                        </div>

                        {/* Order Cancellation Panel with live timer */}
                        <div className="p-4 bg-white/[0.02] rounded-3xl border border-white/5 space-y-3">
                          {(() => {
                            const isCancelableStatus = order.status === 'pending' || order.status === 'confirmed';
                            const createdTime = order.created_at ? new Date(order.created_at).getTime() : 0;
                            const limitTime = createdTime + 24 * 60 * 60 * 1000;
                            const timeLeftSecs = limitTime - Date.now();
                            const isExpired = timeLeftSecs <= 0;

                            if (isCancelableStatus) {
                              if (!isExpired) {
                                return (
                                  <div className="flex flex-col gap-2.5">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                      <Clock className="text-amber-500 animate-pulse" size={14} />
                                      <div className="flex-1">
                                        <p className="text-[8px] text-zinc-500 font-black uppercase tracking-widest leading-none">Cancellation Period</p>
                                        <p className="text-[11px] font-mono font-black text-amber-500 mt-1">
                                          {formatTimeLeft(timeLeftSecs)} remaining
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCancelOrder(order);
                                        setIsCancelModalOpen(true);
                                      }}
                                      className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500 text-rose-500 rounded-xl text-[9px] font-black uppercase tracking-widest text-center transition-all shadow-lg active:scale-95"
                                    >
                                      Cancel Order
                                    </button>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex items-start gap-2.5 text-zinc-500 text-[9px] font-black uppercase tracking-widest leading-normal">
                                    <AlertCircle size={14} className="text-zinc-600 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-zinc-400">Cancellation period expired</p>
                                      <p className="text-[8px] text-zinc-650 font-medium normal-case mt-0.5">Orders can only be cancelled within 24 hours of placement.</p>
                                    </div>
                                  </div>
                                );
                              }
                            } else if (order.status === 'cancelled') {
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-rose-500 text-[9px] font-black uppercase tracking-widest">
                                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                    Order Cancelled
                                  </div>
                                  {order.refund_status && order.refund_status !== 'none' && (
                                    <div className="flex items-center gap-2">
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                                        order.refund_status === 'refunded'
                                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                          : order.refund_status === 'failed'
                                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                            : 'bg-amber-500/15 border-amber-500/20 text-amber-400'
                                      )}>
                                        Refund {order.refund_status.replace('_', ' ')}
                                      </span>
                                      <span className="text-[8px] text-zinc-500 font-bold">Amt: ₹{order.total || order.total_amount || 0}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-start gap-2.5 text-zinc-500 text-[9px] font-black uppercase tracking-widest leading-normal">
                                  <AlertCircle size={14} className="text-zinc-600 shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-zinc-400">Order can no longer be cancelled</p>
                                    <p className="text-[8px] text-zinc-650 font-medium normal-case mt-0.5">Baking in progress (Preparing / Dispatched / Delivered).</p>
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={(e) => handleReorderAll(e, order)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                          >
                            <RotateCcw size={12} />
                            Repeat Order
                          </button>
                          <Link
                            to={`/order-tracking/${order.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/5 hover:bg-white/10 transition-all"
                          >
                            Track Status
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {selectedCancelOrder && (
        <CancelOrderModal
          order={selectedCancelOrder}
          isOpen={isCancelModalOpen}
          onClose={() => {
            setIsCancelModalOpen(false);
            setSelectedCancelOrder(null);
          }}
          onCancelSuccess={handleCancelSuccess}
          userId={user?.uid || ''}
        />
      )}
    </motion.div>
  );
};

export default Orders;
