import React, { useState, useEffect } from 'react';
import { DashboardCards } from '../../components/admin/DashboardCards';
import { OrdersChart, PopularItemsChart, RevenueChart } from '../../components/admin/Charts';
import { OrdersTable } from '../../components/admin/OrdersTable';
import { motion } from 'motion/react';
import { useConfig } from '../../context/ConfigContext';
import { Power, CheckCircle2, XCircle, ShoppingBag, Store, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

import { supabase } from '../../supabase';
import { Order } from '../../types';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { config, toggleOrderingStatus, updatePickupOnlyStatus } = useConfig();
  const [isToggling, setIsToggling] = useState(false);
  const [isTogglingPickup, setIsTogglingPickup] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const isPickupOnly = Boolean(config?.pickup_only ?? config?.isPickupOnly ?? false);

  useEffect(() => {
    // Load initial data from cache
    const ordersCacheKey = 'admin_orders_cache';
    
    const cachedOrders = localStorage.getItem(ordersCacheKey);
    
    if (cachedOrders) {
      try { 
        const parsed = JSON.parse(cachedOrders);
        const data = parsed.data || parsed;
        if (Array.isArray(data)) {
          setRecentOrders(data); 
          setLoadingOrders(false);
        }
      } catch (e) {}
    }

    const fetchRecentOrders = async () => {
      try {
        setSupabaseError(null);
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        if (data) {
          setRecentOrders(data as Order[]);
          setLoadingOrders(false);
          localStorage.setItem(ordersCacheKey, JSON.stringify(data));
        }
      } catch (err: any) {
        console.error('Error fetching dashboard orders:', err);
        if (err.code === 'PGRST205' || (err.message && err.message.includes('schema cache'))) {
          setSupabaseError('Database schema not found. Please go to your Supabase Dashboard -> SQL Editor and click "RUN" on your SQL script to create the tables.');
        } else {
          setSupabaseError(err.message || 'Failed to fetch orders from database.');
        }
        setLoadingOrders(false);
      }
    };

    fetchRecentOrders();

    // Subscribe to new orders
    const channel = supabase
      .channel('dashboard_recent_orders')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders' 
      }, () => {
        fetchRecentOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleToggleOrdering = async () => {
    if (!config) return;
    setIsToggling(true);
    const newStatus = !config.isOrderingOpen;
    try {
      const token = (user && typeof user.getIdToken === 'function' ? await user.getIdToken() : null) || localStorage.getItem('latest_admin_auth_token');
      await toggleOrderingStatus(token);
      toast.success(`Store is now ${newStatus ? 'OPEN' : 'CLOSED'}`);
    } catch (error) {
      console.error('Error toggling ordering status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsToggling(false);
    }
  };

  const handleTogglePickupOnly = async () => {
    if (!config) return;
    setIsTogglingPickup(true);
    const newStatus = !isPickupOnly;
    try {
      const token = (user && typeof user.getIdToken === 'function' ? await user.getIdToken() : null) || localStorage.getItem('latest_admin_auth_token');
      await updatePickupOnlyStatus(newStatus, token);
      toast.success(`Pickup Only is now ${newStatus ? 'ENABLED (Bakery Pickup Only)' : 'DISABLED (Home Delivery Active)'}`);
    } catch (error) {
      console.error('Error toggling pickup only status:', error);
      toast.error('Failed to update pickup status');
    } finally {
      setIsTogglingPickup(false);
    }
  };

  const exportRecentOrders = () => {
    if (recentOrders.length === 0) return;
    
    const headers = ['Order ID', 'Customer', 'Items', 'Total', 'Status', 'Date'];
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = recentOrders.map(order => [
      order.id,
      order.customer_name || order.customerName || 'Guest Customer',
      order.items?.map((i: any) => {
        if (typeof i === 'string') return i;
        return `${i.name || 'Unknown'} (x${i.quantity || 1})`;
      }).join('; ') || 'No items',
      order.total || 0,
      order.status,
      order.created_at 
        ? new Date(order.created_at).toLocaleString()
        : 'N/A'
    ].map(escapeCSV));

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `recent_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Dashboard Overview</h1>
          <p className="text-gray-500 font-medium">Welcome back, Admin! Here's what's happening today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {config && (
            <button 
              onClick={handleToggleOrdering}
              disabled={isToggling}
              className={`flex items-center gap-3 px-4 sm:px-6 py-3 rounded-2xl font-bold transition-all relative overflow-hidden group flex-1 sm:flex-none ${
                config.isOrderingOpen 
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' 
                  : 'bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20'
              }`}
            >
              {/* Glow Effect */}
              <div className={`absolute inset-0 opacity-20 blur-xl transition-all group-hover:opacity-40 ${
                config.isOrderingOpen ? 'bg-emerald-500' : 'bg-red-500'
              }`} />
              
              {isToggling ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                config.isOrderingOpen ? <CheckCircle2 size={20} /> : <XCircle size={20} />
              )}
              
              <span className="relative z-10 text-sm sm:text-base">
                {config.isOrderingOpen ? 'Open' : 'Closed'}
              </span>
            </button>
          )}
          <button 
            onClick={exportRecentOrders}
            className="p-3 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 transition-all flex-1 sm:flex-none flex items-center justify-center gap-2"
            title="Download Report"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span className="sm:hidden text-xs">Report</span>
          </button>
          <button className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-accent transition-all flex-1 sm:flex-none text-sm">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse hidden sm:block" />
            Live
          </button>
        </div>
      </div>

      {/* Order Settings Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
              <Store size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Order Settings</h2>
              <p className="text-xs text-gray-400 font-medium">Manage ordering status and fulfillment modes in real time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              config?.isOrderingOpen 
                ? (isPickupOnly ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30') 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {!config?.isOrderingOpen ? 'Store Closed' : (isPickupOnly ? 'Pickup Only Active' : 'Store Open (Delivery & Pickup)')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Order Open / Close Toggle */}
          <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Power size={18} className={config?.isOrderingOpen ? 'text-emerald-400' : 'text-red-400'} />
                <span className="font-bold text-white text-base">Order Status</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {config?.isOrderingOpen ? 'Store is accepting orders.' : 'Store is closed. Online orders are disabled.'}
              </p>
            </div>
            {config && (
              <button 
                type="button"
                onClick={handleToggleOrdering}
                disabled={isToggling}
                className={`relative w-14 h-8 rounded-full p-1 transition-all duration-300 outline-none shrink-0 ${
                  config.isOrderingOpen ? 'bg-emerald-500' : 'bg-white/10'
                }`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform flex items-center justify-center ${
                  config.isOrderingOpen ? 'translate-x-6' : 'translate-x-0'
                }`}>
                  {isToggling ? (
                    <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  ) : null}
                </div>
              </button>
            )}
          </div>

          {/* Pickup Only Toggle */}
          <div className="p-5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className={isPickupOnly ? 'text-amber-400' : 'text-gray-400'} />
                <span className="font-bold text-white text-base">Pickup Only</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                When enabled, customers can place orders online but must collect them from the bakery. Home delivery will be disabled.
              </p>
            </div>
            <button 
              type="button"
              onClick={handleTogglePickupOnly}
              disabled={isTogglingPickup}
              className={`relative w-14 h-8 rounded-full p-1 transition-all duration-300 outline-none shrink-0 ${
                isPickupOnly ? 'bg-amber-500' : 'bg-white/10'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform flex items-center justify-center ${
                isPickupOnly ? 'translate-x-6' : 'translate-x-0'
              }`}>
                {isTogglingPickup ? (
                  <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                ) : null}
              </div>
            </button>
          </div>
        </div>
      </motion.div>

      <DashboardCards />

      {supabaseError && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-3xl mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/20 rounded-2xl text-red-500">
              <XCircle size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Configuration Error</h3>
              <p className="text-gray-400 font-medium leading-relaxed">{supabaseError}</p>
              <div className="mt-4 flex gap-3">
                <a 
                  href="https://supabase.com/dashboard/project/_/editor" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-colors"
                >
                  Go to Supabase Dashboard
                </a>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-white/5 text-white rounded-xl font-bold text-sm hover:bg-white/10 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        <RevenueChart />
        <OrdersChart />
        <PopularItemsChart />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white tracking-tight">Real-time Orders</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-xs text-primary font-black uppercase tracking-widest">Live Updates</span>
          </div>
        </div>
        <OrdersTable orders={recentOrders} loading={loadingOrders} />
      </div>
    </div>
  );
};
