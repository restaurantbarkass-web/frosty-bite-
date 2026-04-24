import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, MapPin, CreditCard, Mail, Phone, Plus, Edit2, Trash2, ChevronRight, LogOut, X, CheckCircle, Smartphone, ShoppingBag, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { logout, db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Button } from '../components/Button';
import { Order } from '../types';

export const Profile: React.FC = () => {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'orders'>('personal');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    if (!authUser) return;

    // Real-time user data
    const userUnsubscribe = onSnapshot(doc(db, 'users', authUser.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserData(data);
        setFormData({
          name: data.name || authUser.displayName || '',
          phone: data.phone || '',
          address: data.address || ''
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${authUser.uid}`);
      setLoading(false);
    });

    // Real-time recent orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('userId', '==', authUser.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const ordersUnsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setRecentOrders(ordersData);
    }, (error) => {
      console.error("Orders fetching error:", error);
    });

    return () => {
      userUnsubscribe();
      ordersUnsubscribe();
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
      await updateDoc(doc(db, 'users', authUser.uid), formData);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error as any, OperationType.UPDATE, `users/${authUser.uid}`);
      alert("Failed to update profile. Please try again.");
    }
  };

  const user = {
    name: userData?.name || authUser?.displayName || 'User',
    email: authUser?.email || 'No email provided',
    phone: userData?.phone || 'Not provided',
    address: userData?.address || 'No address saved',
    avatar: authUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.name || authUser?.displayName || 'User')}&background=f97316&color=fff`,
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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
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
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-8">
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

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleLogout}
                className="flex-1 py-5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <LogOut size={18} />
                Logout
              </button>
              <button className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all active:scale-95">
                Account Settings
              </button>
            </div>
          </motion.div>
        ) : (
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
                            {formatDate(order.createdAt)}
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
              className="relative w-full max-w-xl bg-[#0a0a0a] border border-white/5 rounded-[3rem] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-10">
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

              <form onSubmit={handleUpdateProfile} className="space-y-8">
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
                    placeholder="e.g. +91 98765 43210"
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

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-5 rounded-[1.5rem] bg-white/5 text-zinc-500 font-black uppercase text-xs tracking-widest hover:text-white transition-all">
                    Dismiss
                  </button>
                  <button type="submit" className="flex-2 py-5 rounded-[1.5rem] bg-primary text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                    Commit Changes
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
