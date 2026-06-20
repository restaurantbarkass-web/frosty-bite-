import React, { useState, useEffect } from 'react';
import { Plus, Minus, Edit2, Trash2, Image as ImageIcon, Search, Filter, CheckCircle2, XCircle, X, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES } from '../../constants';
import { cn } from '../../lib/utils';
import { uploadImage } from '../../utils/upload';
import toast from 'react-hot-toast';
import { supabase } from '../../supabase';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
  stock_quantity: number;
  description: string;
  ai_description?: string;
  is_ai_boosted?: boolean;
  estimated_delivery_time?: number;
  estimated_delivery_time_unit?: 'mins' | 'days';
  estimated_delivery_time_string?: string;
  available_date?: string;
  available_day?: string;
}

import { ImageZoom } from '../ImageZoom';
import { Sparkles, Clock, Calendar } from 'lucide-react';

import { ConfirmationModal } from '../ui/ConfirmationModal';

export const MenuManager: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock_quantity: '0',
    category: CATEGORIES[0],
    image: '',
    available: true,
    description: '',
    ai_description: '',
    is_ai_boosted: false,
    estimated_delivery_time: '30',
    estimated_delivery_time_unit: 'mins' as 'mins' | 'days',
    estimated_delivery_time_string: '',
    available_date: '',
    available_day: ''
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      const toastId = toast.loading('Uploading image...');
      try {
        const url = await uploadImage(file);
        setFormData({ ...formData, image: url });
        toast.success('Image uploaded successfully!', { id: toastId });
      } catch (error: any) {
        console.error('Upload failed:', error);
        toast.error(error.message || 'Failed to upload image', { id: toastId });
      } finally {
        setUploading(false);
      }
    }
  };

  const fetchMenu = async () => {
    if (!navigator.onLine) {
      toast.error('No internet connection. Please check your network.');
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*');
      
      if (error) throw error;
      
      if (data) {
        const mappedItems = data.map((item: any) => {
          let ai_desc = item.ai_description || '';
          let est_time = item.estimated_delivery_time !== undefined ? Number(item.estimated_delivery_time) : undefined;
          let est_unit = item.estimated_delivery_time_unit || '';
          let est_string = item.estimated_delivery_time_string || '';
          let avail_date = item.available_date || '';
          let avail_day = item.available_day || '';
          
          if (ai_desc.startsWith('{') && ai_desc.endsWith('}')) {
            try {
              const parsed = JSON.parse(ai_desc);
              ai_desc = parsed.ai_description || '';
              if (est_time === undefined && parsed.estimated_delivery_time !== undefined) {
                est_time = Number(parsed.estimated_delivery_time);
              }
              if (!est_unit && parsed.estimated_delivery_time_unit !== undefined) {
                est_unit = parsed.estimated_delivery_time_unit;
              }
              if (!est_string && parsed.estimated_delivery_time_string !== undefined) {
                est_string = parsed.estimated_delivery_time_string;
              }
              if (!avail_date && parsed.available_date !== undefined) {
                avail_date = parsed.available_date;
              }
              if (!avail_day && parsed.available_day !== undefined) {
                avail_day = parsed.available_day;
              }
            } catch (e) {
              // Ignore failure
            }
          }
          
          return {
            id: item.id,
            name: item.name,
            price: item.price,
            image: item.image,
            category: item.category || 'General',
            available: item.available !== undefined ? item.available : true,
            stock_quantity: item.stock_quantity || 0,
            description: item.description || '',
            ai_description: ai_desc,
            is_ai_boosted: item.is_ai_boosted || false,
            estimated_delivery_time: est_time || 30,
            estimated_delivery_time_unit: (est_unit || 'mins') as 'mins' | 'days',
            estimated_delivery_time_string: est_string,
            available_date: avail_date,
            available_day: avail_day
          };
        });
        setMenuItems(mappedItems);
      }
      setLoading(false);
    } catch (error) {
      console.error('Menu fetch failed:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();

    // Subscribe to menu changes
    const channel = supabase
      .channel('menu_mgr_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchMenu();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading(editingItem ? 'Updating product...' : 'Adding product...');

    try {
      // Get file from input
      const fileInput = document.getElementById("image") as HTMLInputElement;
      const file = fileInput?.files?.[0];
      
      let imageUrl = formData.image;
      
      // Always favor new file upload if selected
      if (file && !uploading) {
        setUploading(true);
        try {
          imageUrl = await uploadImage(file);
          setFormData(prev => ({ ...prev, image: imageUrl }));
        } catch (uploadErr: any) {
          console.error('Image upload failed during submit:', uploadErr);
          toast.error(uploadErr.message || 'Image upload failed', { id: loadingToast });
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      if (!imageUrl) {
        toast.error("Please provide an image URL or upload an image file.", { id: loadingToast });
        return;
      }

      const stockQty = Number(formData.stock_quantity);
      
      const estTimeVal = formData.estimated_delivery_time_unit === 'days' 
        ? (parseInt(formData.estimated_delivery_time_string) || 2) 
        : Number(formData.estimated_delivery_time || 30);

      const serializedAiDescription = JSON.stringify({
        ai_description: formData.ai_description,
        estimated_delivery_time: estTimeVal,
        estimated_delivery_time_unit: formData.estimated_delivery_time_unit,
        estimated_delivery_time_string: formData.estimated_delivery_time_unit === 'days' ? formData.estimated_delivery_time_string : '',
        available_date: formData.available_date || '',
        available_day: formData.available_day || ''
      });

      const body = {
        name: formData.name,
        price: Number(formData.price),
        image: imageUrl,
        category: formData.category,
        description: formData.description,
        ai_description: serializedAiDescription,
        is_ai_boosted: formData.is_ai_boosted,
        stock_quantity: stockQty,
        available: stockQty === 0 ? false : formData.available,
        estimated_delivery_time: estTimeVal,
        estimated_delivery_time_unit: formData.estimated_delivery_time_unit,
        estimated_delivery_time_string: formData.estimated_delivery_time_unit === 'days' ? formData.estimated_delivery_time_string : '',
        available_date: formData.available_date ? formData.available_date : null,
        available_day: formData.available_day ? formData.available_day : null
      };

      let result;
      if (editingItem) {
        result = await supabase
          .from('products')
          .update(body)
          .eq('id', editingItem.id);
          
        if (result.error && (
            result.error.code === 'PGRST204' || 
            result.error.message?.includes('estimated_delivery_time') ||
            result.error.message?.includes('estimated_delivery_time_unit') ||
            result.error.message?.includes('estimated_delivery_time_string') ||
            result.error.message?.includes('available_date') ||
            result.error.message?.includes('available_day')
        )) {
          console.warn('DB scheme does not have columns, retrying using JSON serialization in ai_description...');
          const fallbackBody = { ...body };
          delete (fallbackBody as any).estimated_delivery_time;
          delete (fallbackBody as any).estimated_delivery_time_unit;
          delete (fallbackBody as any).estimated_delivery_time_string;
          delete (fallbackBody as any).available_date;
          delete (fallbackBody as any).available_day;
          result = await supabase
            .from('products')
            .update(fallbackBody)
            .eq('id', editingItem.id);
        }
      } else {
        result = await supabase
          .from('products')
          .insert([body]);
          
        if (result.error && (
            result.error.code === 'PGRST204' || 
            result.error.message?.includes('estimated_delivery_time') ||
            result.error.message?.includes('estimated_delivery_time_unit') ||
            result.error.message?.includes('estimated_delivery_time_string') ||
            result.error.message?.includes('available_date') ||
            result.error.message?.includes('available_day')
        )) {
          console.warn('DB scheme does not have columns, retrying using JSON serialization in ai_description...');
          const fallbackBody = { ...body };
          delete (fallbackBody as any).estimated_delivery_time;
          delete (fallbackBody as any).estimated_delivery_time_unit;
          delete (fallbackBody as any).estimated_delivery_time_string;
          delete (fallbackBody as any).available_date;
          delete (fallbackBody as any).available_day;
          result = await supabase
            .from('products')
            .insert([fallbackBody]);
        }
      }

      if (result.error) {
        console.error('Supabase DB error:', result.error);
        if (result.error.message === 'Failed to fetch') {
          throw new Error("Could not connect to database. Please check your internet connection.");
        }
        throw result.error;
      }

      toast.success(editingItem ? "Product updated" : "Product added", { id: loadingToast });
      
      setIsAdding(false);
      setEditingItem(null);
      setFormData({ 
        name: '', 
        price: '', 
        stock_quantity: '0', 
        category: CATEGORIES[0], 
        image: '', 
        available: true, 
        description: '',
        ai_description: '',
        is_ai_boosted: false,
        estimated_delivery_time: '30',
        estimated_delivery_time_unit: 'mins' as 'mins' | 'days',
        estimated_delivery_time_string: '',
        available_date: '',
        available_day: ''
      });
      fetchMenu(); // Refresh list from Supabase
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.message || 'Failed to save product', { id: loadingToast });
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const loadingToast = toast.loading('Deleting product...');
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Product deleted', { id: loadingToast });
      fetchMenu();
      setDeletingId(null);
    } catch (error) {
      console.error('Error deleting menu item:', error);
      toast.error('Failed to delete product', { id: loadingToast });
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const newStatus = !item.available;
      
      if (newStatus && (item.stock_quantity === 0)) {
        toast.error('Cannot mark as available with 0 stock');
        return;
      }

      const { error } = await supabase
        .from('products')
        .update({ available: newStatus })
        .eq('id', item.id);

      if (error) throw error;

      // Proactively update local state
      setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, available: newStatus } : i));
      toast.success(`Product ${newStatus ? 'available' : 'sold out'}`);
    } catch (error) {
      console.error('Error toggling availability:', error);
      toast.error('Failed to update availability');
    }
  };

  const updateStock = async (item: MenuItem, delta: number) => {
    try {
      const newStock = Math.max(0, (item.stock_quantity || 0) + delta);
      const updates: any = { stock_quantity: newStock };
      
      // Automatically set available to false if stock hits 0
      if (newStock === 0) {
        updates.available = false;
      }
      
      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', item.id);

      if (error) throw error;

      // Proactively update local state
      setMenuItems(prev => prev.map(i => i.id === item.id ? { 
        ...i, 
        stock_quantity: newStock,
        available: newStock === 0 ? false : i.available
      } : i));
      
      if (newStock === 0) {
        toast.error(`${item.name} is now Sold Out!`);
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock');
    }
  }

  const filteredMenu = menuItems.filter(item => 
    (item.name || '').toLowerCase().includes(search.toLowerCase()) || 
    (item.category || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && handleDelete(deletingId)}
        title="Delete Item?"
        description="This action cannot be undone. Are you sure you want to remove this item?"
        confirmText="Delete"
        variant="danger"
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Menu Management</h2>
          <p className="text-gray-500 font-medium">Add, edit, or remove items from your restaurant menu</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => {
              setLoading(true);
              fetchMenu();
            }}
            className="flex items-center gap-3 px-6 py-4 bg-[#111]/80 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all group"
          >
            <div className={cn("transition-transform duration-700", loading && "animate-spin")}>
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </div>
            Refresh
          </button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setEditingItem(null);
              setFormData({ 
                name: '', 
                price: '', 
                stock_quantity: '0', 
                category: CATEGORIES[0], 
                image: '', 
                available: true, 
                description: '',
                ai_description: '',
                is_ai_boosted: false,
                estimated_delivery_time: '30',
                estimated_delivery_time_unit: 'mins' as 'mins' | 'days',
                estimated_delivery_time_string: '',
                available_date: '',
                available_day: ''
              });
              setIsAdding(true);
            }}
            className="flex items-center gap-3 px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex-1 md:flex-none justify-center"
          >
            <Plus size={20} />
            Add New Item
          </motion.button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-orange-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search menu items..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111]/80 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-orange-500/50 transition-all"
          />
        </div>
        <button className="flex items-center gap-3 px-6 py-4 bg-[#111]/80 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all">
          <Filter size={18} />
          Filter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredMenu.map((item) => (
            <motion.div 
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group bg-[#111]/80 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden hover:border-orange-500/30 transition-all"
            >
              <div className="relative h-48 overflow-hidden">
                <ImageZoom 
                  src={item.image} 
                  alt={item.name} 
                  className={cn("w-full h-full object-cover group-hover:scale-110 transition-transform duration-500", (item.available === false || item.stock_quantity <= 0) && "grayscale")}
                  triggerClassName="w-full h-full"
                />
                {(item.available === false || item.stock_quantity <= 0) && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                    <span className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg -rotate-12 border border-white/20">
                      Sold Out
                    </span>
                  </div>
                )}
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => {
                      const url = `${window.location.origin}/product/${item.id}`;
                      navigator.clipboard.writeText(url);
                      toast.success('Product link copied!');
                    }}
                    className="p-2 rounded-xl bg-black/50 backdrop-blur-md text-white hover:bg-primary transition-all"
                    title="Copy Public Link"
                  >
                    <LinkIcon size={16} />
                  </button>
                   <button 
                    onClick={() => {
                      setEditingItem(item);
                      setFormData({
                        name: item.name,
                        price: item.price.toString(),
                        stock_quantity: (item.stock_quantity || 0).toString(),
                        category: item.category,
                        image: item.image,
                        available: item.available,
                        description: item.description || '',
                        ai_description: item.ai_description || '',
                        is_ai_boosted: !!item.is_ai_boosted,
                        estimated_delivery_time: (item.estimated_delivery_time || 30).toString(),
                        estimated_delivery_time_unit: item.estimated_delivery_time_unit || 'mins',
                        estimated_delivery_time_string: item.estimated_delivery_time_string || '',
                        available_date: item.available_date || '',
                        available_day: item.available_day || ''
                      });
                      setIsAdding(true);
                    }}
                    className="p-2 rounded-xl bg-black/50 backdrop-blur-md text-white hover:bg-orange-500 transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setDeletingId(item.id)}
                    className="p-2 rounded-xl bg-black/50 backdrop-blur-md text-white hover:bg-red-500 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4">
                  <span className="px-3 py-1 rounded-lg bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest">
                    {item.category}
                  </span>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-start">
                      <h4 className="text-lg font-bold text-white mb-1">{item.name}</h4>
                      <p className="text-2xl font-black text-orange-500">₹{item.price}</p>
                      
                      <div className="flex gap-2 items-center flex-wrap mt-2">
                        {item.is_ai_boosted && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#f97316]/10 border border-[#f97316]/20 rounded-md text-[8px] font-black text-[#f97316] uppercase animate-pulse">
                            <Sparkles size={10} /> AI Boosted
                          </div>
                        )}
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-md text-[8px] font-black text-orange-400 uppercase">
                          <Clock size={10} /> {item.estimated_delivery_time_unit === 'days' 
                            ? `${item.estimated_delivery_time_string || item.estimated_delivery_time || '1-2'} Days` 
                            : `${item.estimated_delivery_time || 30} Mins`}
                        </div>
                        {item.available_date && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 rounded-md text-[8px] font-black text-sky-400 uppercase">
                            <Calendar size={10} /> {item.available_date} ({item.available_day})
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Stock:</span>
                        <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-0.5 border border-white/10">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStock(item, -1);
                            }}
                            className="text-zinc-500 hover:text-orange-500 transition-colors"
                          >
                            <Minus size={10} />
                          </button>
                          <span className="text-xs font-bold text-white min-w-[20px] text-center">{item.stock_quantity || 0}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updateStock(item, 1);
                            }}
                            className="text-zinc-500 hover:text-orange-500 transition-colors"
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold ${(item.available && item.stock_quantity > 0) ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {(item.available && item.stock_quantity > 0) ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {(item.available && item.stock_quantity > 0) ? 'Available' : 'Sold Out'}
                  </div>
                </div>
                <button 
                  onClick={() => toggleAvailability(item)}
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-all"
                >
                  {item.available ? 'Mark as Sold Out' : 'Mark as Available'}
                </button>
              </div>
            </motion.div>
          ))}
          {filteredMenu.length === 0 && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 bg-white/5 border border-dashed border-white/10 rounded-3xl"
            >
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-gray-500">
                <Search size={32} />
              </div>
              <div>
                <p className="text-white font-bold text-lg">No menu items found</p>
                <p className="text-gray-500">Try adjusting your search or add a new food item.</p>
              </div>
              <button 
                onClick={() => fetchMenu()}
                className="text-orange-500 font-bold hover:underline"
              >
                Try refreshing
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-[32px] shadow-2xl flex flex-col h-[90vh] md:h-auto md:max-h-[85vh] overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between p-6 md:p-10 shrink-0">
                  <h3 className="text-2xl font-bold text-white tracking-tight">{editingItem ? 'Edit Menu Item' : 'Add New Food Item'}</h3>
                  <button onClick={() => setIsAdding(false)} className="p-2 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-all">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 pb-40 md:pb-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Item Name</label>
                        <input 
                          type="text" 
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g. Artisan Sourdough" 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all font-bold placeholder:text-zinc-700" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Category</label>
                        <select 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all appearance-none font-bold"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat} className="bg-[#111]">{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Price (₹)</label>
                        <input 
                          type="number" 
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          placeholder="e.g. 350" 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all font-bold placeholder:text-zinc-700" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Stock Quantity</label>
                        <input 
                          type="number" 
                          required
                          value={formData.stock_quantity}
                          onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                          placeholder="e.g. 50" 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all font-bold placeholder:text-zinc-700" 
                        />
                      </div>
                    </div>

                    <div className="space-y-4 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                      <div className="flex items-center justify-between col-span-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Estimated Delivery Duration <span className="text-orange-500">*</span></label>
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, estimated_delivery_time_unit: 'mins'})}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${formData.estimated_delivery_time_unit === 'mins' ? 'bg-orange-500 text-white font-bold text-xs' : 'text-zinc-400 hover:text-white text-xs'}`}
                          >
                            Minutes
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, estimated_delivery_time_unit: 'days'})}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${formData.estimated_delivery_time_unit === 'days' ? 'bg-orange-500 text-white font-bold text-xs' : 'text-zinc-400 hover:text-white text-xs'}`}
                          >
                            Days
                          </button>
                        </div>
                      </div>

                      {formData.estimated_delivery_time_unit === 'mins' ? (
                        <div className="relative">
                          <input 
                            type="number" 
                            required={formData.estimated_delivery_time_unit === 'mins'}
                            value={formData.estimated_delivery_time}
                            onChange={(e) => setFormData({...formData, estimated_delivery_time: e.target.value})}
                            placeholder="e.g. 30" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all font-bold placeholder:text-zinc-700 pr-12" 
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                            <Clock size={18} />
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <input 
                            type="text" 
                            required={formData.estimated_delivery_time_unit === 'days'}
                            value={formData.estimated_delivery_time_string}
                            onChange={(e) => setFormData({...formData, estimated_delivery_time_string: e.target.value})}
                            placeholder="e.g. 1-2 or 3" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all font-bold placeholder:text-zinc-700 pr-12 text-sm" 
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">
                            <Calendar size={18} />
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-zinc-500 font-bold tracking-wide italic leading-relaxed">
                        {formData.estimated_delivery_time_unit === 'mins' 
                          ? 'Product delivery time in minutes (e.g. 30 for 30 minutes).' 
                          : 'Enter days format as a range (e.g. "1-2" or singular "3") to display on cards.'}
                      </p>
                    </div>

                    {/* Availability Scheduling */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Available On Date</label>
                        <div className="relative">
                          <input 
                            type="date" 
                            value={formData.available_date}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v) {
                                const d = new Date(v);
                                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                setFormData({
                                  ...formData,
                                  available_date: v,
                                  available_day: days[d.getDay()]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  available_date: '',
                                  available_day: ''
                                });
                              }
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all font-bold pr-12 text-sm [color-scheme:dark]" 
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                            <Calendar size={18} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Computed Day of Week</label>
                        <input 
                          type="text" 
                          readOnly
                          value={formData.available_day || 'No date selected'}
                          placeholder="Monday, Tuesday, etc." 
                          className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-4 px-6 text-orange-400 focus:outline-none transition-all font-bold placeholder:text-zinc-700 text-sm cursor-not-allowed" 
                        />
                      </div>
                    </div>

                    {/* Image Section Moved Up for Better Accessibility */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Visual Identity <span className="text-orange-500">*</span></label>
                        <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-1 rounded-md">Required</span>
                      </div>
                      
                      <div className="flex flex-col gap-4">
                        <div className="relative">
                          <input 
                            type="text" 
                            required
                            value={formData.image}
                            onChange={(e) => setFormData({...formData, image: e.target.value})}
                            placeholder="Paste direct URL or Upload" 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all font-bold placeholder:text-zinc-700 pr-12" 
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700">
                             <ImageIcon size={20} />
                          </div>
                        </div>

                        <label className={cn(
                          "flex items-center justify-center gap-3 w-full py-5 border-2 border-dashed border-white/10 rounded-[1.5rem] bg-white/[0.02] cursor-pointer hover:bg-white/5 hover:border-orange-500/30 transition-all active:scale-95",
                          uploading && "opacity-50 cursor-not-allowed animate-pulse"
                        )}>
                          {uploading ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                              <span className="text-xs font-black text-white uppercase tracking-widest">Uploading...</span>
                            </div>
                          ) : (
                            <>
                              <ImageIcon size={24} className="text-primary" />
                              <span className="text-xs font-black text-white uppercase tracking-widest">Upload New Food Image</span>
                            </>
                          )}
                          <input 
                            id="image-upload-new"
                            type="file" 
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden" 
                            disabled={uploading}
                          />
                        </label>

                        {formData.image && (
                          <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                            <div className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 shrink-0">
                              <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest truncate">{formData.image}</p>
                               <button 
                                 type="button"
                                 onClick={() => setFormData(p => ({ ...p, image: '' }))}
                                 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1"
                               >
                                 Remove
                               </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <Sparkles className="text-primary" size={20} />
                          <div>
                            <p className="text-xs font-bold text-white uppercase tracking-wider">AI Boost</p>
                            <p className="text-[10px] text-zinc-500">Enable to prioritize this item in smart recommendations</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_ai_boosted: !formData.is_ai_boosted })}
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative shrink-0",
                            formData.is_ai_boosted ? "bg-primary" : "bg-zinc-800"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            formData.is_ai_boosted ? "left-7" : "left-1"
                          )} />
                        </button>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">AI Optimization Description</label>
                          <textarea 
                            value={formData.ai_description}
                            onChange={(e) => setFormData({...formData, ai_description: e.target.value})}
                            placeholder="Special search keywords or context for the AI Butler..." 
                            className="w-full bg-primary/5 border border-primary/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary/50 transition-all h-20 resize-none font-medium placeholder:text-zinc-700 text-sm" 
                          />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-2">Description</label>
                      <textarea 
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Describe the item..." 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all h-24 resize-none font-medium placeholder:text-zinc-700" 
                      />
                    </div>
                  </div>
 
                  <div className="sticky bottom-0 left-0 right-0 p-8 pt-4 bg-[#111]/95 backdrop-blur-xl border-t border-white/10 flex gap-4 shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all active:scale-95">
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={uploading}
                      className={cn(
                        "flex-1 py-4 rounded-2xl bg-orange-500 text-white font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95",
                        uploading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {uploading ? 'Uploading...' : (editingItem ? 'Update Item' : 'Save Item')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
