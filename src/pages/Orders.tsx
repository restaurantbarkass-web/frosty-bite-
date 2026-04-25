import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ChevronRight, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { FrostyAnimation } from '../components/LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../constants/animations';

export const Orders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      // Sort client-side to avoid index requirement
      const sortedOrders = ordersData.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setOrders(sortedOrders);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const getStatusColor = (status: string) => {
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
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
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
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-8">
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
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link 
                  to={`/order-tracking/${order.id}`}
                  className="block glass-dark rounded-[2rem] border border-white/5 p-6 hover:border-primary/30 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-all" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors shrink-0">
                        <ShoppingBag size={28} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-xl font-black text-white tracking-tight leading-none uppercase">Order #{order.id?.slice(0, 6) || 'N/A'}</h4>
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            getStatusColor(order.status || 'pending')
                          )}>
                            {(order.status || 'pending').replace(/-/g, ' ')}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 font-bold uppercase tracking-widest mt-2">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-primary" />
                            {formatDate(order.createdAt)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <ShoppingBag size={12} className="text-primary" />
                            {(order.items || []).length} Items
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1.5 text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
                          <MapPin size={12} className="text-primary" />
                          <span className="truncate max-w-[200px]">{order.address || 'No address'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Total Paid</p>
                        <p className="text-2xl font-black text-white">₹{order.total || 0}</p>
                      </div>
                      <ChevronRight className="w-6 h-6 text-zinc-700 group-hover:text-primary transition-all group-hover:translate-x-2 hidden sm:block mt-2" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
