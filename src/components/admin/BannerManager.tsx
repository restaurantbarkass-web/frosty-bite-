import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ToggleLeft, 
  ToggleRight, 
  BarChart3, 
  X, 
  Image as ImageIcon,
  ExternalLink,
  Save,
  Loader2,
  Calendar,
  Link as LinkIcon,
  Ticket
} from 'lucide-react';
import { supabase } from '../../supabase';
import { Banner } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { ImageUpload } from './ImageUpload';

export const BannerManager: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    redirect_url: '',
    priority: 0,
    is_active: true,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    auto_apply_coupon: ''
  });

  useEffect(() => {
    fetchBanners();
    fetchAnalytics();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error('Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('banner_clicks')
        .select('banner_id');

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach(click => {
        counts[click.banner_id] = (counts[click.banner_id] || 0) + 1;
      });
      setAnalytics(counts);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleOpenModal = (banner: Banner | null = null) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title,
        image_url: banner.image_url,
        redirect_url: banner.redirect_url || '',
        priority: banner.priority,
        is_active: banner.is_active,
        start_date: banner.start_date.split('T')[0],
        end_date: banner.end_date ? banner.end_date.split('T')[0] : '',
        auto_apply_coupon: banner.auto_apply_coupon || ''
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: '',
        image_url: '',
        redirect_url: '',
        priority: 0,
        is_active: true,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        auto_apply_coupon: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const bannerData = {
        title: formData.title,
        image_url: formData.image_url,
        redirect_url: formData.redirect_url,
        priority: Number(formData.priority),
        is_active: formData.is_active,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        auto_apply_coupon: formData.auto_apply_coupon || null
      };

      if (editingBanner) {
        const { error } = await supabase
          .from('banners')
          .update(bannerData)
          .eq('id', editingBanner.id);
        if (error) throw error;
        toast.success('Banner updated');
      } else {
        const { error } = await supabase
          .from('banners')
          .insert([bannerData]);
        if (error) throw error;
        toast.success('Banner created');
      }

      setIsModalOpen(false);
      fetchBanners();
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error('Failed to save banner');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: !b.is_active } : b));
      toast.success(`Banner ${!banner.is_active ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Operation failed');
    }
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    try {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setBanners(prev => prev.filter(b => b.id !== id));
      toast.success('Banner deleted');
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error('Failed to delete banner');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Banner Carousel</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Manage swiggy-style promotions</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-6 py-3 bg-primary hover:bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all active:scale-95 shadow-xl shadow-primary/20"
        >
          <Plus size={16} />
          New Banner
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
          <Loader2 className="animate-spin text-white mb-4" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Loading Banners...</p>
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-20 text-center grayscale opacity-50">
          <ImageIcon className="mx-auto text-white mb-4 opacity-20" size={48} />
          <p className="text-white font-black uppercase tracking-widest text-sm italic">No banners found</p>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-2">Create your first ad banner</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {banners.map((banner) => (
            <motion.div
              key={banner.id}
              layoutId={banner.id}
              className="bg-[#111] border border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-primary/30 transition-all duration-500"
            >
              <div className="relative aspect-[16/9]">
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-700 group-hover:scale-110",
                    !banner.is_active && "grayscale opacity-40"
                  )}
                />
                <div className="absolute top-4 right-4 flex gap-2">
                  <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                    <BarChart3 size={12} className="text-primary" />
                    <span className="text-[10px] font-black italic text-white tracking-widest">{analytics[banner.id] || 0} CLICKS</span>
                  </div>
                </div>
                {!banner.is_active && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="px-6 py-2 bg-rose-500 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-full -rotate-12 shadow-2xl">
                      Disabled
                    </span>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-black uppercase tracking-tight text-lg mb-1 italic line-clamp-1">{banner.title}</h3>
                    <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                      Priority: {banner.priority} • {banner.redirect_url ? 'With Link' : 'No Link'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleStatus(banner)}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      banner.is_active ? "text-emerald-500 bg-emerald-500/10" : "text-zinc-500 bg-white/5"
                    )}
                  >
                    {banner.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleOpenModal(banner)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/5"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => deleteBanner(banner.id)}
                    className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl transition-all active:scale-95 border border-rose-500/20"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-white/5 p-6 sm:p-8 flex justify-between items-center border-b border-white/5 shrink-0">
                <h2 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tighter">
                  {editingBanner ? 'Edit Banner' : 'Create Banner'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 sm:p-3 bg-white/5 rounded-2xl hover:bg-white/10 text-zinc-400">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Banner Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-primary outline-none transition-colors"
                      placeholder="e.g. 50% OFF Sunday Special"
                    />
                  </div>

                  <ImageUpload 
                    onUploadComplete={(url) => setFormData({ ...formData, image_url: url })}
                    currentImage={formData.image_url}
                    label="Banner Image (21:9 Recommended)"
                  />

                  {formData.image_url && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Image URL (Optional Override)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-zinc-400 font-mono truncate">
                          {formData.image_url}
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const newUrl = prompt('Enter new image URL:', formData.image_url);
                            if (newUrl) setFormData({ ...formData, image_url: newUrl });
                          }}
                          className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Auto-Apply Coupon Code (Optional)</label>
                    <div className="relative group">
                      <Ticket size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        value={formData.auto_apply_coupon}
                        onChange={e => setFormData({ ...formData, auto_apply_coupon: e.target.value.toUpperCase() })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-white text-sm focus:border-primary outline-none transition-colors"
                        placeholder="e.g. MOTHERSDAY15"
                      />
                    </div>
                    <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mt-2 ml-1">Applying this will skip manual entry for the user</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Redirect URL (Optional)</label>
                    <div className="relative group">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-primary transition-colors" size={16} />
                      <input
                        type="text"
                        value={formData.redirect_url}
                        onChange={e => setFormData({ ...formData, redirect_url: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-white text-sm focus:border-primary outline-none transition-colors"
                        placeholder="/menu?category=biryani"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Priority (Higher = First)</label>
                      <input
                        type="number"
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-primary outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Status</label>
                      <div 
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className={cn(
                          "flex items-center gap-3 w-full h-[54px] rounded-2xl px-5 border transition-all cursor-pointer",
                          formData.is_active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-white/5 border-white/10 text-zinc-500"
                        )}
                      >
                        {formData.is_active ? <ToggleRight /> : <ToggleLeft />}
                        <span className="text-xs font-black uppercase tracking-widest">{formData.is_active ? 'Active' : 'Draft'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Start Date</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-primary outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">End Date (Optional)</label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-primary outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4 shrink-0">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-white hover:bg-gray-100 text-black py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-2xl"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {editingBanner ? 'Save Changes' : 'Create Banner'}
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
