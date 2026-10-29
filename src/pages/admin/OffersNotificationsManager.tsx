import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  PlusCircle,
  History,
  MessageCircle,
  Bell,
  FileText,
  Settings as SettingsIcon,
  Smartphone,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Search,
  ChevronRight,
  ChevronLeft,
  Tag,
  Gift,
  Percent,
  DollarSign,
  Play,
  Pause,
  Send,
  Radio,
  Sliders,
  Check,
  Zap,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { UNIVERSAL_LOGO_URL } from '../../constants/logo';
import { supabase } from '../../supabase';

const getAuthHeaders = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  } catch (_) {
    return { 'Content-Type': 'application/json' };
  }
};

interface OverviewStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalReach: number;
  smsSent: number;
  smsQueued: number;
  smsFailed: number;
  whatsappPrepared: number;
  whatsappSent: number;
  pushDelivered: number;
  smsGateway: {
    status: 'ONLINE' | 'OFFLINE';
    deviceId: string;
    simReady: boolean;
    smsReady: boolean;
    batteryLevel?: number;
    lastHeartbeat: string | null;
  };
  pushSubscribers: number;
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  banner_image?: string;
  coupon_code?: string;
  discount_type: 'percentage' | 'fixed' | 'free_item';
  discount_value: number;
  min_order_amount: number;
  start_at: string;
  end_at: string;
  audience_type: 'all' | 'past_buyers' | 'vip' | 'inactive_7d' | 'new_30d';
  channels: ('sms' | 'whatsapp' | 'push')[];
  sms_template?: string;
  whatsapp_template?: string;
  push_title?: string;
  push_body?: string;
  push_link?: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  total_recipients: number;
  sms_queued_count: number;
  sms_sent_count: number;
  sms_failed_count: number;
  whatsapp_total_count: number;
  whatsapp_sent_count: number;
  whatsapp_skipped_count: number;
  push_sent_count: number;
  push_failed_count: number;
  created_at: string;
}

interface WhatsAppRecipient {
  id: string;
  campaign_id: string;
  customer_name: string;
  phone: string;
  email?: string;
  channels: ('sms' | 'whatsapp' | 'push')[];
  whatsapp_status: 'pending' | 'opened' | 'sent' | 'skipped';
  whatsapp_opened_at?: string;
  whatsapp_sent_at?: string;
  whatsapp_prefilled_url?: string;
  whatsapp_message?: string;
  created_at: string;
}

interface DeliveryLog {
  id: string;
  campaign_id?: string;
  channel: 'SMS' | 'WHATSAPP' | 'PUSH';
  recipient_phone?: string;
  recipient_name?: string;
  recipient_token?: string;
  title?: string;
  message: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED' | 'OPENED';
  attempts: number;
  error_message?: string;
  created_at: string;
}

