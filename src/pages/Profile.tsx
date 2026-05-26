import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, MapPin, CreditCard, Mail, Phone, Plus, Edit2, Trash2, 
  ChevronRight, LogOut, X, CheckCircle, Smartphone, ShoppingBag, 
  Clock, Heart, Palette, MessageCircle, Star, ShieldCheck, 
  Gift, Percent, Settings, ArrowUpRight, Sparkles, TrendingUp,
  Crown, Wallet, Briefcase, Zap, Bell, Award, Coffee, IceCream,
  Pizza, Flame, Moon, Sun, CloudRain, Shield, Camera, 
  Share2, HeartHandshake, HelpCircle, Layout, Calendar,
  Sparkles as SparkleIcon, Instagram, Download
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { StoryCard } from '../components/StoryCard';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, collection, query, where, orderBy, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { safeFirestore, handleFirestoreError, OperationType } from '../services/firestoreService';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Order, FoodItem } from '../types';
import { FoodCard } from '../components/FoodCard';
import { getUserWishlist } from '../services/wishlistService';
import { RESTAURANT_WHATSAPP } from '../constants';
import { usePWA } from '../hooks/usePWA';
import { AiRecommendationCard } from '../AiRecommendationCard';
import { searchService, AiRecommendationResponse } from '../services/searchService';
import { useMenu } from '../context/MenuContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-hot-toast';

import { rewardsService, BadgeConfig } from '../services/rewardsService';
import { BadgeUnlockModal } from '../components/BadgeUnlockModal';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { LogOut as LucideLogOut } from 'lucide-react';

import { AvatarEditor } from '../components/AvatarEditor';
import { createAvatar } from '@dicebear/core';
import * as adventurer from '@dicebear/adventurer';

// --- STYLIZED COMPONENTS ---
const BAKERY_PROPS: any = {
  croissant: '🥐',
  cupcake: '🧁',
  chef_hat: '👩‍🍳',
  coffee_mug: '☕',
  whisk: '🥣',
  cake_slice: '🍰'
};

