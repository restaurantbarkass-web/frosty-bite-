import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Search, Mail, Phone, Calendar, MapPin, ExternalLink, 
  MessageCircle, X, ShoppingBag, Star, Award, Flame, ChevronDown, 
  ChevronUp, Wallet, ShieldAlert, CheckCircle2, Ban, ShieldCheck, 
  AlertCircle, Users, UserCheck, UserX, UserPlus, RefreshCw, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../supabase';
import { sendWhatsAppMessage } from '../../utils/whatsapp';
import { formatOrderId } from '../../utils/orderUtils';

interface Customer {
  id: string;
  full_name?: string;
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  role?: string;
  created_at?: string;
  last_login?: string;
  points?: number;
  reward_points?: number;
  badge_tier?: string;
  total_orders?: number;
  lifetime_spend?: number;
  activity_streak?: number;
  wallet_balance?: number;
  status?: string;
  is_blocked?: boolean;
  block_reason?: string;
  block_note?: string;
  blocked_at?: string;
}

interface Stats {
  totalCustomers: number;
  activeCustomers: number;
  blockedCustomers: number;
  newCustomers: number;
}

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    activeCustomers: 0,
    blockedCustomers: 0,
    newCustomers: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'recent'>('all');

  // Customer Detail Drawer/Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerReviews, setCustomerReviews] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'reviews' | 'loyalty'>('orders');

  // Blocking Modal State
  const [customerToBlock, setCustomerToBlock] = useState<Customer | null>(null);
  const [blockReason, setBlockReason] = useState<string>('Suspicious activity');
  const [blockNote, setBlockNote] = useState<string>('');
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

  // Unblocking Modal State
  const [customerToUnblock, setCustomerToUnblock] = useState<Customer | null>(null);
  const [isSubmittingUnblock, setIsSubmittingUnblock] = useState(false);

  useEffect(() => {
    fetchCustomersData();

    // Subscribe to realtime database updates
    const channel = supabase
      .channel('users_admin_sync_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchCustomersData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const fetchCustomersData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Try server API first
      const res = await fetch(`/api/admin/customers?status=${statusFilter}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          setCustomers(json.customers || []);
          if (json.stats) {
            setStats(json.stats);
          }
          return;
        }
      }

      // Fallback: Direct Supabase fetch
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      if (data) {
        const isBlockedUser = (c: any) =>
          c.status === 'blocked' ||
          c.is_blocked === true ||
          c.settings?.status === 'blocked' ||
          c.settings?.is_blocked === true;

        const formatted = data.map(c => ({
          ...c,
          is_blocked: isBlockedUser(c),
          status: isBlockedUser(c) ? 'blocked' : 'active'
        }));

        let displayList = formatted;
        if (statusFilter === 'blocked') {
          displayList = formatted.filter(c => c.is_blocked);
        } else if (statusFilter === 'active') {
          displayList = formatted.filter(c => !c.is_blocked);
        } else if (statusFilter === 'recent') {
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          displayList = formatted.filter(c => c.created_at && new Date(c.created_at).getTime() >= sevenDaysAgo);
        }

        setCustomers(displayList);

        const blockedCount = formatted.filter(c => c.is_blocked).length;
        const total = formatted.length;
        setStats({
          totalCustomers: total,
          activeCustomers: total - blockedCount,
          blockedCustomers: blockedCount,
          newCustomers: formatted.filter(c => c.created_at && (Date.now() - new Date(c.created_at).getTime() < 7 * 24 * 60 * 60 * 1000)).length
        });
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewActivity = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setActivityLoading(true);
    setActiveTab('orders');
    try {
      const { data: oData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });
      if (oData) setCustomerOrders(oData);

      const { data: rData } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });
      if (rData) setCustomerReviews(rData);
    } catch (err) {
      console.error('Error fetching activity details:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleExecuteBlock = async () => {
    if (!customerToBlock) return;
    setIsSubmittingBlock(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/customers/${customerToBlock.id}/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          reason: blockReason,
          note: blockNote
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(`Customer ${customerToBlock.full_name || customerToBlock.name || 'Account'} blocked successfully.`);
        // Update local state immediately
        setCustomers(prev => prev.map(c => c.id === customerToBlock.id ? { ...c, is_blocked: true, status: 'blocked', block_reason: blockReason } : c));
        setStats(prev => ({
          ...prev,
          activeCustomers: Math.max(0, prev.activeCustomers - 1),
          blockedCustomers: prev.blockedCustomers + 1
        }));
        setCustomerToBlock(null);
        setBlockNote('');
      } else {
        toast.error(data.error || 'Failed to block customer. Please try again.');
      }
    } catch (err) {
      console.error('Error executing block:', err);
      toast.error('Unable to block customer. Please try again.');
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  const handleExecuteUnblock = async () => {
    if (!customerToUnblock) return;
    setIsSubmittingUnblock(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/customers/${customerToUnblock.id}/unblock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(`Customer access restored for ${customerToUnblock.full_name || customerToUnblock.name || 'Account'}.`);
        // Update local state immediately
        setCustomers(prev => prev.map(c => c.id === customerToUnblock.id ? { ...c, is_blocked: false, status: 'active', block_reason: undefined } : c));
        setStats(prev => ({
          ...prev,
          activeCustomers: prev.activeCustomers + 1,
          blockedCustomers: Math.max(0, prev.blockedCustomers - 1)
        }));
        setCustomerToUnblock(null);
      } else {
        toast.error(data.error || 'Failed to restore customer access. Please try again.');
      }
    } catch (err) {
      console.error('Error executing unblock:', err);
      toast.error('Unable to restore customer access. Please try again.');
    } finally {
      setIsSubmittingUnblock(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.full_name?.toLowerCase() || '').includes(q) ||
      (c.name?.toLowerCase() || '').includes(q) ||
      (c.email?.toLowerCase() || '').includes(q) ||
      (c.phone || '').includes(q)
    );
  });

  const formatDate = (dateString: any) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 bg-white border border-stone-200/80 rounded-3xl p-12 shadow-xs">
        <div className="w-12 h-12 border-4 border-[#E76A54]/20 border-t-[#E76A54] rounded-full animate-spin" />
        <p className="text-stone-500 font-bold animate-pulse text-sm">Syncing Customer Data…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight mb-1">Customer Management</h1>
        <p className="text-stone-500 font-medium text-xs sm:text-sm">Manage Frosty Bite customers, account access, and customer status.</p>
      </div>

      {/* Real Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="bg-white border border-stone-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs text-stone-500 font-black uppercase tracking-wider">Total Customers</p>
            <p className="text-xl sm:text-3xl font-black text-stone-900 mt-1">{stats.totalCustomers}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white border border-stone-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs text-emerald-600 font-black uppercase tracking-wider">Active Customers</p>
            <p className="text-xl sm:text-3xl font-black text-emerald-700 mt-1">{stats.activeCustomers}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck size={22} />
          </div>
        </div>

        <div className="bg-white border border-stone-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs text-red-500 font-black uppercase tracking-wider">Blocked Customers</p>
            <p className="text-xl sm:text-3xl font-black text-red-600 mt-1">{stats.blockedCustomers}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
            <UserX size={22} />
          </div>
        </div>

        <div className="bg-white border border-stone-200/80 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs text-orange-600 font-black uppercase tracking-wider">New This Week</p>
            <p className="text-xl sm:text-3xl font-black text-[#E76A54] mt-1">{stats.newCustomers}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-50 text-[#E76A54] flex items-center justify-center">
            <UserPlus size={22} />
          </div>
        </div>
      </div>

      {/* Search Bar & Filter Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#E76A54] transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by Name, Email, or Mobile..." 
            className="w-full bg-white border border-stone-200 rounded-2xl py-3.5 pl-12 pr-4 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#E76A54] transition-all font-medium shadow-xs text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100/80 border border-stone-200/80 rounded-2xl max-w-full overflow-x-auto scrollbar-hide shrink-0">
          {(['all', 'active', 'blocked', 'recent'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              {tab === 'all' ? 'All Customers' : tab === 'active' ? 'Active' : tab === 'blocked' ? 'Blocked' : 'Recently Joined'}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <AnimatePresence mode="popLayout">
          {filteredCustomers.map((customer) => {
            const isBlocked = customer.is_blocked || customer.status === 'blocked';
            const displayName = customer.full_name || customer.name || 'Foodie Customer';

            return (
              <motion.div 
                key={customer.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className={`bg-white border rounded-2xl sm:rounded-[28px] p-4 sm:p-6 space-y-4 sm:space-y-5 relative overflow-hidden transition-all shadow-xs ${
                  isBlocked ? 'border-red-200 bg-red-50/20' : 'border-stone-200/80 hover:border-stone-300'
                }`}
              >
                {/* Header Info */}
                <div className="flex items-start justify-between gap-2.5 min-w-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-1">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shrink-0 ${
                      isBlocked ? 'bg-red-100 text-red-600' : 'bg-orange-50 text-[#E76A54]'
                    }`}>
                      {displayName[0]?.toUpperCase() || 'F'}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3 className="text-sm sm:text-base font-extrabold text-stone-900 leading-tight truncate" title={displayName}>
                        {displayName}
                      </h3>
                      <p className="text-[11px] text-stone-500 font-mono mt-0.5 truncate" title={customer.email}>
                        {customer.email}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 pt-0.5">
                    {isBlocked ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 border border-red-200 text-red-700 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-2xs">
                        <Ban size={11} /> Blocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap shadow-2xs">
                        <CheckCircle2 size={11} /> Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Fields */}
                <div className="space-y-2 text-xs text-stone-600 border-t border-stone-100 pt-3 min-w-0">
                  {customer.phone && (
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Phone size={14} className="text-stone-400 shrink-0" />
                      <span className="font-mono truncate">{customer.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Calendar size={14} className="text-stone-400 shrink-0" />
                    <span className="truncate">Joined: {formatDate(customer.created_at)}</span>
                  </div>
                  {isBlocked && customer.block_reason && (
                    <div className="p-2.5 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-800 font-medium space-y-0.5">
                      <p className="font-bold text-red-900 uppercase text-[9px] tracking-wider">Reason: {customer.block_reason}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-1 flex items-center gap-2">
                  <button 
                    onClick={() => handleViewActivity(customer)}
                    className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink size={14} /> View Details
                  </button>

                  {isBlocked ? (
                    <button
                      onClick={() => setCustomerToUnblock(customer)}
                      className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck size={14} /> Unblock
                    </button>
                  ) : (
                    <button
                      onClick={() => setCustomerToBlock(customer)}
                      className="px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-600 hover:text-white text-red-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserX size={14} /> Block
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-16 bg-white border border-dashed border-stone-200 rounded-[32px]">
          <p className="text-stone-500 font-bold text-sm">No customers found matching your filter or search criteria.</p>
        </div>
      )}

      {/* BLOCK CONFIRMATION MODAL */}
      <AnimatePresence>
        {customerToBlock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#FAF8F5] border border-stone-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900">Block this customer?</h3>
                  <p className="text-xs text-stone-500">Prevent account access for this customer.</p>
                </div>
              </div>

              <div className="p-4 bg-white border border-stone-200 rounded-2xl space-y-1">
                <p className="text-xs font-black text-stone-900">{customerToBlock.full_name || customerToBlock.name || 'Customer'}</p>
                <p className="text-xs text-stone-500 font-mono">{customerToBlock.email}</p>
                {customerToBlock.phone && <p className="text-xs text-stone-500 font-mono">{customerToBlock.phone}</p>}
              </div>

              <p className="text-xs text-stone-600 font-medium leading-relaxed">
                Blocking this account will prevent the customer from accessing their Frosty Bite account.
              </p>

              {/* Predefined Block Reason Dropdown */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-stone-900 uppercase tracking-wider block">Block Reason</label>
                <select
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-[#E76A54]"
                >
                  <option value="Suspicious activity">Suspicious activity</option>
                  <option value="Payment issue">Payment issue</option>
                  <option value="Abuse of service">Abuse of service</option>
                  <option value="Repeated policy violations">Repeated policy violations</option>
                  <option value="Fraud prevention">Fraud prevention</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Additional Note */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-stone-900 uppercase tracking-wider block">Additional Administrative Note</label>
                <textarea
                  value={blockNote}
                  onChange={(e) => setBlockNote(e.target.value)}
                  placeholder="Optional internal note (admin visible only)"
                  rows={2}
                  className="w-full p-3 bg-white border border-stone-300 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-[#E76A54] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCustomerToBlock(null)}
                  disabled={isSubmittingBlock}
                  className="flex-1 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBlock}
                  disabled={isSubmittingBlock}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingBlock ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Blocking…</span>
                    </>
                  ) : (
                    <span>Block Customer</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* UNBLOCK CONFIRMATION MODAL */}
      <AnimatePresence>
        {customerToUnblock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#FAF8F5] border border-stone-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900">Restore customer access?</h3>
                  <p className="text-xs text-stone-500">Unblock account and allow normal sign in.</p>
                </div>
              </div>

              <div className="p-4 bg-white border border-stone-200 rounded-2xl space-y-1">
                <p className="text-xs font-black text-stone-900">{customerToUnblock.full_name || customerToUnblock.name || 'Customer'}</p>
                <p className="text-xs text-stone-500 font-mono">{customerToUnblock.email}</p>
              </div>

              <p className="text-xs text-stone-600 font-medium leading-relaxed">
                This will allow the customer to sign in and access their Frosty Bite account again.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCustomerToUnblock(null)}
                  disabled={isSubmittingUnblock}
                  className="flex-1 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteUnblock}
                  disabled={isSubmittingUnblock}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingUnblock ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Restoring…</span>
                    </>
                  ) : (
                    <span>Unblock Customer</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOMER DETAIL MODAL */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#FAF8F5] border border-stone-200 rounded-[32px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 bg-white border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#E76A54] flex items-center justify-center font-black text-xl">
                    {(selectedCustomer.full_name || selectedCustomer.name || 'F')[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-stone-900 leading-tight">
                      {selectedCustomer.full_name || selectedCustomer.name || 'Foodie Customer'}
                    </h3>
                    <p className="text-xs text-stone-500 font-mono">{selectedCustomer.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white border border-stone-200 p-3.5 rounded-2xl">
                    <p className="text-[10px] text-stone-400 font-black uppercase tracking-wider">Account Status</p>
                    <p className={`text-xs font-black uppercase mt-1 ${selectedCustomer.is_blocked ? 'text-red-600' : 'text-emerald-600'}`}>
                      {selectedCustomer.is_blocked ? 'Blocked' : 'Active'}
                    </p>
                  </div>
                  <div className="bg-white border border-stone-200 p-3.5 rounded-2xl">
                    <p className="text-[10px] text-stone-400 font-black uppercase tracking-wider">Total Orders</p>
                    <p className="text-xs font-black text-stone-900 mt-1">{customerOrders.length || selectedCustomer.total_orders || 0}</p>
                  </div>
                  <div className="bg-white border border-stone-200 p-3.5 rounded-2xl">
                    <p className="text-[10px] text-stone-400 font-black uppercase tracking-wider">Member Since</p>
                    <p className="text-xs font-black text-stone-900 mt-1">{formatDate(selectedCustomer.created_at)}</p>
                  </div>
                </div>

                {/* Recent Orders List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider">Recent Orders</h4>
                  {activityLoading ? (
                    <div className="py-8 text-center text-stone-400 font-bold text-xs animate-pulse">Loading order history…</div>
                  ) : customerOrders.length === 0 ? (
                    <div className="py-6 text-center text-stone-400 text-xs font-medium bg-white border border-stone-200 rounded-2xl">No recent orders recorded for this customer.</div>
                  ) : (
                    <div className="space-y-2">
                      {customerOrders.map(o => (
                        <div key={o.id} className="p-3.5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between text-xs">
                          <div>
                            <p className="font-mono font-bold text-stone-900">#{formatOrderId(o.id)}</p>
                            <p className="text-[10px] text-stone-400">{formatDate(o.created_at)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-stone-900">₹{o.total_amount}</p>
                            <span className="text-[10px] font-bold uppercase text-emerald-600">{o.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
