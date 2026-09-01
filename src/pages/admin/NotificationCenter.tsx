import React, { useState, useEffect } from 'react';
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
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { requestForToken, triggerOrderStatusNotification } from '../../utils/messaging';
import { safeFetchJson, safeResponseJson } from '../../utils/safeFetch';

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
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'campaigns' | 'reengagement' | 'templates' | 'simulator'>('overview');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Campaign Form State
  const [campaignTitle, setCampaignTitle] = useState('Freshly Baked Chef Specials! 🍰');
  const [campaignMessage, setCampaignMessage] = useState('Our bakery oven just turned out warm Belgian Chocolate Croissants & Berry Tarts. Order now for 20% off!');
  const [campaignAudience, setCampaignAudience] = useState<'all' | 'active' | 'inactive_3d' | 'inactive_7d' | 'previous_buyers' | 'user'>('all');
  const [campaignUserId, setCampaignUserId] = useState('');
  const [campaignDeepLink, setCampaignDeepLink] = useState('/');
  const [campaignSending, setCampaignSending] = useState(false);

  // Simulator Form State
  const [simOrderId, setSimOrderId] = useState('ORD-DEMO-88');
  const [simStatus, setSimStatus] = useState('preparing');
  const [simReason, setSimReason] = useState('');
  const [simSimulating, setSimSimulating] = useState(false);

  // Re-engagement trigger state
  const [reengageLoading, setReengageLoading] = useState(false);
  const [reengageDryRun, setReengageDryRun] = useState(false);
  const [reengageResult, setReengageResult] = useState<any>(null);

  // Template editing state
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);

  const fetchAnalyticsAndTemplates = async () => {
    try {
      setLoading(true);
      const [resAna, resTpl] = await Promise.all([
        safeFetchJson('/api/notifications/analytics', undefined, { success: false, analytics: null }),
        safeFetchJson('/api/notifications/templates', undefined, { success: false, templates: [] })
      ]);

      if (resAna?.data?.success && resAna?.data?.analytics) {
        setAnalytics(resAna.data.analytics);
      }
      if (resTpl?.data?.success && resTpl?.data?.templates) {
        setTemplates(resTpl.data.templates);
      }
    } catch (err) {
      console.warn('Failed to load notification analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsAndTemplates();
  }, []);

  // Send Broadcast Campaign
  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignTitle.trim() || !campaignMessage.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setCampaignSending(true);
    try {
      const res = await safeFetchJson('/api/notifications/send-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: campaignTitle.trim(),
          message: campaignMessage.trim(),
          audience: campaignAudience,
          targetUserId: campaignUserId.trim() || undefined,
          deepLink: campaignDeepLink.trim() || '/'
        })
      });
      const data = res.data;
      if (data && data.success) {
        toast.success(`Campaign broadcast sent to ${data.sentCount || 0} customer devices!`, { icon: '📢' });
        fetchAnalyticsAndTemplates();
      } else {
        toast.error(res.error || data?.error || 'Failed to dispatch broadcast');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error sending campaign');
    } finally {
      setCampaignSending(false);
    }
  };

  // Run Re-Engagement Cycle
  const handleTriggerReengagement = async () => {
    setReengageLoading(true);
    try {
      const res = await safeFetchJson('/api/notifications/trigger-reengagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: reengageDryRun })
      });
      const data = res.data;
      if (data && data.success) {
        setReengageResult(data);
        toast.success(
          reengageDryRun
            ? `Dry Run complete: Evaluated ${data.processedCount || 0} customer profiles.`
            : `Re-engagement cycle completed: ${data.sentCount || 0} push alerts sent!`,
          { icon: '✨' }
        );
        fetchAnalyticsAndTemplates();
      } else {
        toast.error(res.error || data?.error || 'Failed to execute re-engagement');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error triggering re-engagement');
    } finally {
      setReengageLoading(false);
    }
  };

  // Simulate Order Lifecycle Event
  const handleSimulateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simOrderId.trim()) {
      toast.error('Order ID is required');
      return;
    }

    setSimSimulating(true);
    try {
      const res = await safeFetchJson('/api/notifications/send-order-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: simOrderId.trim(),
          status: simStatus,
          customReason: simReason.trim() || undefined,
          eventVersion: Date.now() // Unique version for simulator test
        })
      });
      const data = res.data;
      if (data && data.success) {
        toast.success(`Simulated order status "${simStatus}" triggered!`, { icon: '🍰' });
        fetchAnalyticsAndTemplates();
      } else {
        toast.error(res.error || data?.reason || data?.error || 'Failed to simulate');
      }
    } catch (err: any) {
      toast.error(err.message || 'Simulation error');
    } finally {
      setSimSimulating(false);
    }
  };

  // Save template edit
  const handleSaveTemplate = async (type: string, payload: Partial<TemplateItem>) => {
    try {
      const res = await safeFetchJson(`/api/notifications/templates/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = res.data;
      if (data && data.success) {
        toast.success('Template updated successfully!');
        setEditingTemplate(null);
        fetchAnalyticsAndTemplates();
      } else {
        toast.error(res.error || data?.error || 'Failed to update template');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating template');
    }
  };

  // Filtered Events
  const filteredEvents = (analytics?.recentEvents || []).filter(e => {
    if (typeFilter === 'all') return true;
    return e.notification_type === typeFilter;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111] p-6 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Bell className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Notification Command Center</h1>
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                Frosty-Grade Engine
              </span>
            </div>
            <p className="text-gray-400 text-sm mt-1">
              Automated order status push alerts, smart re-engagement campaigns, and device token lifecycle.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAnalyticsAndTemplates}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111] p-5 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-medium">Total Alerts Sent</span>
            <h3 className="text-2xl font-black text-white">{analytics?.totalSent || 0}</h3>
          </div>
        </div>

        <div className="bg-[#111] p-5 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-medium">Active Devices</span>
            <h3 className="text-2xl font-black text-white">{analytics?.activeTokens || 0}</h3>
          </div>
        </div>

        <div className="bg-[#111] p-5 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-medium">Open & CTR Rate</span>
            <h3 className="text-2xl font-black text-white">{analytics?.openRate || '0%'}</h3>
          </div>
        </div>

        <div className="bg-[#111] p-5 rounded-2xl border border-white/10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-gray-400 font-medium">Re-Engagements</span>
            <h3 className="text-2xl font-black text-white">{analytics?.typeBreakdown?.reengagement || 0}</h3>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 overflow-x-auto custom-scrollbar">
        {[
          { id: 'overview', label: 'Live Events & Feed', icon: Zap },
          { id: 'campaigns', label: 'Broadcast Campaigns', icon: Send },
          { id: 'reengagement', label: 'Frosty Re-Engagement', icon: Sparkles },
          { id: 'templates', label: 'Templates & Copy', icon: Edit3 },
          { id: 'simulator', label: 'Sandbox Simulator', icon: Play }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: LIVE EVENTS & AUDIT LOG */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Filter By Type:</span>
              <div className="flex items-center gap-1.5">
                {['all', 'order_status', 'reengagement', 'campaign'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setTypeFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize ${
                      typeFilter === f
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-gray-500">
              Showing {filteredEvents.length} recent notification event(s)
            </span>
          </div>

          <div className="bg-[#111] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
            {filteredEvents.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-500" />
                <p className="text-sm font-bold text-gray-300">No notification events recorded yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  Events will stream here in real-time as customer orders update and campaigns are dispatched.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredEvents.map((evt: any) => (
                  <div key={evt.id} className="p-4 sm:p-5 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 text-lg">
                        {evt.notification_type === 'order_status' ? '📦' : evt.notification_type === 'reengagement' ? '🍰' : '📢'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white">{evt.title}</h4>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
                            {evt.notification_type.replace('_', ' ')}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            evt.status === 'sent' || evt.status === 'delivered'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {evt.status}
                          </span>
                          {evt.opened_at && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                              <Eye className="w-2.5 h-2.5" /> Opened
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 mt-1 leading-relaxed">{evt.body}</p>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                          <span>Key: <code className="text-gray-400">{evt.event_key}</code></span>
                          {evt.order_id && <span>Order: #{evt.order_id}</span>}
                          <span>{new Date(evt.sent_at || evt.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-gray-400 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                        {evt.user_id ? `User: ${evt.user_id.substring(0, 12)}...` : 'Guest Device'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BROADCAST CAMPAIGNS */}
      {activeSubTab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-[#111] p-6 rounded-2xl border border-white/10 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-black text-white">Create Broadcast Campaign</h3>
              <p className="text-xs text-gray-400 mt-1">
                Deliver rich bakery promotions, weekend specials, or coupon alerts straight to customer lock screens.
              </p>
            </div>

            <form onSubmit={handleSendCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Audience Segment
                </label>
                <select
                  value={campaignAudience}
                  onChange={(e) => setCampaignAudience(e.target.value as any)}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Registered Devices & Guests ({analytics?.activeTokens || 0} devices)</option>
                  <option value="active">Active Customers (Last 48 Hours)</option>
                  <option value="inactive_3d">Inactive Customers (3+ Days)</option>
                  <option value="inactive_7d">Dormant Customers (7+ Days)</option>
                  <option value="previous_buyers">Previous Cake & Pastry Buyers</option>
                  <option value="user">Specific User or Guest ID</option>
                </select>
              </div>

              {campaignAudience === 'user' && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Target User ID / Email
                  </label>
                  <input
                    type="text"
                    value={campaignUserId}
                    onChange={(e) => setCampaignUserId(e.target.value)}
                    placeholder="Enter user email or UID"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. Freshly Baked Chef Specials! 🍰"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Message Body
                </label>
                <textarea
                  rows={3}
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  placeholder="Write engaging, mouth-watering bakery copy..."
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Deep Link Route
                </label>
                <input
                  type="text"
                  value={campaignDeepLink}
                  onChange={(e) => setCampaignDeepLink(e.target.value)}
                  placeholder="e.g. / or /menu or /offers"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={campaignSending}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {campaignSending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Dispatch Broadcast Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Live Mobile Lock-screen Preview */}
          <div className="lg:col-span-5 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Real-Time Device Notification Preview
            </h4>

            <div className="bg-[#18181b] border border-white/15 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-gray-400 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <span>Lock Screen Notification</span>
              </div>

              <div className="mt-6 bg-[#27272a]/90 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg">
                <div className="flex items-start gap-3">
                  <img
                    src="/logo.png"
                    alt="Frosty Bite"
                    className="w-10 h-10 rounded-xl object-contain bg-black shrink-0 border border-white/10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-400">FROSTY BITE</span>
                      <span className="text-[10px] text-gray-400">now</span>
                    </div>
                    <h5 className="text-sm font-bold text-white mt-0.5">{campaignTitle || 'Notification Title'}</h5>
                    <p className="text-xs text-gray-300 mt-1 line-clamp-3 leading-relaxed">
                      {campaignMessage || 'Notification message will appear here for customers.'}
                    </p>
                    <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                      <span>Tap to open:</span>
                      <code className="text-amber-400">{campaignDeepLink || '/'}</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-400 space-y-1.5">
                <div className="flex items-center gap-2 text-green-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Opt-out & Quiet Hours Respected</span>
                </div>
                <p className="text-[11px]">
                  Users with quiet hours enabled will not be disturbed. Customers who opted out of promotional push are automatically excluded.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FROSTY-STYLE INACTIVITY RE-ENGAGEMENT ENGINE */}
      {activeSubTab === 'reengagement' && (
        <div className="space-y-8">
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent p-6 rounded-2xl border border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">Automated Customer Re-Engagement Engine</h3>
              </div>
              <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                Periodically identifies customers based on days of inactivity (3, 5, 7, 10, 14, 21 days) and sends warm, tasteful reminders while strictly respecting a 72-hour cooldown and late-night Quiet Hours.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-300 bg-white/5 px-3 py-2 rounded-xl border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reengageDryRun}
                  onChange={(e) => setReengageDryRun(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <span>Dry Run Mode</span>
              </label>

              <button
                onClick={handleTriggerReengagement}
                disabled={reengageLoading}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold py-3 px-5 rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {reengageLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Run Re-Engagement Cycle</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Lifecycle Stages */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { days: '3 Days Inactive', emoji: '🍰', title: 'Something sweet is missing… 🍰', body: 'We think it might be you! Come taste what is freshly baked today.' },
              { days: '5 Days Inactive', emoji: '✨', title: 'Your dessert cravings called ✨', body: 'We answered! Explore our chef special pastries and cakes.' },
              { days: '7 Days Inactive', emoji: '🎂', title: 'It has been a little while! 🎂', body: 'Your next sweet moment is waiting. Grab your favourite slice today.' },
              { days: '10 Days Inactive', emoji: '💕', title: 'No pressure… but your cake misses you 💕', body: 'Treat yourself to something warm and delicious from Frosty Bite.' },
              { days: '14 Days Inactive', emoji: '👀', title: 'We haven’t seen you lately 👀', body: 'Should we tempt you with something delicious today?' },
              { days: '21 Days Inactive', emoji: '🍓', title: 'New cravings unlocked! 🍓', body: 'Come see what is fresh in our bakery ovens this week.' }
            ].map((stage, idx) => (
              <div key={idx} className="bg-[#111] p-5 rounded-2xl border border-white/10 relative overflow-hidden group hover:border-amber-500/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    Stage {idx + 1} • {stage.days}
                  </span>
                  <span className="text-xl">{stage.emoji}</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1.5">{stage.title}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{stage.body}</p>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Cooldown: 72 Hours</span>
                  <span className="text-green-400 font-bold">Active Rule</span>
                </div>
              </div>
            ))}
          </div>

          {/* Re-engagement Run Result Log */}
          {reengageResult && (
            <div className="bg-[#111] p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">Last Re-Engagement Cycle Summary</h4>
                <span className="text-xs text-gray-400">Processed: {reengageResult.processedCount} users</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-xl bg-white/5">
                  <span className="text-xs text-gray-400">Pushes Sent</span>
                  <p className="text-xl font-bold text-green-400">{reengageResult.sentCount || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5">
                  <span className="text-xs text-gray-400">Skipped (Cooldown)</span>
                  <p className="text-xl font-bold text-amber-400">{reengageResult.skippedCooldown || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5">
                  <span className="text-xs text-gray-400">Skipped (Quiet Hours)</span>
                  <p className="text-xl font-bold text-purple-400">{reengageResult.skippedQuietHours || 0}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TEMPLATES & BRAND COPY */}
      {activeSubTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Notification Templates</h3>
              <p className="text-xs text-gray-400 mt-1">
                Customize titles, messages, and placeholders (<code>{'{{order_id}}'}</code>, <code>{'{{customer_name}}'}</code>, <code>{'{{reason}}'}</code>, <code>{'{{amount}}'}</code>).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => {
              const isEditing = editingTemplate?.id === tpl.id;
              return (
                <div key={tpl.id} className="bg-[#111] p-5 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      {tpl.notification_type}
                    </span>
                    {!isEditing && (
                      <button
                        onClick={() => setEditingTemplate(tpl)}
                        className="text-xs text-gray-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-[10px] text-gray-400 font-bold uppercase">Title Template</label>
                        <input
                          type="text"
                          value={editingTemplate.title_template}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, title_template: e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-bold uppercase">Body Template</label>
                        <textarea
                          rows={2}
                          value={editingTemplate.body_template}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, body_template: e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 mt-1 resize-none"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          onClick={() => setEditingTemplate(null)}
                          className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveTemplate(tpl.notification_type, editingTemplate)}
                          className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-1.5 rounded-lg shadow transition-all"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-sm font-bold text-white">{tpl.title_template}</h4>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{tpl.body_template}</p>
                      {tpl.deep_link && (
                        <span className="text-[10px] text-gray-500 mt-2 block">
                          Link: <code>{tpl.deep_link}</code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: SANDBOX SIMULATOR & TEST TOOLS */}
      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-[#111] p-6 rounded-2xl border border-white/10 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-black text-white">Order Status Transition Sandbox</h3>
              <p className="text-xs text-gray-400 mt-1">
                Simulate any order transition (e.g. Preparing → Out for Delivery → Delivered) to test end-to-end device delivery and deep linking.
              </p>
            </div>

            <form onSubmit={handleSimulateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Order ID
                </label>
                <input
                  type="text"
                  value={simOrderId}
                  onChange={(e) => setSimOrderId(e.target.value)}
                  placeholder="e.g. ORD-12345"
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Target Status Transition
                </label>
                <select
                  value={simStatus}
                  onChange={(e) => setSimStatus(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="confirmed">1. Confirmed (Order Accepted 🍰)</option>
                  <option value="preparing">2. Preparing (In the Oven 👨‍🍳)</option>
                  <option value="almost_ready">3. Almost Ready (Final Touches ✨)</option>
                  <option value="ready">4. Ready for Pickup 🎂</option>
                  <option value="out_for_delivery">5. Out for Delivery 🛵</option>
                  <option value="near_you">6. Near You / Almost There 📍</option>
                  <option value="delivered">7. Delivered 🤍</option>
                  <option value="cancelled">8. Cancelled ❌</option>
                  <option value="refund">9. Refund Initiated 💳</option>
                </select>
              </div>

              {simStatus === 'cancelled' && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Cancellation Reason
                  </label>
                  <input
                    type="text"
                    value={simReason}
                    onChange={(e) => setSimReason(e.target.value)}
                    placeholder="e.g. Delivery zone weather delay"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={simSimulating}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {simSimulating ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Fire Simulated Status Push</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 bg-[#111] p-6 rounded-2xl border border-white/10 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-black text-white">Browser Push Diagnostic</h3>
              <p className="text-xs text-gray-400 mt-1">
                Check whether your current admin device is subscribed to background push messages.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Notification Permission:</span>
                  <span className={`font-bold uppercase ${
                    typeof window !== 'undefined' && window.Notification?.permission === 'granted'
                      ? 'text-green-400'
                      : 'text-amber-400'
                  }`}>
                    {typeof window !== 'undefined' ? window.Notification?.permission || 'Unsupported' : 'Unsupported'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Service Worker Ready:</span>
                  <span className="text-green-400 font-bold">
                    {typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'Active & Registered' : 'No'}
                  </span>
                </div>
              </div>

              <button
                onClick={async () => {
                  try {
                    const token = await requestForToken('admin_tester');
                    if (token) {
                      toast.success('Admin device push token refreshed and active!', { icon: '🔔' });
                    }
                  } catch (e: any) {
                    toast.error(e.message || 'Permission request error');
                  }
                }}
                className="w-full bg-white/10 hover:bg-white/15 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Register / Test Admin Device Token</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default NotificationCenter;
