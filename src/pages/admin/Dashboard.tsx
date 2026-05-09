import React, { useState, useEffect } from 'react';
import { DashboardCards } from '../../components/admin/DashboardCards';
import { OrdersChart, PopularItemsChart, RevenueChart } from '../../components/admin/Charts';
import { OrdersTable } from '../../components/admin/OrdersTable';
import { motion } from 'motion/react';
import { appConfigService, AppConfig } from '../../services/appConfigService';
import { Power, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { db } from '../../firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { safeFirestore } from '../../services/firestoreService';
import { supabase } from '../../supabase';
import { Order } from '../../types';

export const Dashboard: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial data from cache
    const configCacheKey = 'admin_config_cache';
    const ordersCacheKey = 'admin_orders_cache';
    
    const cachedConfig = localStorage.getItem(configCacheKey);
    const cachedOrders = localStorage.getItem(ordersCacheKey);
    
    if (cachedConfig) {
      try { 
        const parsed = JSON.parse(cachedConfig);
        setConfig(parsed.data || parsed); 
      } catch (e) {}
    }
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

    const unsubscribeConfig = appConfigService.subscribeToConfig((data) => {
      setConfig(data);
      localStorage.setItem(configCacheKey, JSON.stringify(data));
    });

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
      unsubscribeConfig();
      supabase.removeChannel(channel);
    };
  }, []);

  const handleToggleOrdering = async () => {
    if (!config) return;
    setIsToggling(true);
    const newStatus = !config.isOrderingOpen;
    try {
      await appConfigService.toggleOrderingStatus(config.isOrderingOpen);
      toast.success(`Store is now ${newStatus ? 'OPEN' : 'CLOSED'}`);
    } catch (error) {
      console.error('Error toggling ordering status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsToggling(false);
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
