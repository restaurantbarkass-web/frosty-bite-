import React, { useState, useEffect } from 'react';
import { OrdersTable } from '../../components/admin/OrdersTable';
import { Filter, Search, Download, Calendar, Clock, X } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { supabase } from '../../supabase';

import { Order } from '../../types';

export const Orders: React.FC = () => {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'active' | 'verification'>('active');
  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    preparing: 0,
    out_for_delivery: 0,
    delivered: 0
  });

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        
        if (data) {
          setAllOrders(data as Order[]);
          calculateStats(data as Order[]);
        }
      } catch (error) {
        console.error('Error fetching admin orders from Supabase:', error);
      } finally {
        setLoading(false);
      }
    };

    const calculateStats = (ordersData: Order[]) => {
      const nowTs = new Date().getTime();
      const twentyFourHoursAgo = nowTs - (24 * 60 * 60 * 1000);
      const last24hOrders = ordersData.filter(o => {
        const ca = o.created_at;
        const d = ca ? new Date(ca) : null;
        return d && d.getTime() >= twentyFourHoursAgo;
      });

      setStats({
        pending: last24hOrders.filter(o => o.status === 'pending').length,
        confirmed: last24hOrders.filter(o => o.status === 'confirmed').length,
        preparing: last24hOrders.filter(o => o.status === 'preparing').length,
        out_for_delivery: last24hOrders.filter(o => o.status === 'out_for_delivery').length,
        delivered: last24hOrders.filter(o => o.status === 'delivered').length,
      });
    };

    fetchOrders();

    // Set up real-time subscription for admin orders
    const channel = supabase
      .channel('admin_orders_all')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAllOrders(prev => [payload.new as Order, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setAllOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
        } else if (payload.eventType === 'DELETE') {
          setAllOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredOrders = allOrders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customer_name || order.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.phone && order.phone.includes(searchQuery));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    let matchesDate = true;
    if (startDate || endDate) {
      const orderDate = order.created_at ? new Date(order.created_at) : null;
      if (orderDate) {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) matchesDate = false;
        }
      } else {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesDate && matchesStatus;
  });

  const exportToCSV = () => {
    const headers = ['Order ID', 'Customer', 'Phone', 'Address', 'Items', 'Total', 'Status', 'Date'];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredOrders.map(order => {
      return [
        order.id,
        order.customer_name || order.customerName || 'Guest Customer',
        order.phone || 'N/A',
        order.address || 'N/A',
        order.items.map((i: any) => typeof i === 'string' ? i : i.name).join('; '),
        order.total,
        order.status,
        order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'
      ].map(escapeCSV);
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
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
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Order Management</h1>
          <p className="text-gray-500 font-medium">Track and manage all customer orders in real-time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full md:w-auto">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-[#111] border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-orange-500/50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="out_for_delivery">Dispatch</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-500 text-[10px] sm:text-xs font-bold whitespace-nowrap">
            <Clock size={14} />
            <span className="hidden xs:inline">Last 24 Hours</span>
            <span className="xs:hidden">24h</span>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 sm:px-4 py-1 flex-1 sm:flex-none">
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-bold uppercase">From</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white text-[10px] sm:text-xs font-bold focus:outline-none w-20 sm:w-auto"
              />
            </div>
            <div className="w-px h-8 bg-white/10 mx-1 sm:mx-2" />
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-bold uppercase">To</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-white text-[10px] sm:text-xs font-bold focus:outline-none w-20 sm:w-auto"
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="ml-1 sm:ml-2 text-gray-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 flex-1 sm:flex-none px-6 sm:px-8 py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all text-sm"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {[
          { label: 'Pending', count: stats.pending, color: 'amber' },
          { label: 'Confirmed', count: stats.confirmed, color: 'emerald' },
          { label: 'Preparing', count: stats.preparing, color: 'blue' },
          { label: 'Dispatch', count: stats.out_for_delivery, color: 'purple' },
          { label: 'Delivered', count: stats.delivered, color: 'emerald' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex items-center justify-between group hover:border-white/10 transition-all">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <h4 className="text-3xl font-black text-white">{stat.count}</h4>
            </div>
            <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-500 border border-${stat.color}-500/20 shadow-lg shadow-${stat.color}-500/5`}>
              <span className="text-xl font-black">#</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex bg-[#111] p-1 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveTab('active')}
            className={cn(
              "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'active' 
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                : "text-gray-500 hover:text-white"
            )}
          >
            Active Orders
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={cn(
              "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === 'verification' 
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" 
                : "text-gray-500 hover:text-white"
            )}
          >
            Payment Verification
            {allOrders.filter(o => o.payment_status === 'pending_verification').length > 0 && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by Order ID, Customer Name, Phone..." 
            className="w-full bg-[#111]/80 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500/50 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <OrdersTable 
        orders={filteredOrders.filter(o => {
          if (activeTab === 'verification') {
            return o.payment_status === 'pending_verification' || (o.utr && o.payment_status !== 'paid');
          }
          // In Active tab, show everything except those currently in "verification" status
          if (o.payment_status === 'pending_verification') return false;
          return true;
        })} 
        loading={loading} 
      />
    </div>
  );
};
