import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, MapPin, CreditCard, Mail, Phone, Plus, Edit2, Trash2, ChevronRight, LogOut, X, CheckCircle, Smartphone, ShoppingBag, Clock, Heart, Palette, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { logout } from '../services/authService';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc } from 'firebase/firestore';
import { safeFirestore, handleFirestoreError, OperationType } from '../services/firestoreService';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Order, FoodItem } from '../types';
import { FoodCard } from '../components/FoodCard';
import { getUserWishlist } from '../services/wishlistService';
import { RESTAURANT_WHATSAPP } from '../constants';

export const Profile: React.FC = () => {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<FoodItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'orders' | 'wishlist'>('personal');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  const [settingsData, setSettingsData] = useState({
    notifications: {
      orderUpdates: true,
      promotions: false,
      riderChat: true
    },
    privacy: {
      shareActivity: false,
      saveSearchHistory: true
    }
  });

  useEffect(() => {
    if (!authUser) return;

    // Load initial data from cache
    const profileCacheKey = `profile_cache_${authUser.uid}`;
    const ordersCacheKey = `recent_orders_cache_${authUser.uid}`;
    const wishlistCacheKey = `wishlist_cache_${authUser.uid}`;

    const cachedProfile = localStorage.getItem(profileCacheKey);
    const cachedOrders = localStorage.getItem(ordersCacheKey);
    const cachedWishlist = localStorage.getItem(wishlistCacheKey);

    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile);
        const data = parsed.data || parsed;
        setUserData(data);
        setFormData({
          name: data.full_name || '',
          phone: data.phone || '',
          address: data.address || ''
        });
        if (data.settings) setSettingsData(data.settings);
        setLoading(false);
      } catch (e) {}
    }
    if (cachedOrders) {
      try {
        const parsed = JSON.parse(cachedOrders);
        setRecentOrders(parsed.data || parsed);
      } catch (e) {}
    }
    if (cachedWishlist) {
      try {
        const parsed = JSON.parse(cachedWishlist);
        setWishlist(parsed.data || parsed);
      } catch (e) {}
    }

    const fetchData = async () => {
      try {
        // User data
        const userDataObj = await safeFirestore.getDocument<any>(
          doc(db, 'users', authUser.uid), 
          profileCacheKey,
          `users/${authUser.uid}`
        );
        
        if (userDataObj) {
          setUserData(userDataObj);
          setFormData({
            name: userDataObj.full_name || '',
            phone: userDataObj.phone || '',
            address: userDataObj.address || ''
          });
          if (userDataObj.settings) setSettingsData(userDataObj.settings);
        }

        // Recent orders
        const qOrders = query(
          collection(db, 'orders'),
          where('user_id', '==', authUser.uid),
          orderBy('created_at', 'desc'),
          limit(5)
        );
        const ordersData = await safeFirestore.getCollection<Order>(qOrders, ordersCacheKey, 'orders');

        if (ordersData && ordersData.length > 0) {
          setRecentOrders(ordersData);
        }

        // Wishlist from Supabase
        const wishlistItems = await getUserWishlist(authUser.uid);
        setWishlist(wishlistItems || []);
      } catch (err) {
        console.error("Error fetching profile data:", err);
      }

      setLoading(false);
    };

    fetchData();

    // Real-time subscriptions
    const unsubUser = safeFirestore.listen(doc(db, 'users', authUser.uid), (data: any) => {
      if (data) {
        setUserData(data);
        setFormData({
          name: data.full_name || '',
          phone: data.phone || '',
          address: data.address || ''
        });
        if (data.settings) setSettingsData(data.settings);
      }
    }, `profile_user_${authUser.uid}`);

    const qOrdersRealtime = query(
      collection(db, 'orders'),
      where('user_id', '==', authUser.uid),
      orderBy('created_at', 'desc'),
      limit(5)
    );
    const unsubOrders = safeFirestore.listen(qOrdersRealtime, (data: Order[]) => {
      setRecentOrders(data);
    }, `profile_orders_${authUser.uid}`);

    return () => {
      unsubUser();
      unsubOrders();
    };
  }, [authUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    try {
      const userDocRef = doc(db, 'users', authUser.uid);
      await updateDoc(userDocRef, {
        full_name: formData.name,
        phone: formData.phone,
        address: formData.address,
        updated_at: new Date().toISOString()
      });
      
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${authUser.uid}`);
      }
    }
  };

  const handleUpdateSettings = async (newSettings: any) => {
    if (!authUser) return;
    try {
      const userDocRef = doc(db, 'users', authUser.uid);
      await updateDoc(userDocRef, { 
        settings: newSettings,
        updated_at: new Date().toISOString()
      });
      
      setSettingsData(newSettings);
    } catch (error: any) {
      console.error('Error updating settings:', error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${authUser.uid}`);
      }
    }
  };

  const handleExportData = () => {
    const data = {
      profile: user,
      orders: recentOrders,
      settings: settingsData,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `frosty-bite-data-${authUser?.uid.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAccount = async () => {
    if (window.confirm("CRITICAL ACTION: This will delete your entire order history and account data from Frosty Bite. This cannot be undone. Are you absolutely sure?")) {
      try {
        const userDocRef = doc(db, 'users', authUser?.uid!);
        await updateDoc(userDocRef, { 
          deleted: true,
          deleted_at: new Date().toISOString(),
          status: 'deactivated'
        });
        
        alert("Your account has been deactivated. Our team will process the final deletion within 24 hours.");
        await handleLogout();
      } catch (error: any) {
        console.error("Account deletion failed:", error);
        if (error.code === 'permission-denied') {
          handleFirestoreError(error, OperationType.WRITE, `users/${authUser?.uid}`);
        }
      }
    }
  };

  const user = {
    name: userData?.full_name || authUser?.displayName || 'User',
    email: authUser?.email || 'No email provided',
    phone: userData?.phone || 'Not provided',
    address: userData?.address || 'No address saved',
    avatar: authUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.full_name || authUser?.displayName || 'User')}&background=f97316&color=fff`,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-500 bg-amber-500/10';
      case 'confirmed': return 'text-blue-500 bg-blue-500/10';
      case 'preparing': return 'text-purple-500 bg-purple-500/10';
      case 'out_for_delivery': return 'text-orange-500 bg-orange-500/10';
      case 'delivered': return 'text-emerald-500 bg-emerald-500/10';
      case 'cancelled': return 'text-red-500 bg-red-500/10';
      default: return 'text-zinc-500 bg-zinc-500/10';
    }
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch (e) {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Establishing Secure Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-svh flex flex-col max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-8 pb-32">
      {/* Profile Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-dark rounded-[40px] border border-white/5 p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -translate-y-1/2 translate-x-1/2" />
        
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2rem] overflow-hidden border-4 border-white/5 ring-8 ring-primary/5 group-hover:ring-primary/10 transition-all duration-500">
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter leading-none mb-2">{user.name}</h1>
              <p className="text-zinc-500 font-medium">Customer ID: {authUser?.uid.slice(0, 8)}</p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                <Mail className="text-primary" size={16} />
                <span className="text-xs font-bold text-white/80">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
                <Phone className="text-primary" size={16} />
                <span className="text-xs font-bold text-white/80">{user.phone}</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsEditing(true)}
            className="w-full md:w-auto px-8 py-4 bg-primary text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20"
          >
            Edit Profile
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex p-2 bg-white/5 border border-white/5 rounded-[2rem] gap-2">
        <button 
          onClick={() => setActiveTab('personal')}
          className={cn(
            "flex-1 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'personal' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
          )}
        >
          Details
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={cn(
            "flex-1 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'orders' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
          )}
        >
          Orders
        </button>
        <button 
          onClick={() => setActiveTab('wishlist')}
          className={cn(
            "flex-1 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'wishlist' ? "bg-white text-black shadow-lg" : "text-zinc-500 hover:text-white"
          )}
        >
          Wishlist
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'personal' ? (
          <motion.div 
            key="personal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <div className="glass-dark rounded-[2.5rem] border border-white/5 p-8 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <MapPin size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Default Delivery Address</h3>
                  <p className="text-xs text-zinc-500 font-medium">Where we deliver your fresh bakes</p>
                </div>
              </div>
              
              <div className="p-6 bg-[#0a0a0a] rounded-3xl border border-white/5">
                <p className="text-zinc-400 font-medium leading-relaxed">
                  {user.address}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Frosty Points</p>
                  <p className="text-2xl font-black text-white">450</p>
                </div>
                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Total Orders</p>
                  <p className="text-2xl font-black text-white">{recentOrders.length}</p>
                </div>
              </div>
            </div>

            <div className="glass-dark rounded-[2.5rem] border border-white/5 p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <MessageCircle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Help & Support</h3>
                  <p className="text-xs text-zinc-500 font-medium">Need help with an order or have a question?</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => window.open(`https://wa.me/${RESTAURANT_WHATSAPP}`, '_blank')}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <MessageCircle size={16} />
                  Chat on WhatsApp
                </button>
                <button 
                  onClick={() => window.location.href = `tel:${RESTAURANT_WHATSAPP}`}
                  className="flex-1 py-4 bg-white/5 border border-white/5 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Phone size={16} />
                  Call Us
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleLogout}
                className="flex-1 py-5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <LogOut size={18} />
                Logout
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all active:scale-95"
              >
                Account Settings
              </button>
            </div>
          </motion.div>
        ) : activeTab === 'orders' ? (
          <motion.div 
            key="orders"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-4"
          >
            {recentOrders.length === 0 ? (
              <div className="glass-dark rounded-[2.5rem] border border-white/5 p-12 text-center space-y-4">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-700">
                  <ShoppingBag size={40} />
                </div>
                <h3 className="text-xl font-bold text-white">No orders yet</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">Freshly baked treats are just a few clicks away!</p>
                <Link 
                  to="/" 
                  className="inline-block px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest mt-4 shadow-lg shadow-primary/20"
                >
                  Start Ordering
                </Link>
              </div>
            ) : (
              recentOrders.map((order) => (
                <Link 
                  key={order.id} 
                  to={`/order-tracking/${order.id}`}
                  className="block glass-dark rounded-3xl border border-white/5 p-6 hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                        <ShoppingBag size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white tracking-tight">Order #{order.id.slice(0, 6)}</h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            getStatusColor(order.status)
                          )}>
                            {order.status.replace(/-/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold mt-1 uppercase tracking-widest">
                          <div className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatDate(order.created_at)}
                          </div>
                          <span>•</span>
                          <span>{order.items.length} Items</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-white">₹{order.total}</p>
                      <ChevronRight className="w-5 h-5 text-zinc-700 ml-auto mt-1 group-hover:text-primary transition-all group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="wishlist"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {wishlist.length === 0 ? (
              <div className="glass-dark rounded-[2.5rem] border border-white/5 p-12 text-center space-y-4">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-700">
                  <Heart size={40} />
                </div>
                <h3 className="text-xl font-bold text-white">Your wishlist is empty</h3>
                <p className="text-zinc-500 text-sm max-w-xs mx-auto">Save your favorite items for later!</p>
                <Link 
                  to="/" 
                  className="inline-block px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest mt-4 shadow-lg shadow-primary/20"
                >
                  Explore Menu
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {wishlist.map((item) => (
                  <FoodCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/5 rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between p-8 md:p-10 pb-0 shrink-0">
                  <div>
                    <h3 className="text-3xl font-black text-white tracking-tighter">Edit Identity</h3>
                    <p className="text-xs text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">Profile Synchronization</p>
                  </div>
                  <button 
                    onClick={() => setIsEditing(false)} 
                    className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-8 scrollbar-hide pb-32 md:pb-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-4">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="Enter your name"
                        className="w-full bg-[#111] border border-white/5 rounded-[1.5rem] py-5 px-8 text-white focus:outline-none focus:border-primary/50 transition-all font-bold" 
                      />
                    </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-4">Direct Contact</label>
                  <input 
                    type="text" 
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="e.g. +91 77358 00239"
                    className="w-full bg-[#111] border border-white/5 rounded-[1.5rem] py-5 px-8 text-white focus:outline-none focus:border-primary/50 transition-all font-bold" 
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-4">Primary HQ (Address)</label>
                  <textarea 
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Street, Building, Landmark..."
                    className="w-full bg-[#111] border border-white/5 rounded-[1.5rem] py-5 px-8 text-white focus:outline-none focus:border-primary/50 transition-all font-bold h-32 resize-none" 
                  />
                </div>

                  </div>
 
                  <div className="sticky bottom-0 left-0 right-0 p-8 pt-4 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 flex gap-4 shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-5 rounded-[1.5rem] bg-white/5 text-zinc-500 font-black uppercase text-xs tracking-widest hover:text-white transition-all active:scale-95">
                      Dismiss
                    </button>
                    <button type="submit" className="flex-2 py-5 rounded-[1.5rem] bg-primary text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                      Commit Changes
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Account Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/5 rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between p-8 md:p-10 pb-0 shrink-0 mb-6">
                  <div>
                    <h3 className="text-3xl font-black text-white tracking-tighter">Account Center</h3>
                    <p className="text-xs text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">Manage Control Panel</p>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)} 
                    className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-10 scrollbar-hide pb-32 md:pb-6">
                {/* Notifications Section skipped */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Notification Preferences</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-sm font-bold text-white">Order Status Updates</p>
                        <p className="text-[10px] text-zinc-500">Real-time alerts for your orders</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSettings({
                          ...settingsData,
                          notifications: { ...settingsData.notifications, orderUpdates: !settingsData.notifications.orderUpdates }
                        })}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          settingsData.notifications.orderUpdates ? "bg-primary" : "bg-zinc-800"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          settingsData.notifications.orderUpdates ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-sm font-bold text-white">Promotional Offers</p>
                        <p className="text-[10px] text-zinc-500">New discounts and seasonal treats</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSettings({
                          ...settingsData,
                          notifications: { ...settingsData.notifications, promotions: !settingsData.notifications.promotions }
                        })}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          settingsData.notifications.promotions ? "bg-primary" : "bg-zinc-800"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          settingsData.notifications.promotions ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Data Section */}
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Data & Portability</h4>
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={handleExportData}
                      className="w-full flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <ShoppingBag size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-white">Export Order History</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Download as JSON</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="space-y-6 pt-4">
                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">Danger Zone</h4>
                  <button 
                     onClick={handleDeleteAccount}
                    className="w-full h-16 border-2 border-red-500/20 rounded-2xl flex items-center justify-between px-6 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black uppercase text-xs tracking-widest"
                  >
                    Permanently Delete Account
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 left-0 right-0 p-8 pt-4 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 flex gap-4 shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                  <button 
                    onClick={() => setIsSettingsOpen(false)} 
                    className="w-full py-5 rounded-[1.5rem] bg-white/5 text-zinc-500 font-black uppercase text-xs tracking-widest hover:text-white transition-all active:scale-95"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ThemeSettingsPanel removed */}
    </div>
  );
};

export default Profile;
