import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Edit2, Trash2, Image as ImageIcon, Search, Filter, CheckCircle2, XCircle, X, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES } from '../../constants';
import { cn } from '../../lib/utils';
import { uploadImage } from '../../utils/upload';
import toast from 'react-hot-toast';
import { supabase } from '../../supabase';
import { safeTrim, safeTrimLowerCase } from '../../utils/string';

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

  const fetchMenu = useCallback(async () => {
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
          let est_time = item.estimated_delivery_time !== undefined && item.estimated_delivery_time !== null ? Number(item.estimated_delivery_time) : undefined;
          let est_unit = item.estimated_delivery_time_unit || '';
          let est_string = '';
          let avail_date = item.available_date || '';
          let avail_day = item.available_day || '';
          
          if (ai_desc.startsWith('{') && ai_desc.endsWith('}')) {
            try {
              const parsed = JSON.parse(ai_desc);
              ai_desc = parsed.ai_description || '';
              if (parsed.estimated_delivery_time !== undefined && parsed.estimated_delivery_time !== null) {
                est_time = Number(parsed.estimated_delivery_time);
              }
              if (parsed.estimated_delivery_time_unit) {
                est_unit = parsed.estimated_delivery_time_unit;
              }
              if (parsed.estimated_delivery_time_string) {
                est_string = parsed.estimated_delivery_time_string;
              }
              if (parsed.available_date) {
                avail_date = parsed.available_date;
              }
              if (parsed.available_day) {
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
  }, []);

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
            result.error.code === '42703' ||
            result.error.message?.includes('estimated_delivery_time') ||
            result.error.message?.includes('estimated_delivery_time_unit') ||
            result.error.message?.includes('available_date') ||
            result.error.message?.includes('available_day') ||
            result.error.message?.includes('column') ||
            result.error.message?.includes('does not exist')
        )) {
          console.warn('DB scheme does not have columns, retrying using JSON serialization in ai_description...');
          const fallbackBody = { ...body };
          delete (fallbackBody as any).estimated_delivery_time;
          delete (fallbackBody as any).estimated_delivery_time_unit;
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
            result.error.code === '42703' ||
            result.error.message?.includes('estimated_delivery_time') ||
            result.error.message?.includes('estimated_delivery_time_unit') ||
            result.error.message?.includes('available_date') ||
            result.error.message?.includes('available_day') ||
            result.error.message?.includes('column') ||
            result.error.message?.includes('does not exist')
        )) {
          console.warn('DB scheme does not have columns, retrying using JSON serialization in ai_description...');
          const fallbackBody = { ...body };
          delete (fallbackBody as any).estimated_delivery_time;
          delete (fallbackBody as any).estimated_delivery_time_unit;
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
    safeTrimLowerCase(item.name).includes(safeTrimLowerCase(search)) || 
    safeTrimLowerCase(item.category).includes(safeTrimLowerCase(search))
  );

  if (loading) {
    return (
      <div className="bg-white border border-stone-200/80 rounded-3xl p-16 sm:p-20 flex flex-col items-center justify-center gap-3 shadow-xs">
        <div className="w-10 h-10 border-3 border-[#E76A54]/20 border-t-[#E76A54] rounded-full animate-spin" />
        <p className="text-stone-500 text-xs font-bold uppercase tracking-wider animate-pulse">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">Menu Management</h2>
          <p className="text-stone-500 text-xs sm:text-sm font-medium mt-1">Add, edit, or remove items from your bakery menu</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button 
            onClick={() => {
              setLoading(true);
              fetchMenu();
            }}
            className="flex items-center gap-2 px-4 py-2.5 sm:py-3 bg-white border border-stone-200 rounded-2xl text-stone-700 hover:bg-stone-50 transition-all text-xs font-bold shadow-xs cursor-pointer"
          >
            <div className={cn("transition-transform duration-700", loading && "animate-spin")}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
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
            className="flex items-center gap-2 px-5 py-2.5 sm:py-3 bg-[#E76A54] text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md shadow-[#E76A54]/20 hover:bg-[#d55b45] transition-all flex-1 sm:flex-none justify-center cursor-pointer"
          >
            <Plus size={16} />
            Add New Item
          </motion.button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#E76A54] transition-colors" size={17} />
          <input 
            type="text" 
            placeholder="Search menu items..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-2xl py-3 pl-11 pr-4 text-stone-900 text-sm focus:outline-none focus:border-[#E76A54] transition-all shadow-xs placeholder:text-stone-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        <AnimatePresence mode="popLayout">
          {filteredMenu.map((item) => (
            <motion.div 
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group bg-white border border-stone-200/80 rounded-3xl overflow-hidden hover:border-[#E76A54]/40 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 sm:h-48 overflow-hidden bg-stone-100">
                  <ImageZoom 
                    src={item.image} 
                    alt={item.name} 
                    className={cn("w-full h-full object-cover group-hover:scale-105 transition-transform duration-500", (item.available === false || item.stock_quantity <= 0) && "grayscale")}
                    triggerClassName="w-full h-full"
                  />
                  {(item.available === false || item.stock_quantity <= 0) && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                      <span className="bg-stone-800 text-white text-[10px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full shadow-lg">
                        Sold Out
                      </span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    <button 
                      onClick={() => {
                        const url = `${window.location.origin}/product/${item.id}`;
                        navigator.clipboard.writeText(url);
                        toast.success('Product link copied!');
                      }}
                      className="p-2 rounded-xl bg-black/50 backdrop-blur-md text-white hover:bg-[#E76A54] transition-all cursor-pointer"
                      title="Copy Public Link"
                    >
                      <LinkIcon size={14} />
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
                      className="p-2 rounded-xl bg-black/50 backdrop-blur-md text-white hover:bg-[#E76A54] transition-all cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => setDeletingId(item.id)}
                      className="p-2 rounded-xl bg-black/50 backdrop-blur-md text-white hover:bg-rose-600 transition-all cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                      {item.category}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="text-base font-bold text-stone-900 line-clamp-1">{item.name}</h4>
                      <p className="text-lg font-black text-[#E76A54] mt-0.5">₹{item.price}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] font-bold shrink-0 ${(item.available && item.stock_quantity > 0) ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md' : 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md'}`}>
                      {(item.available && item.stock_quantity > 0) ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {(item.available && item.stock_quantity > 0) ? 'Available' : 'Sold Out'}
                    </div>
                  </div>

                  <div className="flex gap-1.5 items-center flex-wrap mb-3">
                    {item.is_ai_boosted && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-[#E76A54]/10 border border-[#E76A54]/20 rounded-md text-[9px] font-bold text-[#E76A54] uppercase">
                        <Sparkles size={9} /> AI Boosted
                      </div>
                    )}
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-md text-[9px] font-bold text-amber-800 uppercase">
                      <Clock size={9} /> {item.estimated_delivery_time_unit === 'days' 
                        ? `${item.estimated_delivery_time_string || item.estimated_delivery_time || '1-2'} Days` 
                        : `${item.estimated_delivery_time || 30} Mins`}
                    </div>
                    {item.available_date && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-50 border border-sky-200 rounded-md text-[9px] font-bold text-sky-800 uppercase">
                        <Calendar size={9} /> {item.available_date}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-stone-100">
                    <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Stock:</span>
                    <div className="flex items-center gap-1.5 bg-stone-50 rounded-xl px-2.5 py-1 border border-stone-200">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStock(item, -1);
                        }}
                        className="text-stone-400 hover:text-stone-800 transition-colors cursor-pointer"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="text-xs font-bold text-stone-900 min-w-[20px] text-center">{item.stock_quantity || 0}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStock(item, 1);
                        }}
                        className="text-stone-400 hover:text-stone-800 transition-colors cursor-pointer"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                <button 
                  onClick={() => toggleAvailability(item)}
                  className="w-full py-2.5 rounded-xl bg-[#FAF8F5] border border-stone-200 text-stone-800 text-xs font-bold hover:bg-stone-100 transition-all cursor-pointer"
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
              className="col-span-full py-16 flex flex-col items-center justify-center text-center space-y-3 bg-white border border-dashed border-stone-200 rounded-3xl"
            >
              <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                <Search size={24} />
              </div>
              <div>
                <p className="text-stone-800 font-bold text-base">No menu items found</p>
                <p className="text-stone-400 text-xs mt-0.5">Try adjusting your search or add a new bakery item.</p>
              </div>
              <button 
                onClick={() => fetchMenu()}
                className="text-[#E76A54] text-xs font-bold hover:underline cursor-pointer"
              >
                Refresh menu
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white border border-stone-200 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="relative z-10 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between p-5 sm:p-6 bg-[#FAF8F5] border-b border-stone-200 shrink-0">
                  <h3 className="text-lg sm:text-xl font-bold text-stone-900">{editingItem ? 'Edit Menu Item' : 'Add New Bakery Item'}</h3>
                  <button onClick={() => setIsAdding(false)} className="p-2 rounded-xl bg-white text-stone-400 hover:text-stone-800 border border-stone-200 transition-all cursor-pointer">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Item Name</label>
                        <input 
                          type="text" 
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g. Artisan Sourdough Loaf" 
                          className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl py-3 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-medium text-sm placeholder:text-stone-400" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Category</label>
                        <select 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl py-3 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-medium text-sm cursor-pointer"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat} className="bg-white text-stone-900">{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Price (₹)</label>
                        <input 
                          type="number" 
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          placeholder="e.g. 350" 
                          className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl py-3 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold text-sm placeholder:text-stone-400" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Stock Quantity</label>
                        <input 
                          type="number" 
                          required
                          value={formData.stock_quantity}
                          onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                          placeholder="e.g. 50" 
                          className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl py-3 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold text-sm placeholder:text-stone-400" 
                        />
                      </div>
                    </div>

                    <div className="space-y-3 p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Delivery Duration</label>
                        <div className="flex bg-stone-200/70 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, estimated_delivery_time_unit: 'mins'})}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${formData.estimated_delivery_time_unit === 'mins' ? 'bg-[#E76A54] text-white' : 'text-stone-600 hover:text-stone-900'}`}
                          >
                            Minutes
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, estimated_delivery_time_unit: 'days'})}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${formData.estimated_delivery_time_unit === 'days' ? 'bg-[#E76A54] text-white' : 'text-stone-600 hover:text-stone-900'}`}
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
                            className="w-full bg-white border border-stone-200 rounded-xl py-2.5 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold text-sm pr-11" 
                          />
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                            <Clock size={16} />
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
                            className="w-full bg-white border border-stone-200 rounded-xl py-2.5 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-bold text-sm pr-11" 
                          />
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                            <Calendar size={16} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Availability Scheduling */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Available On Date</label>
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
                            className="w-full bg-white border border-stone-200 rounded-xl py-2.5 px-3.5 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all font-medium text-xs sm:text-sm" 
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Day of Week</label>
                        <input 
                          type="text" 
                          readOnly
                          value={formData.available_day || 'No date selected'}
                          placeholder="Monday, Tuesday, etc." 
                          className="w-full bg-stone-100 border border-stone-200 rounded-xl py-2.5 px-3.5 text-stone-600 font-medium text-xs sm:text-sm cursor-not-allowed" 
                        />
                      </div>
                    </div>

                    {/* Image Section */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Product Image</label>
                      
                      <div className="flex flex-col gap-3">
                        <div className="relative">
                          <input 
                            type="text" 
                            required
                            value={formData.image}
                            onChange={(e) => setFormData({...formData, image: e.target.value})}
                            placeholder="Paste direct URL or Upload" 
                            className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl py-3 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all text-xs font-medium placeholder:text-stone-400 pr-11" 
                          />
                          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                             <ImageIcon size={18} />
                          </div>
                        </div>

                        <label className={cn(
                          "flex items-center justify-center gap-2.5 w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl bg-[#FAF8F5] cursor-pointer hover:bg-stone-100 hover:border-[#E76A54]/40 transition-all active:scale-98",
                          uploading && "opacity-50 cursor-not-allowed animate-pulse"
                        )}>
                          {uploading ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-[#E76A54]/20 border-t-[#E76A54] rounded-full animate-spin" />
                              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Uploading...</span>
                            </div>
                          ) : (
                            <>
                              <ImageIcon size={20} className="text-[#E76A54]" />
                              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Upload New Bakery Image</span>
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
                          <div className="flex items-center gap-3 p-3 bg-[#FAF8F5] rounded-2xl border border-stone-200">
                            <div className="h-16 w-16 rounded-xl overflow-hidden border border-stone-200 shrink-0 bg-stone-100">
                              <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-[10px] font-mono text-stone-500 truncate">{formData.image}</p>
                               <button 
                                 type="button"
                                 onClick={() => setFormData(p => ({ ...p, image: '' }))}
                                 className="text-[10px] font-bold text-rose-600 hover:underline mt-1 cursor-pointer"
                               >
                                 Remove
                               </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3.5 bg-[#FAF8F5] border border-stone-200 rounded-2xl">
                        <div className="flex items-center gap-2.5">
                          <Sparkles className="text-[#E76A54]" size={18} />
                          <div>
                            <p className="text-xs font-bold text-stone-900">AI Boost</p>
                            <p className="text-[10px] text-stone-500">Prioritize this item in smart recommendations</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_ai_boosted: !formData.is_ai_boosted })}
                          className={cn(
                            "w-11 h-6 rounded-full transition-all relative shrink-0 cursor-pointer",
                            formData.is_ai_boosted ? "bg-[#E76A54]" : "bg-stone-300"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-xs",
                            formData.is_ai_boosted ? "left-6" : "left-1"
                          )} />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">AI Keywords / Context</label>
                          <textarea 
                            value={formData.ai_description}
                            onChange={(e) => setFormData({...formData, ai_description: e.target.value})}
                            placeholder="Special search keywords or context for the AI Assistant..." 
                            className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl py-3 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all h-18 resize-none font-medium text-xs placeholder:text-stone-400" 
                          />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">Description</label>
                      <textarea 
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Describe the bakery item..." 
                        className="w-full bg-[#FAF8F5] border border-stone-200 rounded-2xl py-3 px-4 text-stone-900 focus:outline-none focus:border-[#E76A54] transition-all h-20 resize-none font-medium text-xs placeholder:text-stone-400" 
                      />
                    </div>
                  </div>
 
                  <div className="p-4 sm:p-5 bg-[#FAF8F5] border-t border-stone-200 flex gap-3 shrink-0">
                    <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 rounded-2xl bg-white border border-stone-200 text-stone-700 font-bold hover:bg-stone-100 transition-all text-xs cursor-pointer">
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={uploading}
                      className={cn(
                        "flex-1 py-3 rounded-2xl bg-[#E76A54] text-white font-bold shadow-md shadow-[#E76A54]/20 hover:bg-[#d55b45] transition-all text-xs cursor-pointer",
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
