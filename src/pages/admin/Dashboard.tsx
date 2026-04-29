import React, { useState, useEffect } from 'react';
import { DashboardCards } from '../../components/admin/DashboardCards';
import { OrdersChart, PopularItemsChart } from '../../components/admin/Charts';
import { OrdersTable } from '../../components/admin/OrdersTable';
import { motion } from 'framer-motion';
import { appConfigService, AppConfig } from '../../services/appConfigService';
import { Power, CheckCircle2, XCircle } from 'lucide-react';

import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Order } from '../../types';

export const Dashboard: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    const unsubscribeConfig = appConfigService.subscribeToConfig((data) => {
      setConfig(data);
    });

    const q = query(collection(db, 'orders'));
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      // Client-side sort, filter and limit
      const sortedOrders = ordersData
        .filter(o => {
          // Hide UPI/Online orders that haven't submitted a UTR yet
          if ((o.paymentMethod === 'upi' || o.paymentMethod === 'online') && !o.utr && o.paymentStatus !== 'paid') {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        })
        .slice(0, 10);

      setRecentOrders(sortedOrders);
      setLoadingOrders(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orders');
    });

    return () => {
      unsubscribeConfig();
      unsubscribeOrders();
    };
  }, []);

  const handleToggleOrdering = async () => {
    if (!config) return;
    setIsToggling(true);
    try {
      await appConfigService.toggleOrderingStatus(config.isOrderingOpen);
    } catch (error) {
      console.error('Error toggling ordering status:', error);
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
      order.customerName,
      order.items?.map((i: any) => {
        if (typeof i === 'string') return i;
        return `${i.name || 'Unknown'} (x${i.quantity || 1})`;
      }).join('; ') || 'No items',
      order.total || 0,
      order.status,
      order.createdAt 
        ? (typeof (order.createdAt as any).toDate === 'function' 
            ? (order.createdAt as any).toDate().toLocaleString() 
            : new Date((order.createdAt as any).seconds * 1000).toLocaleString())
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
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