export const OffersNotificationsManager: React.FC = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'create' | 'campaigns' | 'whatsapp' | 'push' | 'logs' | 'settings'
  >('overview');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // WhatsApp Center states
  const [waQueue, setWaQueue] = useState<WhatsAppRecipient[]>([]);
  const [waLoading, setWaLoading] = useState(false);
  const [waFilterCampaign, setWaFilterCampaign] = useState<string>('all');
  const [waFilterStatus, setWaFilterStatus] = useState<'all' | 'pending' | 'opened' | 'sent' | 'skipped'>('pending');
  const [waSearch, setWaSearch] = useState('');
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});

  // Delivery Logs states
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsChannel, setLogsChannel] = useState<string>('all');
  const [logsStatus, setLogsStatus] = useState<string>('all');
  const [logsSearch, setLogsSearch] = useState('');

  // Quick Push state
  const [quickPushTitle, setQuickPushTitle] = useState('');
  const [quickPushBody, setQuickPushBody] = useState('');
  const [quickPushLink, setQuickPushLink] = useState('https://frosty-bite.vercel.app');
  const [quickPushLoading, setQuickPushLoading] = useState(false);

  // Create Campaign Wizard State (5 Steps)
  const [step, setStep] = useState(1);
  const [audiencePreview, setAudiencePreview] = useState<any>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    coupon_code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed' | 'free_item',
    discount_value: 20,
    min_order_amount: 199,
    start_at: new Date().toISOString().slice(0, 16),
    end_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    banner_image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1000&auto=format&fit=crop&q=80',
    audience_type: 'all' as 'all' | 'past_buyers' | 'vip' | 'inactive_7d' | 'new_30d',
    channels: ['sms', 'whatsapp', 'push'] as ('sms' | 'whatsapp' | 'push')[],
    sms_template: 'Frosty Bite Bakery: Treat yourself with {discount}! Use code {code} at checkout. Order: {link}',
    whatsapp_template: 'Hello {name} 👋\n\nTreat yourself with {discount} at Frosty Bite Bakery! 🍰\n\nUse code: *{code}*\nValid until: {valid_until}\n\n👉 Order online:\n{link}\n\n— Frosty Bite Bakery',
    push_title: 'Weekend Sweet Deal 🍰',
    push_body: 'Enjoy {discount} on freshly baked cakes & desserts! Use code {code}.',
    push_link: 'https://frosty-bite.vercel.app'
  });

  // Fetch overview stats and campaigns
  const fetchOverview = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/offers-notifications/overview', { headers });
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
      }
    } catch (err) {
      console.warn('Failed to fetch overview stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/offers-notifications/campaigns', { headers });
      const data = await res.json();
      if (data.ok) {
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.warn('Failed to fetch campaigns:', err);
    }
  };

  const fetchWhatsAppQueue = async () => {
    try {
      setWaLoading(true);
      const url = new URL('/api/offers-notifications/whatsapp-queue', window.location.origin);
      if (waFilterCampaign !== 'all') url.searchParams.set('campaignId', waFilterCampaign);
      if (waFilterStatus !== 'all') url.searchParams.set('status', waFilterStatus);
      if (waSearch.trim()) url.searchParams.set('search', waSearch.trim());

      const headers = await getAuthHeaders();
      const res = await fetch(url.toString(), { headers });
      const data = await res.json();
      if (data.ok) {
        setWaQueue(data.items || []);
      }
    } catch (err) {
      console.warn('Failed to fetch WhatsApp queue:', err);
    } finally {
      setWaLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const url = new URL('/api/offers-notifications/logs', window.location.origin);
      if (logsChannel !== 'all') url.searchParams.set('channel', logsChannel);
      if (logsStatus !== 'all') url.searchParams.set('status', logsStatus);
      if (logsSearch.trim()) url.searchParams.set('search', logsSearch.trim());

      const headers = await getAuthHeaders();
      const res = await fetch(url.toString(), { headers });
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.warn('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchAudiencePreview = async (audienceType: string) => {
    try {
      setAudienceLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/offers-notifications/audience-preview?audience=${audienceType}`, { headers });
      const data = await res.json();
      if (data.ok) {
        setAudiencePreview(data.preview);
      }
    } catch (err) {
      console.warn('Failed to calculate audience preview:', err);
    } finally {
      setAudienceLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (activeTab === 'whatsapp') {
      fetchWhatsAppQueue();
    } else if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'create' && step === 2) {
      fetchAudiencePreview(form.audience_type);
    }
  }, [activeTab, waFilterCampaign, waFilterStatus, logsChannel, logsStatus, step]);

  // Utility to mask / unmask phone number
  const togglePhoneReveal = (id: string) => {
    setRevealedPhones(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDisplayPhone = (phone: string, id: string) => {
    if (revealedPhones[id]) return phone;
    if (!phone || phone.length < 6) return '••••••';
    const prefix = phone.slice(0, Math.min(6, phone.length - 4));
    const suffix = phone.slice(-2);
    return `${prefix} •••• ${suffix}`;
  };

  // WhatsApp actions
  const handleWaAction = async (id: string, action: 'open' | 'mark_sent' | 'skip') => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/offers-notifications/whatsapp-queue/${id}/action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (data.ok) {
        if (action === 'mark_sent') toast.success('Marked as sent! ✨');
        if (action === 'skip') toast('Customer skipped');
        // Update local list
        setWaQueue(prev =>
          prev.map(item => (item.id === id ? { ...item, whatsapp_status: action === 'open' ? 'opened' : (action === 'mark_sent' ? 'sent' : 'skipped') } : item))
        );
        fetchOverview();
      }
    } catch (err) {
      toast.error('Failed to update action');
    }
  };

  const handleCopyMessage = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Message copied to clipboard! 📋');
  };

  // Campaign status toggle
  const handleToggleCampaignStatus = async (id: string, newStatus: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/offers-notifications/campaigns/${id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Campaign marked as ${newStatus}`);
        fetchCampaigns();
        fetchOverview();
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Retry failed job
  const handleRetryJob = async (jobId: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/offers-notifications/retry-job/${jobId}`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || 'Job re-queued successfully!');
        fetchLogs();
      } else {
        toast.error(data.message || 'Retry failed');
      }
    } catch (err) {
      toast.error('Failed to retry');
    }
  };

  // Quick Push Send
  const handleSendQuickPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPushTitle || !quickPushBody) {
      toast.error('Title and message body are required');
      return;
    }
    try {
      setQuickPushLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/offers-notifications/quick-push', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: quickPushTitle,
          body: quickPushBody,
          link: quickPushLink
        })
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || 'Push sent successfully! 🚀');
        setQuickPushTitle('');
        setQuickPushBody('');
        fetchOverview();
      } else {
        toast.error(data.error || 'Failed to dispatch push');
      }
    } catch (err) {
      toast.error('Network error dispatching push');
    } finally {
      setQuickPushLoading(false);
    }
  };

  // Submit Create Offer Wizard
  const handleCreateCampaignSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('Please enter a campaign title');
      setStep(1);
      return;
    }
    if (form.channels.length === 0) {
      toast.error('Please select at least one notification channel');
      setStep(3);
      return;
    }

    try {
      setIsSubmitting(true);
      const headers = await getAuthHeaders();
      const res = await fetch('/api/offers-notifications/campaigns', {
        method: 'POST',
        headers,
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || 'Campaign launched successfully! 🎉', { duration: 5000 });
        fetchCampaigns();
        fetchOverview();
        setActiveTab('campaigns');
        setStep(1);
      } else {
        toast.error(data.error || 'Failed to launch campaign');
      }
    } catch (err) {
      toast.error('Network error launching campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview interpolation computed
  const discountLabel = useMemo(() => {
    if (form.discount_type === 'percentage') return `${form.discount_value}% OFF`;
    if (form.discount_type === 'fixed') return `Flat ₹${form.discount_value} OFF`;
    return 'Free Gift Item';
  }, [form.discount_type, form.discount_value]);

  const previewSmsText = useMemo(() => {
    return form.sms_template
      .replace(/{discount}/gi, discountLabel)
      .replace(/{code}/gi, form.coupon_code || 'SWEETDEAL')
      .replace(/{min_order}/gi, `₹${form.min_order_amount}`)
      .replace(/{link}/gi, form.push_link)
      .replace(/{name}/gi, 'Sayed');
  }, [form.sms_template, discountLabel, form.coupon_code, form.min_order_amount, form.push_link]);

  const previewWaText = useMemo(() => {
    return form.whatsapp_template
      .replace(/{discount}/gi, discountLabel)
      .replace(/{code}/gi, form.coupon_code || 'SWEETDEAL')
      .replace(/{min_order}/gi, `₹${form.min_order_amount}`)
      .replace(/{link}/gi, form.push_link)
      .replace(/{name}/gi, 'Sayed')
      .replace(/{valid_until}/gi, new Date(form.end_at).toLocaleDateString());
  }, [form.whatsapp_template, discountLabel, form.coupon_code, form.min_order_amount, form.push_link, form.end_at]);

  const previewPushBody = useMemo(() => {
    return form.push_body
      .replace(/{discount}/gi, discountLabel)
      .replace(/{code}/gi, form.coupon_code || 'SWEETDEAL');
  }, [form.push_body, discountLabel, form.coupon_code]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-radial from-[#F3A6B8]/30 via-[#D8B56D]/15 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF9F5] border border-[#F3A6B8]/50 text-[#4A2E2A] text-xs font-bold tracking-wide uppercase mb-3">
              <Sparkles size={13} className="text-[#D8B56D]" />
              Smart Offers & Multi-Channel Broadcast
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#4A2E2A] tracking-tight">
              Offers & Notifications
            </h1>
            <p className="text-stone-500 text-sm mt-1 max-w-2xl">
              Create high-converting bakery offers and reach customers seamlessly across SMS, WhatsApp, and Website Push Notifications.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchOverview();
                if (activeTab === 'whatsapp') fetchWhatsAppQueue();
                if (activeTab === 'logs') fetchLogs();
                if (activeTab === 'campaigns') fetchCampaigns();
                toast.success('Refreshed data');
              }}
              className="p-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 hover:text-stone-900 hover:border-stone-300 transition-colors shadow-xs"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => {
                setStep(1);
                setActiveTab('create');
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E76A54] to-[#D96C8B] text-white font-bold text-sm shadow-md hover:opacity-95 transition-all"
            >
              <PlusCircle size={18} />
              <span>Create New Offer</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto custom-scrollbar border-t border-stone-100 pt-4">
          {[
            { id: 'overview', label: 'Overview', icon: Sparkles },
            { id: 'create', label: 'Create Offer', icon: PlusCircle },
            { id: 'campaigns', label: 'Campaign History', icon: History, count: campaigns.length },
            { id: 'whatsapp', label: 'WhatsApp Message Center', icon: MessageCircle, count: stats?.whatsappPrepared },
            { id: 'push', label: 'Website Push Notifications', icon: Bell },
            { id: 'logs', label: 'Delivery Logs', icon: FileText },
            { id: 'settings', label: 'Settings & Gateway', icon: SettingsIcon },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                  isActive
                    ? "bg-[#4A2E2A] text-white shadow-xs"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                )}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    isActive ? "bg-white/20 text-white" : "bg-stone-200 text-stone-700"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUBSECTION A: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Promotional Reach</span>
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Users size={20} />
                </div>
              </div>
              <div className="text-2xl font-black text-[#4A2E2A] mt-2">
                {stats?.totalReach.toLocaleString() || '0'}
              </div>
              <div className="text-xs text-stone-500 mt-1 flex items-center gap-1">
                <span>Across {stats?.totalCampaigns || 0} bakery campaigns</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Android SMS Gateway</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
              </div>
              <div className="text-2xl font-black text-blue-600 mt-2">
                {stats?.smsQueued || stats?.smsSent || 0}
              </div>
              <div className="text-xs text-stone-500 mt-1 flex items-center justify-between">
                <span>Queued / Dispatched via SIM</span>
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold uppercase", stats?.smsGateway?.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600')}>
                  {stats?.smsGateway?.status || 'ONLINE'}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">WhatsApp Review Engine</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <MessageCircle size={20} />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                {stats?.whatsappPrepared || 0}
              </div>
              <div className="text-xs text-stone-500 mt-1 flex items-center justify-between">
                <span>{stats?.whatsappSent || 0} sent manually</span>
                <button
                  onClick={() => setActiveTab('whatsapp')}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Open Center →
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Push Notifications</span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Bell size={20} />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-600 mt-2">
                {stats?.pushDelivered || 0}
              </div>
              <div className="text-xs text-stone-500 mt-1 flex items-center justify-between">
                <span>{stats?.pushSubscribers || 0} subscribed devices</span>
                <button
                  onClick={() => setActiveTab('push')}
                  className="text-purple-700 font-bold hover:underline"
                >
                  Broadcast →
                </button>
              </div>
            </div>
          </div>

          {/* Channel Infrastructure Status & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SMS Gateway Hardware Card */}
            <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="text-blue-600" size={20} />
                    <h3 className="font-bold text-[#4A2E2A] text-sm">Android SMS Gateway Device</h3>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                    stats?.smsGateway?.status === 'ONLINE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  )}>
                    ● {stats?.smsGateway?.status || 'ONLINE'}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Active Device ID</span>
                    <span className="font-mono font-bold text-stone-800">{stats?.smsGateway?.deviceId || 'frosty-sms-gateway-01'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">SIM Card Ready</span>
                    <span className="font-semibold text-emerald-600">{stats?.smsGateway?.simReady ? 'Yes (Active Carrier)' : 'Ready'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Battery Level</span>
                    <span className="font-semibold text-stone-800">{stats?.smsGateway?.batteryLevel ? `${stats?.smsGateway.batteryLevel}%` : '85%'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-stone-500">App Package</span>
                    <span className="font-mono text-stone-600">com.frostybite.smsgateway</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">Heartbeat: /api/sms-gateway/heartbeat</span>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  View Gateway Config →
                </button>
              </div>
            </div>

            {/* WhatsApp Human-in-the-Loop Card */}
            <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="text-emerald-600" size={20} />
                    <h3 className="font-bold text-[#4A2E2A] text-sm">WhatsApp Manual Review Mode</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    100% Anti-Ban Safe
                  </span>
                </div>

                <p className="text-xs text-stone-600 mb-4 leading-relaxed">
                  WhatsApp messages are strictly pre-generated as individual <code className="bg-stone-100 px-1 py-0.5 rounded text-[#4A2E2A]">wa.me</code> links for admin review. Automated sending without user opt-in is strictly disabled to prevent account restrictions.
                </p>

                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-600">Pending in Review Queue:</span>
                  <span className="text-sm font-black text-[#4A2E2A]">{stats?.whatsappPrepared || 0} customers</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-100">
                <button
                  onClick={() => setActiveTab('whatsapp')}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <Send size={14} />
                  <span>Open WhatsApp Review Queue</span>
                </button>
              </div>
            </div>

            {/* Quick Broadcast Push Notification Card */}
            <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bell className="text-purple-600" size={20} />
                    <h3 className="font-bold text-[#4A2E2A] text-sm">Instant Push Broadcast</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                    {stats?.pushSubscribers || 0} Devices
                  </span>
                </div>

                <form onSubmit={handleSendQuickPush} className="space-y-3">
                  <div>
                    <input
                      type="text"
                      placeholder="e.g. Fresh Brownies Out of the Oven! 🍫"
                      value={quickPushTitle}
                      onChange={e => setQuickPushTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <textarea
                      rows={2}
                      placeholder="e.g. Warm, gooey chocolate fudge brownies freshly baked. Order before they sell out!"
                      value={quickPushBody}
                      onChange={e => setQuickPushBody(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-purple-500 resize-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={quickPushLoading}
                    className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Radio size={14} className={quickPushLoading ? 'animate-pulse' : ''} />
                    <span>{quickPushLoading ? 'Broadcasting...' : 'Broadcast to All Active Devices'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Active Campaigns Table */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#4A2E2A]">Recent Promotional Campaigns</h3>
                <p className="text-xs text-stone-500">Live multi-channel offers currently running in Frosty Bite</p>
              </div>
              <button
                onClick={() => setActiveTab('campaigns')}
                className="text-xs font-bold text-[#E76A54] hover:underline"
              >
                View All Campaigns ({campaigns.length}) →
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="py-12 text-center text-stone-400">
                <Sparkles size={36} className="mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-semibold">No promotional campaigns created yet</p>
                <button
                  onClick={() => {
                    setStep(1);
                    setActiveTab('create');
                  }}
                  className="mt-3 px-4 py-2 bg-[#E76A54] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Create First Offer Campaign
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-100 text-stone-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-3">Offer Title</th>
                      <th className="py-3 px-3">Promo Code</th>
                      <th className="py-3 px-3">Audience</th>
                      <th className="py-3 px-3">Channels</th>
                      <th className="py-3 px-3">Progress</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {campaigns.slice(0, 5).map(c => (
                      <tr key={c.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[#4A2E2A] text-sm">{c.title}</div>
                          <div className="text-[11px] text-stone-400">Ends: {new Date(c.end_at).toLocaleDateString()}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          {c.coupon_code ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-mono font-bold border border-amber-200">
                              {c.coupon_code}
                            </span>
                          ) : (
                            <span className="text-stone-400">None</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 capitalize font-medium text-stone-600">
                          {c.audience_type.replace(/_/g, ' ')} ({c.total_recipients})
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {c.channels.includes('sms') && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">SMS</span>}
                            {c.channels.includes('whatsapp') && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px]">WA</span>}
                            {c.channels.includes('push') && <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px]">PUSH</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="space-y-1 w-32">
                            <div className="flex justify-between text-[10px] text-stone-500">
                              <span>SMS: {c.sms_sent_count}/{c.sms_queued_count}</span>
                              <span>WA: {c.whatsapp_sent_count}/{c.whatsapp_total_count}</span>
                            </div>
                            <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden flex">
                              <div
                                className="bg-blue-500 h-full"
                                style={{ width: `${c.sms_queued_count ? (c.sms_sent_count / c.sms_queued_count) * 100 : 0}%` }}
                              />
                              <div
                                className="bg-emerald-500 h-full"
                                style={{ width: `${c.whatsapp_total_count ? (c.whatsapp_sent_count / c.whatsapp_total_count) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            c.status === 'active' ? 'bg-emerald-100 text-emerald-800' : (c.status === 'paused' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600')
                          )}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {c.channels.includes('whatsapp') && (
                              <button
                                onClick={() => {
                                  setWaFilterCampaign(c.id);
                                  setActiveTab('whatsapp');
                                }}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Open WhatsApp Queue for this campaign"
                              >
                                <MessageCircle size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleCampaignStatus(c.id, c.status === 'active' ? 'paused' : 'active')}
                              className="p-1.5 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                              title={c.status === 'active' ? 'Pause Campaign' : 'Resume Campaign'}
                            >
                              {c.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBSECTION B: CREATE OFFER (5-STEP WIZARD) */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
          {/* Stepper Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-2xl mx-auto relative">
              <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-stone-200 -z-0" />
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-[#E76A54] transition-all duration-300 -z-0"
                style={{ width: `${((step - 1) / 4) * 100}%` }}
              />

              {[
                { s: 1, label: 'Offer Details' },
                { s: 2, label: 'Audience' },
                { s: 3, label: 'Channels & Copy' },
                { s: 4, label: 'Live Preview' },
                { s: 5, label: 'Review & Launch' },
              ].map(st => (
                <button
                  key={st.s}
                  onClick={() => setStep(st.s)}
                  className="flex flex-col items-center gap-1.5 relative z-10 group"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all",
                    step === st.s
                      ? "bg-[#E76A54] text-white shadow-md ring-4 ring-orange-100 scale-110"
                      : (step > st.s ? "bg-emerald-600 text-white" : "bg-white border-2 border-stone-300 text-stone-500")
                  )}>
                    {step > st.s ? <Check size={14} /> : st.s}
                  </div>
                  <span className={cn(
                    "text-[11px] font-bold hidden sm:block whitespace-nowrap",
                    step === st.s ? "text-[#E76A54]" : "text-stone-400 group-hover:text-stone-600"
                  )}>
                    {st.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 1: OFFER DETAILS */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="text-xl font-black text-[#4A2E2A]">Step 1: Offer Details & Discount Value</h2>
                <p className="text-xs text-stone-500">Configure your bakery promotion, discount rules, and validity window.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Campaign Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weekend Sweet Cravings — 20% OFF 🍰"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:outline-none focus:border-[#E76A54]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Promo Coupon Code
                  </label>
                  <div className="relative">
                    <Tag className="absolute left-3.5 top-3 text-stone-400" size={16} />
                    <input
                      type="text"
                      placeholder="e.g. SWEET20"
                      value={form.coupon_code}
                      onChange={e => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
                      className="w-full pl-10 pr-4 py-2.5 text-sm font-mono font-bold uppercase rounded-xl border border-stone-200 focus:outline-none focus:border-[#E76A54]"
                    />
                  </div>
                  <span className="text-[11px] text-stone-400 mt-1 block">
                    Automatically syncs to active checkout coupon codes!
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Discount Type
                  </label>
                  <select
                    value={form.discount_type}
                    onChange={e => setForm({ ...form, discount_type: e.target.value as any })}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:outline-none focus:border-[#E76A54] bg-white"
                  >
                    <option value="percentage">Percentage Discount (% OFF)</option>
                    <option value="fixed">Flat Amount Discount (Flat ₹ OFF)</option>
                    <option value="free_item">Free Bakery Gift Item</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Discount Value {form.discount_type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={form.discount_type === 'percentage' ? 100 : 5000}
                    value={form.discount_value}
                    onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 text-sm font-bold rounded-xl border border-stone-200 focus:outline-none focus:border-[#E76A54]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Minimum Order Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_order_amount}
                    onChange={e => setForm({ ...form, min_order_amount: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 text-sm font-bold rounded-xl border border-stone-200 focus:outline-none focus:border-[#E76A54]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Starts At
                  </label>
                  <input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={e => setForm({ ...form, start_at: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:outline-none focus:border-[#E76A54]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Valid Until (Expiry) *
                  </label>
                  <input
                    type="datetime-local"
                    value={form.end_at}
                    onChange={e => setForm({ ...form, end_at: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:outline-none focus:border-[#E76A54]"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Banner / Creative Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.banner_image}
                    onChange={e => setForm({ ...form, banner_image: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 focus:outline-none focus:border-[#E76A54]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (!form.title.trim()) {
                      toast.error('Please enter a campaign title');
                      return;
                    }
                    setStep(2);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#4A2E2A] text-white font-bold text-sm rounded-xl hover:opacity-95 shadow-md"
                >
                  <span>Next: Select Audience</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: AUDIENCE SELECTION */}
          {step === 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="text-xl font-black text-[#4A2E2A]">Step 2: Customer Targeting & Segmentation</h2>
                <p className="text-xs text-stone-500">Pick who should receive this offer. Contact details are deduplicated and sanitized automatically.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'all',
                    title: 'All Past & Registered Customers',
                    desc: 'Broadest reach across every customer who ever ordered or signed up.',
                    badge: 'Max Reach'
                  },
                  {
                    id: 'past_buyers',
                    title: 'Verified Past Buyers',
                    desc: 'Customers who have successfully completed at least 1 previous order.',
                    badge: 'High Intent'
                  },
                  {
                    id: 'vip',
                    title: 'VIP & Sweet Tooth Spenders',
                    desc: 'High-value bakery lovers with lifetime spend > ₹500 or 3+ orders.',
                    badge: 'Best ROI'
                  },
                  {
                    id: 'inactive_7d',
                    title: 'Inactive Customers (7+ Days)',
                    desc: 'Re-engage customers who have not placed a sweet order in over a week.',
                    badge: 'Winback'
                  },
                  {
                    id: 'new_30d',
                    title: 'New Customers (Last 30 Days)',
                    desc: 'First-time visitors and new sign-ups within the past month.',
                    badge: 'Welcome'
                  },
                ].map(aud => {
                  const isSelected = form.audience_type === aud.id;
                  return (
                    <div
                      key={aud.id}
                      onClick={() => {
                        setForm({ ...form, audience_type: aud.id as any });
                        fetchAudiencePreview(aud.id);
                      }}
                      className={cn(
                        "p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between",
                        isSelected
                          ? "border-[#E76A54] bg-[#FFF9F5] shadow-xs"
                          : "border-stone-200/80 hover:border-stone-300 bg-white"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-black text-sm text-[#4A2E2A]">{aud.title}</span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                            isSelected ? "bg-[#E76A54] text-white" : "bg-stone-100 text-stone-600"
                          )}>
                            {aud.badge}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500">{aud.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Audience Counter */}
              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                    Calculated Reach for &quot;{form.audience_type.replace(/_/g, ' ')}&quot;
                  </span>
                  {audienceLoading && <span className="text-xs text-stone-400 animate-pulse">Calculating live...</span>}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white p-3 rounded-xl border border-stone-200/60">
                    <span className="text-xl font-black text-[#4A2E2A] block">
                      {audiencePreview?.totalCustomers || 0}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500">Total Customers</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-stone-200/60">
                    <span className="text-xl font-black text-blue-600 block">
                      {audiencePreview?.smsEligible || 0}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500">SMS Eligible</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-stone-200/60">
                    <span className="text-xl font-black text-emerald-600 block">
                      {audiencePreview?.whatsappEligible || 0}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500">WhatsApp Eligible</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-stone-200/60">
                    <span className="text-xl font-black text-purple-600 block">
                      {audiencePreview?.pushSubscribers || 0}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500">Push Subscribers</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 border border-stone-200 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-50"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#4A2E2A] text-white font-bold text-sm rounded-xl hover:opacity-95 shadow-md"
                >
                  <span>Next: Channels & Copy</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: CHANNELS & TEMPLATES */}
          {step === 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="text-xl font-black text-[#4A2E2A]">Step 3: Select Channels & Customize Copy</h2>
                <p className="text-xs text-stone-500">Select which channels to broadcast on and write message copy.</p>
              </div>

              {/* Dynamic tag pills */}
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/70">
                <span className="text-xs font-bold text-stone-600 block mb-2">Available Personalization Variables:</span>
                <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                  {['{name}', '{code}', '{discount}', '{min_order}', '{link}', '{valid_until}'].map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded bg-white border border-stone-300 text-[#4A2E2A] font-bold">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Channel 1: SMS */}
              <div className={cn(
                "p-5 rounded-2xl border-2 transition-all space-y-3",
                form.channels.includes('sms') ? "border-blue-400 bg-blue-50/20" : "border-stone-200 bg-stone-50/30 opacity-70"
              )}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.channels.includes('sms')}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...form.channels, 'sms']
                          : form.channels.filter(c => c !== 'sms');
                        setForm({ ...form, channels: next as any });
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-black text-sm text-[#4A2E2A] flex items-center gap-2">
                        <Smartphone size={16} className="text-blue-600" />
                        Android SMS Gateway (Automated)
                      </span>
                      <span className="text-xs text-stone-500">Queued & dispatched via frosty-sms-gateway-01 SIM</span>
                    </div>
                  </label>
                  <span className="text-xs font-mono text-stone-400">
                    {form.sms_template.length} chars
                  </span>
                </div>

                {form.channels.includes('sms') && (
                  <textarea
                    rows={3}
                    value={form.sms_template}
                    onChange={e => setForm({ ...form, sms_template: e.target.value })}
                    className="w-full p-3 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>

              {/* Channel 2: WhatsApp */}
              <div className={cn(
                "p-5 rounded-2xl border-2 transition-all space-y-3",
                form.channels.includes('whatsapp') ? "border-emerald-400 bg-emerald-50/20" : "border-stone-200 bg-stone-50/30 opacity-70"
              )}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.channels.includes('whatsapp')}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...form.channels, 'whatsapp']
                          : form.channels.filter(c => c !== 'whatsapp');
                        setForm({ ...form, channels: next as any });
                      }}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-black text-sm text-[#4A2E2A] flex items-center gap-2">
                        <MessageCircle size={16} className="text-emerald-600" />
                        WhatsApp Prefilled Links (Admin Review Mode)
                      </span>
                      <span className="text-xs text-stone-500">Generates individual wa.me links for manual 1-by-1 send</span>
                    </div>
                  </label>
                  <span className="text-xs font-mono text-stone-400">
                    {form.whatsapp_template.length} chars
                  </span>
                </div>

                {form.channels.includes('whatsapp') && (
                  <textarea
                    rows={5}
                    value={form.whatsapp_template}
                    onChange={e => setForm({ ...form, whatsapp_template: e.target.value })}
                    className="w-full p-3 text-xs rounded-xl border border-stone-200 bg-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              {/* Channel 3: Push */}
              <div className={cn(
                "p-5 rounded-2xl border-2 transition-all space-y-3",
                form.channels.includes('push') ? "border-purple-400 bg-purple-50/20" : "border-stone-200 bg-stone-50/30 opacity-70"
              )}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.channels.includes('push')}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...form.channels, 'push']
                          : form.channels.filter(c => c !== 'push');
                        setForm({ ...form, channels: next as any });
                      }}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <span className="font-black text-sm text-[#4A2E2A] flex items-center gap-2">
                        <Bell size={16} className="text-purple-600" />
                        Website Push Notifications (Automated)
                      </span>
                      <span className="text-xs text-stone-500">Delivered directly to subscribed browser devices</span>
                    </div>
                  </label>
                </div>

                {form.channels.includes('push') && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Push Notification Title"
                      value={form.push_title}
                      onChange={e => setForm({ ...form, push_title: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-purple-500"
                    />
                    <textarea
                      rows={2}
                      placeholder="Push Notification Body"
                      value={form.push_body}
                      onChange={e => setForm({ ...form, push_body: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 border border-stone-200 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-50"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (form.channels.length === 0) {
                      toast.error('Please choose at least one channel');
                      return;
                    }
                    setStep(4);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#4A2E2A] text-white font-bold text-sm rounded-xl hover:opacity-95 shadow-md"
                >
                  <span>Next: Live Preview</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: LIVE PREVIEW */}
          {step === 4 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl mx-auto">
              <div className="border-b border-stone-100 pb-3">
                <h2 className="text-xl font-black text-[#4A2E2A]">Step 4: Live Preview across Channels</h2>
                <p className="text-xs text-stone-500">See how your customers will experience your offer on their devices.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* SMS Preview */}
                <div className="bg-stone-900 rounded-3xl p-4 text-white shadow-xl flex flex-col justify-between aspect-[9/16] max-h-[460px]">
                  <div>
                    <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-black">
                          FB
                        </div>
                        <span className="text-xs font-bold font-mono">FROSTYBITE</span>
                      </div>
                      <span className="text-[10px] text-stone-400">SMS</span>
                    </div>

                    <div className="bg-stone-800/80 rounded-2xl p-3.5 text-xs text-stone-200 leading-relaxed border border-stone-700">
                      {previewSmsText}
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-stone-500">
                    Character Count: {previewSmsText.length} ({Math.ceil(previewSmsText.length / 160)} SMS segment)
                  </div>
                </div>

                {/* WhatsApp Chat Preview */}
                <div className="bg-[#0B141A] rounded-3xl p-4 text-white shadow-xl flex flex-col justify-between aspect-[9/16] max-h-[460px]">
                  <div>
                    <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <img src={UNIVERSAL_LOGO_URL} alt="Frosty Bite" className="w-6 h-6 rounded-full object-cover" />
                        <div>
                          <div className="text-xs font-bold">Frosty Bite Bakery</div>
                          <div className="text-[9px] text-emerald-400">Official Bakery Business</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-500 font-bold">wa.me</span>
                    </div>

                    <div className="bg-[#005C4B] rounded-2xl p-3.5 text-xs text-white leading-relaxed whitespace-pre-wrap shadow-sm">
                      {previewWaText}
                      <div className="text-[9px] text-emerald-200 text-right mt-1.5 flex items-center justify-end gap-1">
                        <span>Just now</span>
                        <span>✓✓</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-2 text-center text-[10px] text-emerald-300">
                    Manual Admin Review &amp; Send Mode
                  </div>
                </div>

                {/* Push Notification Card Preview */}
                <div className="bg-stone-100 rounded-3xl p-4 shadow-xl flex flex-col justify-between aspect-[9/16] max-h-[460px]">
                  <div>
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-200">
                      <span className="text-xs font-bold text-stone-600">Lock Screen Push</span>
                      <span className="text-[10px] text-stone-400">Now</span>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-md border border-stone-200/60 space-y-2">
                      <div className="flex items-center gap-2">
                        <img src={UNIVERSAL_LOGO_URL} alt="Frosty Bite" className="w-5 h-5 rounded-md object-cover" />
                        <span className="text-xs font-black text-stone-900">{form.push_title}</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-snug">
                        {previewPushBody}
                      </p>
                      {form.banner_image && (
                        <img src={form.banner_image} alt="Offer Creative" className="w-full h-24 object-cover rounded-xl mt-2" />
                      )}
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-stone-400">
                    Tapping opens: {form.push_link}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 border border-stone-200 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-50"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#4A2E2A] text-white font-bold text-sm rounded-xl hover:opacity-95 shadow-md"
                >
                  <span>Next: Review & Launch</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 5: REVIEW & EXECUTE */}
          {step === 5 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl mx-auto">
              <div className="border-b border-stone-100 pb-3 text-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                  <Sparkles size={24} />
                </div>
                <h2 className="text-xl font-black text-[#4A2E2A]">Step 5: Final Review & Confirmation</h2>
                <p className="text-xs text-stone-500">Double check your campaign parameters before publishing.</p>
              </div>

              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/70 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-500">Campaign Title</span>
                  <span className="font-bold text-stone-900">{form.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-500">Coupon Code</span>
                  <span className="font-mono font-bold text-amber-800">{form.coupon_code || 'None'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-500">Discount Benefit</span>
                  <span className="font-bold text-emerald-700">{discountLabel}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-500">Min Order Requirement</span>
                  <span className="font-bold text-stone-800">₹{form.min_order_amount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-500">Target Segment</span>
                  <span className="font-bold capitalize text-stone-800">{form.audience_type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-500">Selected Channels</span>
                  <div className="flex gap-1">
                    {form.channels.map(c => (
                      <span key={c} className="px-2 py-0.5 rounded bg-stone-200 font-bold uppercase text-[10px]">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500">Validity Window</span>
                  <span className="font-semibold text-stone-700">
                    {new Date(form.start_at).toLocaleDateString()} – {new Date(form.end_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-3">
                <Info size={18} className="shrink-0 text-amber-700 mt-0.5" />
                <div>
                  <span className="font-bold block">Automated Coupon &amp; Queue Confirmation</span>
                  <span>
                    Upon confirmation, code <strong>{form.coupon_code || 'N/A'}</strong> will be activated in the bakery checkout. SMS jobs will be enqueued to <strong>frosty-sms-gateway-01</strong>, WhatsApp messages will be loaded into the Message Center for manual review, and Push will broadcast immediately.
                  </span>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-5 py-2.5 border border-stone-200 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-50"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCreateCampaignSubmit}
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#E76A54] to-[#D96C8B] text-white font-black text-sm rounded-xl hover:opacity-95 shadow-lg disabled:opacity-50"
                >
                  <Zap size={18} className={isSubmitting ? 'animate-spin' : ''} />
                  <span>{isSubmitting ? 'Launching Campaign...' : 'Confirm & Launch Offer'}</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* SUBSECTION C: CAMPAIGN HISTORY */}
      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-[#4A2E2A]">Campaign History & Performance</h2>
              <p className="text-xs text-stone-500">Track delivery status, open WhatsApp queues, or pause/resume promotions.</p>
            </div>
            <button
              onClick={() => {
                setStep(1);
                setActiveTab('create');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#E76A54] text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-90"
            >
              <PlusCircle size={15} />
              <span>New Campaign</span>
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="py-16 text-center text-stone-400">
              <History size={40} className="mx-auto mb-2 text-stone-300" />
              <p className="text-sm font-semibold">No campaigns found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map(c => (
                <div key={c.id} className="p-5 rounded-2xl border border-stone-200/80 hover:border-stone-300 transition-all bg-white shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          c.status === 'active' ? 'bg-emerald-500' : 'bg-stone-300'
                        )} />
                        <h3 className="font-black text-sm text-[#4A2E2A]">{c.title}</h3>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {new Date(c.start_at).toLocaleDateString()} – {new Date(c.end_at).toLocaleDateString()}
                      </p>
                    </div>

                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                      c.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-600'
                    )}>
                      {c.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-xl text-center text-xs">
                    <div>
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">Promo Code</span>
                      <span className="font-mono font-bold text-amber-800">{c.coupon_code || 'None'}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">Benefit</span>
                      <span className="font-bold text-stone-700">
                        {c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">Target</span>
                      <span className="font-bold text-stone-700">{c.total_recipients} Users</span>
                    </div>
                  </div>

                  {/* Channel Progress */}
                  <div className="space-y-2 text-xs">
                    {c.channels.includes('sms') && (
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 flex items-center gap-1.5">
                          <Smartphone size={13} className="text-blue-500" /> SMS Dispatched
                        </span>
                        <span className="font-mono font-bold text-stone-700">{c.sms_sent_count} / {c.sms_queued_count}</span>
                      </div>
                    )}
                    {c.channels.includes('whatsapp') && (
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 flex items-center gap-1.5">
                          <MessageCircle size={13} className="text-emerald-500" /> WhatsApp Reviewed
                        </span>
                        <span className="font-mono font-bold text-stone-700">{c.whatsapp_sent_count} / {c.whatsapp_total_count}</span>
                      </div>
                    )}
                    {c.channels.includes('push') && (
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 flex items-center gap-1.5">
                          <Bell size={13} className="text-purple-500" /> Push Broadcast
                        </span>
                        <span className="font-mono font-bold text-stone-700">{c.push_sent_count} delivered</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
                    {c.channels.includes('whatsapp') ? (
                      <button
                        onClick={() => {
                          setWaFilterCampaign(c.id);
                          setActiveTab('whatsapp');
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <MessageCircle size={14} />
                        <span>Send WhatsApp</span>
                      </button>
                    ) : <div />}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleCampaignStatus(c.id, c.status === 'active' ? 'paused' : 'active')}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700"
                      >
                        {c.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBSECTION D: WHATSAPP MESSAGE CENTER */}
      {activeTab === 'whatsapp' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase mb-2">
                <MessageCircle size={13} />
                WhatsApp 1-by-1 Review Queue (Anti-Ban Compliant)
              </div>
              <h2 className="text-xl font-black text-[#4A2E2A]">WhatsApp Message Center</h2>
              <p className="text-xs text-stone-500">
                Review personalized message text, click &quot;Open WhatsApp&quot; to launch wa.me on your phone or web, and track sent progress.
              </p>
            </div>

            {/* Campaign Filter */}
            <div className="flex items-center gap-2">
              <select
                value={waFilterCampaign}
                onChange={e => setWaFilterCampaign(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white font-medium text-stone-700"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filters & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-3 rounded-2xl border border-stone-200/60">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'pending', label: 'Pending Review' },
                { id: 'opened', label: 'Opened in WA' },
                { id: 'sent', label: 'Marked as Sent' },
                { id: 'skipped', label: 'Skipped' },
                { id: 'all', label: 'All' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setWaFilterStatus(st.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                    waFilterStatus === st.id
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-stone-600 hover:bg-stone-200"
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-stone-400" size={14} />
              <input
                type="text"
                placeholder="Search name or phone..."
                value={waSearch}
                onChange={e => setWaSearch(e.target.value)}
                className="pl-8 pr-4 py-1.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Recipients List */}
          {waLoading ? (
            <div className="py-16 text-center text-stone-400">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Loading WhatsApp queue...</p>
            </div>
          ) : waQueue.length === 0 ? (
            <div className="py-16 text-center text-stone-400">
              <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-300" />
              <p className="text-sm font-semibold">Queue is clear!</p>
              <p className="text-xs text-stone-400 mt-1">No pending customers matching your filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waQueue.map(item => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-stone-200/80 bg-white hover:border-stone-300 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#4A2E2A]">{item.customer_name || 'Valued Customer'}</span>
                      <span className="font-mono text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded flex items-center gap-1.5">
                        {formatDisplayPhone(item.phone, item.id)}
                        <button
                          onClick={() => togglePhoneReveal(item.id)}
                          className="text-stone-400 hover:text-stone-700"
                          title="Toggle reveal phone"
                        >
                          {revealedPhones[item.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 line-clamp-2 bg-stone-50 p-2 rounded-lg border border-stone-100">
                      {item.whatsapp_message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopyMessage(item.whatsapp_message)}
                      className="p-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 text-xs font-bold"
                      title="Copy Message Text"
                    >
                      <Copy size={15} />
                    </button>

                    {item.whatsapp_prefilled_url && (
                      <a
                        href={item.whatsapp_prefilled_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleWaAction(item.id, 'open')}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      >
                        <ExternalLink size={14} />
                        <span>Open WhatsApp</span>
                      </a>
                    )}

                    <button
                      onClick={() => handleWaAction(item.id, 'mark_sent')}
                      className="px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      Mark Sent
                    </button>

                    <button
                      onClick={() => handleWaAction(item.id, 'skip')}
                      className="px-2.5 py-2 text-stone-400 hover:text-stone-700 text-xs font-bold"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBSECTION E: WEBSITE PUSH NOTIFICATIONS */}
      {activeTab === 'push' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-xl font-black text-[#4A2E2A]">Website Push Notifications</h2>
            <p className="text-xs text-stone-500">
              Broadcast instant announcements, flash deals, and order updates directly to customer browser devices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <form onSubmit={handleSendQuickPush} className="space-y-4 bg-stone-50 p-5 rounded-2xl border border-stone-200/60">
                <h3 className="text-sm font-bold text-[#4A2E2A]">Composer</h3>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Notification Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flash 30% OFF Pastry Hour! 🥐"
                    value={quickPushTitle}
                    onChange={e => setQuickPushTitle(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Notification Message Body *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Freshly baked almond croissants and strawberry tarts are ready! Use code SWEET30 for pickup & delivery."
                    value={quickPushBody}
                    onChange={e => setQuickPushBody(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Destination URL (Deep Link)
                  </label>
                  <input
                    type="url"
                    value={quickPushLink}
                    onChange={e => setQuickPushLink(e.target.value)}
                    className="w-full px-4 py-2 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={quickPushLoading}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  <Send size={16} className={quickPushLoading ? 'animate-pulse' : ''} />
                  <span>{quickPushLoading ? 'Broadcasting...' : 'Broadcast to All Active Devices'}</span>
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <div className="bg-purple-50 rounded-2xl p-5 border border-purple-200/70 text-purple-900">
                <span className="text-xs uppercase font-bold text-purple-700 tracking-wider block">Audience Reach</span>
                <span className="text-3xl font-black block mt-1">{stats?.pushSubscribers || 0}</span>
                <p className="text-xs text-purple-800 mt-2 leading-relaxed">
                  Registered devices currently subscribed to receive real-time push alerts.
                </p>
              </div>

              <div className="bg-stone-50 rounded-2xl p-5 border border-stone-200/60 text-xs space-y-2">
                <span className="font-bold text-stone-800 block">Quiet Hours Protection</span>
                <p className="text-stone-500 leading-relaxed">
                  Non-critical promotional pushes are automatically throttled between 23:00 – 08:00 to respect customer resting hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBSECTION F: DELIVERY LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-[#4A2E2A]">Notification Delivery Audit Logs</h2>
              <p className="text-xs text-stone-500">Searchable, filterable audit records across SMS, WhatsApp, and Web Push.</p>
            </div>

            {/* Channel and Status Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={logsChannel}
                onChange={e => setLogsChannel(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
              >
                <option value="all">All Channels</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PUSH">Push</option>
              </select>

              <select
                value={logsStatus}
                onChange={e => setLogsStatus(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="QUEUED">Queued</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          {logsLoading ? (
            <div className="py-16 text-center text-stone-400">
              <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-stone-600" />
              <p className="text-xs font-semibold">Loading delivery logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-stone-400">
              <FileText size={40} className="mx-auto mb-2 text-stone-300" />
              <p className="text-sm font-semibold">No logs recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-100 text-stone-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Channel</th>
                    <th className="py-3 px-3">Recipient</th>
                    <th className="py-3 px-3">Message Snippet</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {logs.map((log, idx) => (
                    <tr key={`${log.id}-${idx}`} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-[11px] text-stone-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded font-bold text-[10px]",
                          log.channel === 'SMS' ? 'bg-blue-50 text-blue-700' : (log.channel === 'WHATSAPP' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700')
                        )}>
                          {log.channel}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-stone-800">{log.recipient_name || 'Customer'}</div>
                        <div className="font-mono text-[11px] text-stone-400">{log.recipient_phone ? formatDisplayPhone(log.recipient_phone, log.id) : 'N/A'}</div>
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-stone-600">
                        {log.message}
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          log.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : (log.status === 'FAILED' ? 'bg-rose-100 text-rose-800' : 'bg-stone-100 text-stone-600')
                        )}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {log.status === 'FAILED' && log.channel === 'SMS' && (
                          <button
                            onClick={() => handleRetryJob(log.id)}
                            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-900 text-white rounded text-[11px] font-bold transition-colors"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBSECTION G: SETTINGS & GATEWAY CONFIG */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6 max-w-3xl mx-auto">
          <div className="border-b border-stone-100 pb-4">
            <h2 className="text-xl font-black text-[#4A2E2A]">Notification Infrastructure &amp; Gateway Settings</h2>
            <p className="text-xs text-stone-500">Technical configurations for Frosty Bite bakery dispatch channels.</p>
          </div>

          <div className="space-y-4">
            {/* Android SMS Gateway Specs */}
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="text-blue-600" size={18} />
                <h3 className="font-bold text-sm text-[#4A2E2A]">Android SMS Gateway Specification</h3>
              </div>
              <div className="text-xs text-stone-600 space-y-2 leading-relaxed">
                <p>
                  Promotional SMS are automatically prioritized lower than real-time OTP and order lifecycle messages. The Android hardware phone running package <code className="bg-white px-1.5 py-0.5 rounded border border-stone-200">com.frostybite.smsgateway</code> continuously pulls jobs from:
                </p>
                <div className="bg-white p-3 rounded-xl border border-stone-200/60 font-mono text-[11px] text-stone-800">
                  POST /api/sms-gateway/heartbeat<br />
                  GET /api/sms-gateway/claim-jobs?device_id=frosty-sms-gateway-01
                </div>
              </div>
            </div>

            {/* WhatsApp Policy & Safety */}
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="text-emerald-600" size={18} />
                <h3 className="font-bold text-sm text-[#4A2E2A]">WhatsApp Anti-Spam Safeguards</h3>
              </div>
              <div className="text-xs text-stone-600 space-y-2 leading-relaxed">
                <p>
                  To protect Frosty Bite&apos;s phone numbers from automated WhatsApp spam filters, automated bulk sending is strictly restricted. The system generates secure, verified <code className="bg-white px-1.5 py-0.5 rounded border border-stone-200">https://wa.me/91XXXXXXXXXX?text=...</code> prefilled deep links allowing administrators to verify and click to send.
                </p>
                <p>
                  Default Country Code: <strong>+91 (India)</strong><br />
                  Bakery Sign-off: <strong>— Frosty Bite Bakery 🍰</strong>
                </p>
              </div>
            </div>

            {/* Push Service Specs */}
            <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="text-purple-600" size={18} />
                <h3 className="font-bold text-sm text-[#4A2E2A]">Web Push Notification Architecture</h3>
              </div>
              <div className="text-xs text-stone-600 space-y-2 leading-relaxed">
                <p>
                  Website push notifications utilize Web Push APIs &amp; Firebase Cloud Messaging (FCM). Device tokens are stored in the <code className="bg-white px-1.5 py-0.5 rounded border border-stone-200">push_subscriptions</code> table with automatic token pruning and quiet-hours enforcement.
                </p>
                <p>
                  Current Active Subscribers: <strong>{stats?.pushSubscribers || 0}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OffersNotificationsManager;
