import React, { useState, useEffect, useCallback } from 'react';
import { OrdersTable } from '../../components/admin/OrdersTable';
import { Filter, Search, Download, Calendar, Clock, X, AlertCircle, RefreshCw, Sparkles, CheckCircle2, Package, Truck, Layers, ShieldCheck, DollarSign } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { supabase } from '../../supabase';
import { useNotifications } from '../../context/NotificationContext';
import toast from 'react-hot-toast';
import { formatOrderId } from '../../utils/orderUtils';

import { Order } from '../../types';

export const Orders: React.FC = () => {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'active' | 'verification' | 'cancelled'>('active');
  const { addNotification } = useNotifications();

  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    preparing: 0,
    out_for_delivery: 0,
    delivered: 0
  });

  const calculateStats = useCallback((ordersData: Order[]) => {
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
  }, []);

  const handleOptimisticUpdate = useCallback((orderId: string, updates: Partial<Order>) => {
    setAllOrders((prev) => {
      const next = prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o));
      calculateStats(next);
      return next;
    });
  }, [calculateStats]);

  const handleOptimisticDelete = useCallback((orderId: string) => {
    setAllOrders((prev) => {
      const next = prev.filter((o) => o.id !== orderId);
      calculateStats(next);
      return next;
    });
  }, [calculateStats]);

  useEffect(() => {
    const fetchOrders = async (isBackground = false) => {
      try {
        if (!isBackground) setLoading(true);
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
        if (!isBackground) setLoading(false);
      }
    };

    fetchOrders();

    // Fine-grained Realtime Channel for Admin Orders
    const channel = supabase
      .channel('admin_orders_realtime_sync')
      .on('postgres_changes', { 
         event: 'INSERT', 
         schema: 'public', 
         table: 'orders' 
      }, (payload) => {
        const newOrder = payload.new as Order;
        if (newOrder && newOrder.id) {
          setAllOrders((prev) => {
            if (prev.some((o) => o.id === newOrder.id)) return prev;
            const updated = [newOrder, ...prev];
            calculateStats(updated);
            return updated;
          });
        }
      })
      .on('postgres_changes', { 
         event: 'UPDATE', 
         schema: 'public', 
         table: 'orders' 
      }, (payload) => {
        const updatedOrder = payload.new as Order;
        if (updatedOrder && updatedOrder.id) {
          setAllOrders((prev) => {
            const updated = prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
            calculateStats(updated);
            return updated;
          });
        }
      })
      .on('postgres_changes', { 
         event: 'DELETE', 
         schema: 'public', 
         table: 'orders' 
      }, (payload) => {
        const deletedId = (payload.old as any)?.id;
        if (deletedId) {
          setAllOrders((prev) => {
            const updated = prev.filter((o) => o.id !== deletedId);
            calculateStats(updated);
            return updated;
          });
        }
      })
      .subscribe();

    const interval = setInterval(() => {
      fetchOrders(true);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [calculateStats]);

  const updateRefundStatus = async (orderId: string, status: 'none' | 'pending_refund' | 'refunded' | 'failed') => {
    const loadingToast = toast.loading('Processing refund audit...');
    try {
      const { error } = await supabase
        .from('orders')
        .update({ refund_status: status, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      const order = allOrders.find(o => o.id === orderId);
      if (order && order.user_id && order.user_id !== 'guest') {
        let textMsg = `Refund of ₹${order.total || order.total_amount || 0} has been processed successfully to your account.`;
        if (status === 'failed') {
          textMsg = `Your online refund of ₹${order.total || order.total_amount || 0} failed to settle. Please contact Frosty Bite.`;
        }
        await addNotification({
          title: status === 'refunded' ? 'Refund Processed' : 'Refund Failed',
          message: textMsg,
          type: 'order',
          user_id: order.user_id,
          link: `/orders`
        });
      }

      setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, refund_status: status } : o));
      toast.success('Refund status updated successfully!', { id: loadingToast });
    } catch (err: any) {
      console.error('Refund status update error:', err);
      toast.error('Failed to change refund status', { id: loadingToast });
    }
  };

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
    const headers = ['Order ID', 'Customer', 'Phone', 'Address', 'Items', 'Total', 'Status', 'Date', 'Refund Status', 'Cancellation Reason'];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredOrders.map(order => {
      const itemsList = Array.isArray(order.items)
        ? order.items.map((i: any) => typeof i === 'string' ? i : i.name).join('; ')
        : 'None';

      return [
        order.id,
        order.customer_name || order.customerName || 'Guest Customer',
        order.phone || 'N/A',
        order.address || 'N/A',
        itemsList,
        order.total,
        order.status,
        order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A',
        order.refund_status || 'N/A',
        order.cancellation_reason || 'N/A'
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

  // Metrics calculators for the Cancelled Tab Panel
  const cancelledOrdersList = allOrders.filter(o => o.status === 'cancelled');
  const cancellationsCount = cancelledOrdersList.length;
  const storeTotalPlaced = allOrders.length;
  const cancellationPercent = storeTotalPlaced > 0 ? ((cancellationsCount / storeTotalPlaced) * 100).toFixed(1) : '0.0';

  // Group reason counters helper
  const commonReasonCounter: Record<string, number> = {};
  cancelledOrdersList.forEach(order => {
    const reasonValue = order.cancellation_reason || 'Ordered by mistake';
    commonReasonCounter[reasonValue] = (commonReasonCounter[reasonValue] || 0) + 1;
  });
  let topReason = 'None';
  let topCount = 0;
  Object.entries(commonReasonCounter).forEach(([r, c]) => {
    if (c > topCount) {
      topReason = r;
      topCount = c;
    }
  });

  const pendingRefunds = cancelledOrdersList.filter(o => o.refund_status === 'pending_refund');
  const pendingRefundsSum = pendingRefunds.reduce((sum, o) => sum + (Number(o.total) || Number(o.total_amount) || 0), 0);
  const processedRefunds = cancelledOrdersList.filter(o => o.refund_status === 'refunded');
  const processedRefundsSum = processedRefunds.reduce((sum, o) => sum + (Number(o.total) || Number(o.total_amount) || 0), 0);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 bg-white border border-stone-200/80 p-5 sm:p-7 rounded-3xl shadow-xs relative overflow-hidden">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/70 text-[#E76A54] text-[10px] font-black uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#E76A54] animate-pulse" />
            Live Orders Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">Order Management</h1>
          <p className="text-stone-500 text-xs sm:text-sm font-medium">Real-time fulfillment dashboard, payment verifications & audit trails.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-2xl px-3 py-2 shadow-xs">
            <Filter size={14} className="text-[#E76A54]" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-stone-800 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="out_for_delivery">Dispatch</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-2xl px-3 py-1.5 flex-1 sm:flex-none shadow-xs">
            <div className="flex flex-col">
              <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider">From</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-stone-800 text-[10px] sm:text-xs font-bold focus:outline-none w-20 sm:w-auto"
              />
            </div>
            <div className="w-px h-7 bg-stone-200 mx-1 sm:mx-2" />
            <div className="flex flex-col">
              <span className="text-[8px] text-stone-400 font-bold uppercase tracking-wider">To</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-stone-800 text-[10px] sm:text-xs font-bold focus:outline-none w-20 sm:w-auto"
              />
            </div>
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="ml-1 sm:ml-2 text-stone-400 hover:text-stone-700 transition-colors"
                title="Clear date filter"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#E76A54] hover:bg-[#d95d48] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Modern 24h Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: 'Pending', count: stats.pending, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200/80' },
          { label: 'Confirmed', count: stats.confirmed, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200/80' },
          { label: 'Preparing', count: stats.preparing, icon: Package, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200/80' },
          { label: 'Dispatch', count: stats.out_for_delivery, icon: Truck, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200/80' },
          { label: 'Delivered', count: stats.delivered, icon: Sparkles, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200/80' },
        ].map((stat) => {
          const IconComp = stat.icon;
          return (
            <div 
              key={stat.label} 
              className="bg-white border border-stone-200/80 rounded-3xl p-4 sm:p-5 flex items-center justify-between group hover:border-stone-300 transition-all hover:-translate-y-0.5 shadow-xs"
            >
              <div>
                <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest mb-1">{stat.label}</p>
                <h4 className="text-2xl sm:text-3xl font-black text-stone-900 font-mono">{stat.count}</h4>
                <p className="text-[8px] text-stone-400 font-bold uppercase mt-1">Last 24 hours</p>
              </div>
              <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center border shadow-xs shrink-0", stat.bg)}>
                <IconComp size={18} className={stat.color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs & Search Navigation Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white border border-stone-200/80 p-2 sm:p-2.5 rounded-3xl shadow-xs">
        <div className="flex bg-stone-100/90 p-1 rounded-2xl border border-stone-200/60 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={cn(
              "px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2",
              activeTab === 'active' 
                ? "bg-[#E76A54] text-white shadow-md shadow-orange-500/25" 
                : "text-stone-600 hover:text-stone-900 font-semibold"
            )}
          >
            <Layers size={14} />
            <span>Active Orders</span>
            <span className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-mono", activeTab === 'active' ? "bg-white/20 text-white" : "bg-stone-200 text-stone-700")}>
              {allOrders.filter(o => o.status !== 'cancelled' && o.payment_status !== 'pending_verification').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verification')}
            className={cn(
              "px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'verification' 
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
                : "text-stone-600 hover:text-stone-900 font-semibold"
            )}
          >
            <ShieldCheck size={14} />
            <span>Verification</span>
            {allOrders.filter(o => o.payment_status === 'pending_verification').length > 0 && (
              <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancelled')}
            className={cn(
              "px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'cancelled' 
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/20" 
                : "text-stone-600 hover:text-stone-900 font-semibold"
            )}
          >
            <AlertCircle size={14} />
            <span>Cancelled & Refunds</span>
            {allOrders.filter(o => o.status === 'cancelled' && o.refund_status === 'pending_refund').length > 0 && (
              <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>

        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#E76A54] transition-colors" size={17} />
          <input 
            type="text" 
            placeholder="Search by Order ID, Customer Name, Phone..." 
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-2.5 sm:py-3 pl-11 pr-10 text-stone-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#E76A54] transition-all placeholder:text-stone-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {activeTab === 'cancelled' ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Cancellation Analytics Board */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <div className="bg-white border border-stone-200/80 rounded-3xl p-5 shadow-xs">
              <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Total Canceled</p>
              <h4 className="text-3xl sm:text-4xl font-black text-rose-600 font-mono">{cancellationsCount}</h4>
              <p className="text-[9px] text-stone-400 mt-2 font-bold uppercase">All-time cancellations</p>
            </div>

            <div className="bg-white border border-stone-200/80 rounded-3xl p-5 shadow-xs">
              <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Cancellation Rate</p>
              <h4 className="text-3xl sm:text-4xl font-black text-amber-600 font-mono">{cancellationPercent}%</h4>
              <p className="text-[9px] text-stone-400 mt-2 font-bold uppercase">Proportion of orders</p>
            </div>

            <div className="bg-white border border-stone-200/80 rounded-3xl p-5 shadow-xs">
              <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Common Reason</p>
              <h4 className="text-sm sm:text-base font-black text-stone-900 truncate mt-2 uppercase text-sky-700">{topReason}</h4>
              <p className="text-[9px] text-stone-400 mt-2 font-bold uppercase">{topCount} matching order files</p>
            </div>

            <div className="bg-white border border-stone-200/80 rounded-3xl p-5 shadow-xs">
              <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Refund Settlement</p>
              <div className="mt-1.5 flex flex-col font-mono">
                <span className="text-xs text-emerald-700 font-bold">Paid: ₹{processedRefundsSum}</span>
                <span className="text-xs text-amber-700 font-bold">Pend: ₹{pendingRefundsSum}</span>
              </div>
              <p className="text-[9px] text-stone-400 mt-2 font-bold uppercase">{pendingRefunds.length} claims in escrow</p>
            </div>
          </div>

          {/* Refund Registry Dashboard */}
          <div className="bg-white border border-stone-200/80 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-5 sm:p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-stone-900 tracking-tight">Cancelled Orders & Refund Management</h3>
                <p className="text-xs text-stone-500 mt-0.5 font-medium">Verify customer claims, audit restocked menus, and trigger bank reversals.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-[9px] text-stone-500 font-black uppercase tracking-widest bg-stone-50/80">
                    <th className="p-4 sm:p-5">Order ID & Date</th>
                    <th className="p-4 sm:p-5">Customer Profile</th>
                    <th className="p-4 sm:p-5">Cancellation Reason</th>
                    <th className="p-4 sm:p-5 text-right">Refund Amount</th>
                    <th className="p-4 sm:p-5">Reversion Status</th>
                    <th className="p-4 sm:p-5 text-center">Update Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredOrders.filter(o => o.status === 'cancelled').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-stone-400 font-bold text-xs uppercase tracking-widest">
                        No cancellation claims found.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.filter(o => o.status === 'cancelled').map((order) => {
                      const isOnlinePay = order.payment_method === 'online' || order.payment_method === 'upi';
                      return (
                        <tr key={order.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="p-4 sm:p-5">
                            <div className="font-mono font-black text-stone-900 text-xs uppercase">#{formatOrderId(order.id)}</div>
                            <div className="text-[9px] text-stone-400 mt-0.5">
                              {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
                            </div>
                          </td>
                          <td className="p-4 sm:p-5">
                            <div className="font-bold text-stone-900 text-xs">
                              {order.customer_name || order.customerName || 'Guest Customer'}
                            </div>
                            <div className="text-[9px] text-stone-400 mt-0.5">{order.phone || 'N/A'}</div>
                          </td>
                          <td className="p-4 sm:p-5 max-w-xs">
                            <div className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200/80 inline-block">
                              {order.cancellation_reason || order.notes || 'No reason specified'}
                            </div>
                            {order.cancelled_at && (
                              <div className="text-[8px] text-stone-400 mt-1 uppercase tracking-widest">
                                Logged: {new Date(order.cancelled_at).toLocaleTimeString()}
                              </div>
                            )}
                          </td>
                          <td className="p-4 sm:p-5 text-right font-mono font-black text-stone-900 text-xs">
                            ₹{order.total || order.total_amount || 0}
                          </td>
                          <td className="p-4 sm:p-5">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border whitespace-nowrap",
                              order.refund_status === 'refunded'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : order.refund_status === 'failed'
                                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                                  : order.refund_status === 'pending_refund'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                                    : 'bg-stone-100 border-stone-200 text-stone-500'
                            )}>
                              {order.refund_status ? order.refund_status.replace('_', ' ') : 'None (COD)'}
                            </span>
                          </td>
                          <td className="p-4 sm:p-5">
                            {isOnlinePay ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateRefundStatus(order.id, 'refunded')}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 text-emerald-700 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                                  title="Settle Refund"
                                >
                                  Mark Settled
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateRefundStatus(order.id, 'failed')}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-700 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                                  title="Reject Refund"
                                >
                                  Mark Fail
                                </button>
                              </div>
                            ) : (
                              <div className="text-center text-[8px] text-stone-400 font-bold uppercase tracking-widest">
                                Cash/COD Order
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <OrdersTable 
          orders={filteredOrders.filter(o => {
            if (activeTab === 'verification') {
              return o.payment_status === 'pending_verification' || (o.utr && o.payment_status !== 'paid');
            }
            // In Active tab, show everything except those currently in "verification" or "awaiting_payment" status
            if (o.payment_status === 'pending_verification' || o.status === 'awaiting_payment') return false;
            return true;
          })} 
          loading={loading}
          onOptimisticUpdate={handleOptimisticUpdate}
          onOptimisticDelete={handleOptimisticDelete}
        />
      )}
    </div>
  );
};

export default Orders;
