import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  XCircle,
  Tag,
  Calendar,
  Users,
  Percent,
  DollarSign,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_item';
  value: number;
  min_order: number;
  expiry_date: string;
  usage_limit: number;
  usage_count: number;
  status: 'active' | 'expired' | 'disabled';
  is_hidden?: boolean;
  is_first_order_only?: boolean;
  created_at: string;
  free_item_id?: string;
  free_item_quantity?: number;
  gift_url?: string;
}

import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

export const Coupons: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed' | 'free_item',
    value: 0,
    min_order: 0,
    expiry_date: '',
    usage_limit: 100,
    is_hidden: false,
    is_first_order_only: false,
    free_item_id: '',
    free_item_quantity: 1,
    gift_url: ''
  });

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCoupons(data || []);
      localStorage.setItem('coupons_cache', JSON.stringify({ data: data || [], timestamp: Date.now() }));
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

  useEffect(() => {
    fetchCoupons();

    const channel = supabase
      .channel('coupons_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () => {
        fetchCoupons();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('coupons')
        .insert([{
          ...newCoupon,
          code: newCoupon.code.toUpperCase(),
          usage_count: 0,
          status: 'active',
          created_at: new Date().toISOString()
        }]);
      
      if (error) throw error;
      
      toast.success(`Successfully created coupon ${newCoupon.code.toUpperCase()}`);
      setIsModalOpen(false);
      setNewCoupon({
        code: '',
        type: 'percentage',
        value: 0,
        min_order: 0,
        expiry_date: '',
        usage_limit: 100,
        is_hidden: false,
        is_first_order_only: false,
        free_item_id: '',
        free_item_quantity: 1,
        gift_url: ''
      });
      fetchCoupons();
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      toast.error(error.message || 'Error occurred creating coupon');
    } finally {
      setIsLoading(false);
    }
  };

  const generateFirstOrderCoupon = async () => {
    setIsLoading(true);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      const expiryStr = expiryDate.toISOString().split('T')[0];

      const { error } = await supabase
        .from('coupons')
        .insert([{
          code: 'FIRSTORDER',
          type: 'percentage',
          value: 20,
          min_order: 0,
          expiry_date: expiryStr,
          usage_limit: 100,
          usage_count: 0,
          status: 'active',
          is_first_order_only: true,
          created_at: new Date().toISOString()
        }]);
      
      if (error) throw error;

      toast.success('FIRSTORDER coupon generated successfully!');
      fetchCoupons();
    } catch (error: any) {
      console.error('Error generating FIRSTORDER coupon:', error);
      toast.error(error.message || 'Error generating FIRSTORDER coupon');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    const backup = [...coupons];
    // Optimistic Update
    setCoupons(prev => prev.filter(c => c.id !== id));
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setDeletingId(null);
      toast.success('Coupon removed successfully');
      fetchCoupons();
    } catch (error: any) {
      setCoupons(backup);
      console.error('Error deleting coupon:', error);
      toast.error(error.message || 'Failed to delete coupon');
    }
  };

  const toggleCouponStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    // Optimistic Update
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, status: newStatus as any } : c));
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      toast.success(`Coupon set to ${newStatus}`);
      fetchCoupons();
    } catch (error: any) {
      // Revert
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, status: currentStatus as any } : c));
      console.error('Error toggling coupon status:', error);
      toast.error('Failed to update coupon status');
    }
  };

  const toggleCouponVisibility = async (id: string, isCurrentlyHidden: boolean) => {
    const newHidden = !isCurrentlyHidden;
    // Optimistic Update
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_hidden: newHidden } : c));
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_hidden: newHidden })
        .eq('id', id);
      
      if (error) throw error;
      toast.success(`Coupon visibility changed to ${newHidden ? 'Hidden' : 'Visible'}`);
      fetchCoupons();
    } catch (error: any) {
      // Revert
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_hidden: isCurrentlyHidden } : c));
      console.error('Error toggling coupon visibility:', error);
      toast.error('Failed to update visibility');
    }
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && handleDeleteCoupon(deletingId)}
        title="Delete Coupon?"
        description="This will permanently remove this coupon code. This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-white">Coupons & Discounts</h2>
          <p className="text-zinc-500 text-sm font-medium">Manage promotional codes and special offers</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={generateFirstOrderCoupon}
            disabled={isLoading}
            className="flex items-center gap-2 bg-white/5 text-zinc-500 px-6 py-3 rounded-2xl font-bold hover:bg-white/10 hover:text-white transition-all border border-white/5 disabled:opacity-50"
          >
            <Tag size={20} />
            Generate FIRSTORDER
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all"
          >
            <Plus size={20} />
            Create Coupon
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-dark p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center text-orange-500">
              <Tag size={24} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Active Coupons</p>
              <h3 className="text-2xl font-black text-white">{coupons.filter(c => c.status === 'active').length}</h3>
            </div>
          </div>
        </div>
              <div className="glass-dark p-6 rounded-3xl border border-white/5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Total Redemptions</p>
                    <h3 className="text-2xl font-black text-white">{coupons.reduce((acc, curr) => acc + (curr.usage_count || 0), 0)}</h3>
                  </div>
                </div>
              </div>
        <div className="glass-dark p-6 rounded-3xl border border-white/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Expiring Soon</p>
              <h3 className="text-2xl font-black text-white">3</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Coupons List */}
      <div className="glass-dark rounded-[2.5rem] border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Search by code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-3 bg-white/5 border border-white/10 rounded-xl text-zinc-500 hover:text-white transition-all">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto hidden lg:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-6 py-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Coupon Code</th>
                <th className="px-6 py-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Discount</th>
                <th className="px-6 py-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Min. Order</th>
                <th className="px-6 py-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Usage</th>
                <th className="px-6 py-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Expiry</th>
                <th className="px-6 py-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Public?</th>
                <th className="px-6 py-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] text-zinc-500 uppercase font-black tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCoupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <Tag size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-white tracking-wider">{coupon.code}</span>
                        {coupon.is_first_order_only && (
                          <span className="text-[8px] text-orange-500 font-black uppercase tracking-widest">First Order Only</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-white">
                      {coupon.type === 'percentage' ? `${coupon.value}%` : 
                       coupon.type === 'fixed' ? `₹${coupon.value}` : 
                       `Gift: ${coupon.free_item_quantity}x Item`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">₹{coupon.min_order}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        <span>{coupon.usage_count} / {coupon.usage_limit}</span>
                      </div>
                      <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500" 
                          style={{ width: `${((coupon.usage_count || 0) / (coupon.usage_limit || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{coupon.expiry_date}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleCouponVisibility(coupon.id, !!coupon.is_hidden)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        coupon.is_hidden ? "text-zinc-500 hover:text-white bg-white/5" : "text-emerald-500 bg-emerald-500/10"
                      )}
                      title={coupon.is_hidden ? "Show on Offers page" : "Hide from Offers page"}
                    >
                      {coupon.is_hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      coupon.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 
                      coupon.status === 'expired' ? 'bg-red-500/10 text-red-500' : 
                      'bg-zinc-500/10 text-zinc-500'
                    }`}>
                      {coupon.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleCouponStatus(coupon.id, coupon.status)}
                        className="p-2 bg-white/5 border border-white/10 rounded-lg text-zinc-500 hover:text-white transition-all"
                      >
                        {coupon.status === 'active' ? <XCircle size={16} /> : <CheckCircle size={16} />}
                      </button>
                      <button 
                        onClick={() => setDeletingId(coupon.id)}
                        className="p-2 bg-white/5 border border-white/10 rounded-lg text-zinc-500 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Coupon List */}
        <div className="lg:hidden divide-y divide-white/5">
          {filteredCoupons.map((coupon) => (
            <div key={coupon.id} className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <Tag size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-white tracking-wider text-sm">{coupon.code}</span>
                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                      coupon.status === 'active' ? 'text-emerald-500' : 'text-zinc-500'
                    }`}>{coupon.status}</span>
                  </div>
                </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">
                      {coupon.type === 'percentage' ? `${coupon.value}%` : 
                       coupon.type === 'fixed' ? `₹${coupon.value}` : 
                       'Free Gift'}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-bold">Min: ₹{coupon.min_order}</p>
                  </div>
                </div>
  
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-[8px] text-zinc-500 font-black uppercase tracking-widest mb-1">
                      <span>Usage</span>
                      <span>{coupon.usage_count}/{coupon.usage_limit}</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500" 
                        style={{ width: `${((coupon.usage_count || 0) / (coupon.usage_limit || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-0.5">Expires</p>
                    <p className="text-[10px] text-white font-bold">{coupon.expiry_date}</p>
                  </div>
                </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => toggleCouponStatus(coupon.id, coupon.status)}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-center gap-2"
                >
                  {coupon.status === 'active' ? 'Disable' : 'Enable'}
                </button>
                <button 
                  onClick={() => setDeletingId(coupon.id)}
                  className="px-4 py-2.5 bg-red-500/10 border border-red-500/10 rounded-xl text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#121212] border border-white/10 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6 sm:mb-8 shrink-0">
                <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">New Coupon</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateCoupon} className="space-y-6 overflow-y-auto no-scrollbar pb-6 pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Coupon Code</label>
                    <input 
                      type="text" 
                      required
                      placeholder="E.G. WELCOME50"
                      value={newCoupon.code}
                      onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-bold placeholder:text-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Type</label>
                    <select 
                      value={newCoupon.type}
                      onChange={(e) => setNewCoupon({...newCoupon, type: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-sans"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                      <option value="free_item">Free Gift Item</option>
                    </select>
                  </div>
                  {newCoupon.type !== 'free_item' ? (
                    <div>
                      <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Value</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          required
                          value={newCoupon.value}
                          onChange={(e) => setNewCoupon({...newCoupon, value: Number(e.target.value)})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-bold"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                          {newCoupon.type === 'percentage' ? <Percent size={16} /> : <DollarSign size={16} />}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="col-span-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Free Item ID</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. cupcakes"
                        value={newCoupon.free_item_id}
                        onChange={(e) => setNewCoupon({...newCoupon, free_item_id: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-bold"
                      />
                    </div>
                  )}
                  {newCoupon.type === 'free_item' && (
                    <div className="col-span-1 text-left">
                      <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Gift Quantity</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        value={newCoupon.free_item_quantity}
                        onChange={(e) => setNewCoupon({...newCoupon, free_item_quantity: Number(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-bold"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Gift Info URL (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. /product/cupcake-tasting-pack"
                      value={newCoupon.gift_url}
                      onChange={(e) => setNewCoupon({...newCoupon, gift_url: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-bold placeholder:text-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Min. Order (₹)</label>
                    <input 
                      type="number" 
                      required
                      value={newCoupon.min_order}
                      onChange={(e) => setNewCoupon({...newCoupon, min_order: Number(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Usage Limit</label>
                    <input 
                      type="number" 
                      required
                      value={newCoupon.usage_limit}
                      onChange={(e) => setNewCoupon({...newCoupon, usage_limit: Number(e.target.value)})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-bold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2 block">Expiry Date</label>
                    <input 
                      type="date" 
                      required
                      value={newCoupon.expiry_date}
                      onChange={(e) => setNewCoupon({...newCoupon, expiry_date: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-bold appearance-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only"
                          checked={newCoupon.is_first_order_only}
                          onChange={(e) => setNewCoupon({...newCoupon, is_first_order_only: e.target.checked})}
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${newCoupon.is_first_order_only ? 'bg-orange-500' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${newCoupon.is_first_order_only ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest group-hover:text-zinc-300 transition-colors">First Order Only</span>
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only"
                          checked={newCoupon.is_hidden}
                          onChange={(e) => setNewCoupon({...newCoupon, is_hidden: e.target.checked})}
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${newCoupon.is_hidden ? 'bg-orange-500' : 'bg-zinc-800'}`}>
                          <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${newCoupon.is_hidden ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest group-hover:text-zinc-300 transition-colors">Hide from Offers List</span>
                    </label>
                  </div>
                </div>

                <div className="sticky bottom-0 pt-4 bg-[#121212] shrink-0">
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Creating...' : 'Create Coupon'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
