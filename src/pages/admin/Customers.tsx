import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Search, Mail, Phone, Calendar, MapPin, ExternalLink, MessageCircle, X, ShoppingBag, Star, Award, Flame, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { supabase } from '../../supabase';
import { sendWhatsAppMessage } from '../../utils/whatsapp';
import { formatOrderId } from '../../utils/orderUtils';

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
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 bg-white border border-stone-200/80 rounded-3xl p-12 shadow-xs">
        <div className="w-12 h-12 border-4 border-[#E76A54]/20 border-t-[#E76A54] rounded-full animate-spin" />
        <p className="text-stone-500 font-bold animate-pulse text-sm">Syncing Customer Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight mb-1 sm:mb-2">Customer Base</h1>
          <p className="text-stone-500 font-medium text-sm">Real-time insights into your registered customers.</p>
        </div>
        <div className="px-5 py-3 bg-white border border-stone-200 rounded-2xl flex items-center gap-4 shadow-xs self-start md:self-auto">
          <div className="text-right">
            <p className="text-[10px] text-stone-500 font-black uppercase tracking-widest">Active Users</p>
            <p className="text-xl sm:text-2xl font-black text-stone-900">{customers.length}</p>
          </div>
          <div className="w-px h-8 bg-stone-200" />
          <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center text-[#E76A54]">
            <User size={20} />
          </div>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#E76A54] transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Search by Name, Email, or Phone..." 
          className="w-full bg-white border border-stone-200 rounded-2xl py-4 sm:py-5 pl-14 pr-6 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#E76A54] transition-all font-medium shadow-xs text-sm sm:text-base"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        <AnimatePresence mode="popLayout">
          {filteredCustomers.map((customer) => (
            <motion.div 
              key={customer.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-stone-200/80 rounded-[28px] p-6 sm:p-8 space-y-5 relative overflow-hidden group hover:border-[#E76A54]/40 transition-all shadow-xs"
            >
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center text-[#E76A54] text-xl font-black">
                    {customer.full_name ? customer.full_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 capitalize leading-tight">{customer.full_name || 'Guest User'}</h3>
                    <span className="inline-block px-2 py-0.5 mt-1 rounded-md bg-stone-100 text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                      {customer.role || 'customer'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 relative z-10">
                <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-600">
                  <Mail className="shrink-0 text-[#E76A54]" size={15} />
                  <span className="truncate">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-600">
                    <Phone className="shrink-0 text-[#E76A54]" size={15} />
                    <span>{customer.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-600">
                  <Calendar className="shrink-0 text-[#E76A54]" size={15} />
                  <span>Joined: {formatDate(customer.created_at)}</span>
                </div>
                {customer.address && (
                  <div className="flex items-start gap-3 text-xs sm:text-sm text-stone-600">
                    <MapPin className="shrink-0 text-[#E76A54] mt-0.5" size={15} />
                    <span className="line-clamp-2">{customer.address}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3 relative z-10">
                <button 
                  onClick={() => handleViewActivity(customer)}
                  className="flex-1 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-bold text-stone-800 hover:bg-stone-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={14} />
                  View Activity
                </button>
                {customer.phone && (
                  <button 
                    onClick={() => sendWhatsAppMessage(customer.phone!, `Hello ${customer.full_name || 'Customer'}, this is Frosty Bite Support.`)}
                    className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center cursor-pointer"
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
        <div className="text-center py-16 bg-white border border-dashed border-stone-200 rounded-[32px]">
          <p className="text-stone-500 font-bold">No customers found matching your search.</p>
        </div>
      )}

      {/* Customer Activity Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-stone-200 rounded-[32px] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-stone-200 flex items-start justify-between relative z-10 bg-stone-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-stone-200 flex items-center justify-center text-[#E76A54] text-xl font-black shadow-xs">
                    {selectedCustomer.full_name ? selectedCustomer.full_name[0].toUpperCase() : '?'}
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight capitalize leading-tight">
                      {selectedCustomer.full_name || 'Guest User'}
                    </h2>
                    <p className="text-xs text-stone-500 font-medium mt-0.5 uppercase tracking-wider">
                      ID: {selectedCustomer.id}
                    </p>
                    <div className="flex gap-2 items-center mt-1.5">
                      <span className="inline-block px-2 py-0.5 rounded bg-stone-100 text-[9px] font-bold text-stone-600 uppercase tracking-widest">
                        {selectedCustomer.role || 'customer'}
                      </span>
                      {selectedCustomer.phone && (
                        <span className="text-xs text-stone-600 font-medium">
                          • {selectedCustomer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2.5 bg-stone-100 border border-stone-200 text-stone-500 hover:text-stone-900 rounded-2xl hover:bg-stone-200 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="px-4 sm:px-6 border-b border-stone-200 flex gap-2 overflow-x-auto relative z-10 bg-stone-50">
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`py-3 sm:py-4 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'orders' 
                      ? 'border-[#E76A54] text-[#E76A54]' 
                      : 'border-transparent text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <ShoppingBag size={14} />
                  Order History ({activityLoading ? '...' : customerOrders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className={`py-3 sm:py-4 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'reviews' 
                      ? 'border-[#E76A54] text-[#E76A54]' 
                      : 'border-transparent text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <Star size={14} />
                  Reviews Written ({activityLoading ? '...' : customerReviews.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('loyalty')}
                  className={`py-3 sm:py-4 px-3 sm:px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'loyalty' 
                      ? 'border-[#E76A54] text-[#E76A54]' 
                      : 'border-transparent text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <Award size={14} />
                  Loyalty Profile & Stats
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10 custom-scrollbar">
                {activityLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-10 h-10 border-4 border-[#E76A54]/20 border-t-[#E76A54] rounded-full animate-spin" />
                    <p className="text-stone-500 text-xs font-bold animate-pulse">Fetching member activity...</p>
                  </div>
                ) : (
                  <>
                    {/* ORDERS TAB */}
                    {activeTab === 'orders' && (
                      <div className="space-y-3 sm:space-y-4">
                        {customerOrders.length === 0 ? (
                          <div className="text-center py-12 bg-stone-50 border border-stone-200 rounded-3xl">
                            <ShoppingBag className="mx-auto text-stone-400 mb-2" size={32} />
                            <p className="text-stone-500 font-bold text-sm">No orders found for this customer.</p>
                          </div>
                        ) : (
                          customerOrders.map((order) => {
                            const isExpanded = !!expandedOrders[order.id];
                            return (
                              <div 
                                key={order.id} 
                                className="bg-white border border-stone-200 rounded-2xl overflow-hidden transition-all hover:border-stone-300 shadow-2xs"
                              >
                                {/* Order Summary row */}
                                <div 
                                  onClick={() => toggleOrderExpand(order.id)}
                                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-stone-400 uppercase tracking-widest">
                                        Order ID
                                      </span>
                                      <span className="text-sm font-mono font-bold text-stone-900">
                                        #{formatOrderId(order.id)}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-stone-500">
                                      {order.created_at ? new Date(order.created_at).toLocaleString('en-IN', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                      }) : 'N/A'}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <span className="text-sm font-black text-stone-900">
                                      ₹{order.total || 0}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                      order.status === 'delivered' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
                                      order.status === 'cancelled' ? 'text-rose-700 border-rose-200 bg-rose-50' :
                                      'text-amber-700 border-amber-200 bg-amber-50'
                                    }`}>
                                      {order.status || 'pending'}
                                    </span>
                                    {order.payment_status && (
                                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                        order.payment_status === 'paid' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' :
                                        'text-amber-700 border-amber-200 bg-amber-50'
                                      }`}>
                                        {order.payment_status}
                                      </span>
                                    )}
                                    {isExpanded ? <ChevronUp size={16} className="text-stone-400 ml-1" /> : <ChevronDown size={16} className="text-stone-400 ml-1" />}
                                  </div>
                                </div>

                                {/* Order details body */}
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div 
                                      initial={{ height: 0 }}
                                      animate={{ height: 'auto' }}
                                      exit={{ height: 0 }}
                                      className="border-t border-stone-100 overflow-hidden bg-stone-50/50"
                                    >
                                      <div className="p-4 sm:p-5 space-y-4 text-xs text-stone-600">
                                        <div>
                                          <p className="font-bold text-stone-900 mb-2 uppercase tracking-wide text-[10px]">
                                            Items Ordered
                                          </p>
                                          <div className="space-y-2">
                                            {Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                                              <div key={idx} className="flex justify-between items-center bg-white rounded-xl p-3 border border-stone-200">
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
                                                    <p className="font-bold text-stone-900">{item.name}</p>
                                                    <p className="text-[10px] text-stone-500">Qty: {item.quantity || 1}</p>
                                                  </div>
                                                </div>
                                                <p className="font-mono font-bold text-stone-900">₹{(item.price || 0) * (item.quantity || 1)}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-stone-200">
                                          {order.address && (
                                            <div>
                                              <p className="font-bold text-stone-900 uppercase tracking-wide text-[10px] mb-1">
                                                Delivery Address
                                              </p>
                                              <p className="leading-relaxed text-[11px] text-stone-600">{order.address}</p>
                                            </div>
                                          )}
                                          <div>
                                            <p className="font-bold text-stone-900 uppercase tracking-wide text-[10px] mb-1">
                                              Transaction Info
                                            </p>
                                            <ul className="space-y-1 text-[11px] text-stone-600">
                                              <li>Payment Type: <span className="text-stone-900 font-semibold capitalize">{order.payment_method || 'N/A'}</span></li>
                                              {order.utr && (
                                                <li>UTR / UPI ID: <span className="text-stone-900 font-mono font-semibold">{order.utr}</span></li>
                                              )}
                                              {order.notes && (
                                                <li>Special Notes: <span className="text-stone-900 font-semibold">{order.notes}</span></li>
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
                      <div className="space-y-3 sm:space-y-4">
                        {customerReviews.length === 0 ? (
                          <div className="text-center py-12 bg-stone-50 border border-stone-200 rounded-3xl">
                            <Star className="mx-auto text-stone-400 mb-2" size={32} />
                            <p className="text-stone-500 font-bold text-sm">No reviews submitted by this customer.</p>
                          </div>
                        ) : (
                          customerReviews.map((review) => (
                            <div key={review.id} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <div className="flex gap-1.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star 
                                      key={s} 
                                      size={14} 
                                      className={s <= (review.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-stone-300'} 
                                    />
                                  ))}
                                </div>
                                <span className="text-[10px] text-stone-400">
                                  {review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                  }) : 'N/A'}
                                </span>
                              </div>
                              <p className="text-sm text-stone-800 italic leading-relaxed">
                                "{review.comment || 'No comment provided.'}"
                              </p>
                              {review.order_id && (
                                <div className="flex items-center gap-1.5 text-[10px] text-stone-500 uppercase tracking-wider font-mono pt-1">
                                  <span>Order ID:</span>
                                  <span className="text-[#E76A54] font-bold">#{review.order_id.slice(-8).toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* STATS & LOYALTY TAB */}
                    {activeTab === 'loyalty' && (
                      <div className="space-y-5 sm:space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                          {/* Points widget */}
                          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                              <Award size={22} />
                            </div>
                            <div>
                              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                Loyalty Points
                              </p>
                              <p className="text-xl sm:text-2xl font-black text-stone-900 mt-0.5">
                                {selectedCustomer.points || 0}
                              </p>
                            </div>
                          </div>

                          {/* Streak Level widget */}
                          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                              <Flame size={22} />
                            </div>
                            <div>
                              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                Member Streak
                              </p>
                              <p className="text-xl sm:text-2xl font-black text-stone-900 mt-0.5">
                                {selectedCustomer.activity_streak || 0} Days
                              </p>
                            </div>
                          </div>

                          {/* Wallet widget */}
                          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                              <Wallet size={22} />
                            </div>
                            <div>
                              <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">
                                Wallet Balance
                              </p>
                              <p className="text-xl sm:text-2xl font-black text-stone-900 mt-0.5">
                                ₹{selectedCustomer.wallet_balance || 0}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Extended details box */}
                        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 sm:p-6">
                          <h4 className="text-sm font-bold text-stone-900 mb-4 uppercase tracking-wider">
                            Membership Status Overview
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                                Tier Badge
                              </p>
                              <p className="text-sm font-bold text-stone-900 capitalize">
                                {selectedCustomer.badge_tier || 'Bronze Member'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                                Points Available
                              </p>
                              <p className="text-sm font-bold text-stone-900">
                                {selectedCustomer.reward_points || 0} Points
                              </p>
                            </div>
                            <div className="space-y-1 pt-2 border-t border-stone-200 col-span-2 sm:col-span-1">
                              <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                                Total Orders Placed
                              </p>
                              <p className="text-sm font-bold text-stone-900">
                                {selectedCustomer.total_orders || 0} Orders
                              </p>
                            </div>
                            <div className="space-y-1 pt-2 border-t border-stone-200 col-span-2 sm:col-span-1">
                              <p className="text-[10px] text-stone-500 uppercase tracking-wider">
                                Lifetime Spend
                              </p>
                              <p className="text-sm font-bold text-stone-900">
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
              <div className="p-4 sm:p-5 border-t border-stone-200 flex justify-end bg-stone-50 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-6 py-2.5 bg-white hover:bg-stone-100 border border-stone-200 text-xs font-bold text-stone-800 rounded-2xl transition-all cursor-pointer shadow-xs"
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
