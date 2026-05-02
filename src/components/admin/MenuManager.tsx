import React, { useState, useEffect } from 'react';
import { Plus, Minus, Edit2, Trash2, Image as ImageIcon, Search, Filter, CheckCircle2, XCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES } from '../../constants';
import { cn } from '../../lib/utils';
import { uploadImage } from '../../utils/upload';
import toast from 'react-hot-toast';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
  stock_quantity: number;
  description: string;
}

import { ImageZoom } from '../ImageZoom';

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
    description: ''
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
    try {
      const res = await fetch("https://wilsmmashfpgrxkknmle.supabase.co/rest/v1/products?select=*", {
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM"
        }
      });
      if (res.ok) {
        const items = await res.json();
        // Map fields to match our internal MenuItem interface
        const mappedItems = items.map((item: any) => ({
          id: item.id || String(Math.random()),
          name: item.name,
          price: item.price,
          image: item.image,
          category: item.category || 'General',
          available: item.available !== undefined ? item.available : true,
          stock_quantity: item.stock_quantity || 0,
          description: item.description || ''
        }));
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
      if (file) {
        setUploading(true);
        imageUrl = await uploadImage(file);
        setUploading(false);
      }

      if (!imageUrl) {
        imageUrl = `https://picsum.photos/seed/${formData.name}/800/600`;
      }

      const body = {
        name: formData.name,
        price: Number(formData.price),
        image: imageUrl,
        category: formData.category,
        description: formData.description,
        stock_quantity: Number(formData.stock_quantity),
        available: formData.available
      };

      let url = "https://wilsmmashfpgrxkknmle.supabase.co/rest/v1/products";
      let method = "POST";

      if (editingItem) {
        url = `${url}?id=eq.${editingItem.id}`;
        method = "PATCH";
      }

      // Save to Supabase
      const res = await fetch(url, {
        method: method,
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to save to Supabase');
      }

      toast.success(editingItem ? "Product updated" : "Product added", { id: loadingToast });
      
      setIsAdding(false);
      setEditingItem(null);
      setFormData({ name: '', price: '', stock_quantity: '0', category: CATEGORIES[0], image: '', available: true, description: '' });
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
      const res = await fetch(`https://wilsmmashfpgrxkknmle.supabase.co/rest/v1/products?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM"
        }
      });

      if (!res.ok) {
        throw new Error('Failed to delete from Supabase');
      }

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
      const res = await fetch(`https://wilsmmashfpgrxkknmle.supabase.co/rest/v1/products?id=eq.${item.id}`, {
        method: "PATCH",
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ available: newStatus })
      });

      if (!res.ok) throw new Error();

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
      const res = await fetch(`https://wilsmmashfpgrxkknmle.supabase.co/rest/v1/products?id=eq.${item.id}`, {
        method: "PATCH",
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ stock_quantity: newStock })
      });

      if (!res.ok) throw new Error();

      // Proactively update local state
      setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, stock_quantity: newStock } : i));
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
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Delete Item?</h3>
                <p className="text-gray-500 text-sm">This action cannot be undone. Are you sure you want to remove this item?</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(deletingId)}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              setFormData({ name: '', price: '', stock_quantity: '0', category: CATEGORIES[0], image: '', available: true, description: '' });
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
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  triggerClassName="w-full h-full"
                />
                <div className="absolute top-4 right-4 flex gap-2">
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
                        description: item.description || ''
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
                  <div className={`flex items-center gap-1 text-xs font-bold ${item.available ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {item.available ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {item.available ? 'Available' : 'Sold Out'}
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
              className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-[32px] p-10 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-white">{editingItem ? 'Edit Menu Item' : 'Add New Food Item'}</h3>
                  <button onClick={() => setIsAdding(false)} className="p-2 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-all">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Item Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g. Artisan Sourdough" 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Price (₹)</label>
                      <input 
                        type="number" 
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        placeholder="e.g. 350" 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Stock Quantity</label>
                    <input 
                      type="number" 
                      required
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                      placeholder="e.g. 50" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Description</label>
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Describe the item..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all h-24 resize-none" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Category</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all appearance-none"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-[#111]">{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Image</label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={formData.image}
                          onChange={(e) => setFormData({...formData, image: e.target.value})}
                          placeholder="Image URL or upload below" 
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-orange-500/50 transition-all" 
                        />
                      </div>
                      <label className={cn(
                        "flex items-center justify-center px-6 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:bg-white/10 transition-all",
                        uploading && "opacity-50 cursor-not-allowed animate-pulse"
                      )}>
                        <ImageIcon size={20} className={cn("text-gray-400", uploading && "animate-bounce")} />
                        <input 
                          id="image"
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden" 
                          disabled={uploading}
                        />
                      </label>
                    </div>
                    {formData.image && (
                      <div className="mt-2 h-20 w-20 rounded-xl overflow-hidden border border-white/10 group relative">
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                        {uploading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all">
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={uploading}
                      className={cn(
                        "flex-1 py-4 rounded-2xl bg-orange-500 text-white font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all",
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
