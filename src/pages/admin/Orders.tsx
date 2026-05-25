import React, { useState, useEffect } from 'react';
import { OrdersTable } from '../../components/admin/OrdersTable';
import { Filter, Search, Download, Calendar, Clock, X, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { supabase } from '../../supabase';
import { useNotifications } from '../../context/NotificationContext';
import toast from 'react-hot-toast';

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
      .channel('admin_orders_all_view')
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
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Order Management</h1>
          <p className="text-gray-500 font-medium">Track and manage all customer orders and cancellation claims in real-time.</p>
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
              <span className="text-[8px] text-gray-500 font-bold uppercase font-sans">From</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white text-[10px] sm:text-xs font-bold focus:outline-none w-20 sm:w-auto"
              />
            </div>
            <div className="w-px h-8 bg-white/10 mx-1 sm:mx-2" />
            <div className="flex flex-col">
              <span className="text-[8px] text-gray-500 font-bold uppercase font-sans">To</span>
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
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1 font-sans">{stat.label}</p>
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
              "px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'active' 
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                : "text-zinc-500 hover:text-white"
            )}
          >
            Active Orders
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={cn(
              "px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === 'verification' 
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" 
                : "text-zinc-500 hover:text-white"
            )}
          >
            Verification
            {allOrders.filter(o => o.payment_status === 'pending_verification').length > 0 && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cancelled')}
            className={cn(
              "px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === 'cancelled' 
                ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20" 
                : "text-zinc-500 hover:text-white"
            )}
          >
            Cancelled & Refunds
            {allOrders.filter(o => o.status === 'cancelled' && o.refund_status === 'pending_refund').length > 0 && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>
        <div className="relative flex-1 group w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by Order ID, Customer Name, Phone..." 
            className="w-full bg-[#111]/80 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-650"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {activeTab === 'cancelled' ? (
        <div className="space-y-8">
          {/* Cancellation Analytics Board */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#111]/85 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/[0.03] rounded-full blur-2xl" />
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Total Canceled</p>
              <h4 className="text-4xl font-black text-rose-500 italic font-mono">{cancellationsCount}</h4>
              <p className="text-[9px] text-zinc-650 mt-2 font-bold uppercase transition-colors group-hover:text-zinc-500">All-time store cancellations</p>
            </div>

            <div className="bg-[#111]/85 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/[0.03] rounded-full blur-2xl" />
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Cancellation Rate</p>
              <h4 className="text-4xl font-black text-orange-400 font-mono">{cancellationPercent}%</h4>
              <p className="text-[9px] text-zinc-650 mt-2 font-bold uppercase">Proportion of order files</p>
            </div>

            <div className="bg-[#111]/85 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/[0.03] rounded-full blur-2xl" />
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Common Reason</p>
              <h4 className="text-base font-black text-zinc-100 truncate mt-2 uppercase italic text-sky-400">{topReason}</h4>
              <p className="text-[9px] text-zinc-650 mt-2 font-bold uppercase">{topCount} matching order files</p>
            </div>

            <div className="bg-[#111]/85 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.03] rounded-full blur-2xl" />
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1 font-sans">Refund Settlement</p>
              <div className="mt-1.5 flex flex-col font-mono">
                <span className="text-xs text-emerald-400 font-bold">Paid: ₹{processedRefundsSum}</span>
                <span className="text-xs text-amber-500 font-bold">Pend: ₹{pendingRefundsSum}</span>
              </div>
              <p className="text-[9px] text-zinc-650 mt-2 font-bold uppercase">{pendingRefunds.length} claims in escrow</p>
            </div>
          </div>

          {/* Refund Registry Dashboard */}
          <div className="bg-[#111]/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white italic tracking-tight uppercase">Cancelled Orders & Refund Management</h3>
                <p className="text-xs text-zinc-500 mt-1 font-medium">Verify customer claims, audit restocked menus, and trigger bank reversals.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] text-zinc-600 font-black uppercase tracking-widest bg-black/30">
                    <th className="p-6">Order ID & Date</th>
                    <th className="p-6">Customer Profile</th>
                    <th className="p-6">Cancellation Reason</th>
                    <th className="p-6 text-right">Refund Amount</th>
                    <th className="p-6">Reversion Status</th>
                    <th className="p-6 text-center">Update Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredOrders.filter(o => o.status === 'cancelled').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-16 text-center text-zinc-500 font-bold text-xs uppercase tracking-widest">
                        No cancellation claims found match queries.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.filter(o => o.status === 'cancelled').map((order) => {
                      const isOnlinePay = order.payment_method === 'online' || order.payment_method === 'upi';
                      return (
                        <tr key={order.id} className="hover:bg-white/[0.01] transition-colors group/row">
                          <td className="p-6">
                            <div className="font-mono font-black text-white text-xs uppercase">#{order.id.slice(-6).toUpperCase()}</div>
                            <div className="text-[9px] text-zinc-500 mt-1">
                              {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="font-bold text-white text-xs">
                              {order.customer_name || order.customerName || 'Guest Customer'}
                            </div>
                            <div className="text-[9px] text-zinc-500 mt-1">{order.phone || 'N/A'}</div>
                          </td>
                          <td className="p-6 max-w-xs">
                            <div className="text-xs font-bold text-rose-400 italic bg-rose-500/5 px-3 py-1.5 rounded-xl border border-rose-500/10 inline-block">
                              {order.cancellation_reason || order.notes || 'No reason specify'}
                            </div>
                            {order.cancelled_at && (
                              <div className="text-[8px] text-zinc-600 mt-1 uppercase tracking-widest">
                                Logged: {new Date(order.cancelled_at).toLocaleTimeString()}
                              </div>
                            )}
                          </td>
                          <td className="p-6 text-right font-mono font-black text-zinc-100 text-xs">
                            ₹{order.total || order.total_amount || 0}
                          </td>
                          <td className="p-6">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border whitespace-nowrap",
                              order.refund_status === 'refunded'
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                : order.refund_status === 'failed'
                                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-500'
                                  : order.refund_status === 'pending_refund'
                                    ? 'bg-amber-500/12 border-amber-500/25 text-amber-400 animate-pulse'
                                    : 'bg-zinc-500/10 border-white/5 text-zinc-500'
                            )}>
                              {order.refund_status ? order.refund_status.replace('_', ' ') : 'None (COD)'}
                            </span>
                          </td>
                          <td className="p-6">
                            {isOnlinePay ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateRefundStatus(order.id, 'refunded')}
                                  className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                                  title="Settle Refund"
                                >
                                  Mark Settled
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateRefundStatus(order.id, 'failed')}
                                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 text-rose-500 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                                  title="Reject Refund"
                                >
                                  Mark Fail
                                </button>
                              </div>
                            ) : (
                              <div className="text-center text-[8px] text-zinc-500 font-black uppercase tracking-widest">
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
        />
      )}
    </div>
  );
};

export default Orders;
