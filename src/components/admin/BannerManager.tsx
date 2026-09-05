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
  Ticket,
  Sparkles,
  Zap
} from 'lucide-react';
import { supabase } from '../../supabase';
import { Banner } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { ImageUpload } from './ImageUpload';
import { ConfirmationModal } from '../ui/ConfirmationModal';

export const BannerManager: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    redirect_url: '',
    priority: 0,
    is_active: true,
    is_flash_deal: false,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    auto_apply_coupon: '',
    gift_url: ''
  });

  useEffect(() => {
    fetchBanners();
    fetchAnalytics();

    const channel = supabase
      .channel('admin_banners_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banners' },
        () => {
          console.log('[Realtime] Admin BannerManager detected banner changes, re-fetching...');
          fetchBanners();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        is_flash_deal: banner.is_flash_deal || false,
        start_date: banner.start_date.split('T')[0],
        end_date: banner.end_date ? banner.end_date.split('T')[0] : '',
        auto_apply_coupon: banner.auto_apply_coupon || '',
        gift_url: banner.gift_url || ''
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: '',
        image_url: '',
        redirect_url: '',
        priority: 0,
        is_active: true,
        is_flash_deal: false,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        auto_apply_coupon: '',
        gift_url: ''
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
        is_flash_deal: formData.is_flash_deal,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        auto_apply_coupon: formData.auto_apply_coupon || null,
        gift_url: formData.gift_url || null
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
    } catch (error: any) {
      console.error('Error saving banner:', error);
      const errorMessage = error?.message || 'Failed to save banner';
      toast.error(errorMessage, {
        duration: 5000,
        style: {
          borderRadius: '16px',
          background: '#18181b',
          color: '#fff',
          fontSize: '12px'
        }
      });
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
    try {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setBanners(prev => prev.filter(b => b.id !== id));
      setDeletingId(null);
      toast.success('Banner deleted');
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error('Failed to delete banner');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteBanner(deletingId)}
        title="Delete Banner?"
        description="This action cannot be undone. Are you sure you want to remove this banner?"
        confirmText="Delete"
        variant="danger"
      />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">Banner Carousel</h1>
          <p className="text-stone-500 text-xs sm:text-sm font-medium mt-1">Manage promotional banners and flash deal highlights</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto px-5 py-3 bg-[#E76A54] hover:bg-[#d55b45] text-white rounded-2xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-[#E76A54]/20 cursor-pointer"
        >
          <Plus size={16} />
          New Banner
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#E76A54] mb-3" size={28} />
          <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">Loading Banners...</p>
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white border border-stone-200/80 rounded-3xl p-12 sm:p-20 text-center shadow-xs">
          <ImageIcon className="mx-auto text-stone-300 mb-3" size={44} />
          <p className="text-stone-800 font-bold text-base sm:text-lg">No banners found</p>
          <p className="text-stone-400 text-xs mt-1">Create your first bakery promotional banner</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {banners.map((banner) => (
            <motion.div
              key={banner.id}
              layoutId={banner.id}
              className="bg-white border border-stone-200/80 rounded-3xl overflow-hidden group hover:border-[#E76A54]/40 transition-all duration-300 shadow-xs flex flex-col"
            >
              <div className="relative aspect-[16/9] bg-stone-100">
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
                    !banner.is_active && "grayscale opacity-40"
                  )}
                />
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {banner.is_flash_deal && (
                    <div className="px-2.5 py-1 bg-rose-600 rounded-full flex items-center gap-1.5 shadow-sm">
                      <Zap size={10} className="fill-white text-white" />
                      <span className="text-[9px] font-black text-white tracking-wider">FLASH DEAL</span>
                    </div>
                  )}
                  <div className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full flex items-center gap-1.5 shadow-sm">
                    <BarChart3 size={11} className="text-[#E76A54]" />
                    <span className="text-[9px] font-bold text-white tracking-wider">{analytics[banner.id] || 0} CLICKS</span>
                  </div>
                </div>
                {!banner.is_active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <span className="px-4 py-1.5 bg-stone-800 text-white font-black uppercase tracking-widest text-[10px] rounded-full shadow-lg">
                      Disabled
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-stone-900 font-bold text-base mb-1 line-clamp-1">{banner.title}</h3>
                    <button
                      onClick={() => toggleStatus(banner)}
                      className={cn(
                        "p-1.5 rounded-xl transition-all cursor-pointer shrink-0",
                        banner.is_active ? "text-emerald-600 bg-emerald-50" : "text-stone-400 bg-stone-100"
                      )}
                      title={banner.is_active ? "Disable Banner" : "Enable Banner"}
                    >
                      {banner.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>
                  <p className="text-stone-400 text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5">
                    Priority: {banner.priority} • {banner.redirect_url ? 'Has Link' : 'No Link'}
                    {banner.auto_apply_coupon && ` • Coupon: ${banner.auto_apply_coupon}`}
                  </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-stone-100">
                  <button
                    onClick={() => handleOpenModal(banner)}
                    className="flex-1 bg-[#FAF8F5] hover:bg-stone-100 text-stone-800 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all border border-stone-200 cursor-pointer"
                  >
                    <Edit2 size={13} />
                    Edit
                  </button>
                  <button
                    onClick={() => setDeletingId(banner.id)}
                    className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all border border-rose-200 cursor-pointer"
                    title="Delete Banner"
                  >
                    <Trash2 size={15} />
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-lg bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-[#FAF8F5] p-5 sm:p-6 flex justify-between items-center border-b border-stone-200 shrink-0">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                  {editingBanner ? 'Edit Banner' : 'Create Banner'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 bg-white rounded-xl hover:bg-stone-100 text-stone-400 border border-stone-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Banner Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl px-4 py-3 text-stone-900 text-sm focus:border-[#E76A54] outline-none transition-colors font-medium"
                      placeholder="e.g. 50% OFF Weekend Pastry Special"
                    />
                  </div>

                  <ImageUpload 
                    onUploadComplete={(url) => setFormData({ ...formData, image_url: url })}
                    currentImage={formData.image_url}
                    label="Banner Image (16:9 Recommended)"
                  />

                  {formData.image_url && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block">Image URL (Optional Override)</label>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-[#FAF8F5] border border-stone-200 rounded-xl px-3.5 py-2.5 text-[10px] text-stone-600 font-mono truncate">
                          {formData.image_url}
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const newUrl = prompt('Enter new image URL:', formData.image_url);
                            if (newUrl) setFormData({ ...formData, image_url: newUrl });
                          }}
                          className="p-2.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl text-stone-600 transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Auto-Apply Coupon Code (Optional)</label>
                    <div className="relative group">
                      <Ticket size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#E76A54] transition-colors" />
                      <input
                        type="text"
                        value={formData.auto_apply_coupon}
                        onChange={e => setFormData({ ...formData, auto_apply_coupon: e.target.value.toUpperCase() })}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl pl-11 pr-4 py-3 text-stone-900 text-sm focus:border-[#E76A54] outline-none transition-colors font-mono font-bold"
                        placeholder="e.g. BAKE50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Redirect URL (Optional)</label>
                    <div className="relative group">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#E76A54] transition-colors" size={16} />
                      <input
                        type="text"
                        value={formData.redirect_url}
                        onChange={e => setFormData({ ...formData, redirect_url: e.target.value })}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl pl-11 pr-4 py-3 text-stone-900 text-sm focus:border-[#E76A54] outline-none transition-colors font-medium"
                        placeholder="/menu?category=cakes"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Priority</label>
                      <input
                        type="number"
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: Number(e.target.value) })}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl px-4 py-2.5 text-stone-900 text-sm focus:border-[#E76A54] outline-none transition-colors font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Status</label>
                      <div 
                        onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                        className={cn(
                          "flex items-center gap-2 w-full h-[44px] rounded-2xl px-3.5 border transition-all cursor-pointer select-none",
                          formData.is_active ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-stone-50 border-stone-200 text-stone-500"
                        )}
                      >
                        {formData.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        <span className="text-xs font-bold uppercase tracking-wider">{formData.is_active ? 'Active' : 'Draft'}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Flash Deal</label>
                      <div 
                        onClick={() => setFormData({ ...formData, is_flash_deal: !formData.is_flash_deal })}
                        className={cn(
                          "flex items-center gap-2 w-full h-[44px] rounded-2xl px-3.5 border transition-all cursor-pointer select-none",
                          formData.is_flash_deal ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-stone-50 border-stone-200 text-stone-500"
                        )}
                      >
                        {formData.is_flash_deal ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        <span className="text-xs font-bold uppercase tracking-wider">{formData.is_flash_deal ? 'Flash ON' : 'Flash OFF'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block">Start Date</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl px-4 py-2.5 text-stone-900 text-xs sm:text-sm focus:border-[#E76A54] outline-none transition-colors font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5 block">End Date (Optional)</label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl px-4 py-2.5 text-stone-900 text-xs sm:text-sm focus:border-[#E76A54] outline-none transition-colors font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 shrink-0">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-[#E76A54] hover:bg-[#d55b45] text-white py-3.5 rounded-2xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-[#E76A54]/20 cursor-pointer"
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
