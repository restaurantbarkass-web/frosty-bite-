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
  Sparkles as SparkleIcon, Instagram, Download, RotateCcw
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { StoryCard } from '../components/StoryCard';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { supabase } from '../supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Order, FoodItem } from '../types';
import { FoodCard } from '../components/FoodCard';
import { getUserWishlist } from '../services/wishlistService';
import { RESTAURANT_WHATSAPP } from '../constants';
import { usePWA } from '../hooks/usePWA';
import { AiRecommendationCard } from '../AiRecommendationCard';
import { formatOrderId } from '../utils/orderUtils';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { searchService, AiRecommendationResponse } from '../services/searchService';
import { useMenu } from '../context/MenuContext';
import { LoadingScreen } from '../components/LoadingScreen';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-hot-toast';

import { rewardsService, BadgeConfig } from '../services/rewardsService';
import { BadgeUnlockModal } from '../components/BadgeUnlockModal';
import { SecureFundsLockModal } from '../components/SecureFundsLockModal';
import { AddFundsLockedModal } from '../components/AddFundsLockedModal';
import { GuestSessionManager } from '../core/guest/GuestSessionManager';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { LogOut as LucideLogOut } from 'lucide-react';
import { SlideToLogout } from '../components/ui/SlideToLogout';

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
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl, src]);

  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'FB';
  const finalImage = isAI ? avatarUrl : src;

  return (
    <div className="relative group perspective-1000">
      {/* Animated Glowing Ring Backdrop */}
      <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 via-pink-500 to-amber-500 rounded-full blur-md opacity-75 group-hover:opacity-100 transition-all duration-700 animate-pulse" />
      <div className="absolute -inset-1 bg-gradient-to-tr from-orange-400 via-amber-300 to-pink-500 rounded-full opacity-60 group-hover:scale-105 transition-transform duration-500" />

      <motion.div 
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        onClick={onEdit}
        className="relative w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-br from-white via-amber-100 to-orange-200 overflow-hidden cursor-pointer shadow-2xl border-4 border-white/90 backdrop-blur-md"
      >
        {!imgError && finalImage ? (
          <img 
            src={finalImage} 
            alt={name} 
            className="w-full h-full object-cover rounded-full transition-transform duration-500 group-hover:scale-110"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : svg ? (
          <div 
            className="w-full h-full scale-125 translate-y-3 rounded-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gradient-to-tr from-orange-600 via-amber-500 to-pink-600 flex items-center justify-center text-white font-black text-3xl md:text-4xl shadow-inner tracking-wider">
            {initials}
          </div>
        )}
        
        {!isAI && currentProp !== 'none' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none flex items-center justify-center">
             <span className="text-4xl md:text-6xl drop-shadow-2xl animate-bounce-slow mt-16 mr-16">
               {BAKERY_PROPS[currentProp]}
             </span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-full">
          <Camera size={22} className="text-white drop-shadow-lg mb-1 animate-bounce" />
          <span className="text-[9px] font-black uppercase text-white tracking-widest bg-orange-500/80 px-2 py-0.5 rounded-full border border-white/30">Edit Avatar</span>
        </div>
      </motion.div>
    </div>
  );
};

const PremiumBadge = ({ text, icon: Icon, color = 'bg-primary/10 text-primary border-primary/20' }: { text: string; icon: any; color?: string }) => (
  <motion.div 
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className={cn("px-3.5 sm:px-4 py-1.5 rounded-full flex items-center gap-2 border shadow-xs backdrop-blur-md", color)}
  >
    <Icon size={14} />
    <span className="text-[10px] font-black uppercase tracking-wider sm:tracking-widest">{text}</span>
  </motion.div>
);

const StatCard = ({ label, value, icon: Icon, color, delay, onClick }: { label: string; value: string | number; icon: any; color: string; delay: number; onClick?: () => void }) => (
  <motion.div
    initial={{ x: 50, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    transition={{ delay, type: 'spring', stiffness: 100 }}
    whileHover={{ y: -4, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="min-w-[140px] sm:min-w-[170px] bg-white border border-stone-200/80 rounded-3xl p-4 sm:p-5 group cursor-pointer relative overflow-hidden shadow-xs hover:shadow-md hover:border-primary/40 transition-all"
  >
    <div className={cn("absolute top-0 right-0 p-3 md:p-4 opacity-5 group-hover:opacity-10 transition-all scale-125 md:scale-150 rotate-12", color)}>
      <Icon className="w-10 h-10 md:w-12 md:h-12" />
    </div>
    <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-stone-100 flex items-center justify-center mb-3 transition-transform group-hover:rotate-12", color)}>
      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
    </div>
    <div>
      <h4 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight tabular-nums mb-1">{value}</h4>
      <div className="flex items-center justify-between gap-1">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-500 group-hover:text-primary transition-colors">{label}</p>
        {label === 'Wallet' && onClick && (
          <span className="text-[8px] bg-orange-50 text-primary border border-orange-200 px-1.5 py-0.5 rounded-full uppercase font-black tracking-wider leading-none">
            Lock
          </span>
        )}
      </div>
    </div>
    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-stone-200 to-transparent" />
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
          className="text-stone-100"
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
          className="text-primary drop-shadow-[0_2px_8px_rgba(231,106,84,0.3)]"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Crown size={32} className="text-amber-500 animate-bounce mb-1" />
        <span className="text-3xl font-black text-stone-900">{percentage}%</span>
        <span className="text-[9px] font-black uppercase text-stone-500 tracking-widest">To Platinum</span>
      </div>
    </div>
  );
};

const SmartActionCard = ({ label, icon: Icon, onClick, color = 'bg-white' }: { label: string; icon: any; onClick?: () => void; color?: string }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-stone-200/80 shadow-xs hover:shadow-md hover:border-primary/40 flex flex-col items-center justify-center gap-2.5 sm:gap-3 transition-all group overflow-hidden cursor-pointer",
      color
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-orange-50/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:text-primary group-hover:bg-orange-50 transition-all group-hover:scale-110">
      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
    </div>
    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] text-stone-700 group-hover:text-stone-900 transition-colors text-center whitespace-nowrap">{label}</span>
    <div className="absolute -bottom-4 -right-4 text-stone-900/[0.03] group-hover:text-primary/[0.06] transition-colors">
      <Icon className="w-16 h-16 md:w-20 md:h-20" />
    </div>
  </motion.button>
);

export const Profile: React.FC = () => {
  const { user: authUser, isGuest, openAuthModal, logout, refreshProfile } = useAuth();
  const { items: menuItems } = useMenu();
  const { reorderItems, addToCart } = useCart();
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

  // Extract most frequently ordered favorite items for One-Tap Re-Order
  const favoriteItems = useMemo(() => {
    const map = new Map<string, { item: any; count: number }>();
    recentOrders.forEach(order => {
      (order.items || []).forEach(it => {
        const id = it.id || it.food_id || it.name;
        if (!id) return;
        const existing = map.get(id);
        if (existing) {
          existing.count += (it.quantity || 1);
        } else {
          map.set(id, { item: it, count: it.quantity || 1 });
        }
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(x => x.item);
  }, [recentOrders]);

  const handleReorderOrder = (e: React.MouseEvent, order: Order) => {
    e.preventDefault();
    e.stopPropagation();
    if (!order.items || order.items.length === 0) return;
    reorderItems(order.items, { openCart: true });
    toast.success(`Added ${order.items.length} items to your cart!`, {
      icon: '🛍️',
      style: {
        borderRadius: '16px',
        background: '#18181b',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)'
      }
    });
  };

  const handleReorderSingleItem = (e: React.MouseEvent, item: any) => {
    e.preventDefault();
    e.stopPropagation();
    const foodItem: FoodItem = {
      id: item.id || item.food_id,
      name: item.name,
      price: Number(item.price) || 0,
      image: item.image || item.imageUrl || '',
      description: item.description || '',
      category: item.category || 'Bakery',
      rating: item.rating || 5,
      stock_quantity: item.stock_quantity || 100,
      available: true
    };
    addToCart(foodItem);
    toast.success(`${item.name} added to cart!`, {
      icon: '🧁',
      style: {
        borderRadius: '16px',
        background: '#18181b',
        color: '#fff',
      }
    });
  };

  const handleReorderAllFavorites = () => {
    if (!favoriteItems.length) return;
    reorderItems(favoriteItems, { openCart: true });
    toast.success(`Added ${favoriteItems.length} favorite items to your cart!`, {
      icon: '⭐',
      style: {
        borderRadius: '16px',
        background: '#18181b',
        color: '#fff',
      }
    });
  };

  const [badgeConfigs, setBadgeConfigs] = useState<BadgeConfig[]>([]);
  const [gifts, setGifts] = useState<any[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isFundsLockOpen, setIsFundsLockOpen] = useState(false);
  const [isAddFundsLockOpen, setIsAddFundsLockOpen] = useState(false);
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

  const guestState = GuestSessionManager.get();
  const isCheckoutRegisteredGuest = isGuest && guestState?.guestProfile?.isRegisteredAtCheckout;

  useEffect(() => {
    if (isCheckoutRegisteredGuest && guestState?.guestProfile) {
      const gp = guestState.guestProfile;
      setUserData({
        full_name: gp.name,
        phone: gp.phone || '',
        address: gp.address || '',
        email: gp.email,
        badge_tier: gp.badge_tier || 'Valued Customer'
      });
      setFormData({
        name: gp.name,
        phone: gp.phone || '',
        address: gp.address || ''
      });
      setLoading(false);
    }
  }, [isCheckoutRegisteredGuest, guestState]);

  useEffect(() => {
    if (!authUser) return;

    // Load initial data from cache
    const profileCacheKey = `profile_cache_${authUser.uid}`;
    const ordersCacheKey = `recent_orders_cache_${authUser.uid}`;
    const wishlistCacheKey = `wishlist_cache_${authUser.uid}`;

    let cachedProfile = null;
    let cachedOrders = null;
    let cachedWishlist = null;

    try {
      cachedProfile = localStorage.getItem(profileCacheKey);
      cachedOrders = localStorage.getItem(ordersCacheKey);
      cachedWishlist = localStorage.getItem(wishlistCacheKey);
    } catch (e) {}

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
        if (authUser) {
          setUserData(authUser);
          setFormData({
            name: (authUser as any)?.full_name || authUser.displayName || (authUser as any)?.name || '',
            phone: (authUser as any)?.phone || (authUser as any)?.phoneNumber || '',
            address: (authUser as any)?.address || ''
          });
          if ((authUser as any)?.settings) setSettingsData((authUser as any).settings);
        }

        // Recent orders
        if (authUser) {
          const stableId = authUser.id || authUser.uid;
          const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', stableId)
            .order('created_at', { ascending: false })
            .limit(5);

          if (!ordersError && ordersData) {
            setRecentOrders(ordersData as any[]);
          }
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
    let userSubscription: any = null;
    let ordersSubscription: any = null;

    if (authUser) {
      const stableUid = authUser.id || authUser.uid;

      userSubscription = supabase
        .channel(`profile-user-${stableUid}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${stableUid}`
        }, (payload) => {
          if (payload.new) {
            const data = payload.new as any;
            if (userData && data.badge_tier && data.badge_tier !== userData.badge_tier) {
              setNewTierName(data.badge_tier);
              setPrevTier(userData.badge_tier);
              setShowUnlockModal(true);
            }

            setUserData(data);
            setFormData({
              name: data.full_name || data.name || '',
              phone: data.phone || '',
              address: data.address || ''
            });
            if (data.settings) setSettingsData(data.settings);
          }
        })
        .subscribe();

      ordersSubscription = supabase
        .channel(`profile-orders-${stableUid}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${stableUid}`
        }, async () => {
          const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', stableUid)
            .order('created_at', { ascending: false })
            .limit(5);
          if (ordersData) {
            setRecentOrders(ordersData as any[]);
          }
        })
        .subscribe();
    }

    return () => {
      if (userSubscription) supabase.removeChannel(userSubscription);
      if (ordersSubscription) supabase.removeChannel(ordersSubscription);
    };
  }, [authUser?.uid || authUser?.id, menuItems?.length]);

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
    { 
      label: 'Wallet', 
      value: userData?.locked_wallet_balance > 0 
        ? `₹${userData?.wallet_balance || 0} (${userData?.locked_wallet_balance}🔒)` 
        : `₹${userData?.wallet_balance || 0}`, 
      icon: Wallet, 
      color: 'text-emerald-400',
      onClick: () => setIsFundsLockOpen(true)
    },
    { label: 'Experience', value: `Lv.${Math.floor((userData?.points || 0) / 100) + 1}`, icon: Zap, color: 'text-yellow-400' },
  ], [wishlist, userData]);

  const handleAddFunds = async () => {
    setIsAddFundsLockOpen(true);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      // User cancelled logout
      console.log('Logout action cancelled by user');
    }
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
      const stableId = authUser.id || authUser.uid;
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          full_name: formData.name,
          phone: formData.phone,
          address: formData.address,
          updated_at: new Date().toISOString()
        })
        .eq('id', stableId);
      
      if (error) throw error;
      setIsEditing(false);
      refreshProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile information.');
    }
  };

  const handleUpdateSettings = async (newSettings: any) => {
    if (!authUser) return;
    try {
      const stableId = authUser.id || authUser.uid;
      const { error } = await supabase
        .from('users')
        .update({ 
          settings: newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', stableId);
      
      if (error) throw error;
      setSettingsData(newSettings);
      refreshProfile();
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update preferences.');
    }
  };

  const handleExportData = () => {
    const data = {
      profile: userData || authUser,
      orders: recentOrders,
      settings: settingsData,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `frosty-bite-data-${authUser?.id ? authUser.id.slice(0, 8) : 'guest'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClaimGift = async (giftId: string) => {
    if (!authUser) return;
    const loadingToast = toast.loading('Claiming reward...');
    try {
      const stableId = authUser.id || authUser.uid;
      const success = await rewardsService.claimGift(stableId, giftId);
      if (success) {
        toast.success('Reward claimed! Check your email for details.', { id: loadingToast });
        refreshProfile();
      }
    } catch (error) {
      toast.error('Failed to claim reward', { id: loadingToast });
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const stableId = authUser.id || authUser.uid;
      const { error } = await supabase
        .from('users')
        .update({ 
          deleted: true,
          deleted_at: new Date().toISOString(),
          status: 'deactivated',
          updated_at: new Date().toISOString()
        })
        .eq('id', stableId);
      
      if (error) throw error;
      setShowDeleteConfirm(false);
      toast.success("Account deactivated. Data deletion in progress.");
      await logout(true);
    } catch (error: any) {
      console.error("Account deletion failed:", error);
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

  if (isGuest && !isCheckoutRegisteredGuest) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 pb-32">
        <div className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-center overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-orange-500/20 to-transparent blur-3xl rounded-full pointer-events-none" />

          <div className="relative mx-auto w-24 h-24 bg-gradient-to-tr from-orange-600 via-amber-500 to-pink-600 rounded-full flex items-center justify-center text-white font-black text-3xl shadow-xl mb-5 border-4 border-white/10">
            G
            <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border border-black">
              Guest
            </div>
          </div>

          <h2 className="text-3xl font-black tracking-tight mb-2">Guest User</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Create an account to save your activity, orders, preferences and more.
          </p>

          <div className="space-y-3.5">
            <button
              onClick={() => navigate('/login', { state: { defaultMode: 'signup' } })}
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              Create Account
            </button>

            <button
              onClick={() => navigate('/login', { state: { defaultMode: 'signin' } })}
              className="w-full h-13 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold text-sm tracking-wide border border-white/10 hover:border-white/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              Sign In
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-3 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer pt-2"
            >
              Continue Browsing
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen fullScreen={true} message="Establishing secure session..." />;
  }

  const handleSaveAvatar = async (avatarConfig: any) => {
    if (!authUser) return;
    const loadingToast = toast.loading('Applying your new identity...');
    try {
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
        updated_at: new Date().toISOString(),
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

      const stableId = authUser.id || authUser.uid;
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', stableId);

      if (error) throw error;

      setIsAvatarEditorOpen(false);
      toast.success('Avatar style applied!', { id: loadingToast });
      refreshProfile();
    } catch (error: any) {
      console.error('Error saving avatar:', error);
      toast.error('Failed to save avatar', { id: loadingToast });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 overflow-x-hidden pb-32" ref={containerRef}>
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

      {/* Warm Artisan Bakery Hero Header */}
      <section className="relative min-h-[45vh] md:min-h-[55vh] flex items-center justify-center overflow-hidden py-16 md:py-24 bg-gradient-to-b from-orange-50/70 via-[#FAF8F5] to-[#FAF8F5]">
        {/* Dynamic Mesh Background */}
        <div className={cn(
          "absolute inset-0 transition-colors duration-1000 bg-gradient-to-tr opacity-50",
          timeBackground
        )} />
        
        {/* Animated Particles & Glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 md:w-96 md:h-96 bg-[#E76A54]/10 rounded-full blur-[80px] md:blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 md:w-96 md:h-96 bg-amber-400/10 rounded-full blur-[80px] md:blur-[120px] animate-pulse-slow" />
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
            className="mt-6 md:mt-8 space-y-3 md:space-y-4 w-full max-w-4xl"
          >
            <div className="flex flex-wrap items-center justify-center gap-2.5 md:gap-3 mb-2">
              <PremiumBadge text={userData?.badge_tier || 'Foodie Starter'} icon={Crown} color="bg-orange-50 text-[#E76A54] border-orange-200" />
              <PremiumBadge text="Verified Foodie" icon={ShieldCheck} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
            </div>
            
            <h1 id="profile-greeting" className="text-3xl sm:text-5xl md:text-6xl font-black text-stone-900 tracking-tight leading-[1.1] md:leading-none px-2">
              {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E76A54] via-orange-600 to-amber-600 block sm:inline-block mt-1 sm:mt-0">{user.name.split(' ')[0]}</span>
            </h1>
            <p className="text-stone-500 font-bold uppercase tracking-[0.15em] md:tracking-[0.25em] text-[10px] md:text-xs">
              {userData?.title || 'Midnight Food Explorer'} • Level {Math.floor((userData?.points || 0) / 100) + 1}
            </p>
          </motion.div>
        </div>

        {/* Bottom Fade to canvas */}
        <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-[#FAF8F5] to-transparent pointer-events-none" />
      </section>

      {/* Floating Stats Rail */}
      <div className="relative -mt-6 md:-mt-12 z-20 px-0 overflow-x-auto scrollbar-hide pb-6 md:pb-8">
        <div className="flex gap-3 sm:gap-4 px-4 sm:px-6 md:justify-center min-w-max">
          {stats.map((stat, idx) => (
            <StatCard key={stat.label} {...stat} delay={0.4 + (idx * 0.1)} />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-10 md:space-y-12">
        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Column: Loyalty & AI */}
          <div className="lg:col-span-4 space-y-6 md:space-y-8">
            {/* Loyalty Engine */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-stone-200/80 shadow-xs p-6 md:p-8 relative overflow-hidden"
            >
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6 md:mb-8">
                  <h3 className="text-lg md:text-xl font-black text-stone-900 tracking-tight italic">LOYALTY ENGINE</h3>
                  <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-full border border-orange-200">
                    <TrendingUp size={12} className="text-primary" />
                    <span className="text-[9px] md:text-[10px] font-black text-primary uppercase">Tier: {userData?.badge_tier || 'Starter'}</span>
                  </div>
                </div>

                <LoyaltyProgressRing percentage={loyaltyStats.progress} />

                <div className="w-full mt-8 p-5 sm:p-6 bg-stone-50 rounded-3xl border border-stone-200/80 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Next Milestone</span>
                    <span className="text-[10px] font-black text-stone-900 uppercase tracking-widest">{loyaltyStats.nextTier} Status</span>
                  </div>
                  <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${loyaltyStats.progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-stone-600 font-bold leading-relaxed px-1">
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
                color="bg-white border-stone-200/80"
              />
            )}
          </div>

          {/* Right Column: Dynamic Content Tabs */}
          <div className="lg:col-span-8 space-y-6 md:space-y-8">
            <div className="flex p-1.5 md:p-2 bg-white/95 border border-stone-200/90 rounded-full sticky top-4 z-40 backdrop-blur-xl mx-2 sm:mx-4 lg:mx-0 shadow-sm">
              {(['personal', 'orders', 'wishlist', 'rewards'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-3 md:py-3.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] transition-all relative overflow-hidden cursor-pointer",
                    activeTab === tab ? "text-white" : "text-stone-500 hover:text-stone-900"
                  )}
                >
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="tab-bg"
                      className="absolute inset-0 bg-[#E76A54] rounded-full shadow-sm"
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
            className="space-y-6 md:space-y-8"
          >
            <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-stone-200/80 shadow-xs p-6 md:p-10 space-y-8 md:space-y-10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">Personal Identity</h3>
                  <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Private Information</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  onClick={() => setIsEditing(true)}
                  className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:bg-stone-200 transition-colors shrink-0 cursor-pointer"
                >
                  <Edit2 className="w-5 h-5 md:w-6 md:h-6" />
                </motion.button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-6">
                  <div className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:text-primary group-hover:bg-orange-50 transition-colors">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Full Name</p>
                      <p className="text-lg font-bold text-stone-900">{user.name}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:text-primary group-hover:bg-orange-50 transition-colors">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Email Protocol</p>
                      <p className="text-lg font-bold text-stone-900 break-all">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:text-primary group-hover:bg-orange-50 transition-colors">
                      <Phone size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Secure Line</p>
                      <p className="text-lg font-bold text-stone-900">{user.phone}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start group">
                    <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:text-primary group-hover:bg-orange-50 transition-colors">
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Primary Base</p>
                      <p className="text-sm font-bold text-stone-900 leading-relaxed line-clamp-2">{user.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4">
              <SmartActionCard label="Add Funds" icon={CreditCard} onClick={handleAddFunds} color="bg-white hover:border-primary/40" />
              <SmartActionCard label="Lock Funds" icon={Shield} onClick={() => setIsFundsLockOpen(true)} color="bg-white hover:border-orange-300" />
              <SmartActionCard label="Help & FAQ" icon={HelpCircle} onClick={() => navigate('/faq')} color="bg-white hover:border-amber-300" />
              <SmartActionCard label="Order Support" icon={MessageCircle} onClick={() => window.open(`https://wa.me/${RESTAURANT_WHATSAPP}`, '_blank')} color="bg-white hover:border-emerald-300" />
              <SmartActionCard label="Share Story" icon={Instagram} onClick={() => setIsShareModalOpen(true)} color="bg-white hover:border-pink-300" />
              <SmartActionCard label="Share Profile" icon={Share2} onClick={handleShare} color="bg-white hover:border-blue-300" />
              <SmartActionCard label="Logout" icon={LogOut} onClick={handleLogout} color="bg-white hover:border-red-300" />
            </div>

            {/* Account Session Security & Slide to Logout */}
            <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-stone-200/80 shadow-xs p-6 md:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
                    <ShieldCheck className="text-orange-500 w-5 h-5" />
                    Session & Security
                  </h4>
                  <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">
                    Authorized Device Authentication
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-black text-emerald-700 uppercase tracking-wider w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Session
                </span>
              </div>

              <SlideToLogout
                onLogout={async () => {
                  await logout(true);
                }}
                autoRedirect={true}
                redirectPath="/login"
              />
            </div>
          </motion.div>
        ) : activeTab === 'orders' ? (
          <motion.div 
            key="orders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 md:space-y-8"
          >
            {/* Re-order Favorites Quick Action Section */}
            {favoriteItems.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-stone-50 rounded-3xl md:rounded-[2.5rem] border border-amber-200/80 p-5 sm:p-7 shadow-xs relative overflow-hidden"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 text-amber-700 text-xs font-black uppercase tracking-widest mb-1">
                      <Sparkles size={16} className="text-amber-500 animate-spin-slow" />
                      <span>One-Tap Re-Order</span>
                    </div>
                    <h3 className="text-2xl font-black text-stone-900 tracking-tight">Re-Order Your Favorites</h3>
                    <p className="text-stone-600 text-xs mt-1">Pre-populate your cart in a single click with the bakery delights you love most.</p>
                  </div>
                  <Button
                    onClick={handleReorderAllFavorites}
                    variant="primary"
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#E76A54] to-orange-600 hover:from-[#d55944] hover:to-orange-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 cursor-pointer"
                  >
                    <RotateCcw size={15} />
                    <span>Re-Order All Favorites ({favoriteItems.length})</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
                  {favoriteItems.map((fav, i) => (
                    <motion.div
                      key={fav.id || fav.name || i}
                      whileHover={{ y: -3 }}
                      className="bg-white border border-stone-200/80 rounded-2xl p-3 flex flex-col justify-between group hover:border-[#E76A54]/50 shadow-xs hover:shadow-md transition-all"
                    >
                      <div className="space-y-2">
                        {fav.image && (
                          <div className="w-full h-20 rounded-xl overflow-hidden bg-stone-100">
                            <img 
                              src={fav.image} 
                              alt={fav.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-black text-stone-900 line-clamp-1 group-hover:text-primary transition-colors">{fav.name}</p>
                          <p className="text-[10px] font-black text-primary mt-0.5">₹{fav.price}</p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleReorderSingleItem(e, fav)}
                        className="mt-3 w-full py-1.5 px-2 bg-stone-100 hover:bg-[#E76A54] hover:text-white text-stone-800 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Add</span>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {recentOrders.length === 0 ? (
              <div className="bg-white rounded-3xl md:rounded-[3rem] border border-stone-200/80 p-12 sm:p-20 text-center space-y-6 shadow-xs">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-primary">
                  <ShoppingBag size={42} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight uppercase italic">No Orders Yet</h3>
                  <p className="text-stone-500 text-sm max-w-xs mx-auto font-bold">Your order history is empty. Treat yourself to fresh bakery delights!</p>
                </div>
                <Button 
                  onClick={() => navigate('/')}
                  variant="primary"
                  className="px-8 sm:px-12 py-4 sm:py-5 rounded-2xl sm:rounded-3xl cursor-pointer"
                >
                  Explore Delicious Menu
                </Button>
              </div>
            ) : (
              recentOrders.map((order, idx) => (
                <motion.div
                  key={order.id}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white rounded-3xl md:rounded-[2.5rem] border border-stone-200/80 shadow-xs hover:shadow-md p-5 sm:p-7 md:p-8 hover:border-primary/40 transition-all group overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-all scale-150 rotate-12 pointer-events-none text-stone-900">
                    <ShoppingBag size={120} />
                  </div>

                  <div className="flex flex-col gap-5 sm:gap-6 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                      <div className="flex items-center gap-4 sm:gap-5">
                        <div className={cn(
                          "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0",
                          getStatusColor(order.status)
                        )}>
                          <Clock size={26} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                            <h4 className="text-lg sm:text-xl md:text-2xl font-black text-stone-900 tracking-tight">ORDER #{formatOrderId(order.id)}</h4>
                            <span className={cn(
                              "px-2.5 sm:px-3 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider border shadow-2xs",
                              getStatusColor(order.status)
                            )}>
                              {order.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 sm:gap-4 text-[10px] text-stone-500 font-bold uppercase tracking-wider mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(order.created_at)}</span>
                            <span className="w-1 h-1 bg-stone-300 rounded-full" />
                            <span>{order.items.length} ITEM{order.items.length > 1 ? 'S' : ''}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-stone-100 pt-3 md:pt-0">
                        <div className="text-left md:text-right">
                          <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-0.5">Total Paid</p>
                          <p className="text-2xl md:text-3xl font-black text-stone-900 tabular-nums">₹{order.total}</p>
                        </div>
                      </div>
                    </div>

                    {/* Order items preview */}
                    {order.items && order.items.length > 0 && (
                      <div className="bg-stone-50 rounded-2xl p-3.5 sm:p-4 border border-stone-200/80">
                        <div className="text-[10px] font-black text-stone-500 uppercase tracking-wider mb-2">Order Summary</div>
                        <div className="flex flex-wrap gap-2">
                          {order.items.map((it: any, i: number) => (
                            <div key={i} className="bg-white px-3 py-1.5 rounded-xl border border-stone-200/80 flex items-center gap-2 text-xs font-bold text-stone-800 shadow-2xs">
                              <span className="text-primary font-black">{it.quantity}x</span>
                              <span className="text-stone-900">{it.name}</span>
                              <span className="text-stone-500 text-[10px]">₹{it.price * (it.quantity || 1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons: Re-Order Favorites / Repeat Order + Track */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                      <button
                        onClick={(e) => handleReorderOrder(e, order)}
                        className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-[#E76A54] to-orange-600 hover:from-[#d55944] hover:to-orange-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-orange-500/20 transition-transform active:scale-98 cursor-pointer"
                      >
                        <RotateCcw size={15} />
                        <span>Re-Order Favorites ({order.items.length} items)</span>
                      </button>

                      <Link
                        to={`/order-tracking/${order.id}`}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-xs uppercase tracking-wider border border-stone-200 transition-colors cursor-pointer"
                      >
                        <span>Track Status</span>
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </div>
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
            className="space-y-6 md:space-y-8"
          >
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">Saved Delicacies</h3>
                  <p className="text-stone-500 text-xs font-black uppercase tracking-[0.2em] mt-1">Your Bakery Wishlist</p>
                </div>
                <div className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-pink-50 rounded-full border border-pink-200 flex items-center gap-2">
                  <Heart size={14} className="text-pink-500 fill-pink-500" />
                  <span className="text-[10px] font-black text-pink-700 uppercase tracking-wider">{wishlist.length} Items</span>
                </div>
              </div>

            {wishlist.length === 0 ? (
              <div className="bg-white rounded-3xl md:rounded-[3rem] border border-stone-200/80 p-12 sm:p-20 text-center space-y-6 shadow-xs">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-pink-50 rounded-full flex items-center justify-center mx-auto text-pink-400">
                  <Heart size={42} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight uppercase italic">Wishlist is Empty</h3>
                  <p className="text-stone-500 text-sm max-w-xs mx-auto font-bold">You haven't saved any bakery items to your wishlist yet.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
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
            className="space-y-6 md:space-y-8"
          >
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight italic uppercase">REWARDS STORE</h3>
                  <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Exclusive Tier-Based Perks</p>
                </div>
                <div className="px-4 sm:px-5 py-2 sm:py-2.5 bg-orange-50 rounded-full border border-orange-200 flex items-center gap-2.5 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <Award size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-stone-500 uppercase tracking-widest leading-none mb-1">Your Balance</p>
                    <p className="text-base sm:text-lg font-black text-stone-900 leading-none tabular-nums">{userData?.points || 0} PTS</p>
                  </div>
                </div>
              </div>

            {gifts.length === 0 ? (
              <div className="bg-white rounded-3xl md:rounded-[3rem] border border-stone-200/80 p-12 sm:p-20 text-center space-y-6 shadow-xs">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-orange-50 rounded-full flex items-center justify-center mx-auto text-primary">
                  <Gift size={42} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight uppercase italic">NO REWARDS AVAILABLE</h3>
                  <p className="text-stone-500 text-sm max-w-xs mx-auto font-bold">Check back later for exclusive member benefits.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
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
                        "bg-white rounded-3xl border border-stone-200/80 shadow-xs p-5 sm:p-6 md:p-7 flex items-center gap-4 sm:gap-6 group transition-all relative overflow-hidden",
                        isLocked && "opacity-50 grayscale pointer-events-none"
                      )}
                    >
                      <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-stone-200 relative bg-stone-100">
                        <OptimizedImage src={gift.image} alt={gift.title} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        {isLocked && (
                          <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center backdrop-blur-[2px]">
                            <Shield size={28} className="text-white/80" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2.5 sm:space-y-3 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border",
                              isLocked ? "bg-stone-100 text-stone-500 border-stone-200" : "bg-orange-50 text-primary border-orange-200"
                            )}>
                              {gift.requiredTier} Only
                            </span>
                            {isClaimed && (
                               <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                 <CheckCircle size={10} /> Claimed
                               </span>
                            )}
                          </div>
                          <h4 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight uppercase italic truncate">{gift.title}</h4>
                          <p className="text-[10px] text-stone-500 font-bold line-clamp-2 mt-1">{gift.description}</p>
                        </div>
                        
                        <div className="flex items-center justify-between gap-3 pt-1">
                           <div className="flex flex-col">
                             <span className="text-[8px] font-black text-stone-500 uppercase tracking-wider">Investment</span>
                             <span className="text-base sm:text-lg font-black text-stone-900 tabular-nums tracking-tight">{gift.costPoints || 0} PTS</span>
                           </div>
                           <Button 
                             onClick={() => handleClaimGift(gift.id)}
                             disabled={isLocked || !canAfford || gift.stock <= 0}
                             variant={isLocked ? "outline" : canAfford ? "primary" : "ghost"}
                             className="rounded-xl px-4 sm:px-5 h-10 sm:h-11 text-xs cursor-pointer"
                           >
                             {isLocked ? 'Locked' : gift.stock <= 0 ? 'Out of Stock' : canAfford ? 'Claim Reward' : 'Points Needed'}
                           </Button>
                        </div>
                      </div>

                      {isLocked && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <div className="bg-stone-900/80 border border-white/20 px-4 py-1.5 rounded-full transform -rotate-6">
                              <span className="text-[9px] font-black text-white uppercase tracking-wider">Locked: Upgrade to {gift.requiredTier}</span>
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
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white border border-stone-200/90 rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between p-6 sm:p-8 md:p-10 pb-0 shrink-0">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">Edit Identity</h3>
                    <p className="text-xs text-stone-500 font-black uppercase tracking-[0.2em] mt-1">Profile Synchronization</p>
                  </div>
                  <button 
                    onClick={() => setIsEditing(false)} 
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                  >
                    <X size={22} />
                  </button>
                </div>

                <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10 space-y-6 sm:space-y-8 scrollbar-hide pb-28 md:pb-6">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] ml-2">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="Enter your name"
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-primary focus:bg-white transition-all font-bold" 
                      />
                    </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] ml-2">Direct Contact</label>
                  <input 
                    type="text" 
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="e.g. +91 77358 00239"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-primary focus:bg-white transition-all font-bold" 
                  />
                </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] ml-2">Primary HQ (Address)</label>
                  <textarea 
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Street, Building, Landmark..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-6 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-primary focus:bg-white transition-all font-bold h-32 resize-none" 
                  />
                </div>

                  </div>
 
                  <div className="sticky bottom-0 left-0 right-0 p-6 sm:p-8 pt-4 bg-white/95 backdrop-blur-xl border-t border-stone-100 flex gap-3 sm:gap-4 shrink-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                    <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-4 rounded-2xl bg-stone-100 text-stone-700 font-black uppercase text-xs tracking-wider hover:bg-stone-200 transition-all active:scale-98 cursor-pointer">
                      Dismiss
                    </button>
                    <button type="submit" className="flex-2 py-4 rounded-2xl bg-gradient-to-r from-[#E76A54] to-orange-600 text-white font-black uppercase text-xs tracking-wider shadow-md shadow-orange-500/25 hover:from-[#d55944] hover:to-orange-700 active:scale-98 transition-all cursor-pointer">
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
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white border border-stone-200/90 rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between p-6 sm:p-8 md:p-10 pb-0 shrink-0 mb-4 sm:mb-6">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">Account Center</h3>
                    <p className="text-xs text-stone-500 font-black uppercase tracking-[0.2em] mt-1">Manage Control Panel</p>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)} 
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                  >
                    <X size={22} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10 space-y-8 sm:space-y-10 scrollbar-hide pb-28 md:pb-6">
                {/* Notifications Section */}
                <div className="space-y-4 sm:space-y-6">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Notification Preferences</h4>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200/80">
                      <div>
                        <p className="text-sm font-bold text-stone-900">Order Status Updates</p>
                        <p className="text-[10px] text-stone-500">Real-time alerts for your orders</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSettings({
                          ...settingsData,
                          notifications: { ...settingsData.notifications, orderUpdates: !settingsData.notifications.orderUpdates }
                        })}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                          settingsData.notifications.orderUpdates ? "bg-[#E76A54]" : "bg-stone-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-2xs",
                          settingsData.notifications.orderUpdates ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200/80">
                      <div>
                        <p className="text-sm font-bold text-stone-900">Promotional Offers</p>
                        <p className="text-[10px] text-stone-500">New discounts and seasonal treats</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateSettings({
                          ...settingsData,
                          notifications: { ...settingsData.notifications, promotions: !settingsData.notifications.promotions }
                        })}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative cursor-pointer",
                          settingsData.notifications.promotions ? "bg-[#E76A54]" : "bg-stone-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-2xs",
                          settingsData.notifications.promotions ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Data Section */}
                <div className="space-y-4 sm:space-y-6">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Data & Portability</h4>
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <button 
                      onClick={handleExportData}
                      className="w-full flex items-center justify-between p-4 sm:p-5 bg-stone-50 rounded-2xl border border-stone-200/80 hover:bg-stone-100 transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-200">
                          <ShoppingBag size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-stone-900">Export Order History</p>
                          <p className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Download as JSON</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-stone-400 group-hover:text-stone-900 group-hover:translate-x-1 transition-all" />
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="space-y-4 sm:space-y-6 pt-2">
                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em]">Danger Zone</h4>
                  <button 
                     onClick={() => setShowDeleteConfirm(true)}
                    className="w-full h-14 sm:h-16 border border-red-200 bg-red-50/60 rounded-2xl flex items-center justify-between px-5 sm:px-6 text-red-600 hover:bg-red-500 hover:text-white transition-all font-black uppercase text-xs tracking-wider cursor-pointer"
                  >
                    <span>Permanently Delete Account</span>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 left-0 right-0 p-6 sm:p-8 pt-4 bg-white/95 backdrop-blur-xl border-t border-stone-100 flex gap-4 shrink-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                  <button 
                    onClick={() => setIsSettingsOpen(false)} 
                    className="w-full py-4 rounded-2xl bg-stone-100 text-stone-800 font-black uppercase text-xs tracking-wider hover:bg-stone-200 transition-all active:scale-98 cursor-pointer"
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

      <SecureFundsLockModal
        isOpen={isFundsLockOpen}
        onClose={() => setIsFundsLockOpen(false)}
        firebaseUid={authUser?.id || authUser?.uid || ''}
        userData={userData}
        onSuccess={refreshProfile}
      />

      <AddFundsLockedModal
        isOpen={isAddFundsLockOpen}
        onClose={() => setIsAddFundsLockOpen(false)}
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
              className="absolute inset-0 bg-stone-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white border border-stone-200/90 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 overflow-hidden"
            >
              <div className="relative z-10 space-y-6 sm:space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">Share to Story</h3>
                    <p className="text-xs text-stone-500 font-black uppercase tracking-[0.2em] mt-1">Select Card Style</p>
                  </div>
                  <button 
                    onClick={() => setIsShareModalOpen(false)} 
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                  >
                    <X size={22} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {(['avatar', 'rank', 'personality'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setShareType(type)}
                      className={cn(
                        "p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer",
                        shareType === type ? "bg-orange-50/80 border-[#E76A54]" : "bg-stone-50 border-stone-200/80 hover:bg-stone-100"
                      )}
                    >
                      <div className="flex items-center gap-3.5 sm:gap-4">
                        <div className={cn(
                          "w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                          shareType === type ? "bg-[#E76A54] text-white" : "bg-white text-stone-600 border border-stone-200"
                        )}>
                          {type === 'avatar' && <User size={20} />}
                          {type === 'rank' && <Crown size={20} />}
                          {type === 'personality' && <Sparkles size={20} />}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold uppercase tracking-wider text-stone-900">
                            {type === 'avatar' ? 'Foodie Identity' : type === 'rank' ? 'Loyalty Progress' : 'AI Food Personality'}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                            9:16 Instagram Ready
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className={cn(shareType === type ? "text-primary" : "text-stone-400")} />
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handleShareStory}
                  disabled={isSharing}
                  variant="primary"
                  className="w-full py-4 sm:py-5 rounded-2xl text-xs sm:text-sm font-black tracking-wider uppercase shadow-md shadow-orange-500/20 cursor-pointer"
                >
                  {isSharing ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      GENERATING...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2.5">
                      <Instagram size={18} />
                      GENERATE & SHARE
                    </div>
                  )}
                </Button>
                
                <p className="text-[10px] text-center text-stone-500 font-bold uppercase tracking-widest leading-relaxed">
                  Generates a vertical card <br /> perfect for Instagram Stories.
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