const GlowingAvatar = ({ src, name, svg, config, onEdit, avatarUrl }: { src: string; name: string; svg?: string; config?: any; onEdit?: () => void, avatarUrl?: string }) => {
  const currentProp = config?.options?.bakeryTheme?.[0] || 'none';
  const isAI = !!avatarUrl;
  
  return (
    <div className="relative group perspective-1000">
      <div className="absolute -inset-1.5 bg-gradient-to-r from-bakery-pink via-bakery-chocolate/20 to-bakery-beige rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000" />
      <motion.div 
        animate={{ 
          y: [0, -8, 0]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        whileHover={{ scale: 1.05 }}
        onClick={onEdit}
        className="relative w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-white overflow-hidden cursor-pointer shadow-2xl border-4 border-white"
      >
        {isAI ? (
           <img 
            src={avatarUrl} 
            alt={name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : svg ? (
          <div 
            className="w-full h-full scale-125 translate-y-3"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <img 
            src={src} 
            alt={name} 
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        )}
        
        {!isAI && currentProp !== 'none' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex items-center justify-center">
             <span className="text-4xl md:text-6xl drop-shadow-2xl animate-bounce-slow mt-16 mr-16">
               {BAKERY_PROPS[currentProp]}
             </span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera size={20} className="text-white drop-shadow-md" />
        </div>
      </motion.div>
    </div>
  );
};

const PremiumBadge = ({ text, icon: Icon, color = 'bg-primary' }: { text: string; icon: any; color?: string }) => (
  <motion.div 
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className={cn("px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/10 shadow-lg backdrop-blur-md", color)}
  >
    <Icon size={14} className="text-white" />
    <span className="text-[10px] font-black text-white uppercase tracking-widest">{text}</span>
  </motion.div>
);

const StatCard = ({ label, value, icon: Icon, color, delay }: { label: string; value: string | number; icon: any; color: string; delay: number }) => (
  <motion.div
    initial={{ x: 50, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ delay, type: 'spring', stiffness: 100 }}
    whileHover={{ y: -5 }}
    className="min-w-[150px] md:min-w-[180px] glass-dark border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-6 group cursor-pointer relative overflow-hidden"
  >
    <div className={cn("absolute top-0 right-0 p-3 md:p-4 opacity-5 group-hover:opacity-10 transition-all scale-125 md:scale-150 rotate-12", color)}>
      <Icon className="w-10 h-10 md:w-12 md:h-12" />
    </div>
    <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center mb-3 md:mb-4 transition-transform group-hover:rotate-12", color)}>
      <Icon className="w-5 h-5 md:w-6 md:h-6" />
    </div>
    <div>
      <h4 className="text-2xl md:text-3xl font-black text-white tracking-tighter tabular-nums mb-1">{value}</h4>
      <p className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-white transition-colors">{label}</p>
    </div>
    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </motion.div>
);

const LoyaltyProgressRing = ({ percentage }: { percentage: number }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center group">
      <svg className="w-48 h-48 transform -rotate-90">
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="transparent"
          className="text-white/5"
        />
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: "easeOut" }}
          cx="96"
          cy="96"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="transparent"
          strokeDasharray={circumference}
          className="text-primary drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Crown size={32} className="text-yellow-500 animate-bounce mb-1" />
        <span className="text-3xl font-black text-white">{percentage}%</span>
        <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">To Platinum</span>
      </div>
    </div>
  );
};

const SmartActionCard = ({ label, icon: Icon, onClick, color = 'bg-white/5' }: { label: string; icon: any; onClick?: () => void; color?: string }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "relative p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 flex flex-col items-center justify-center gap-3 md:gap-4 transition-all group overflow-hidden",
      color
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors group-hover:scale-110">
      <Icon className="w-6 h-6 md:w-7 md:h-7" />
    </div>
    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-zinc-500 group-hover:text-white transition-colors text-center">{label}</span>
    <div className="absolute -bottom-4 -right-4 text-white/[0.02] group-hover:text-white/[0.05] transition-colors">
      <Icon className="w-16 h-16 md:w-20 md:h-20" />
    </div>
  </motion.button>
);

export const Profile: React.FC = () => {
  const { user: authUser, logout } = useAuth();
  const firebaseUid = authUser?.firebase_uid || authUser?.uid;
  const { items: menuItems } = useMenu();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { notifications } = useNotifications();
  
  const [userData, setUserData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<FoodItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareType, setShareType] = useState<'avatar' | 'rank' | 'personality'>('avatar');
  const [isSharing, setIsSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'orders' | 'wishlist' | 'rewards'>('personal');
  const { install, isStandalone, isInstallable } = usePWA();
  const [aiRec, setAiRec] = useState<{ recommendation: AiRecommendationResponse, item: FoodItem } | null>(null);

  const [badgeConfigs, setBadgeConfigs] = useState<BadgeConfig[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [newTierName, setNewTierName] = useState('');
  const [prevTier, setPrevTier] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  const currentTierConfig = useMemo(() => {
    return badgeConfigs.find(c => c.tierName === userData?.badge_tier) || {
      tierName: userData?.badge_tier || 'Foodie Starter',
      themeColor: '#F97316',
      badgeIcon: 'Crown',
      benefits: ['Standard Support', 'Fresh Bakery Access']
    };
  }, [userData?.badge_tier, badgeConfigs]);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  const [settingsData, setSettingsData] = useState({
    notifications: {
      orderUpdates: true,
      promotions: false
    },
    privacy: {
      shareActivity: false,
      saveSearchHistory: true
    }
  });

  // Greetings & Background logic
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning ☀️';
    if (hour < 18) return 'Good Afternoon 🌤️';
    return 'Good Evening 🌙';
  }, []);

  const timeBackground = useMemo(() => {
    const hour = new Date().getHours();
    const isLight = theme === 'light';
    if (isLight) {
      if (hour < 12) return 'from-orange-200/50 via-yellow-100/30 to-transparent';
      if (hour < 18) return 'from-blue-200/50 via-cyan-100/30 to-transparent';
      return 'from-purple-200/50 via-indigo-100/30 to-transparent';
    }
    if (hour < 12) return 'from-orange-500/20 via-yellow-400/5 to-transparent';
    if (hour < 18) return 'from-blue-400/20 via-cyan-400/5 to-transparent';
    return 'from-purple-600/30 via-indigo-900/10 to-transparent';
  }, [theme]);

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
        // Fetch badge configs
        const configs = await rewardsService.getBadgeConfigs();
        setBadgeConfigs(configs);

        // User data
        const userDataObj = await safeFirestore.get<any>(doc(db, 'users', firebaseUid));
        
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
          where('user_id', '==', firebaseUid),
          orderBy('created_at', 'desc'),
          limit(5)
        );
        const ordersData = await safeFirestore.list<Order>(qOrders);

        if (ordersData && ordersData.length > 0) {
          setRecentOrders(ordersData);
        }

        // Wishlist from Supabase
        const wishlistItems = await getUserWishlist(authUser.uid);
        setWishlist(wishlistItems || []);

        // Rewards gifts
        const availableGifts = await rewardsService.getGifts();
        setGifts(availableGifts);

        if (menuItems.length > 0) {
          const queryText = "Best celebratory dessert for a premium member";
          const rec = await searchService.getSmartRecommendation(queryText, menuItems);
          if (rec) {
             const item = menuItems.find(i => String(i.id) === String(rec.bestMatchId));
             if (item) setAiRec({ recommendation: rec, item });
          }
        }
      } catch (err) {
        console.error("Error fetching profile data:", err);
      }

      setLoading(false);
    };

    fetchData();

    // Real-time subscriptions
    const unsubUser = safeFirestore.subscribe<any>(doc(db, 'users', firebaseUid), (data) => {
      if (data) {
        // Check for tier upgrade
        if (userData && data.badge_tier && data.badge_tier !== userData.badge_tier) {
          setNewTierName(data.badge_tier);
          setPrevTier(userData.badge_tier);
          setShowUnlockModal(true);
        }

        setUserData(data);
        setFormData({
          name: data.full_name || '',
          phone: data.phone || '',
          address: data.address || ''
        });
        if (data.settings) setSettingsData(data.settings);
      }
    });

    const qOrdersRealtime = query(
      collection(db, 'orders'),
      where('user_id', '==', firebaseUid),
      orderBy('created_at', 'desc'),
      limit(5)
    );
    const unsubOrders = safeFirestore.subscribe<Order>(qOrdersRealtime, (data) => {
      if (Array.isArray(data)) {
        setRecentOrders(data);
      }
    });

    return () => {
      unsubUser();
      unsubOrders();
    };
  }, [authUser, menuItems]);

  const loyaltyStats = useMemo(() => {
    const points = userData?.points || 0;
    const totalOrders = userData?.total_orders || 0;
    const spend = userData?.lifetime_spend || 0;
    
    // Find next tier
    const nextTierConfig = badgeConfigs.find(c => {
      const currentPriority = badgeConfigs.find(curr => curr.tierName === (userData?.badge_tier || 'Foodie Starter'))?.priority || 0;
      return c.priority > currentPriority;
    });

    const progress = nextTierConfig ? Math.min(100, Math.max(
      (totalOrders / nextTierConfig.minOrders) * 100,
      (spend / nextTierConfig.minSpend) * 100
    )) : 100;
    
    return { 
      progress, 
      nextTier: nextTierConfig?.tierName || 'Elite', 
      ordersLeft: nextTierConfig ? Math.max(0, nextTierConfig.minOrders - totalOrders) : 0,
      spendLeft: nextTierConfig ? Math.max(0, nextTierConfig.minSpend - spend) : 0
    };
  }, [recentOrders, userData, badgeConfigs]);

  const stats = useMemo(() => [
    { label: 'Orders', value: userData?.total_orders || 0, icon: ShoppingBag, color: 'text-blue-400' },
    { label: 'Favorites', value: wishlist.length, icon: Heart, color: 'text-pink-500' },
    { label: 'Rewards', value: userData?.points || 0, icon: Gift, color: 'text-primary' },
    { label: 'Wallet', value: `₹${userData?.wallet_balance || 0}`, icon: Wallet, color: 'text-emerald-400' },
    { label: 'Experience', value: `Lv.${Math.floor((userData?.points || 0) / 100) + 1}`, icon: Zap, color: 'text-yellow-400' },
  ], [wishlist, userData]);

  const handleAddFunds = async () => {
    if (!authUser) return;
    try {
      const userDocRef = doc(db, 'users', firebaseUid);
      const currentBalance = userData?.wallet_balance || 0;
      await updateDoc(userDocRef, {
        wallet_balance: currentBalance + 500,
        updated_at: serverTimestamp()
      });
      toast.success('₹500 added to your wallet!');
    } catch (error: any) {
      console.error('Error adding funds:', error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUid}`);
      }
      toast.error('Failed to add funds');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Frosty Bite | ' + user.name,
      text: `Check out ${user.name}'s profile on Frosty Bite!`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success('Shared successfully');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Profile link copied to clipboard');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        toast.error('Could not share profile');
      }
    }
  };
  
  const handleShareStory = async () => {
    if (!storyRef.current) return;
    
    const loadingToast = toast.loading('Baking your story card...');
    setIsSharing(true);
    
    try {
      // Short delay to ensure any dynamic assets are ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const dataUrl = await toPng(storyRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#000',
      });
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `frosty-bite-story-${shareType}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'My Frosty Bite Identity',
            text: 'Check out my level on Frosty Bite! ✨',
          });
          toast.success('Ready to share!', { id: loadingToast });
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            toast.dismiss(loadingToast);
          } else {
            throw shareErr;
          }
        }
      } else {
        // Fallback for desktop: download
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `frosty-bite-${shareType}-${Date.now()}.png`;
        link.click();
        toast.success('Story card saved! Now upload it to Instagram STORIES ✨', { id: loadingToast });
      }
      setIsShareModalOpen(false);
    } catch (err) {
      console.error('Sharing failed:', err);
      toast.error('Failed to generate story card. Please try again.', { id: loadingToast });
    } finally {
      setIsSharing(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    try {
      const userDocRef = doc(db, 'users', firebaseUid);
      await updateDoc(userDocRef, {
        full_name: formData.name,
        phone: formData.phone,
        address: formData.address,
        updated_at: serverTimestamp()
      });
      
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUid}`);
      }
    }
  };

  const handleUpdateSettings = async (newSettings: any) => {
    if (!authUser) return;
    try {
      const userDocRef = doc(db, 'users', firebaseUid);
      await updateDoc(userDocRef, { 
        settings: newSettings,
        updated_at: serverTimestamp()
      });
      
      setSettingsData(newSettings);
    } catch (error: any) {
      console.error('Error updating settings:', error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUid}`);
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

  const handleClaimGift = async (giftId: string) => {
    if (!authUser) return;
    const loadingToast = toast.loading('Claiming reward...');
    try {
      const success = await rewardsService.claimGift(firebaseUid, giftId);
      if (success) {
        toast.success('Reward claimed! Check your email for details.', { id: loadingToast });
      }
    } catch (error) {
      toast.error('Failed to claim reward', { id: loadingToast });
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const userDocRef = doc(db, 'users', firebaseUid);
      await updateDoc(userDocRef, { 
        deleted: true,
        deleted_at: new Date().toISOString(),
        status: 'deactivated',
        updated_at: serverTimestamp()
      });
      
      setShowDeleteConfirm(false);
      toast.success("Account deactivated. Data deletion in progress.");
      await handleLogout();
    } catch (error: any) {
      console.error("Account deletion failed:", error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUid}`);
      }
      toast.error("Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const user = {
    name: userData?.full_name || authUser?.displayName || 'User',
    email: authUser?.email || 'No email provided',
    phone: userData?.phone || 'Not provided',
    address: userData?.address || 'No address saved',
    avatar_url: userData?.avatar_url,
    avatar: userData?.avatar_url || (userData?.avatar_config ? `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.avatar_config.seed}${Object.entries(userData.avatar_config.options || {}).map(([k, v]) => `&${k}=${Array.isArray(v) ? v[0] : v}`).join('')}` : authUser?.photoURL) || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData?.full_name || authUser?.displayName || 'User')}&background=f97316&color=fff`,
    avatarConfig: userData?.avatar_config,
    aiUsageStats: userData?.ai_usage_stats || { count: userData?.avatar_generation_count || 0, month: new Date().getMonth() },
    avatarSvg: userData?.avatar_config ? createAvatar(adventurer, {
      seed: userData.avatar_config.seed,
      ...userData.avatar_config.options
    }).toString() : null
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

  const handleSaveAvatar = async (avatarConfig: any) => {
    if (!authUser) return;
    const loadingToast = toast.loading('Applying your new identity...');
    try {
      const userDocRef = doc(db, 'users', firebaseUid);
      
      let finalAvatarUrl = avatarConfig.avatar_url;

      // If it's a new AI generation (base64), we MUST upload it to Cloudinary first
      if (avatarConfig.isAI && finalAvatarUrl?.startsWith('data:')) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
          toast.error("Cloudinary keys missing! Please ensure you've added VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in Settings > Environment Variables, then REFRESH this page.", { id: loadingToast, duration: 8000 });
          return;
        }

        const formData = new FormData();
        formData.append("file", finalAvatarUrl);
        formData.append("upload_preset", uploadPreset);

        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        let cloudData;
        try {
          const text = await cloudRes.text();
          cloudData = text ? JSON.parse(text) : {};
        } catch (e) {
          cloudData = {};
        }

        if (!cloudRes.ok) {
          throw new Error(cloudData.error?.message || `Failed to store AI avatar in cloud (${cloudRes.status})`);
        }
        
        finalAvatarUrl = cloudData.secure_url;
        if (!finalAvatarUrl) {
          throw new Error("Cloudinary missing URL after upload");
        }
      }

      // AI usage logic
      let updatedAiUsage = avatarConfig.aiUsageStats || { count: userData?.avatar_generation_count || 0, month: new Date().getMonth() };
      
      if (avatarConfig.isAI) {
        updatedAiUsage.count = (userData?.avatar_generation_count || 0) + 1;
      }

      const currentMonth = new Date().getMonth();
      
      // If month has changed, reset count
      if (updatedAiUsage.month !== currentMonth) {
        updatedAiUsage = { count: updatedAiUsage.count, month: currentMonth };
      }

      const updateData: any = {
        updated_at: serverTimestamp(),
        ai_usage_stats: updatedAiUsage,
        avatar_generation_count: updatedAiUsage.count
      };

      if (avatarConfig.isAI) {
        updateData.avatar_url = finalAvatarUrl;
        updateData.avatar_style = avatarConfig.avatar_style;
        updateData.avatar_vibe = avatarConfig.avatar_vibe;
      } else {
        updateData.avatar_config = {
          seed: avatarConfig.seed,
          options: avatarConfig.options
        };
        // If they chose a new DiceBear avatar, clear the AI one
        updateData.avatar_url = null;
        updateData.avatar_style = 'dicebear';
        updateData.avatar_vibe = avatarConfig.avatar_vibe;
      }

      await updateDoc(userDocRef, updateData);
      setIsAvatarEditorOpen(false);
      toast.success('Avatar style applied!', { id: loadingToast });
    } catch (error: any) {
      console.error('Error saving avatar:', error);
      toast.error('Failed to save avatar', { id: loadingToast });
    }
  };

  return (
    <div className="min-h-screen bg-black overflow-x-hidden pb-32" ref={containerRef}>
      {/* Confirmation Modal for Account Deletion */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account?"
        description="CRITICAL ACTION: This will delete your entire order history and account data from Frosty Bite. This cannot be undone."
        confirmText="Permanently Delete"
        variant="danger"
        isLoading={isDeletingAccount}
      />

      {/* Cinematic Hero Header */}
      <section className="relative min-h-[50vh] md:min-h-[70vh] flex items-center justify-center overflow-hidden py-20 md:py-32">
        {/* Dynamic Mesh Background */}
        <div className={cn(
          "absolute inset-0 transition-colors duration-1000 bg-gradient-to-tr opacity-40",
          timeBackground
        )} />
        
        {/* Animated Particles & Glows */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 md:w-96 md:h-96 bg-primary/20 rounded-full blur-[80px] md:blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 md:w-96 md:h-96 bg-purple-500/20 rounded-full blur-[80px] md:blur-[120px] animate-pulse-slow" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center px-4 md:px-6 w-full">
          <GlowingAvatar 
            src={user.avatar} 
            name={user.name} 
            svg={user.avatarSvg || undefined}
            avatarUrl={user.avatar_url}
            config={user.avatarConfig}
            onEdit={() => setIsAvatarEditorOpen(true)}
          />
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 md:mt-12 space-y-4 md:space-y-6 w-full max-w-4xl"
          >
            <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-2 md:mb-4">
              <PremiumBadge text={userData?.badge_tier || 'Foodie Starter'} icon={Crown} color="bg-primary/20 text-primary border-primary/20" />
              <PremiumBadge text="Verified Foodie" icon={ShieldCheck} color="bg-emerald-500/10 text-emerald-500 border-emerald-500/10" />
            </div>
            
            <h1 id="profile-greeting" className="text-4xl sm:text-5xl md:text-7xl font-black text-white tracking-tighter leading-[1.1] md:leading-none px-2">
              {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-400 to-zinc-600 block sm:inline-block mt-2 sm:mt-0">{user.name.split(' ')[0]}</span>
            </h1>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] md:tracking-[0.4em] text-[10px] md:text-sm">
              {userData?.title || 'Midnight Food Explorer'} • Level {Math.floor((userData?.points || 0) / 100) + 1}
            </p>
          </motion.div>
        </div>

        {/* Parallax Gradient Overlay */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent" />
      </section>

      {/* Floating Stats Rail */}
      <div className="relative -mt-8 md:-mt-20 z-20 px-0 overflow-x-auto scrollbar-hide pb-6 md:pb-10">
        <div className="flex gap-4 px-6 md:justify-center min-w-max">
          {stats.map((stat, idx) => (
            <StatCard key={stat.label} {...stat} delay={0.4 + (idx * 0.1)} />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-12">
        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Loyalty & AI */}
          <div className="lg:col-span-4 space-y-8">
            {/* Loyalty Engine */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="glass-dark rounded-[2.5rem] md:rounded-[3rem] border border-white/5 p-6 md:p-8 relative overflow-hidden"
            >
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6 md:mb-8">
                  <h3 className="text-lg md:text-xl font-black text-white tracking-tight italic">LOYALTY ENGINE</h3>
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                    <TrendingUp size={12} className="text-primary" />
                    <span className="text-[9px] md:text-[10px] font-black text-primary uppercase">Tier: {userData?.badge_tier || 'Starter'}</span>
                  </div>
                </div>

                <LoyaltyProgressRing percentage={loyaltyStats.progress} />

                <div className="w-full mt-8 p-6 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Next Milestone</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{loyaltyStats.nextTier} Status</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${loyaltyStats.progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 font-bold leading-relaxed px-1">
                    {loyaltyStats.ordersLeft > 0 
                      ? `Complete ${loyaltyStats.ordersLeft} more orders to unlock ${loyaltyStats.nextTier} benefits.`
                      : `You've reached the ${userData?.badge_tier} tier! Keep ordering for maximum rewards.`}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* AI Smart Recommendation */}
            {aiRec && (
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <AiRecommendationCard 
                  recommendation={aiRec.recommendation}
                  item={aiRec.item}
                  onAddToCart={() => {}} 
                  onViewDetails={() => {}}
                />
              </motion.div>
            )}
            
            {/* Install PWA Prompt */}
            {isInstallable && (
              <SmartActionCard 
                label="Install Desktop App" 
                icon={Smartphone} 
                onClick={install}
                color="bg-primary/10 border-primary/20"
              />
            )}
          </div>

          {/* Right Column: Dynamic Content Tabs */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex p-1.5 md:p-2 bg-black/80 border border-white/10 rounded-full sticky top-4 z-40 backdrop-blur-xl mx-4 lg:mx-0">
              {(['personal', 'orders', 'wishlist', 'rewards'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-3 md:py-4 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] transition-all relative overflow-hidden",
                    activeTab === tab ? "text-black" : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="tab-bg"
                      className="absolute inset-0 bg-white"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">{tab}</span>
                </button>
              ))}
            </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'personal' ? (
          <motion.div 
            key="personal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="glass-dark rounded-[2.5rem] md:rounded-[3rem] border border-white/5 p-6 md:p-10 space-y-8 md:space-y-10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Personal Identity</h3>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Private Information</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  onClick={() => setIsEditing(true)}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors shrink-0"
                >
                  <Edit2 className="w-5 h-5 md:w-6 md:h-6" />
                </motion.button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-6">
                  <div className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Full Name</p>
                      <p className="text-lg font-bold text-white">{user.name}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Email Protocol</p>
                      <p className="text-lg font-bold text-white">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                      <Phone size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Secure Line</p>
                      <p className="text-lg font-bold text-white">{user.phone}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Primary Base</p>
                      <p className="text-sm font-bold text-white leading-relaxed line-clamp-2">{user.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <SmartActionCard label="Add Funds" icon={CreditCard} onClick={handleAddFunds} color="bg-primary/5 group-hover:bg-primary/10" />
              <SmartActionCard label="Order Support" icon={MessageCircle} onClick={() => window.open(`https://wa.me/${RESTAURANT_WHATSAPP}`, '_blank')} />
              <SmartActionCard label="Share Story" icon={Instagram} onClick={() => setIsShareModalOpen(true)} color="bg-gradient-to-tr from-purple-500/10 to-pink-500/10 border-pink-500/10" />
              <SmartActionCard label="Share Profile" icon={Share2} onClick={handleShare} color="bg-emerald-500/5 group-hover:bg-emerald-500/10" />
              <SmartActionCard label="Logout" icon={LogOut} onClick={handleLogout} color="bg-red-500/5 group-hover:bg-red-500/10" />
            </div>
          </motion.div>
        ) : activeTab === 'orders' ? (
          <motion.div 
            key="orders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {recentOrders.length === 0 ? (
              <div className="glass-dark rounded-[3rem] border border-white/5 p-20 text-center space-y-6">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-700 animate-pulse">
                  <ShoppingBag size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic">NO MISSION DATA</h3>
                  <p className="text-zinc-500 text-sm max-w-xs mx-auto font-bold">Your order history is a blank canvas. Start your first mission now.</p>
                </div>
                <Button 
                  onClick={() => navigate('/')}
                  variant="primary"
                  className="px-12 py-5 rounded-3xl"
                >
                  Initiate First Order
                </Button>
              </div>
            ) : (
              recentOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Link 
                    to={`/order-tracking/${order.id}`}
                    className="block glass-dark rounded-[2.5rem] border border-white/5 p-8 hover:border-primary/30 hover:bg-white/[0.02] transition-all group overflow-hidden relative"
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all scale-150 rotate-12">
                      <ShoppingBag size={120} />
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                      <div className="flex items-center gap-6">
                        <div className={cn(
                          "w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                          getStatusColor(order.status)
                        )}>
                          <Clock size={32} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="text-2xl font-black text-white tracking-tighter">MISSION #{order.id.slice(0, 6).toUpperCase()}</h4>
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-white/10 shadow-sm",
                              getStatusColor(order.status)
                            )}>
                              {order.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-2">
                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(order.created_at)}</span>
                            <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                            <span>{order.items.length} SQUAD MEMBERS (ITEMS)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-12 border-t md:border-t-0 border-white/5 pt-6 md:pt-0">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Payload</p>
                          <p className="text-3xl font-black text-white tabular-nums">₹{order.total}</p>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-600 group-hover:text-primary group-hover:bg-primary/10 transition-all group-hover:translate-x-2">
                          <ChevronRight size={28} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : activeTab === 'wishlist' ? (
          <motion.div 
            key="wishlist"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tighter">Vault (Wishlist)</h3>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.2em] mt-1">Saved delicacies</p>
                </div>
                <div className="px-4 py-2 bg-pink-500/10 rounded-full border border-pink-500/20 flex items-center gap-2">
                  <Heart size={14} className="text-pink-500 fill-pink-500" />
                  <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest">{wishlist.length} Items</span>
                </div>
              </div>

            {wishlist.length === 0 ? (
              <div className="glass-dark rounded-[3rem] border border-white/5 p-20 text-center space-y-6">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-700">
                  <Heart size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic text-zinc-800">VAULT IS EMPTY</h3>
                  <p className="text-zinc-500 text-sm max-w-xs mx-auto font-bold">You haven't locked any items in your vault yet.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {wishlist.map((item) => (
                  <FoodCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="rewards"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tighter italic uppercase">REWARDS STORE</h3>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Exclusive Tier-Based Perks</p>
                </div>
                <div className="px-6 py-3 bg-primary/10 rounded-full border border-primary/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Award size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.15em] leading-none mb-1">Your Balance</p>
                    <p className="text-lg font-black text-white leading-none tabular-nums">{userData?.points || 0} PTS</p>
                  </div>
                </div>
              </div>

            {gifts.length === 0 ? (
              <div className="glass-dark rounded-[3rem] border border-white/5 p-20 text-center space-y-6">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-700 animate-pulse">
                  <Gift size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic">NO REWARDS AVAILABLE</h3>
                  <p className="text-zinc-500 text-sm max-w-xs mx-auto font-bold">Check back later for exclusive member benefits.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {gifts.map((gift) => {
                  const requiredPriority = badgeConfigs.find(c => c.tierName === gift.requiredTier)?.priority || 0;
                  const userPriority = badgeConfigs.find(c => c.tierName === userData?.badge_tier)?.priority || 0;
                  const isLocked = userPriority < requiredPriority;
                  const canAfford = (userData?.points || 0) >= (gift.costPoints || 0);
                  const isClaimed = userData?.claimedGifts?.some((g: any) => g.giftId === gift.id);

                  return (
                    <motion.div
                      key={gift.id}
                      className={cn(
                        "glass-dark rounded-[2.5rem] border border-white/5 p-6 md:p-8 flex items-center gap-6 group transition-all relative overflow-hidden",
                        isLocked && "opacity-50 grayscale pointer-events-none"
                      )}
                    >
                      <div className="shrink-0 w-24 h-24 rounded-3xl overflow-hidden border border-white/10 relative">
                        <img src={gift.image} alt={gift.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        {isLocked && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                            <Shield size={32} className="text-white/40" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-3 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                              isLocked ? "bg-zinc-800 text-zinc-500 border-zinc-700" : "bg-primary/20 text-primary border-primary/20"
                            )}>
                              {gift.requiredTier} Only
                            </span>
                            {isClaimed && (
                               <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                                 <CheckCircle size={10} /> Claimed
                               </span>
                            )}
                          </div>
                          <h4 className="text-xl font-black text-white tracking-tight uppercase italic truncate">{gift.title}</h4>
                          <p className="text-[10px] text-zinc-500 font-bold line-clamp-2 mt-1">{gift.description}</p>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4 pt-2">
                           <div className="flex flex-col">
                             <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Investment</span>
                             <span className="text-lg font-black text-white tabular-nums tracking-tight">{gift.costPoints || 0} PTS</span>
                           </div>
                           <Button 
                             onClick={() => handleClaimGift(gift.id)}
                             disabled={isLocked || !canAfford || gift.stock <= 0}
                             variant={isLocked ? "outline" : canAfford ? "primary" : "ghost"}
                             className="rounded-2xl px-6 h-12"
                           >
                             {isLocked ? 'Locked' : gift.stock <= 0 ? 'Out of Stock' : canAfford ? 'Claim Reward' : 'Points Needed'}
                           </Button>
                        </div>
                      </div>

                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <div className="bg-black/60 border border-white/10 px-6 py-2 rounded-full transform -rotate-12">
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">Locked: Upgrade to {gift.requiredTier}</span>
                           </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
</div>

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
                     onClick={() => setShowDeleteConfirm(true)}
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
      
      <BadgeUnlockModal 
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        tierName={newTierName}
        themeColor={badgeConfigs.find(c => c.tierName === newTierName)?.themeColor}
      />

      <AvatarEditor 
        isOpen={isAvatarEditorOpen}
        onClose={() => setIsAvatarEditorOpen(false)}
        onSave={handleSaveAvatar}
        user={userData}
        initialConfig={{
          seed: userData?.avatar_config?.seed || user.avatarConfig?.seed,
          options: userData?.avatar_config?.options || user.avatarConfig?.options,
          aiUsageStats: userData?.ai_usage_stats || user.aiUsageStats
        }}
      />

      {/* Share Story Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[3rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black text-white tracking-tighter">Share to Story</h3>
                    <p className="text-xs text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">Select Card Style</p>
                  </div>
                  <button 
                    onClick={() => setIsShareModalOpen(false)} 
                    className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(['avatar', 'rank', 'personality'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setShareType(type)}
                      className={cn(
                        "p-6 rounded-[2rem] border transition-all flex items-center justify-between group",
                        shareType === type ? "bg-primary border-primary" : "bg-white/5 border-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          shareType === type ? "bg-white text-primary" : "bg-white/5 text-zinc-400 group-hover:text-white"
                        )}>
                          {type === 'avatar' && <User size={20} />}
                          {type === 'rank' && <Crown size={20} />}
                          {type === 'personality' && <Sparkles size={20} />}
                        </div>
                        <div className="text-left">
                          <p className={cn("text-sm font-bold uppercase tracking-widest", shareType === type ? "text-white" : "text-white")}>
                            {type === 'avatar' ? 'Foodie Identity' : type === 'rank' ? 'Loyalty Progress' : 'AI Food Personality'}
                          </p>
                          <p className={cn("text-[10px] font-bold uppercase opacity-60 tracking-widest", shareType === type ? "text-white" : "text-zinc-500")}>
                            9:16 Instagram Ready
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={20} className={cn(shareType === type ? "text-white" : "text-zinc-700")} />
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handleShareStory}
                  disabled={isSharing}
                  variant="primary"
                  className="w-full py-6 rounded-[2rem] text-sm font-black tracking-[0.2em]"
                >
                  {isSharing ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      GENERATING...
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Instagram size={20} />
                      GENERATE & SHARE
                    </div>
                  )}
                </Button>
                
                <p className="text-[10px] text-center text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                  Generates a premium vertical card <br /> perfect for Instagram Stories.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Off-screen story card for rendering */}
      <div className="fixed -left-[2000px] top-0 pointer-events-none" aria-hidden="true">
        <div ref={storyRef}>
          <StoryCard 
            user={{
              name: user.name,
              avatar: user.avatar,
              avatar_url: user.avatar_url,
              avatarSvg: user.avatarSvg,
              vibe: userData?.avatar_vibe,
              title: userData?.title,
              level: Math.floor((userData?.points || 0) / 100) + 1,
              points: userData?.points || 0,
              tier: userData?.badge_tier || 'Foodie Starter'
            }}
            type={shareType}
          />
        </div>
      </div>
    </div>
  );
};

export default Profile;
