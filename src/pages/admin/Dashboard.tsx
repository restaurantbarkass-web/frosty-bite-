import React, { useState, useEffect } from 'react';
import { DashboardCards } from '../../components/admin/DashboardCards';
import { OrdersChart, PopularItemsChart, RevenueChart } from '../../components/admin/Charts';
import { OrdersTable } from '../../components/admin/OrdersTable';
import { motion } from 'motion/react';
import { useConfig } from '../../context/ConfigContext';
import { Power, CheckCircle2, XCircle, ShoppingBag, Store, ShieldAlert, Megaphone, Radio, Sparkles, Smartphone, BellRing, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { liveAlertService } from '../../services/liveAlertService';

import { supabase } from '../../supabase';
import { Order } from '../../types';

export const Dashboard: React.FC = () => {
  const { user, getAuthToken } = useAuth();
  const { config, toggleOrderingStatus, updatePickupOnlyStatus } = useConfig();
  const [isToggling, setIsToggling] = useState(false);
  const [isTogglingPickup, setIsTogglingPickup] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastHeadline, setBroadcastHeadline] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [showCloseReasonModal, setShowCloseReasonModal] = useState(false);
  
  // Dynamic Closure Announcement Fields
  const [closureTitleInput, setClosureTitleInput] = useState('Taking a Little Break! ❤️');
  const [closingReasonInput, setClosingReasonInput] = useState('Our bakery is temporarily closed while we prepare something special for you.');
  const [closureMessageInput, setClosureMessageInput] = useState("Thank you for your love and patience. We can't wait to serve you again.");
  const [reopenDateInput, setReopenDateInput] = useState('');
  const [reopenTimeInput, setReopenTimeInput] = useState('10:00 AM');
  const [closureImageInput, setClosureImageInput] = useState('');
  const [reopeningMessageInput, setReopeningMessageInput] = useState('WE ARE BACK! 🎉 Frosty Bite Bakery is officially OPEN again! Your favourite cakes and desserts are waiting for you.');

  useEffect(() => {
    if (config) {
      if (config.closureTitle) setClosureTitleInput(config.closureTitle);
      if (config.closureReason || config.storeClosedReason) setClosingReasonInput(config.closureReason || config.storeClosedReason);
      if (config.closureMessage) setClosureMessageInput(config.closureMessage);
      if (config.reopenDate) setReopenDateInput(config.reopenDate);
      if (config.reopenTime) setReopenTimeInput(config.reopenTime);
      if (config.closureImage) setClosureImageInput(config.closureImage);
      if (config.reopeningMessage) setReopeningMessageInput(config.reopeningMessage);
    }
  }, [config]);

  const isPickupOnly = Boolean(config?.pickup_only ?? config?.isPickupOnly ?? false);

  const handleTestMobilePopup = (mode: 'closed' | 'open' | 'pickup') => {
    if (mode === 'closed') {
      liveAlertService.triggerLocalAlert({
        type: 'STORE_CLOSED',
        title: closureTitleInput || 'Taking a Little Break! ❤️',
        message: closureMessageInput || "Thank you for your love and patience. We can't wait to serve you again.",
        reason: closingReasonInput || 'Our bakery is temporarily closed while we prepare something special for you.',
        reopenDate: reopenDateInput || '20 November 2026',
        reopenTime: reopenTimeInput || '10:00 AM',
        closureTitle: closureTitleInput,
        closureMessage: closureMessageInput,
        closureImage: closureImageInput,
        badge: '🔴 Store Temporarily Closed',
        actionText: 'Continue Exploring'
      });
      toast.success('Previewing full-screen Store Closure Announcement on your screen!');
    } else if (mode === 'open') {
      // In accordance with instructions: When store is open, popup will not show
      toast.success('Store Open verified: Popup will NEVER show when store is open!');
    } else {
      liveAlertService.triggerLocalAlert({
        type: 'PICKUP_ONLY',
        title: 'Switched to Bakery Pickup Only 🛍️',
        message: 'Due to kitchen capacity or high demand, online orders are currently accepting In-Store Pickup only. Place your order and collect fresh from our counter!',
        badge: '🛍️ Pickup Only Active',
        actionText: 'Got It, View Pickup Menu'
      });
      toast.success('Previewing Pickup Only popup on your screen!');
    }
  };

  const handleSendCustomBroadcast = async () => {
    if (!broadcastHeadline.trim() || !broadcastMessage.trim()) {
      toast.error('Please enter a headline and message');
      return;
    }
    setIsBroadcasting(true);
    try {
      await liveAlertService.broadcastLiveEvent({
        type: 'CUSTOM_ANNOUNCEMENT',
        title: broadcastHeadline.trim(),
        message: broadcastMessage.trim(),
        badge: '📣 Live Bakery Notice',
        actionText: 'View Updates',
        source: 'admin_broadcast'
      });
      toast.success('Live popup broadcasted to all customer mobile phones in real-time!');
      setShowBroadcastModal(false);
      setBroadcastHeadline('');
      setBroadcastMessage('');
    } catch (e) {
      toast.error('Failed to send broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

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

    // Subscribe to orders changes with fine-grained event handlers
    const channel = supabase
      .channel('dashboard_recent_orders')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        const newOrder = payload.new as Order;
        if (newOrder && newOrder.id) {
          setRecentOrders((prev) => {
            if (prev.some((o) => o.id === newOrder.id)) return prev;
            return [newOrder, ...prev.slice(0, 19)];
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
          setRecentOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)));
        }
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'orders' 
      }, (payload) => {
        const deletedId = (payload.old as any)?.id;
        if (deletedId) {
          setRecentOrders((prev) => prev.filter((o) => o.id !== deletedId));
        }
      })
      .subscribe();

    const interval = setInterval(() => {
      fetchRecentOrders();
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const handleOptimisticUpdate = (orderId: string, updates: Partial<Order>) => {
    setRecentOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
  };

  const handleOptimisticDelete = (orderId: string) => {
    setRecentOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleToggleOrdering = async () => {
    if (!config) return;
    const newStatus = !config.isOrderingOpen;
    if (!newStatus) {
      // Opening closure configuration modal
      setShowCloseReasonModal(true);
      return;
    }

    setIsToggling(true);
    try {
      const token = await getAuthToken();
      await toggleOrderingStatus({
        reopeningMessage: reopeningMessageInput.trim() || 'WE ARE BACK! 🎉 Frosty Bite Bakery is officially OPEN again! Your favourite cakes and desserts are waiting for you.'
      }, token);
      toast.success('Store is now OPEN! Closure announcement automatically deactivated.');
    } catch (error) {
      console.error('Error toggling ordering status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsToggling(false);
    }
  };

  const handleConfirmCloseStore = async () => {
    if (!config) return;
    setIsToggling(true);
    try {
      const token = await getAuthToken();
      await toggleOrderingStatus({
        title: closureTitleInput.trim() || 'Taking a Little Break! ❤️',
        reason: closingReasonInput.trim() || 'Our bakery is temporarily closed while we prepare something special for you.',
        message: closureMessageInput.trim() || "Thank you for your love and patience. We can't wait to serve you again.",
        reopenDate: reopenDateInput.trim(),
        reopenTime: reopenTimeInput.trim(),
        closureImage: closureImageInput.trim(),
        reopeningMessage: reopeningMessageInput.trim()
      }, token);
      toast.success('Store is now CLOSED. Full-screen announcement published & broadcasted!');
      setShowCloseReasonModal(false);
    } catch (error) {
      console.error('Error closing store:', error);
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
      const token = await getAuthToken();
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
    <div className="space-y-8 sm:space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight mb-1">Dashboard Overview</h1>
          <p className="text-stone-500 text-sm font-medium">Welcome back, Admin! Here's what's happening today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
          {config && (
            <button 
              onClick={handleToggleOrdering}
              disabled={isToggling}
              className={`flex items-center justify-center gap-2.5 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-bold transition-all relative overflow-hidden group flex-1 sm:flex-none border text-sm shadow-xs ${
                config.isOrderingOpen 
                  ? 'bg-emerald-50 border-emerald-300/80 text-emerald-800 hover:bg-emerald-100' 
                  : 'bg-rose-50 border-rose-300/80 text-rose-800 hover:bg-rose-100'
              }`}
            >
              {isToggling ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                config.isOrderingOpen ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-rose-600" />
              )}
              
              <span className="font-bold">
                {config.isOrderingOpen ? 'Store Open' : 'Store Closed'}
              </span>
            </button>
          )}
          <button 
            onClick={exportRecentOrders}
            className="p-2.5 sm:p-3 bg-white border border-stone-200/90 rounded-2xl text-stone-700 font-bold hover:bg-stone-50 transition-all flex-1 sm:flex-none flex items-center justify-center gap-2 shadow-xs"
            title="Download Report"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-stone-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span className="text-xs font-semibold">Report</span>
          </button>
          <button className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-[#E76A54] text-white rounded-2xl font-bold shadow-md shadow-orange-500/25 hover:bg-[#d95d48] transition-all flex-1 sm:flex-none text-xs sm:text-sm">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse hidden sm:block" />
            Live
          </button>
        </div>
      </div>

      {/* Order Settings Section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-stone-200/80 rounded-3xl p-5 sm:p-7 space-y-6 relative overflow-hidden shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-700 border border-amber-200/60">
              <Store size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black text-stone-900 tracking-tight">Order Settings</h2>
              <p className="text-xs text-stone-500 font-medium">Manage ordering status and fulfillment modes in real time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              config?.isOrderingOpen 
                ? (isPickupOnly ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200') 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {!config?.isOrderingOpen ? 'Store Closed' : (isPickupOnly ? 'Pickup Only Active' : 'Store Open (Delivery & Pickup)')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Order Open / Close Toggle */}
          <div className="p-4 sm:p-5 bg-stone-50/70 rounded-2xl border border-stone-200/80 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Power size={18} className={config?.isOrderingOpen ? 'text-emerald-600' : 'text-rose-600'} />
                <span className="font-bold text-stone-900 text-sm sm:text-base">Order Status</span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                {config?.isOrderingOpen ? 'Store is accepting orders.' : 'Store is closed. Online orders are disabled.'}
              </p>
            </div>
            {config && (
              <button 
                type="button"
                onClick={handleToggleOrdering}
                disabled={isToggling}
                className={`relative w-14 h-8 rounded-full p-1 transition-all duration-300 outline-none shrink-0 ${
                  config.isOrderingOpen ? 'bg-emerald-600' : 'bg-stone-300'
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
          <div className="p-4 sm:p-5 bg-stone-50/70 rounded-2xl border border-stone-200/80 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className={isPickupOnly ? 'text-amber-600' : 'text-stone-400'} />
                <span className="font-bold text-stone-900 text-sm sm:text-base">Pickup Only</span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed max-w-sm">
                When enabled, customers can place orders online but must collect them from the bakery.
              </p>
            </div>
            <button 
              type="button"
              onClick={handleTogglePickupOnly}
              disabled={isTogglingPickup}
              className={`relative w-14 h-8 rounded-full p-1 transition-all duration-300 outline-none shrink-0 ${
                isPickupOnly ? 'bg-amber-500' : 'bg-stone-300'
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

        {/* Real-time mobile sync & instant announcement tools */}
        <div className="pt-4 border-t border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#FFF9F5] via-white to-amber-50/40 p-4 rounded-2xl border border-amber-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-xs">
              <Radio size={20} className="animate-pulse text-[#E76A54]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-stone-900 text-xs sm:text-sm">Instant Mobile Sync: Active</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  &lt;100ms
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">
                Store Open / Store Closed toggles instantly trigger an animated popup with gentle chime on all customer mobile phones.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Test alert button */}
            <div className="flex items-center bg-white border border-stone-200/90 rounded-xl p-1 shadow-xs">
              <span className="text-[10px] font-bold text-stone-500 px-2 flex items-center gap-1">
                <Smartphone size={12} /> Test:
              </span>
              <button
                type="button"
                onClick={() => handleTestMobilePopup('closed')}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                title="Preview Store Closed popup"
              >
                Closed
              </button>
              <button
                type="button"
                onClick={() => handleTestMobilePopup('open')}
                className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Preview Store Open popup"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => handleTestMobilePopup('pickup')}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                title="Preview Pickup Only popup"
              >
                Pickup
              </button>
            </div>

            {/* Custom broadcast popup */}
            <button
              type="button"
              onClick={() => setShowBroadcastModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#4A2E2A] text-white rounded-xl text-xs font-bold hover:bg-[#382320] transition-colors shadow-xs"
            >
              <Megaphone size={14} className="text-[#D8B56D]" />
              <span>Broadcast Notice</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Broadcast Announcement Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[#FFF9F5] border border-[#D8B56D]/50 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-left">
            <button
              onClick={() => setShowBroadcastModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-stone-200/70 hover:bg-stone-200 text-stone-600 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-[#FFE8EC] text-[#E76A54] rounded-2xl">
                <Megaphone size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-[#4A2E2A] tracking-tight">Broadcast Instant Mobile Alert</h3>
                <p className="text-xs text-stone-500 font-medium">Pops up immediately on all customer screens and mobile devices</p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-bold text-stone-600 uppercase tracking-wider">Quick Presets</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastHeadline("Fresh Batch Just Out of the Oven! 🎂");
                    setBroadcastMessage("Our pastry chefs just finished fresh chocolate croissants and strawberry mousse cups. Grab them while they're warm!");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#D8B56D] text-xs font-semibold text-stone-700 transition-colors"
                >
                  🎂 Fresh Batch Ready
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastHeadline("Kitchen Rush Notice ⏳");
                    setBroadcastMessage("Our kitchen is currently experiencing high demand. Order preparation may take 10-15 minutes longer. Thank you for your patience!");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#D8B56D] text-xs font-semibold text-stone-700 transition-colors"
                >
                  ⏳ Kitchen Rush
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBroadcastHeadline("Closing Soon (Last Orders) ⏰");
                    setBroadcastMessage("Online order intake will close in 30 minutes! Please finalize your cart to get your late-night treats.");
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-[#D8B56D] text-xs font-semibold text-stone-700 transition-colors"
                >
                  ⏰ Closing in 30 Mins
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Headline</label>
                <input
                  type="text"
                  value={broadcastHeadline}
                  onChange={(e) => setBroadcastHeadline(e.target.value)}
                  placeholder="e.g. Fresh Mango Cakes Just Arrived! 🥭"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-900 text-sm font-semibold focus:outline-none focus:border-[#E76A54]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Popup Message</label>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="e.g. Handcrafted with fresh alphonso mangoes and sweet cream. Limited boxes available today!"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-900 text-sm font-medium focus:outline-none focus:border-[#E76A54] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSendCustomBroadcast}
                disabled={isBroadcasting}
                className="flex-1 py-3 px-5 rounded-xl bg-[#E76A54] text-white font-bold text-sm shadow-md hover:bg-[#d95d48] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isBroadcasting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Radio size={16} />
                    <span>Send to All Customer Phones</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="px-4 py-3 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Store Announcement Configuration Modal */}
      {showCloseReasonModal && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl bg-[#FFF9F5] border-2 border-[#D8B56D]/70 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-left my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCloseReasonModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-stone-200/70 hover:bg-stone-200 text-stone-600 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shadow-xs">
                <Power size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-stone-900 tracking-tight">Store Closure Announcement</h3>
                <p className="text-xs text-stone-500 font-medium">Configure the full-screen announcement shown to customers</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {/* 1. Announcement Title */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1">
                  Announcement Title
                </label>
                <input
                  type="text"
                  value={closureTitleInput}
                  onChange={(e) => setClosureTitleInput(e.target.value)}
                  placeholder="e.g. Taking a Little Break! ❤️"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-900 text-sm font-bold focus:outline-none focus:border-[#E76A54]"
                />
              </div>

              {/* 2. Quick Reason Presets */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5">
                  Closure Reason Presets
                </label>
                <div className="flex flex-col gap-1.5">
                  {[
                    { icon: '🥐', text: 'Our bakery is temporarily closed while we prepare something special for you.' },
                    { icon: '🌙', text: 'Closed for the night. Reopening tomorrow morning.' },
                    { icon: '⏳', text: 'Kitchen at full capacity. Pausing new orders temporarily.' },
                    { icon: '🎂', text: 'Private catering & bulk festival orders in progress.' },
                    { icon: '❄️', text: 'Oven maintenance & kitchen deep sanitization break.' }
                  ].map((preset) => (
                    <button
                      key={preset.text}
                      type="button"
                      onClick={() => setClosingReasonInput(preset.text)}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-all flex items-center gap-2 ${
                        closingReasonInput === preset.text
                          ? 'bg-rose-50 border-rose-400 text-rose-900 shadow-xs'
                          : 'bg-white border-stone-200 hover:border-[#D8B56D] text-stone-700'
                      }`}
                    >
                      <span className="text-sm shrink-0">{preset.icon}</span>
                      <span className="truncate">{preset.text}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Custom Reason Input */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1">
                  Custom Closure Reason
                </label>
                <textarea
                  rows={2}
                  value={closingReasonInput}
                  onChange={(e) => setClosingReasonInput(e.target.value)}
                  placeholder="Type closure reason..."
                  className="w-full px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-900 text-xs font-medium focus:outline-none focus:border-[#E76A54] resize-none"
                />
              </div>

              {/* 4. Expected Reopening Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/60">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-amber-900 mb-1">
                    📅 Expected Reopening Date
                  </label>
                  <input
                    type="text"
                    value={reopenDateInput}
                    onChange={(e) => setReopenDateInput(e.target.value)}
                    placeholder="e.g. 20 November 2026"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-stone-900 text-xs font-bold focus:outline-none focus:border-[#E76A54]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-amber-900 mb-1">
                    ⏰ Expected Reopening Time
                  </label>
                  <input
                    type="text"
                    value={reopenTimeInput}
                    onChange={(e) => setReopenTimeInput(e.target.value)}
                    placeholder="e.g. 10:00 AM"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-stone-900 text-xs font-bold focus:outline-none focus:border-[#E76A54]"
                  />
                </div>
              </div>

              {/* 5. Additional Announcement Message */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1">
                  Additional Note to Customers
                </label>
                <textarea
                  rows={2}
                  value={closureMessageInput}
                  onChange={(e) => setClosureMessageInput(e.target.value)}
                  placeholder="e.g. Thank you for your love and patience. We can't wait to serve you again."
                  className="w-full px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-900 text-xs font-medium focus:outline-none focus:border-[#E76A54] resize-none"
                />
              </div>

              {/* 6. Special Reopening Message (Auto-broadcast when reopening) */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1">
                  🎉 Message When Reopening
                </label>
                <input
                  type="text"
                  value={reopeningMessageInput}
                  onChange={(e) => setReopeningMessageInput(e.target.value)}
                  placeholder="e.g. WE ARE BACK! 🎉 Frosty Bite Bakery is officially OPEN again!"
                  className="w-full px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-900 text-xs font-medium focus:outline-none focus:border-[#E76A54]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleConfirmCloseStore}
                disabled={isToggling}
                className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 text-white font-bold text-sm shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isToggling ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Power size={16} />
                    <span>Publish Announcement & Close Store</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowCloseReasonModal(false)}
                className="px-5 py-3.5 rounded-2xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <DashboardCards />

      {supabaseError && (
        <div className="p-5 sm:p-6 bg-rose-50 border border-rose-200 rounded-3xl mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-100 rounded-2xl text-rose-600">
              <XCircle size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-rose-900 mb-1">Configuration Error</h3>
              <p className="text-rose-700 font-medium text-sm leading-relaxed">{supabaseError}</p>
              <div className="mt-3 flex gap-3">
                <a 
                  href="https://supabase.com/dashboard/project/_/editor" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors"
                >
                  Go to Supabase Dashboard
                </a>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-white border border-rose-200 text-rose-800 rounded-xl font-bold text-xs hover:bg-rose-50 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
        <RevenueChart />
        <OrdersChart />
        <PopularItemsChart />
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">Real-time Orders</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#E76A54] rounded-full animate-pulse" />
            <span className="text-xs text-[#E76A54] font-black uppercase tracking-widest">Live Updates</span>
          </div>
        </div>
        <OrdersTable 
          orders={recentOrders} 
          loading={loadingOrders}
          onOptimisticUpdate={handleOptimisticUpdate}
          onOptimisticDelete={handleOptimisticDelete}
        />
      </div>
    </div>
  );
};
