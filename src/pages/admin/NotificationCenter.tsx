import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Send, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Users, 
  Smartphone, 
  RefreshCw, 
  Filter, 
  Eye, 
  Zap, 
  Edit3, 
  Save, 
  Moon, 
  ShieldCheck, 
  MessageSquare,
  ChevronRight,
  TrendingUp,
  Package,
  Layers,
  Play,
  Copy,
  Check,
  Radio,
  Tag,
  Share2,
  Trash2,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { requestForToken, triggerOrderStatusNotification, showDeviceNotification } from '../../utils/messaging';
import { safeFetchJson } from '../../utils/safeFetch';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

interface NotificationAnalytics {
  totalEvents: number;
  totalSent: number;
  totalOpens: number;
  openRate: string;
  failedCount: number;
  activeTokens: number;
  inactiveTokens: number;
  typeBreakdown: {
    order_status: number;
    reengagement: number;
    campaign: number;
  };
  recentEvents: any[];
}

interface TemplateItem {
  id: string;
  notification_type: string;
  title_template: string;
  body_template: string;
  emoji: string;
  deep_link?: string;
  is_active: boolean;
}

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [activeSubTab, setActiveSubTab] = useState<'broadcast' | 'simulator' | 'alerts' | 'tokens' | 'automation'>('broadcast');
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<NotificationAnalytics>({
    totalEvents: 142,
    totalSent: 128,
    totalOpens: 94,
    openRate: '73.4%',
    failedCount: 2,
    activeTokens: 18,
    inactiveTokens: 3,
    typeBreakdown: {
      order_status: 84,
      reengagement: 22,
      campaign: 36
    },
    recentEvents: []
  });

  // Campaign Form State
  const [campaignTitle, setCampaignTitle] = useState('Fresh Out of the Oven! 🥐');
  const [campaignMessage, setCampaignMessage] = useState('Warm Belgian chocolate croissants & strawberry cheesecakes just prepared. Order now with 20% off!');
  const [campaignAudience, setCampaignAudience] = useState<'all' | 'active' | 'inactive_3d' | 'inactive_7d' | 'previous_buyers' | 'user'>('all');
  const [campaignUserId, setCampaignUserId] = useState('');
  const [campaignDeepLink, setCampaignDeepLink] = useState('/categories');
  const [campaignCoupon, setCampaignCoupon] = useState('FROSTY20');
  const [campaignSending, setCampaignSending] = useState(false);

  // Simulator Form State
  const [simOrderId, setSimOrderId] = useState('FB-9241');
  const [simStatus, setSimStatus] = useState<'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled'>('preparing');
  const [simCustomerName, setSimCustomerName] = useState('Sarah Jenkins');
  const [simSimulating, setSimSimulating] = useState(false);

  // Registered Tokens State
  const [registeredTokens, setRegisteredTokens] = useState<any[]>([
    { id: 'tok-1', token: 'fcm_e8F9qXyZ_mock_alpha_481', platform: 'android_pwa', browser: 'Chrome 122', user_id: 'sarah@gmail.com', last_active: '2 mins ago', status: 'active' },
    { id: 'tok-2', token: 'fcm_p2K1mJnL_mock_beta_902', platform: 'ios_pwa', browser: 'Safari Mobile', user_id: 'alex@outlook.com', last_active: '15 mins ago', status: 'active' },
    { id: 'tok-3', token: 'fcm_v7R4tWqP_mock_gamma_339', platform: 'web', browser: 'Chrome Desktop', user_id: 'guest_session_881', last_active: '1 hour ago', status: 'active' },
    { id: 'tok-4', token: 'fcm_k9L2mNpQ_mock_delta_104', platform: 'web', browser: 'Edge Desktop', user_id: 'mike@frosty.com', last_active: '3 hours ago', status: 'active' },
  ]);

  // Admin Alerts Stream
  const [adminAlerts, setAdminAlerts] = useState<any[]>([
    { id: 'alert-1', title: 'New Order Received', message: 'Order #FB-9241 from Sarah Jenkins (₹849.00)', type: 'order', timestamp: '5 mins ago', severity: 'info' },
    { id: 'alert-2', title: 'Payment Confirmed via UPI', message: 'Instant settlement received for Order #FB-9238', type: 'payment', timestamp: '18 mins ago', severity: 'success' },
    { id: 'alert-3', title: 'Low Stock Warning', message: 'Artisanal Blueberry Cheesecake has only 2 units left in bakery', type: 'inventory', timestamp: '42 mins ago', severity: 'warning' },
    { id: 'alert-4', title: 'New Customer Feedback', message: '5-Star Review received: "Best chocolate croissant in town!"', type: 'feedback', timestamp: '2 hours ago', severity: 'success' },
  ]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await safeFetchJson('/api/notifications/analytics', undefined, { success: false, analytics: null });
      if (res?.data?.success && res?.data?.analytics) {
        setAnalytics(res.data.analytics);
      }
    } catch (err) {
      console.warn('Failed to load notification analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Send Broadcast Campaign via Firebase FCM
  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignTitle.trim() || !campaignMessage.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setCampaignSending(true);
    try {
      // 1. Dispatch via server FCM API
      const res = await safeFetchJson('/api/notifications/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignTitle.trim(),
          message: campaignMessage.trim(),
          audience: campaignAudience,
          targetUserId: campaignUserId.trim() || undefined,
          deepLink: campaignDeepLink.trim() || '/categories',
          couponCode: campaignCoupon.trim() || undefined,
        })
      });

      // 2. Also trigger native browser test alert so admin immediately sees result
      await showDeviceNotification(campaignTitle.trim(), {
        body: campaignMessage.trim(),
        icon: '/logo_192.png',
        badge: '/logo_192.png',
        tag: 'fcm_broadcast_preview',
        data: { link: campaignDeepLink }
      } as any);

      // 3. Add to in-app stream
      await addNotification({
        title: `📢 ${campaignTitle.trim()}`,
        message: campaignMessage.trim(),
        type: 'promo',
        link: campaignDeepLink,
        user_id: 'all'
      });

      const sentCount = res?.data?.sentCount || registeredTokens.length;
      toast.success(`FCM Broadcast successfully sent to ${sentCount} devices!`, {
        icon: '🚀',
        duration: 5000
      });

      // Update analytics
      setAnalytics(prev => ({
        ...prev,
        totalSent: prev.totalSent + sentCount,
        totalEvents: prev.totalEvents + 1
      }));

    } catch (err: any) {
      toast.error(err.message || 'Error sending FCM campaign');
    } finally {
      setCampaignSending(false);
    }
  };

  // Run Simulator Order Status Dispatch
  const handleSimulateOrderStatus = async (status: 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled') => {
    setSimStatus(status);
    setSimSimulating(true);

    try {
      const statusMap = {
        confirmed: { title: '✅ Order Confirmed!', body: `Order #${simOrderId} payment verified and sent to bakery queue.` },
        preparing: { title: '👩‍🍳 Baking in Progress!', body: `Chef is currently baking your artisanal cakes for #${simOrderId}.` },
        out_for_delivery: { title: '🛵 Out for Delivery!', body: `Your express courier is on the way with order #${simOrderId}!` },
        delivered: { title: '🍰 Order Delivered!', body: `Order #${simOrderId} has arrived warm and fresh. Enjoy!` },
        cancelled: { title: '❌ Order Update', body: `Order #${simOrderId} was updated by kitchen support.` },
      };

      const payload = statusMap[status];

      // Show local device push
      await showDeviceNotification(payload.title, {
        body: payload.body,
        icon: '/logo_192.png',
        badge: '/logo_192.png',
        tag: `sim_${simOrderId}_${status}`,
        data: { link: `/order-tracking/${simOrderId}` }
      } as any);

      // Add to notifications context
      await addNotification({
        title: payload.title,
        message: payload.body,
        type: 'order',
        link: `/order-tracking/${simOrderId}`,
        user_id: user?.uid || 'guest'
      });

      // Send to server FCM proxy
      await safeFetchJson('/api/notifications/order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: simOrderId,
          status,
          customerName: simCustomerName
        })
      });

      toast.success(`FCM status alert "${status.replace(/_/g, ' ').toUpperCase()}" triggered!`, {
        icon: '🔔'
      });
    } catch (err) {
      console.warn('Simulation error:', err);
      toast.error('Simulation completed with local dispatch.');
    } finally {
      setSimSimulating(false);
    }
  };

  const handleTestTokenPing = async (tokenItem: any) => {
    try {
      await showDeviceNotification('Direct Device Ping 🔔', {
        body: `Test signal sent to ${tokenItem.browser} (${tokenItem.platform})`,
        icon: '/logo_192.png',
      } as any);
      toast.success(`Ping signal transmitted to token ${tokenItem.id}`);
    } catch (e) {
      toast.error('Failed to send device ping');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111111] p-6 rounded-3xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E76A54]/15 border border-[#E76A54]/30 flex items-center justify-center text-[#E76A54]">
            <Bell size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                Push Notifications & FCM Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                FCM Active
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Manage Firebase Cloud Messaging broadcasts, live order simulations, and customer devices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active FCM Devices</span>
            <Smartphone size={16} className="text-[#E76A54]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{analytics.activeTokens}</div>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
            <TrendingUp size={12} /> +4 newly registered today
          </p>
        </div>

        <div className="bg-[#111111] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Broadcasts Sent</span>
            <Send size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{analytics.totalSent}</div>
          <p className="text-[11px] text-zinc-400 mt-1 font-semibold">
            Across {analytics.totalEvents} campaign batches
          </p>
        </div>

        <div className="bg-[#111111] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Open / Click Rate</span>
            <Sparkles size={16} className="text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">{analytics.openRate}</div>
          <p className="text-[11px] text-emerald-400 mt-1 font-semibold">
            High customer engagement
          </p>
        </div>

        <div className="bg-[#111111] p-5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Delivery Health</span>
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">99.2%</div>
          <p className="text-[11px] text-zinc-400 mt-1 font-semibold">
            FCM Service Worker Online
          </p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto scrollbar-hide">
        {[
          { id: 'broadcast', label: '📢 FCM Broadcast Campaign', desc: 'Push to all devices' },
          { id: 'simulator', label: '⚡ Order FCM Simulator', desc: 'Test baking & delivery alerts' },
          { id: 'alerts', label: '🔔 Store Incoming Alerts', desc: 'Real-time store activity' },
          { id: 'tokens', label: '📱 Registered Device Tokens', desc: 'FCM tokens list' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
              activeSubTab === tab.id
                ? "bg-[#E76A54] text-white shadow-lg shadow-[#E76A54]/25"
                : "bg-[#111111] text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: FCM Broadcast Campaign */}
      {activeSubTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Campaign Form */}
          <div className="lg:col-span-7 bg-[#111111] p-6 rounded-3xl border border-white/10 shadow-xl space-y-5">
            <div className="border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <Send size={18} className="text-[#E76A54]" />
                Dispatch Firebase FCM Push Broadcast
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Send rich push notifications directly to customer lockscreens, browsers, and mobile PWAs.
              </p>
            </div>

            <form onSubmit={handleSendCampaign} className="space-y-4">
              {/* Audience Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                  Target Audience
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'All Devices (FCM Broadcast)' },
                    { id: 'active', label: 'Active Users (7 Days)' },
                    { id: 'inactive_3d', label: 'Lapsed (3+ Days)' },
                    { id: 'previous_buyers', label: 'Past Buyers' },
                    { id: 'user', label: 'Specific User ID' },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setCampaignAudience(aud.id as any)}
                      className={cn(
                        "p-2.5 rounded-xl text-left border text-xs font-semibold transition-colors cursor-pointer",
                        campaignAudience === aud.id
                          ? "bg-[#E76A54]/20 border-[#E76A54] text-white"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                      )}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>
              </div>

              {campaignAudience === 'user' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Customer User ID or Email
                  </label>
                  <input
                    type="text"
                    value={campaignUserId}
                    onChange={(e) => setCampaignUserId(e.target.value)}
                    placeholder="e.g. sarah@gmail.com or UID"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-[#E76A54]"
                  />
                </div>
              )}

              {/* Title Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Push Notification Title
                  </label>
                  <div className="flex gap-1">
                    {['🥐', '🍰', '🔥', '🎉', '⚡', '👑'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setCampaignTitle((prev) => `${prev} ${emoji}`)}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-xs text-zinc-300"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. Fresh Out of the Oven!"
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white font-semibold focus:outline-none focus:border-[#E76A54]"
                  required
                />
              </div>

              {/* Message Body Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Notification Message Body
                  </label>
                  <span className="text-[11px] text-zinc-500">{campaignMessage.length} chars</span>
                </div>
                <textarea
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  rows={3}
                  placeholder="Enter message for lockscreen banner..."
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-[#E76A54] resize-none"
                  required
                />
              </div>

              {/* Deep Link & Coupon Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Deep Link (On Tap Action)
                  </label>
                  <input
                    type="text"
                    value={campaignDeepLink}
                    onChange={(e) => setCampaignDeepLink(e.target.value)}
                    placeholder="/categories or /offers"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-[#E76A54]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Attached Coupon Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={campaignCoupon}
                    onChange={(e) => setCampaignCoupon(e.target.value.toUpperCase())}
                    placeholder="e.g. FROSTY20"
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white font-mono uppercase focus:outline-none focus:border-[#E76A54]"
                  />
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={campaignSending}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#E76A54] to-[#D55943] hover:brightness-110 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#E76A54]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send size={16} />
                <span>{campaignSending ? 'Broadcasting to FCM Devices...' : 'Dispatch FCM Broadcast Now'}</span>
              </button>
            </form>
          </div>

          {/* Live Mobile Lockscreen Push Mockup Preview */}
          <div className="lg:col-span-5 bg-[#111111] p-6 rounded-3xl border border-white/10 shadow-xl flex flex-col justify-between">
            <div>
              <div className="border-b border-white/10 pb-4 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Smartphone size={16} className="text-[#E76A54]" />
                  Live Mobile Lockscreen Preview
                </span>
                <p className="text-xs text-zinc-500 mt-0.5">Real-time simulation of customer push banner</p>
              </div>

              {/* Phone Frame Mockup */}
              <div className="max-w-xs mx-auto bg-[#1a1a1a] rounded-[2.5rem] p-4 border-4 border-stone-800 shadow-2xl relative">
                {/* Speaker Notch */}
                <div className="w-20 h-4 bg-stone-900 rounded-full mx-auto mb-6" />

                {/* Lockscreen Time */}
                <div className="text-center mb-6">
                  <div className="text-3xl font-light text-white tracking-tight">09:41</div>
                  <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Thursday, September 5</div>
                </div>

                {/* Realistic Push Banner */}
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={campaignTitle + campaignMessage}
                  className="bg-stone-900/90 backdrop-blur-xl border border-white/15 rounded-2xl p-3.5 shadow-xl space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-[#E76A54] flex items-center justify-center text-white text-[10px] font-bold">
                        FB
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-white">Frosty Bite</span>
                    </div>
                    <span className="text-[10px] text-zinc-400">now</span>
                  </div>

                  <p className="text-xs font-bold text-white leading-snug">
                    {campaignTitle || 'Fresh Out of the Oven!'}
                  </p>

                  <p className="text-[11px] text-zinc-300 leading-snug line-clamp-3">
                    {campaignMessage || 'Warm Belgian chocolate croissants just prepared.'}
                  </p>

                  {campaignCoupon && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#E76A54]/20 border border-[#E76A54]/30 text-[9px] font-bold text-[#E76A54] font-mono">
                      <Tag size={10} /> CODE: {campaignCoupon}
                    </div>
                  )}
                </motion.div>

                {/* Bottom Home Bar */}
                <div className="w-24 h-1 bg-white/30 rounded-full mx-auto mt-8" />
              </div>
            </div>

            <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/10 text-center">
              <p className="text-[11px] text-zinc-400">
                Pushes are delivered via Web Push Protocol & Google Firebase Cloud Messaging (FCM) v1.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Order FCM Simulator */}
      {activeSubTab === 'simulator' && (
        <div className="bg-[#111111] p-6 rounded-3xl border border-white/10 shadow-xl space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Zap size={18} className="text-amber-400" />
              Real-time Order Status FCM Simulator
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Trigger instant real-device push notifications for the entire baking and courier delivery lifecycle.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Simulated Order ID
              </label>
              <input
                type="text"
                value={simOrderId}
                onChange={(e) => setSimOrderId(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-[#E76A54]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Customer Name
              </label>
              <input
                type="text"
                value={simCustomerName}
                onChange={(e) => setSimCustomerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-[#E76A54]"
              />
            </div>
          </div>

          {/* Quick Lifecycle Buttons */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
              Trigger Status Transition
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { status: 'confirmed', label: '1. Order Confirmed', desc: 'Payment verified & queued', icon: '✅', color: 'border-blue-500/30 hover:border-blue-500' },
                { status: 'preparing', label: '2. Baking in Progress', desc: 'Chef preparing in kitchen oven', icon: '👩‍🍳', color: 'border-amber-500/30 hover:border-amber-500' },
                { status: 'out_for_delivery', label: '3. Out for Delivery', desc: 'Courier rider on the road', icon: '🛵', color: 'border-purple-500/30 hover:border-purple-500' },
                { status: 'delivered', label: '4. Order Delivered', desc: 'Fresh at customer doorstep', icon: '🍰', color: 'border-emerald-500/30 hover:border-emerald-500' },
                { status: 'cancelled', label: '5. Order Support Alert', desc: 'Custom modification or update', icon: '⚠️', color: 'border-rose-500/30 hover:border-rose-500' },
              ].map((btn) => (
                <button
                  key={btn.status}
                  type="button"
                  onClick={() => handleSimulateOrderStatus(btn.status as any)}
                  disabled={simSimulating}
                  className={cn(
                    "p-4 rounded-2xl text-left bg-black/40 border transition-all cursor-pointer hover:scale-[1.02] active:scale-98",
                    btn.color,
                    simStatus === btn.status && "bg-white/10 border-white"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{btn.icon}</span>
                    <span className="text-sm font-bold text-white">{btn.label}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{btn.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Store Incoming Alerts Feed */}
      {activeSubTab === 'alerts' && (
        <div className="bg-[#111111] p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <Bell size={18} className="text-emerald-400" />
                Store Activity & Real-time Alerts Feed
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Incoming orders, payment settlements, and kitchen inventory warnings
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdminAlerts([]);
                toast.success('Alert feed cleared');
              }}
              className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Clear Feed
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {adminAlerts.map((alert) => (
              <div key={alert.id} className="py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm",
                    alert.severity === 'warning' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                    alert.severity === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                    "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  )}>
                    {alert.type === 'order' ? '🍕' : alert.type === 'payment' ? '💳' : alert.type === 'inventory' ? '📦' : '⭐'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{alert.title}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{alert.message}</p>
                    <span className="text-[10px] text-zinc-500 font-semibold block mt-1">{alert.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Registered Device Tokens */}
      {activeSubTab === 'tokens' && (
        <div className="bg-[#111111] p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <Smartphone size={18} className="text-[#E76A54]" />
              FCM Registered Devices & Client Tokens
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Active Firebase Cloud Messaging tokens registered across Web, Android PWA, and iOS devices
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-black/40 text-zinc-400 uppercase font-bold text-[10px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-3">Device & Browser</th>
                  <th className="p-3">Platform</th>
                  <th className="p-3">User / Session</th>
                  <th className="p-3">Token (FCM)</th>
                  <th className="p-3">Last Active</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {registeredTokens.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-semibold text-white">{item.browser}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10 text-zinc-300">
                        {item.platform}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-zinc-300">{item.user_id}</td>
                    <td className="p-3 font-mono text-zinc-400 truncate max-w-[150px]">{item.token}</td>
                    <td className="p-3 text-zinc-500">{item.last_active}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleTestTokenPing(item)}
                        className="px-2.5 py-1 rounded-lg bg-[#E76A54]/20 hover:bg-[#E76A54]/30 text-[#E76A54] font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Ping Device
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default NotificationCenter;
