import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Settings, 
  LogOut, 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Phone, 
  Power, 
  Truck, 
  Package, 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  User, 
  Clock, 
  ChevronRight, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationDropdown } from '../../components/NotificationDropdown';
import { riderService } from '../../services/riderService';
import { StatusToggle } from '../../components/rider/StatusToggle';
import { EarningsCard } from '../../components/rider/EarningsCard';
import { OrderCard } from '../../components/rider/OrderCard';
import { MapView } from '../../components/rider/MapView';
import { logout } from '../../firebase';
import { useNavigate } from 'react-router-dom';

export const RiderDashboard: React.FC = () => {
  const { user, role } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  
  // State
  const [isOnline, setIsOnline] = useState(true);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riderStats, setRiderStats] = useState({ todayEarnings: 450, totalDeliveries: 128 });
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Mock data for demo if no real orders - Removed for production
  const DUMMY_AVAILABLE: any[] = [];

  useEffect(() => {
    if (!user || role !== 'rider') return;

    // Subscribe to assigned orders
    const unsubscribe = riderService.subscribeToAssignedOrders(user.uid, (orders) => {
      if (orders.length > 0) {
        setActiveOrder(orders[0]); // Take the first active order
      } else {
        setActiveOrder(null);
      }
    });

    // Fetch stats
    const fetchStats = async () => {
      const stats = await riderService.getRiderStats(user.uid);
      if (stats) {
        setRiderStats({
          todayEarnings: stats.todayEarnings || 0,
          totalDeliveries: stats.totalDeliveries || 0
        });
        setIsOnline(stats.status === 'online' || stats.status === 'busy');
      }
    };
    fetchStats();

    // Location sharing simulation
    let locationInterval: any;
    if (isSharingLocation) {
      locationInterval = setInterval(() => {
        // Simulate movement
        const lat = 17.3850 + (Math.random() - 0.5) * 0.01;
        const lng = 78.4867 + (Math.random() - 0.5) * 0.01;
        riderService.updateRiderLocation(user.uid, lat, lng);
      }, 5000);
    }

    return () => {
      unsubscribe();
      if (locationInterval) clearInterval(locationInterval);
    };
  }, [user, role, isSharingLocation]);

  const handleStatusToggle = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const newStatus = isOnline ? 'offline' : 'online';
      await riderService.updateRiderStatus(user.uid, newStatus);
      setIsOnline(!isOnline);
    } catch (err) {
      setError('Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    setIsLoading(true);
    try {
      await riderService.updateOrderStatus(orderId, status);
      // If delivered, update rider status back to online (not busy)
      if (status === 'delivered' && user) {
        await riderService.updateRiderStatus(user.uid, 'online');
      }
    } catch (err) {
      setError('Failed to update order status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-2xl border-b border-white/5 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg" 
              alt="Frosty Bite Logo" 
              className="h-12 w-auto object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Rider Access</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all relative ${isNotifOpen ? 'bg-primary/20 text-primary' : 'bg-white/5 text-zinc-500 hover:text-white'}`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-orange-500 rounded-full border-2 border-[#050505]" />
                )}
              </button>
              <NotificationDropdown isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
            </div>
            <button 
              onClick={handleLogout}
              className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        {/* Welcome & Status */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black tracking-tight mb-2">
              Welcome, <span className="text-primary">{user?.displayName?.split(' ')[0] || 'Rider'}</span>
            </h2>
            <p className="text-zinc-500 text-sm font-medium">You have <span className="text-white">2 assigned</span> orders today.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <StatusToggle 
              isOnline={isOnline} 
              onToggle={handleStatusToggle} 
              isLoading={isLoading} 
            />
            <button 
              onClick={() => setIsSharingLocation(!isSharingLocation)}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all
                ${isSharingLocation 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}
              `}
            >
              <Navigation size={14} className={isSharingLocation ? 'animate-pulse' : ''} />
              {isSharingLocation ? 'Live Tracking On' : 'Start Tracking'}
            </button>
          </div>
        </section>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm"
            >
              <AlertCircle size={18} />
              <p>{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-[10px] uppercase font-black tracking-widest">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Earnings Stats */}
        <EarningsCard 
          todayEarnings={riderStats.todayEarnings} 
          totalDeliveries={riderStats.totalDeliveries} 
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Active Order & Map */}
          <div className="lg:col-span-2 space-y-10">
            <AnimatePresence mode="wait">
              {activeOrder ? (
                <div className="space-y-10">
                  <OrderCard 
                    order={activeOrder} 
                    onStatusUpdate={handleUpdateOrderStatus}
                    isLoading={isLoading}
                  />
                  
                  <div className="h-[400px]">
                    <MapView 
                      riderLocation={{ lat: 17.3850, lng: 78.4867 }}
                      customerLocation={activeOrder.deliveryLocation || { lat: 17.3950, lng: 78.4967 }}
                    />
                  </div>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-dark p-16 rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                    <Truck size={48} className="opacity-20" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white mb-2">No Active Orders</h3>
                    <p className="text-zinc-500 max-w-xs mx-auto">
                      {isOnline 
                        ? "Waiting for new delivery requests. Stay online to receive orders." 
                        : "You are currently offline. Go online to start receiving orders."}
                    </p>
                  </div>
                  {isOnline && (
                    <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest animate-pulse">
                      <Loader2 size={14} className="animate-spin" />
                      Searching for orders...
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Available Orders Sidebar */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">Available Requests</h3>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-black">2 New</span>
            </div>

            <div className="space-y-4">
              {DUMMY_AVAILABLE.map((order) => (
                <motion.div
                  key={order.id}
                  whileHover={{ scale: 1.02 }}
                  className="glass-dark p-6 rounded-3xl border border-white/5 hover:border-primary/30 transition-all group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-white group-hover:text-primary transition-colors">#{order.id.slice(-4)}</h4>
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">{order.distance} away</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-white">₹{order.total}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Payout</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-zinc-400 text-xs mb-6">
                    <MapPin size={12} />
                    <span className="truncate">{order.address}</span>
                  </div>

                  <button className="w-full py-3 bg-white/5 hover:bg-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">
                    Accept Request
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Quick Stats */}
            <div className="glass-dark p-6 rounded-3xl border border-white/5 space-y-6">
              <h3 className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">Performance</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Acceptance Rate</span>
                  <span className="text-xs font-bold text-emerald-500">98%</span>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[98%]" />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400">Rating</span>
                  <span className="text-xs font-bold text-orange-500">4.9 ★</span>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 w-[92%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Navigation Rail (Bottom) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#050505]/80 backdrop-blur-2xl border-t border-white/5 px-6 py-4 md:hidden">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Truck size={20} />
            <span className="text-[8px] uppercase font-black tracking-widest">Orders</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-zinc-500">
            <DollarSign size={20} />
            <span className="text-[8px] uppercase font-black tracking-widest">Wallet</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-zinc-500">
            <User size={20} />
            <span className="text-[8px] uppercase font-black tracking-widest">Profile</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-zinc-500">
            <Settings size={20} />
            <span className="text-[8px] uppercase font-black tracking-widest">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
