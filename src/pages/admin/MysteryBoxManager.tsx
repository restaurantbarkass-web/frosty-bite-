import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gift, Plus, Trash2, Edit2, CheckCircle, XCircle, Sparkles, 
  RefreshCw, Package, Award, Clock, AlertCircle, Search, Filter, ShieldCheck, 
  Tag, QrCode, MessageSquare, Check, Store, ExternalLink, Copy, UserCheck, 
  UserX, History, Send, ChevronRight, ChevronLeft, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import { supabase } from '../../supabase';
import { loyaltyService, LoyaltyPrize, LoyaltySettings } from '../../services/loyaltyService';
import { useMenu } from '../../context/MenuContext';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { Button } from '../../components/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

interface RewardRow {
  id: string;
  customer_id: string;
  prize_id: string;
  unique_redemption_code: string;
  verification_code?: string;
  link_token?: string;
  link_generated_at?: string;
  link_expires_at?: string;
  verification_status?: 'unverified' | 'attempted' | 'verified' | 'failed';
  verification_attempts?: number;
  whatsapp_status?: 'not_generated' | 'link_generated' | 'whatsapp_opened' | 'admin_confirmed_sent';
  whatsapp_opened_at?: string;
  whatsapp_confirmed_at?: string;
  page_visits_count?: number;
  last_page_visited_at?: string;
  customer_type?: 'registered' | 'guest';
  customer_name?: string;
  customer_contact?: string;
  status: 'available' | 'assigned' | 'reserved' | 'opened' | 'redeemed' | 'expired' | 'revoked';
  redemption_type: 'free_claim' | 'min_purchase';
  redemption_method?: string;
  order_id?: string;
  assigned_at: string;
  opened_at?: string;
  redeemed_at?: string;
  expires_at?: string;
  reward_prizes?: LoyaltyPrize;
  user_profile?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

export const MysteryBoxManager: React.FC = () => {
  const { items: menuItems } = useMenu();
  const [prizes, setPrizes] = useState<LoyaltyPrize[]>([]);
  const [settings, setSettings] = useState<LoyaltySettings>({
    enabled: true,
    stampsRequired: 5,
    eligibleOrderStatuses: ['delivered', 'completed', 'dispatched'],
    minimumOrderAmount: 199,
    repeatCyclesEnabled: true,
    scratchThreshold: 55,
    guaranteedRewardsEnabled: true,
    allocationMode: 'equal',
    fallbackAction: 'pause',
    fallbackPrizeId: ''
  } as any);
  
  const [historyRewards, setHistoryRewards] = useState<RewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'tracking' | 'instore' | 'settings'>('tracking');

  // Filters for Reward Tracking Dashboard
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [redemptionTypeFilter, setRedemptionTypeFilter] = useState<string>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('all');
  const [whatsappFilter, setWhatsappFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'expiry'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals & Action States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Partial<LoyaltyPrize> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Link Generation Modal
  const [generatedLinkData, setGeneratedLinkData] = useState<{
    reward: RewardRow;
    linkUrl: string;
    token: string;
    verificationCode: string;
    expiresAt: string;
  } | null>(null);
  const [generatingRewardId, setGeneratingRewardId] = useState<string | null>(null);

  // Audit Timeline Modal
  const [timelineReward, setTimelineReward] = useState<RewardRow | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Revoke Modal
  const [revokingReward, setRevokingReward] = useState<RewardRow | null>(null);
  const [revokingReason, setRevokingReason] = useState('');

  // In-Store Redemption State
  const [inStoreCode, setInStoreCode] = useState('');
  const [inStoreLoading, setInStoreLoading] = useState(false);
  const [inStoreResult, setInStoreResult] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await loyaltyService.getPrizes();
      setPrizes(p);
      const s = await loyaltyService.getSettings();
      setSettings(s);

      const { data: historyData, error: histErr } = await supabase
        .from('scratch_rewards')
        .select('*, reward_prizes(*)')
        .order('assigned_at', { ascending: false });

      if (histErr) {
        console.warn('Scratch rewards fetch warning:', histErr);
      }

      const rawRewards: RewardRow[] = historyData || [];

      // Enhance with customer names/phones from users table for registered users
      const userIds = rawRewards
        .map(r => r.customer_id)
        .filter(id => id && !id.startsWith('guest_') && id.includes('-'));

      let userMap: Record<string, any> = {};
      if (userIds.length > 0) {
        try {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, name, full_name, phone, email')
            .in('id', userIds);
          if (usersData) {
            usersData.forEach((u: any) => {
              userMap[u.id] = u;
            });
          }
        } catch (_) {}
      }

      const enriched = rawRewards.map(r => {
        const u = userMap[r.customer_id];
        const isGuest = r.customer_id.startsWith('guest_') || r.customer_type === 'guest';
        return {
          ...r,
          customer_type: isGuest ? 'guest' : 'registered',
          customer_name: r.customer_name || u?.name || u?.full_name || (isGuest ? 'Guest Customer' : 'Registered Member'),
          customer_contact: r.customer_contact || u?.phone || u?.email || (isGuest ? 'Unverified Mobile' : 'Account Email'),
          user_profile: u
        } as RewardRow;
      });

      setHistoryRewards(enriched);
    } catch (err) {
      console.error('Error loading mystery box data:', err);
      toast.error('Failed to load mystery box records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save or edit prize in catalog
  const handleSavePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrize?.name) {
      toast.error('Gift name is required.');
      return;
    }

    try {
      await loyaltyService.savePrize(editingPrize);
      toast.success(editingPrize.id && !editingPrize.id.startsWith('new_') ? 'Gift updated successfully!' : 'New mystery box gift added!');
      setIsModalOpen(false);
      setEditingPrize(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save gift.');
    }
  };

  const handleDeletePrize = async (id: string) => {
    try {
      const awardedCount = historyRewards.filter(r => r.prize_id === id).length;
      if (awardedCount > 0) {
        toast.error('Cannot delete a gift that has already been awarded. You can deactivate it instead.');
        setDeletingId(null);
        return;
      }

      await loyaltyService.deletePrize(id);
      toast.success('Gift removed successfully.');
      setDeletingId(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete gift.');
    }
  };

  const handleToggleActive = async (prize: LoyaltyPrize) => {
    try {
      await loyaltyService.savePrize({ ...prize, active: !prize.active });
      toast.success(`Gift ${!prize.active ? 'activated' : 'deactivated'}!`);
      loadData();
    } catch (err: any) {
      toast.error('Failed to update status.');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await loyaltyService.updateSettings(settings);
      toast.success('Distribution & guarantee settings saved!');
      loadData();
    } catch (err: any) {
      toast.error('Failed to save settings.');
    }
  };

  // 1. Admin Generate Unique Link
  const handleGenerateLink = async (reward: RewardRow) => {
    setGeneratingRewardId(reward.id);
    try {
      const res = await loyaltyService.adminGenerateLink(reward.id);
      setGeneratedLinkData({
        reward,
        linkUrl: res.linkUrl,
        token: res.token,
        verificationCode: res.verificationCode,
        expiresAt: res.expiresAt
      });
      toast.success('Unique redemption link & verification code generated!');
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate redemption link.');
    } finally {
      setGeneratingRewardId(null);
    }
  };

  // 2. Open WhatsApp with Prefilled Message
  const handleSendWhatsApp = async (reward: RewardRow, tokenOverride?: string, codeOverride?: string, urlOverride?: string) => {
    const domain = window.location.origin;
    const token = tokenOverride || reward.link_token || reward.unique_redemption_code;
    const secureLink = urlOverride || `${domain}/claim-reward/${token}`;
    const vCode = codeOverride || reward.verification_code || reward.unique_redemption_code.slice(-6);
    const giftName = reward.reward_prizes?.name || 'Exclusive Mystery Treat';
    const customerName = reward.customer_name || 'Valued Customer';
    const expiry = reward.expires_at ? new Date(reward.expires_at).toLocaleDateString() : '7 days from issue';

    // Section 3 exact template
    const msg = `🧁 *Frosty Bite Bakery — Your Sweet Reward is Ready!* 🎁

Hello *${customerName}*,
Congratulations! You've unlocked an exclusive bakery reward:
🌟 *${giftName}*

👉 *Claim your free treat here:*
${secureLink}

🔑 *Verification Code:* \`${vCode}\`
⏳ *Valid Until:* ${expiry}

*Instructions:*
1. Tap your unique link above.
2. Enter your Verification Code: \`${vCode}\`
3. Select delivery or store pickup — 100% free with zero payment required!

Sweet wishes,
*Frosty Bite Bakery Team* 🍰`;

    const cleanPhone = (reward.customer_contact || '').replace(/\D/g, '');
    const waUrl = cleanPhone.length >= 10 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    try {
      await loyaltyService.adminWhatsAppOpened(reward.id);
    } catch (_) {}

    window.open(waUrl, '_blank');
    toast.success('WhatsApp opened with pre-filled reward message! Remember to press Send.');
    loadData();
  };

  // 3. Admin Confirms Sent in WhatsApp
  const handleConfirmSent = async (rewardId: string) => {
    try {
      await loyaltyService.adminConfirmSent(rewardId);
      toast.success('WhatsApp status updated: Admin Confirmed Sent!');
      loadData();
    } catch (err: any) {
      toast.error('Failed to confirm sent status.');
    }
  };

  // 4. Revoke Link
  const handleRevokeLink = async () => {
    if (!revokingReward) return;
    try {
      await loyaltyService.adminRevokeLink(revokingReward.id, revokingReason);
      toast.success('Redemption link has been revoked.');
      setRevokingReward(null);
      setRevokingReason('');
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke link.');
    }
  };

  // 5. Open Audit Timeline
  const handleOpenTimeline = async (reward: RewardRow) => {
    setTimelineReward(reward);
    setTimelineLoading(true);
    try {
      const events = await loyaltyService.getRewardTimeline(reward.id);
      setTimelineEvents(events);
    } catch (err) {
      toast.error('Could not load audit timeline.');
    } finally {
      setTimelineLoading(false);
    }
  };

  // 6. In-Store Voucher Verification
  const handleInStoreRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inStoreCode.trim()) {
      toast.error('Please enter a voucher code.');
      return;
    }

    setInStoreLoading(true);
    setInStoreResult(null);
    try {
      const res = await loyaltyService.inStoreRedeem(inStoreCode.trim().toUpperCase());
      setInStoreResult(res);
      toast.success('Voucher verified! Treat handed over.');
      setInStoreCode('');
      loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to verify in-store redemption code.');
    } finally {
      setInStoreLoading(false);
    }
  };

  // Metrics
  const totalUnlocked = historyRewards.length;
  const totalRedeemed = historyRewards.filter(r => r.status === 'redeemed').length;
  const totalFreeClaims = historyRewards.filter(r => r.redemption_type === 'free_claim').length;
  const totalMinPurchase = historyRewards.filter(r => r.redemption_type === 'min_purchase').length;
  const totalWhatsAppSent = historyRewards.filter(r => r.whatsapp_status === 'admin_confirmed_sent').length;
  const totalRemainingStock = prizes.reduce((acc, p) => acc + (p.active ? (p.stockQuantity || 0) : 0), 0);

  // Filtered and Sorted Rewards for Tracking Table
  const filteredRewards = useMemo(() => {
    return historyRewards.filter(r => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (r.customer_name || '').toLowerCase().includes(q);
        const matchContact = (r.customer_contact || '').toLowerCase().includes(q);
        const matchPrize = (r.reward_prizes?.name || '').toLowerCase().includes(q);
        const matchRedCode = (r.unique_redemption_code || '').toLowerCase().includes(q);
        const matchVCode = (r.verification_code || '').toLowerCase().includes(q);
        const matchOrder = (r.order_id || '').toLowerCase().includes(q);
        if (!matchName && !matchContact && !matchPrize && !matchRedCode && !matchVCode && !matchOrder) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all') {
        if (statusFilter === 'expired') {
          const isExp = r.expires_at && new Date(r.expires_at) < new Date() && r.status !== 'redeemed';
          if (!isExp && r.status !== 'expired') return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      // Redemption Type
      if (redemptionTypeFilter !== 'all' && r.redemption_type !== redemptionTypeFilter) {
        return false;
      }

      // Customer Type
      if (customerTypeFilter !== 'all' && r.customer_type !== customerTypeFilter) {
        return false;
      }

      // WhatsApp status
      if (whatsappFilter !== 'all') {
        const ws = r.whatsapp_status || 'not_generated';
        if (ws !== whatsappFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime();
      }
      if (sortBy === 'expiry') {
        const expA = a.expires_at ? new Date(a.expires_at).getTime() : 9999999999999;
        const expB = b.expires_at ? new Date(b.expires_at).getTime() : 9999999999999;
        return expA - expB;
      }
      return 0;
    });
  }, [historyRewards, searchTerm, statusFilter, redemptionTypeFilter, customerTypeFilter, whatsappFilter, sortBy]);

  // Paginated slices
  const totalPages = Math.ceil(filteredRewards.length / pageSize) || 1;
  const paginatedRewards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRewards.slice(start, start + pageSize);
  }, [filteredRewards, currentPage]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-stone-200/80 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Gift size={160} className="text-primary" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest mb-1">
            <Sparkles size={16} />
            <span>Admin Control Center</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight">
            🎁 Mystery Box & Reward Tracking
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm font-medium mt-1 max-w-2xl">
            Audit rewards in real-time, generate secure redemption links, track WhatsApp message dispatches, and verify free & minimum-purchase claims for registered and guest customers.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <Button 
            variant="outline" 
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 border-stone-200 bg-[#FAF8F5] text-stone-700 hover:text-stone-900 hover:bg-stone-100 cursor-pointer rounded-2xl"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Sync Records
          </Button>
          <Button 
            onClick={() => {
              setEditingPrize({
                id: `new_${Date.now()}`,
                name: '',
                description: '',
                rewardType: 'cupcake',
                rewardValue: 100,
                stockQuantity: 50,
                active: true,
                validityDays: 30,
                redemptionRules: 'No minimum purchase required. Redeem via WhatsApp claim link.',
                minimumOrderAmount: 0,
                redemptionType: 'free_claim',
                probability: 20
              });
              setIsModalOpen(true);
            }}
            variant="primary"
            className="bg-[#E76A54] hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-2xl cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Plus size={16} /> Add Custom Gift
          </Button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Total Unlocked</p>
          <p className="text-2xl font-black text-stone-900 mt-1">{totalUnlocked}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Customer rewards</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Free Claim Gifts</p>
          <p className="text-2xl font-black text-primary mt-1">{totalFreeClaims}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Workflow A (WhatsApp)</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Min-Purchase Gifts</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{totalMinPurchase}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Workflow B (Checkout)</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Redeemed</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{totalRedeemed}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Real orders placed</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">WhatsApp Confirmed</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{totalWhatsAppSent}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Dispatched to user</p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-stone-200/80 shadow-2xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Prize Pool Stock</p>
          <p className="text-2xl font-black text-stone-900 mt-1">{totalRemainingStock}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">Available in stock</p>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex border-b border-stone-200 gap-2 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-bold">
        <button
          onClick={() => setActiveTab('tracking')}
          className={cn(
            "pb-3 pt-1 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
            activeTab === 'tracking' ? "border-primary text-primary font-black" : "border-transparent text-stone-500 hover:text-stone-900"
          )}
        >
          <Sparkles size={16} />
          <span>Reward Tracking & Links</span>
          <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
            {historyRewards.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={cn(
            "pb-3 pt-1 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
            activeTab === 'catalog' ? "border-primary text-primary font-black" : "border-transparent text-stone-500 hover:text-stone-900"
          )}
        >
          <Package size={16} />
          <span>Prize Pool Catalog ({prizes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('instore')}
          className={cn(
            "pb-3 pt-1 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
            activeTab === 'instore' ? "border-primary text-primary font-black" : "border-transparent text-stone-500 hover:text-stone-900"
          )}
        >
          <Store size={16} />
          <span>In-Store QR Counter</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={cn(
            "pb-3 pt-1 border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap",
            activeTab === 'settings' ? "border-primary text-primary font-black" : "border-transparent text-stone-500 hover:text-stone-900"
          )}
        >
          <Award size={16} />
          <span>Distribution & Fallback</span>
        </button>
      </div>

      {/* TAB A: REWARD TRACKING & AUDIT LOG */}
      {activeTab === 'tracking' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search customer, phone, prize, code, or order #..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status */}
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="p-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-700 focus:outline-none focus:border-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="assigned">Assigned</option>
                  <option value="redeemed">Redeemed</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>

                {/* Redemption Type */}
                <select
                  value={redemptionTypeFilter}
                  onChange={e => { setRedemptionTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="p-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-700 focus:outline-none focus:border-primary"
                >
                  <option value="all">All Types</option>
                  <option value="free_claim">Free Claim (No Purchase)</option>
                  <option value="min_purchase">Minimum Purchase</option>
                </select>

                {/* Customer Type */}
                <select
                  value={customerTypeFilter}
                  onChange={e => { setCustomerTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="p-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-700 focus:outline-none focus:border-primary"
                >
                  <option value="all">All Customers</option>
                  <option value="registered">Registered Members</option>
                  <option value="guest">Guest Customers</option>
                </select>

                {/* WhatsApp Status */}
                <select
                  value={whatsappFilter}
                  onChange={e => { setWhatsappFilter(e.target.value); setCurrentPage(1); }}
                  className="p-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-700 focus:outline-none focus:border-primary"
                >
                  <option value="all">All WhatsApp Statuses</option>
                  <option value="not_generated">Not Generated</option>
                  <option value="link_generated">Link Generated</option>
                  <option value="whatsapp_opened">WhatsApp Opened</option>
                  <option value="admin_confirmed_sent">Confirmed Sent</option>
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="p-2.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-700 focus:outline-none focus:border-primary"
                >
                  <option value="newest">Newest Assigned</option>
                  <option value="oldest">Oldest Assigned</option>
                  <option value="expiry">Soonest Expiry</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-stone-100">
              <span>Showing <strong>{filteredRewards.length}</strong> matching rewards</span>
              {(searchTerm || statusFilter !== 'all' || redemptionTypeFilter !== 'all' || customerTypeFilter !== 'all' || whatsappFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setRedemptionTypeFilter('all');
                    setCustomerTypeFilter('all');
                    setWhatsappFilter('all');
                  }}
                  className="text-primary font-bold hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {/* Rewards Tracking Table */}
          <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[10px] font-black uppercase tracking-widest text-stone-500">
                    <th className="p-4">Customer</th>
                    <th className="p-4">Reward & Type</th>
                    <th className="p-4">Verification & Link</th>
                    <th className="p-4">WhatsApp Status</th>
                    <th className="p-4">Activity & Order</th>
                    <th className="p-4">Status & Expiry</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs font-medium text-stone-700">
                  {paginatedRewards.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-stone-400">
                        <Gift size={36} className="mx-auto mb-2 text-stone-300" />
                        <p className="font-bold text-stone-600">No customer rewards found matching the selected filters.</p>
                        <p className="text-xs text-stone-400 mt-1">Try adjusting your search or filter criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRewards.map((reward) => {
                      const isGuest = reward.customer_type === 'guest';
                      const isExpired = reward.expires_at ? new Date(reward.expires_at) < new Date() && reward.status !== 'redeemed' : false;
                      const isRevoked = reward.status === 'revoked';
                      const isRedeemed = reward.status === 'redeemed';
                      const prize = reward.reward_prizes;

                      return (
                        <tr key={reward.id} className="hover:bg-stone-50/70 transition-colors">
                          {/* 1. Customer Column */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                                  isGuest ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-blue-100 text-blue-800 border border-blue-200"
                                )}>
                                  {isGuest ? 'Guest' : 'Member'}
                                </span>
                                <span className="font-bold text-stone-900 truncate max-w-[140px]" title={reward.customer_name}>
                                  {reward.customer_name}
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 font-mono truncate max-w-[150px]">
                                {reward.customer_contact}
                              </p>
                              <p className="text-[9px] text-stone-400 font-mono truncate max-w-[140px]" title={reward.customer_id}>
                                ID: {reward.customer_id.slice(0, 14)}...
                              </p>
                            </div>
                          </td>

                          {/* 2. Reward & Type */}
                          <td className="p-4">
                            <div className="space-y-1 max-w-[180px]">
                              <p className="font-bold text-stone-900 leading-tight">
                                {prize?.name || 'Exclusive Mystery Gift'}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                <span className="text-[9px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-bold uppercase">
                                  {prize?.rewardType || 'gift'}
                                </span>
                                <span className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                                  reward.redemption_type === 'free_claim' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-orange-50 text-orange-700 border border-orange-200"
                                )}>
                                  {reward.redemption_type === 'free_claim' ? 'Free Claim' : `Min. ₹${prize?.minimumOrderAmount || 299}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 3. Verification & Link */}
                          <td className="p-4">
                            <div className="space-y-1">
                              {reward.verification_code ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                                    {reward.verification_code}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(reward.verification_code!, 'Verification code')}
                                    className="text-stone-400 hover:text-stone-700"
                                    title="Copy code"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-stone-400 italic">No code generated</span>
                              )}

                              <div className="flex items-center gap-1 text-[10px]">
                                <span className="text-stone-400">Status:</span>
                                <span className={cn(
                                  "font-bold uppercase",
                                  reward.verification_status === 'verified' ? "text-emerald-600" :
                                  reward.verification_status === 'failed' ? "text-rose-600" :
                                  "text-stone-500"
                                )}>
                                  {reward.verification_status || 'unverified'}
                                </span>
                              </div>

                              {reward.link_token && (
                                <div className="flex items-center gap-1 text-[10px] text-primary">
                                  <span className="font-mono truncate max-w-[100px]">{reward.link_token.slice(0, 10)}...</span>
                                  <button
                                    onClick={() => copyToClipboard(`${window.location.origin}/claim-reward/${reward.link_token}`, 'Claim link')}
                                    className="text-primary hover:underline cursor-pointer"
                                    title="Copy link"
                                  >
                                    <Copy size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 4. WhatsApp Status */}
                          <td className="p-4">
                            <div className="space-y-1">
                              {reward.whatsapp_status === 'admin_confirmed_sent' ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                                  <CheckCircle size={10} /> Confirmed Sent
                                </span>
                              ) : reward.whatsapp_status === 'whatsapp_opened' ? (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                                  <Clock size={10} /> WhatsApp Opened
                                </span>
                              ) : reward.whatsapp_status === 'link_generated' ? (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                                  <LinkIcon size={10} /> Link Generated
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-500 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                  Not Generated
                                </span>
                              )}

                              {reward.whatsapp_confirmed_at && (
                                <p className="text-[9px] text-stone-400">
                                  {new Date(reward.whatsapp_confirmed_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* 5. Activity & Order */}
                          <td className="p-4">
                            <div className="space-y-1 text-[11px]">
                              <p className="text-stone-500">
                                👁️ Visits: <strong className="text-stone-800">{reward.page_visits_count || 0}</strong>
                              </p>
                              {reward.order_id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-stone-400">Order:</span>
                                  <a
                                    href={`/order-tracking/${reward.order_id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono font-bold text-primary hover:underline flex items-center gap-0.5"
                                  >
                                    #{reward.order_id} <ExternalLink size={10} />
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[10px] text-stone-400 italic">No order yet</span>
                              )}
                              {reward.redemption_method && (
                                <p className="text-[9px] text-stone-400 capitalize">
                                  Via: {reward.redemption_method.replace('_', ' ')}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* 6. Status & Expiry */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider inline-block",
                                isRedeemed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                isRevoked ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                isExpired ? "bg-stone-100 text-stone-600 border border-stone-200" :
                                reward.status === 'opened' ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                "bg-amber-50 text-amber-700 border border-amber-200"
                              )}>
                                {isRedeemed ? 'Redeemed' : isRevoked ? 'Revoked' : isExpired ? 'Expired' : reward.status}
                              </span>

                              {reward.expires_at && (
                                <p className="text-[10px] text-stone-400">
                                  Exp: {new Date(reward.expires_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* 7. Administrative Actions */}
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Workflow A: Free Claim actions */}
                              {reward.redemption_type === 'free_claim' && !isRedeemed && !isRevoked && (
                                <>
                                  <button
                                    onClick={() => handleGenerateLink(reward)}
                                    disabled={generatingRewardId === reward.id}
                                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                                    title="Generate cryptographically secure link and PIN"
                                  >
                                    {reward.link_token ? 'Rotate Link' : 'Generate Link'}
                                  </button>

                                  <button
                                    onClick={() => handleSendWhatsApp(reward)}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Open WhatsApp with prefilled message"
                                  >
                                    <Send size={11} /> WhatsApp
                                  </button>

                                  {reward.whatsapp_status === 'whatsapp_opened' && (
                                    <button
                                      onClick={() => handleConfirmSent(reward.id)}
                                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[9px] font-bold uppercase transition-colors cursor-pointer"
                                      title="Confirm message sent in WhatsApp"
                                    >
                                      Confirm Sent
                                    </button>
                                  )}

                                  <button
                                    onClick={() => setRevokingReward(reward)}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[9px] font-bold uppercase transition-colors cursor-pointer"
                                    title="Revoke Link"
                                  >
                                    Revoke
                                  </button>
                                </>
                              )}

                              {/* Workflow B: Minimum Purchase info */}
                              {reward.redemption_type === 'min_purchase' && (
                                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                                  Checkout Only
                                </span>
                              )}

                              {/* Audit Timeline Button */}
                              <button
                                onClick={() => handleOpenTimeline(reward)}
                                className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                                title="View durable event audit timeline"
                              >
                                <History size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span>Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB B: PRIZE POOL CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {prizes.map((prize) => {
              const awardCount = historyRewards.filter(r => r.prize_id === prize.id).length;
              const redeemedCount = historyRewards.filter(r => r.prize_id === prize.id && r.status === 'redeemed').length;

              return (
                <motion.div
                  key={prize.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "bg-white rounded-3xl border p-6 shadow-xs flex flex-col justify-between transition-all",
                    prize.active ? "border-stone-200/80" : "border-stone-200 opacity-60 bg-stone-50/50"
                  )}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            {prize.rewardType}
                          </span>
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                            prize.redemptionType === 'min_purchase' ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                          )}>
                            {prize.redemptionType === 'min_purchase' ? 'Min Purchase' : 'Free Claim'}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-stone-900 mt-1">{prize.name}</h4>
                      </div>
                      <button
                        onClick={() => handleToggleActive(prize)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer",
                          prize.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-stone-200 text-stone-600"
                        )}
                      >
                        {prize.active ? 'Active' : 'Inactive'}
                      </button>
                    </div>

                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{prize.description}</p>

                    <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-stone-100">
                      <div className="bg-stone-50 p-2 rounded-2xl">
                        <p className="text-[9px] font-black uppercase text-stone-400">Stock</p>
                        <p className="text-sm font-black text-stone-900">{prize.stockQuantity}</p>
                      </div>
                      <div className="bg-stone-50 p-2 rounded-2xl">
                        <p className="text-[9px] font-black uppercase text-stone-400">Awarded</p>
                        <p className="text-sm font-black text-blue-600">{awardCount}</p>
                      </div>
                      <div className="bg-stone-50 p-2 rounded-2xl">
                        <p className="text-[9px] font-black uppercase text-stone-400">Redeemed</p>
                        <p className="text-sm font-black text-emerald-600">{redeemedCount}</p>
                      </div>
                    </div>

                    <div className="text-[11px] text-stone-500 space-y-1">
                      <p>✨ Validity: <strong className="text-stone-800">{prize.validityDays} Days</strong></p>
                      <p>📋 Rules: <strong className="text-stone-800">{prize.redemptionRules || 'None'}</strong></p>
                      {prize.probability !== undefined && (
                        <p>⚖️ Probability Weight: <strong className="text-primary">{prize.probability}%</strong></p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-stone-100 mt-4">
                    <button
                      onClick={() => {
                        setEditingPrize(prize);
                        setIsModalOpen(true);
                      }}
                      className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit2 size={14} /> Edit Gift
                    </button>
                    <button
                      onClick={() => setDeletingId(prize.id)}
                      className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors cursor-pointer"
                      title="Delete Gift"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB C: IN-STORE QR REDEMPTION */}
      {activeTab === 'instore' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-6 sm:p-8 shadow-xs max-w-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Store size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-stone-900">In-Store QR / Voucher Verification</h3>
              <p className="text-xs text-stone-500">Scan or enter the customer's voucher code at the bakery counter.</p>
            </div>
          </div>

          <form onSubmit={handleInStoreRedeem} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-stone-700 mb-1">Voucher Redemption Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="e.g. FB-REW-ABC123 or FB-7491"
                  value={inStoreCode}
                  onChange={e => setInStoreCode(e.target.value.toUpperCase())}
                  className="flex-1 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl font-mono font-bold text-stone-900 text-sm focus:outline-none focus:border-primary uppercase tracking-wider"
                />
                <Button
                  type="submit"
                  disabled={inStoreLoading}
                  variant="primary"
                  className="px-6 bg-[#E76A54] hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer"
                >
                  {inStoreLoading ? 'Verifying...' : 'Verify & Handover'}
                </Button>
              </div>
            </div>
          </form>

          {inStoreResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2"
            >
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle size={18} />
                <span>Handover Authorized!</span>
              </div>
              <p className="text-xs text-stone-700 font-medium">
                Voucher for <strong>{inStoreResult.reward?.reward_prizes?.name}</strong> has been marked as <strong>Redeemed</strong>.
              </p>
              <p className="text-[11px] font-mono text-stone-500">Code: {inStoreResult.reward?.unique_redemption_code}</p>
            </motion.div>
          )}
        </div>
      )}

      {/* TAB D: SETTINGS & DISTRIBUTION */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 shadow-xs max-w-2xl space-y-6">
          <div>
            <h3 className="text-xl font-black text-stone-900">Distribution & Guaranteed Drop Settings</h3>
            <p className="text-xs text-stone-500 mt-0.5">Configure how prizes are chosen by the backend and fallback rules.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-stone-700 mb-2">Prize Allocation Mode</label>
              <select
                value={settings.allocationMode || 'equal'}
                onChange={e => setSettings({ ...settings, allocationMode: e.target.value as any })}
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-900 focus:outline-none focus:border-primary"
              >
                <option value="equal">Mode A: Equal Chance (All active gifts have equal probability)</option>
                <option value="probability">Mode B: Custom Probability (Based on admin percentage weights)</option>
                <option value="fixed">Fixed-Quantity Inventory Allocation</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200">
              <div>
                <h4 className="text-xs font-black text-stone-900 uppercase">Every Mystery Box Must Contain a Gift</h4>
                <p className="text-[11px] text-stone-500">Guarantees drop on every completed mystery box cycle.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.guaranteedRewardsEnabled ?? true}
                onChange={e => setSettings({ ...settings, guaranteedRewardsEnabled: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-stone-700 mb-2">Fallback Rule When Prize Stock is Empty</label>
              <select
                value={settings.fallbackAction || 'pause'}
                onChange={e => setSettings({ ...settings, fallbackAction: e.target.value as any })}
                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-900 focus:outline-none focus:border-primary"
              >
                <option value="pause">Pause new mystery box openings until stock is replenished</option>
                <option value="fallback_gift">Assign fallback standard reward</option>
              </select>
            </div>

            <Button
              onClick={handleSaveSettings}
              variant="primary"
              className="w-full py-4 bg-[#E76A54] hover:bg-orange-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer shadow-md"
            >
              Save Distribution Settings
            </Button>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT PRIZE */}
      <AnimatePresence>
        {isModalOpen && editingPrize && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl border border-stone-200"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-stone-900">
                  {editingPrize.id && !editingPrize.id.startsWith('new_') ? 'Edit Mystery Gift' : 'Add New Mystery Gift'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-700 p-2 cursor-pointer">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSavePrize} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-stone-700 mb-1">Gift Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Free Chocolate Cupcake"
                    value={editingPrize.name || ''}
                    onChange={e => setEditingPrize({ ...editingPrize, name: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stone-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Describe the sweet reward..."
                    value={editingPrize.description || ''}
                    onChange={e => setEditingPrize({ ...editingPrize, description: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase text-stone-700 mb-1">Gift Type</label>
                    <select
                      value={editingPrize.rewardType || 'cupcake'}
                      onChange={e => setEditingPrize({ ...editingPrize, rewardType: e.target.value as any })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                    >
                      <option value="cupcake">Free Cupcake</option>
                      <option value="cookie">Free Cookie</option>
                      <option value="dessert">Free Dessert</option>
                      <option value="product">Free Bakery Product</option>
                      <option value="fixed_discount">Fixed-Value Discount</option>
                      <option value="percent_discount">Percentage Discount</option>
                      <option value="custom">Custom Gift</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stone-700 mb-1">Redemption Type *</label>
                    <select
                      value={editingPrize.redemptionType || 'free_claim'}
                      onChange={e => setEditingPrize({ ...editingPrize, redemptionType: e.target.value as any })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-primary"
                    >
                      <option value="free_claim">Free Claim (No Purchase Required)</option>
                      <option value="min_purchase">Minimum Purchase Required</option>
                    </select>
                  </div>
                </div>

                {editingPrize.redemptionType === 'min_purchase' && (
                  <div>
                    <label className="block text-xs font-black uppercase text-stone-700 mb-1">Minimum Order Amount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingPrize.minimumOrderAmount || 299}
                      onChange={e => setEditingPrize({ ...editingPrize, minimumOrderAmount: Number(e.target.value) })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase text-stone-700 mb-1">Available Quantity</label>
                    <input
                      type="number"
                      min={0}
                      value={editingPrize.stockQuantity ?? 50}
                      onChange={e => setEditingPrize({ ...editingPrize, stockQuantity: Number(e.target.value) })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stone-700 mb-1">Reward Value (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingPrize.rewardValue ?? 100}
                      onChange={e => setEditingPrize({ ...editingPrize, rewardValue: Number(e.target.value) })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase text-stone-700 mb-1">Validity (Days)</label>
                    <input
                      type="number"
                      min={1}
                      value={editingPrize.validityDays ?? 30}
                      onChange={e => setEditingPrize({ ...editingPrize, validityDays: Number(e.target.value) })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-stone-700 mb-1">Probability Weight (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editingPrize.probability ?? 20}
                      onChange={e => setEditingPrize({ ...editingPrize, probability: Number(e.target.value) })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stone-700 mb-1">Linked Menu Product (Optional)</label>
                  <select
                    value={editingPrize.productId || ''}
                    onChange={e => setEditingPrize({ ...editingPrize, productId: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                  >
                    <option value="">None (Custom Gift Description)</option>
                    {menuItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (₹{item.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-stone-700 mb-1">Redemption Instructions</label>
                  <input
                    type="text"
                    placeholder="e.g. Valid on all orders above ₹299."
                    value={editingPrize.redemptionRules || ''}
                    onChange={e => setEditingPrize({ ...editingPrize, redemptionRules: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="prize_active"
                    checked={editingPrize.active ?? true}
                    onChange={e => setEditingPrize({ ...editingPrize, active: e.target.checked })}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="prize_active" className="text-xs font-bold text-stone-800 cursor-pointer">
                    Activate in Mystery Box Prize Pool immediately
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="bg-[#E76A54] text-white rounded-xl">
                    Save Gift
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: GENERATED UNIQUE LINK & CODE POPUP */}
      <AnimatePresence>
        {generatedLinkData && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-stone-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 font-black text-sm">
                  <CheckCircle size={20} />
                  <span>Redemption Credentials Ready</span>
                </div>
                <button onClick={() => setGeneratedLinkData(null)} className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer">
                  <XCircle size={22} />
                </button>
              </div>

              <div>
                <h3 className="text-xl font-black text-stone-900">
                  {generatedLinkData.reward.reward_prizes?.name || 'Mystery Gift'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Assigned to: <strong>{generatedLinkData.reward.customer_name}</strong> ({generatedLinkData.reward.customer_type})
                </p>
              </div>

              {/* Link Box */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                  Unique Redemption URL
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedLinkData.linkUrl}
                    className="flex-1 bg-white p-2.5 rounded-xl border border-stone-200 text-xs font-mono text-stone-800 focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(generatedLinkData.linkUrl, 'Redemption link')}
                    className="p-2.5 bg-white border border-stone-200 rounded-xl text-stone-700 hover:bg-stone-100 cursor-pointer"
                    title="Copy Link"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              {/* Verification Code Box */}
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  Customer Verification Code
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-mono font-black text-amber-950 tracking-wider">
                    {generatedLinkData.verificationCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(generatedLinkData.verificationCode, 'Verification code')}
                    className="px-3 py-1.5 bg-amber-200/60 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy size={13} /> Copy Code
                  </button>
                </div>
                <p className="text-[11px] text-amber-800 font-medium">
                  Valid until: {new Date(generatedLinkData.expiresAt).toLocaleDateString()} (Rate-limited, max 5 attempts)
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Button
                  onClick={() => {
                    handleSendWhatsApp(
                      generatedLinkData.reward, 
                      generatedLinkData.token, 
                      generatedLinkData.verificationCode,
                      generatedLinkData.linkUrl
                    );
                    setGeneratedLinkData(null);
                  }}
                  variant="primary"
                  className="w-full sm:flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Send size={15} /> Open in WhatsApp
                </Button>
                <Button
                  onClick={() => setGeneratedLinkData(null)}
                  variant="outline"
                  className="w-full sm:w-auto py-3.5 rounded-2xl text-xs uppercase tracking-wider cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: AUDIT TIMELINE MODAL */}
      <AnimatePresence>
        {timelineReward && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl border border-stone-200"
            >
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div>
                  <h3 className="text-xl font-black text-stone-900">Reward Audit Timeline</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Chronological audit log for <strong>{timelineReward.reward_prizes?.name}</strong>
                  </p>
                </div>
                <button onClick={() => setTimelineReward(null)} className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer">
                  <XCircle size={22} />
                </button>
              </div>

              {timelineLoading ? (
                <div className="py-12 text-center text-stone-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-xs">Loading audit trail...</p>
                </div>
              ) : timelineEvents.length === 0 ? (
                <div className="py-8 text-center text-stone-400 text-xs">
                  No audit events recorded yet for this reward.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                  {timelineEvents.map((evt, idx) => (
                    <div key={evt.id || idx} className="relative">
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-white shadow-xs" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-stone-900 uppercase">
                            {evt.event_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full uppercase font-bold">
                            By {evt.actor || 'system'}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          {new Date(evt.created_at).toLocaleString()}
                        </p>
                        {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                          <div className="mt-1.5 p-2.5 bg-stone-50 rounded-xl text-[10px] font-mono text-stone-600 border border-stone-200 overflow-x-auto">
                            {JSON.stringify(evt.metadata, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => setTimelineReward(null)}
                variant="outline"
                className="w-full py-3 rounded-2xl text-xs uppercase tracking-wider cursor-pointer"
              >
                Close Audit Log
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: REVOKE LINK CONFIRMATION */}
      <AnimatePresence>
        {revokingReward && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] p-6 max-w-md w-full space-y-4 shadow-2xl border border-stone-200"
            >
              <div className="flex items-center gap-2.5 text-rose-600 font-black">
                <AlertTriangle size={22} />
                <span>Revoke Redemption Link</span>
              </div>
              <p className="text-xs text-stone-600">
                Are you sure you want to revoke this redemption link for <strong>{revokingReward.reward_prizes?.name}</strong>? 
                The customer will no longer be able to claim this gift.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Reason for revocation (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Requested by customer or duplicate session"
                  value={revokingReason}
                  onChange={e => setRevokingReason(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setRevokingReward(null)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleRevokeLink}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs uppercase tracking-wider"
                >
                  Confirm Revocation
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Prize Deletion */}
      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && handleDeletePrize(deletingId)}
        title="Delete Mystery Gift"
        description="Are you sure you want to remove this gift from the prize pool? This cannot be undone."
        confirmText="Delete Gift"
        cancelText="Cancel"
      />
    </div>
  );
};

// Simple link icon helper
const LinkIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
