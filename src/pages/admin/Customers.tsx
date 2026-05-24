import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Search, Mail, Phone, Calendar, MapPin, ExternalLink, MessageCircle, X, ShoppingBag, Star, Award, Flame, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { supabase } from '../../supabase';
import { sendWhatsAppMessage } from '../../utils/whatsapp';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
  created_at?: string;
  last_login?: string;
  points?: number;
  reward_points?: number;
  badge_tier?: string;
  total_orders?: number;
  lifetime_spend?: number;
  activity_streak?: number;
  wallet_balance?: number;
}

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerReviews, setCustomerReviews] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'reviews' | 'loyalty'>('orders');
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
        
        if (error) throw error;
        if (data) setCustomers(data);
      } catch (error) {
        console.error('Error fetching customers from Supabase:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();

    // Subscribe to user changes
    const channel = supabase
      .channel('users_admin_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchCustomers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleViewActivity = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setActivityLoading(true);
    setActiveTab('orders');
    setExpandedOrders({});
    try {
      const { data: oData, error: oErr } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });
        
      if (oErr) {
        console.error('Supabase orders fetch error:', oErr);
      } else if (oData) {
        setCustomerOrders(oData);
      }

      const { data: rData, error: rErr } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', customer.id)
        .order('created_at', { ascending: false });

      if (rErr) {
        console.error('Supabase reviews fetch error:', rErr);
      } else if (rData) {
        setCustomerReviews(rData);
      }
    } catch (err) {
      console.error('Error fetching activity details:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const filteredCustomers = customers.filter(c => 
    (c.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  const formatDate = (dateString: any) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Syncing Customer Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Customer Base</h1>
          <p className="text-gray-500 font-medium">Real-time insights into your registered customers.</p>
        </div>
        <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Active Users</p>
            <p className="text-2xl font-black text-white">{customers.length}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <User size={20} />
          </div>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Search by Name, Email, or Phone..." 
          className="w-full bg-[#111]/80 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredCustomers.map((customer) => (
            <motion.div 
              key={customer.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 space-y-6 relative overflow-hidden group hover:border-primary/20 transition-all"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-all" />
              
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary text-2xl font-black">
                    {customer.full_name ? customer.full_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white capitalize leading-tight">{customer.full_name || 'Guest User'}</h3>
                    <span className="inline-block px-2 py-0.5 mt-1 rounded-md bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest border border-white/5">
                      {customer.role || 'customer'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 relative z-10">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Mail className="shrink-0 text-primary" size={16} />
                  <span className="truncate">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <Phone className="shrink-0 text-primary" size={16} />
                    <span>{customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <Calendar className="shrink-0 text-primary" size={16} />
                  <span>Joined: {formatDate(customer.created_at)}</span>
                </div>
                {customer.address && (
                  <div className="flex items-start gap-3 text-sm text-gray-400">
                    <MapPin className="shrink-0 text-primary mt-1" size={16} />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3 relative z-10">
                <button 
                  onClick={() => handleViewActivity(customer)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  View Activity
                </button>
                {customer.phone && (
                  <button 
                    onClick={() => sendWhatsAppMessage(customer.phone!, `Hello ${customer.full_name || 'Customer'}, this is Frosty Bite Support.`)}
                    className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center"
                    title="Message on WhatsApp"
                  >
                    <MessageCircle size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-[40px]">
          <p className="text-gray-500 font-bold">No customers found matching your search.</p>
        </div>
      )}

      {/* Customer Activity Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0e0e11] border border-white/10 rounded-[32px] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden relative shadow-2xl"
            >
              {/* Modal Background Ambient Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 blur-3xl rounded-full -translate-y-1/2 pointer-events-none" />

              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-start justify-between relative z-10 bg-black/20">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary text-2xl font-black shadow-inner">
                    {selectedCustomer.full_name ? selectedCustomer.full_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight capitalize leading-tight">
                      {selectedCustomer.full_name || 'Guest User'}
                    </h2>
                    <p className="text-xs text-gray-500 font-medium mt-1 uppercase tracking-wider">
                      ID: {selectedCustomer.id}
                    </p>
                    <div className="flex gap-2 items-center mt-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-white/5 text-[9px] font-black text-gray-400 uppercase tracking-widest border border-white/5">
                        {selectedCustomer.role || 'customer'}
                      </span>
                      {selectedCustomer.phone && (
                        <span className="text-xs text-gray-400 font-medium">
                          • {selectedCustomer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-3 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-2xl hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="px-6 border-b border-white/5 flex gap-2 overflow-x-auto relative z-10 bg-black/10">
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`py-4 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'orders' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <ShoppingBag size={14} />
                  Order History ({activityLoading ? '...' : customerOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className={`py-4 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'reviews' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Star size={14} />
                  Reviews Written ({activityLoading ? '...' : customerReviews.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('loyalty')}
                  className={`py-4 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'loyalty' 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Award size={14} />
                  Loyalty Profile & Stats
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar">
                {activityLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-zinc-500 text-xs font-bold animate-pulse">Fetching member activity...</p>
                  </div>
                ) : (
                  <>
                    {/* ORDERS TAB */}
                    {activeTab === 'orders' && (
                      <div className="space-y-4">
                        {customerOrders.length === 0 ? (
                          <div className="text-center py-12 bg-white/5 border border-white/15 rounded-3xl">
                            <ShoppingBag className="mx-auto text-gray-600 mb-2" size={32} />
                            <p className="text-gray-400 font-bold">No orders found for this customer.</p>
                          </div>
                        ) : (
                          customerOrders.map((order) => {
                            const isExpanded = !!expandedOrders[order.id];
                            return (
                              <div 
                                key={order.id} 
                                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-white/15"
                              >
                                {/* Order Summary row */}
                                <div 
                                  onClick={() => toggleOrderExpand(order.id)}
                                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                        Order ID
                                      </span>
                                      <span className="text-sm font-mono font-black text-white">
                                        #{order.id.slice(-8).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-gray-400">
                                      {order.created_at ? new Date(order.created_at).toLocaleString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                      }) : 'N/A'}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-sm font-black text-white">
                                      ₹{order.total || 0}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded bg-white/5 text-[9px] font-black uppercase tracking-wider border ${
                                      order.status === 'delivered' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' :
                                      order.status === 'cancelled' ? 'text-red-400 border-red-500/20 bg-red-500/5' :
                                      'text-yellow-400 border-yellow-500/20 bg-yellow-500/5'
                                    }`}>
                                      {order.status || 'pending'}
                                    </span>
                                    {order.payment_status && (
                                      <span className={`px-2.5 py-1 rounded bg-white/5 text-[9px] font-black uppercase tracking-wider border ${
                                        order.payment_status === 'paid' ? 'text-emerald-400 border-emerald-500/20' :
                                        'text-orange-400 border-orange-500/20'
                                      }`}>
                                        {order.payment_status}
                                      </span>
                                    )}
                                    {isExpanded ? <ChevronUp size={16} className="text-gray-400 ml-1" /> : <ChevronDown size={16} className="text-gray-400 ml-1" />}
                                  </div>
                                </div>

                                {/* Order details body */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div 
                                      initial={{ height: 0 }}
                                      animate={{ height: 'auto' }}
                                      exit={{ height: 0 }}
                                      className="border-t border-white/5 overflow-hidden bg-black/20"
                                    >
                                      <div className="p-5 space-y-4 text-xs text-gray-400">
                                        <div>
                                          <p className="font-bold text-white mb-2 uppercase tracking-wide text-[10px]">
                                            Items Ordered
                                          </p>
                                          <div className="space-y-2">
                                            {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                                              <div key={idx} className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-3">
                                                  {item.image && (
                                                    <img 
                                                      src={item.image} 
                                                      alt={item.name} 
                                                      className="w-10 h-10 rounded-lg object-cover" 
                                                      referrerPolicy="no-referrer"
                                                    />
                                                  )}
                                                  <div>
                                                    <p className="font-bold text-white">{item.name}</p>
                                                    <p className="text-[10px] text-gray-500">Qty: {item.quantity || 1}</p>
                                                  </div>
                                                </div>
                                                <p className="font-mono text-white">₹{(item.price || 0) * (item.quantity || 1)}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                          {order.address && (
                                            <div>
                                              <p className="font-bold text-white uppercase tracking-wide text-[10px] mb-1">
                                                Delivery Address
                                              </p>
                                              <p className="leading-relaxed text-[11px]">{order.address}</p>
                                            </div>
                                          )}
                                          <div>
                                            <p className="font-bold text-white uppercase tracking-wide text-[10px] mb-1">
                                              Transaction Info
                                            </p>
                                            <ul className="space-y-1 text-[11px]">
                                              <li>Payment Type: <span className="text-white capitalize">{order.payment_method || 'N/A'}</span></li>
                                              {order.utr && (
                                                <li>UTR / UPI ID: <span className="text-white font-mono">{order.utr}</span></li>
                                              )}
                                              {order.notes && (
                                                <li>Special Notes: <span className="text-white">{order.notes}</span></li>
                                              )}
                                            </ul>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* REVIEWS TAB */}
                    {activeTab === 'reviews' && (
                      <div className="space-y-4">
                        {customerReviews.length === 0 ? (
                          <div className="text-center py-12 bg-white/5 border border-white/15 rounded-3xl">
                            <Star className="mx-auto text-gray-600 mb-2" size={32} />
                            <p className="text-gray-400 font-bold">No reviews submitted by this customer.</p>
                          </div>
                        ) : (
                          customerReviews.map((review) => (
                            <div key={review.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex gap-1.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star 
                                      key={s} 
                                      size={14} 
                                      className={s <= (review.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'} 
                                    />
                                  ))}
                                </div>
                                <span className="text-[10px] text-gray-500">
                                  {review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                  }) : 'N/A'}
                                </span>
                              </div>
                              <p className="text-sm text-white italic opacity-90 leading-relaxed">
                                "{review.comment || 'No comment provided.'}"
                              </p>
                              {review.order_id && (
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider font-mono pt-1">
                                  <span>Order ID:</span>
                                  <span className="text-primary font-bold">#{review.order_id.slice(-8).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* STATS & LOYALTY TAB */}
                    {activeTab === 'loyalty' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {/* Points widget */}
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                              <Award size={22} />
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                Loyalty Points
                              </p>
                              <p className="text-2xl font-black text-white mt-1">
                                {selectedCustomer.points || 0}
                              </p>
                            </div>
                          </div>

                          {/* Streak Level widget */}
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden">
                            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                              <Flame size={22} />
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                Member Streak
                              </p>
                              <p className="text-2xl font-black text-white mt-1">
                                {selectedCustomer.activity_streak || 0} Days
                              </p>
                            </div>
                          </div>

                          {/* Wallet widget */}
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                              <Wallet size={22} />
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                Wallet Balance
                              </p>
                              <p className="text-2xl font-black text-white mt-1">
                                ₹{selectedCustomer.wallet_balance || 0}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Extended details box */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                          <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                            Membership Status Overview
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                Tier Badge
                              </p>
                              <p className="text-sm font-bold text-white capitalize">
                                {selectedCustomer.badge_tier || 'Bronze Member'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                Points Available for Redemption
                              </p>
                              <p className="text-sm font-bold text-white">
                                {selectedCustomer.reward_points || 0} Points
                              </p>
                            </div>
                            <div className="space-y-1 pt-2 border-t border-white/5 col-span-2 sm:col-span-1">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                Total Orders Placed
                              </p>
                              <p className="text-sm font-bold text-white">
                                {selectedCustomer.total_orders || 0} Orders
                              </p>
                            </div>
                            <div className="space-y-1 pt-2 border-t border-white/5 col-span-2 sm:col-span-1">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                Lifetime Spend
                              </p>
                              <p className="text-sm font-bold text-white">
                                ₹{selectedCustomer.lifetime_spend || 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/10 flex justify-end bg-black/20 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white rounded-2xl transition-all cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
