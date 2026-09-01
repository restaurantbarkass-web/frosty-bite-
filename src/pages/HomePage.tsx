import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useMetadata } from '../hooks/useMetadata';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Search, Sparkles, ChevronRight, AlertTriangle, X, Flame, Leaf, ChevronDown, SlidersHorizontal, ShoppingBag } from 'lucide-react';
import { CATEGORIES, MENU_ITEMS, RESTAURANT_WHATSAPP } from '../constants';
import { FoodCard } from '../components/FoodCard';
import { FoodCardSkeleton } from '../components/FoodCardSkeleton';
import { BannerCarousel } from '../components/BannerCarousel';
import { ButlerSelection } from '../components/ButlerSelection';
import { getFoodRecommendations } from '../services/geminiService';
import { supabase } from '../supabase';
import { FoodItem } from '../types';
import { useAppConfig } from '../hooks/useAppConfig';
import { useAuth } from '../context/AuthContext';
import { useMenu } from '../context/MenuContext';
import { useCartActions } from '../context/CartContext';
import { PremiumSearchBar } from '../components/Search/PremiumSearchBar';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { BannerService } from '../services/BannerService';
import { CacheManager } from '../core/cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../core/cache/CacheKeys';
import { ReviewsSection } from '../components/ReviewsSection';
import { VoiceAssistant } from '../components/VoiceAssistant';

// Variants for staggered animations
const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

// Helpers for dietary filters (pure module level)
const isVegetarianItem = (item: FoodItem) => {
  const nameLower = (item.name || '').toLowerCase();
  const descLower = (item.description || '').toLowerCase();
  const tagsLower = (item.tags || []).map(t => t.toLowerCase());

  if (tagsLower.includes('vegetarian') || tagsLower.includes('veg') || tagsLower.includes('vegan') || tagsLower.includes('eggless')) {
    return true;
  }
  if (tagsLower.includes('non-veg') || tagsLower.includes('chicken') || tagsLower.includes('meat') || tagsLower.includes('egg') || tagsLower.includes('fish') || tagsLower.includes('beef')) {
    return false;
  }
  const nonVegKeywords = ['chicken', 'meat', 'beef', 'pork', 'bacon', 'pepperoni', 'fish', 'non-veg', 'nonveg'];
  const hasNonVegKeyword = nonVegKeywords.some(keyword => nameLower.includes(keyword) || descLower.includes(keyword));
  return !hasNonVegKeyword;
};

const isSpicyItem = (item: FoodItem) => {
  const nameLower = (item.name || '').toLowerCase();
  const descLower = (item.description || '').toLowerCase();
  const tagsLower = (item.tags || []).map(t => t.toLowerCase());

  return (
    tagsLower.includes('spicy') ||
    tagsLower.includes('hot') ||
    tagsLower.includes('chili') ||
    tagsLower.includes('chilli') ||
    tagsLower.includes('jalapeno') ||
    nameLower.includes('spicy') ||
    nameLower.includes('chili') ||
    nameLower.includes('chilli') ||
    nameLower.includes('jalapeno') ||
    nameLower.includes('pepper') ||
    descLower.includes('spicy') ||
    descLower.includes('chili') ||
    descLower.includes('chilli') ||
    descLower.includes('pepper')
  );
};

// Home Page Component
export const Home: React.FC = () => {
  const location = useLocation();
  const { items: displayItems, categories: menuCategories, loading: isMenuLoading } = useMenu();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [dietaryFilter, setDietaryFilter] = useState<'All' | 'Vegetarian' | 'Spicy'>('All');
  const [sortBy, setSortBy] = useState<string>('popularity');
  const [searchQuery, setSearchQuery] = useState(new URLSearchParams(location.search).get('search') || '');
  
  const [banners, setBanners] = useState<any[]>([]);
  const { isOrderingOpen, isPickupOnly } = useAppConfig();
  const navigate = useNavigate();

  useMetadata({
    title: 'Delicious Desserts & Quick Bites',
    description: 'Order your favorite treats from Frosty Bite! Explore our delicious cheesecakes, ice creams, burgers, and more with lightning fast hot/cold delivery.',
    keywords: ['desserts', 'fast food', 'cheesecakes', 'burgers', 'shakes', 'Frosty Bite ordering', 'Cuttack sweets']
  });

  const recommendedItems = React.useMemo(() => {
    if (!displayItems || displayItems.length === 0) return [];
    const filtered = displayItems.filter(item => item.available !== false);
    const itemsToUse = filtered.length > 0 ? filtered : displayItems;
    return [...itemsToUse].sort(() => 0.5 - Math.random()).slice(0, 6);
  }, [displayItems]);

  const handlePremiumSearch = React.useCallback((q: string) => {
    setSearchQuery(q);
    setTimeout(() => {
      const element = document.getElementById('menu-section');
      element?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const handleFocusChange = React.useCallback((focused: boolean) => {
    if (focused) {
      window.dispatchEvent(new CustomEvent('open-search'));
    }
  }, []);

  useEffect(() => {
    // 1. Instant cached banner render with background revalidation
    BannerService.getBanners((freshBanners) => {
      if (freshBanners && freshBanners.length > 0) {
        setBanners(freshBanners);
      }
    }).then((initialBanners) => {
      if (initialBanners && initialBanners.length > 0) {
        setBanners(initialBanners);
      }
    });

    // 2. Subscribe to CacheManager banner changes
    const unsubscribe = CacheManager.subscribe(
      CacheKeys.BANNERS,
      CacheNamespace.STORE,
      (updatedBanners) => {
        if (Array.isArray(updatedBanners)) {
          setBanners(updatedBanners);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);
  
  // Dynamic categories based on menu items
  const [aiRecs, setAiRecs] = useState<string[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  const suggestions = React.useMemo(() => {
    if (!searchQuery || searchQuery.trim() === '') {
      return [];
    }

    const itemSuggestions = displayItems
      .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(item => item.name);

    const categorySuggestions = (menuCategories || [])
      .filter(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()));

    return Array.from(new Set([...itemSuggestions, ...categorySuggestions])).slice(0, 6);
  }, [searchQuery, displayItems, menuCategories]);

  useEffect(() => {
    const handleNavbarSearch = (e: any) => {
      const queryValue = e.detail;
      if (queryValue !== undefined) {
        setSearchQuery(prev => (prev !== queryValue ? queryValue : prev));
        const element = document.getElementById('menu-section');
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.addEventListener('navbar-search', handleNavbarSearch);
    return () => window.removeEventListener('navbar-search', handleNavbarSearch);
  }, []);

  useEffect(() => {
    const queryStr = new URLSearchParams(location.search).get('search');
    if (queryStr) {
      setSearchQuery(prev => (prev !== queryStr ? queryStr : prev));
      setTimeout(() => {
        const element = document.getElementById('menu-section');
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [location.search]);

  useEffect(() => {
    // Delay non-critical data fetching to prioritize main menu rendering
    const timer = setTimeout(() => {
        const fetchRecs = async () => {
          // Check cache first
          let cachedRecs = null;
          let cacheTimestamp = null;
          try {
            cachedRecs = localStorage.getItem('ai_recs');
            cacheTimestamp = localStorage.getItem('ai_recs_timestamp');
          } catch (e) {}
          const now = Date.now();
          
          if (cachedRecs && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 3600000) { // 1 hour cache
            try {
              setAiRecs(JSON.parse(cachedRecs));
              return;
            } catch (e) {}
          }

          setIsLoadingRecs(true);
          try {
            const recs = await getFoodRecommendations("I want something spicy and filling for dinner");
            if (recs && recs.length > 0) {
              setAiRecs(recs);
              localStorage.setItem('ai_recs', JSON.stringify(recs));
              localStorage.setItem('ai_recs_timestamp', now.toString());
            }
          } catch (e) {
            console.error(e);
          } finally {
            setIsLoadingRecs(false);
          }
        };
        fetchRecs();
    }, 2000); // 2 second delay

    return () => clearTimeout(timer);
  }, []);

  const [previousPurchases, setPreviousPurchases] = useState<FoodItem[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setPreviousPurchases([]);
      return;
    }

    const fetchPreviousPurchases = async () => {
      // Delay user-specific data to prioritize main content
      await new Promise(r => setTimeout(r, 1000));
      
      // If the database is misconfigured with UUID columns...
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (error) {
          // Silent fail for UUID format errors to prevent console spam for users
          if (error.code === '22P02') return;
          throw error;
        }
        
        if (orders && Array.isArray(orders)) {
          const purchasedItems = new Map<string, FoodItem>();
          
          orders.forEach(order => {
            if (order && order.items && Array.isArray(order.items)) {
              order.items.forEach((item: any) => {
                if (item && item.id && !purchasedItems.has(item.id)) {
                  purchasedItems.set(item.id, {
                    ...item,
                    id: item.id
                  });
                }
              });
            }
          });
          
          setPreviousPurchases(Array.from(purchasedItems.values()).slice(0, 8));
        }
      } catch (error) {
        console.error('Error fetching previous purchases from Supabase:', error);
      }
    };

    fetchPreviousPurchases();
    
    // Subscribe to new orders to update previous favorites
    const channel = supabase
      .channel(`user_orders_home_${user.uid}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders',
        filter: `user_id=eq.${user.uid}`
      }, () => {
        fetchPreviousPurchases();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.uid]);

  const filteredItems = React.useMemo(() => {
    let result = displayItems.filter(item => {
      const matchesCategory = selectedCategory === 'All' || (item.category && item.category === selectedCategory);
      const nameMatch = (item.name || '').toLowerCase();
      const searchMatch = (searchQuery || '').toLowerCase();
      const matchesSearch = nameMatch.includes(searchMatch);

      let matchesDiet = true;
      if (dietaryFilter === 'Vegetarian') {
        matchesDiet = isVegetarianItem(item);
      } else if (dietaryFilter === 'Spicy') {
        matchesDiet = isSpicyItem(item);
      }

      return matchesCategory && matchesSearch && matchesDiet;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'price-asc') {
        return a.price - b.price;
      } else if (sortBy === 'price-desc') {
        return b.price - a.price;
      } else if (sortBy === 'rating') {
        return b.rating - a.rating;
      } else if (sortBy === 'popularity') {
        const aRec = a.is_recommended ? 1 : 0;
        const bRec = b.is_recommended ? 1 : 0;
        if (aRec !== bRec) {
          return bRec - aRec;
        }
        return b.rating - a.rating;
      }
      return 0;
    });
  }, [displayItems, selectedCategory, searchQuery, dietaryFilter, sortBy]);

  const { setAppliedCoupon, setIsCartOpen } = useCartActions();

  const handleBannerCoupon = async (code: string) => {
    try {
      const { data: coupons, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('status', 'active')
        .single();

      if (error || !coupons) {
        toast.error('Could not apply this coupon');
        return;
      }

      // Check expiry
      const expiryDate = new Date(coupons.expiry_date);
      if (expiryDate < new Date()) {
        toast.error('This coupon has expired');
        return;
      }

      setAppliedCoupon({
        id: coupons.id,
        code: coupons.code,
        value: coupons.value,
        type: coupons.type,
        free_item_id: coupons.free_item_id,
        free_item_quantity: coupons.free_item_quantity,
        gift_url: coupons.gift_url
      });

      toast.success(`${coupons.code} Applied Automatically! 🎉`, {
        icon: '🎫',
        duration: 4000
      });

      // Open cart to show the discount
      setTimeout(() => setIsCartOpen(true), 1000);
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 },
        colors: ['#F97316', '#FFFFFF']
      });
    } catch (err) {
      console.error('Error auto-applying coupon:', err);
    }
  };

  return (
    <motion.div 
      className="min-h-screen pb-20"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero Section */}
      <section className="relative min-h-[600px] md:min-h-[750px] flex items-center justify-center py-20 overflow-hidden">
        <div className="absolute inset-0 w-full h-full overflow-hidden select-none pointer-events-none">
          <img 
            src="https://images.weserv.nl/?url=https%3A%2F%2Fimages.pexels.com%2Fphotos%2F33038486%2Fpexels-photo-33038486.jpeg%3Fauto%3Dcompress%26cs%3Dtinysrgb%26w%3D1600" 
            alt="Artisanal Bakery Background" 
            className="absolute inset-0 w-full h-full object-cover scale-105 opacity-100"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-black/15" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-background/20 to-background" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <motion.div
            variants={itemVariants}
            className="flex justify-center mb-12"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-white to-primary rounded-full blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-gradient-x" />
              <div className="relative w-56 h-56 bg-zinc-950 backdrop-blur-3xl rounded-full flex items-center justify-center border-2 border-white/10 shadow-[0_0_80px_rgba(249,115,22,0.25)] p-0 overflow-hidden outline outline-1 outline-white/5 outline-offset-8">
                <img 
                  src="/logo.svg" 
                  alt="Frosty Bite" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 p-4"
                />
              </div>
            </div>
          </motion.div>
            <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-7xl md:text-[10rem] font-serif italic text-white tracking-tighter leading-none mb-12"
          >
            Frosty <span className="font-sans font-black NOT-italic text-primary block md:inline">Bite</span>
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="text-muted text-lg md:text-xl mb-10 max-w-2xl mx-auto"
          >
            Artisan bakery and frosty treats. Freshly baked delights from our oven to your heart.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="max-w-xl mx-auto"
          >
            <PremiumSearchBar 
              onSearch={handlePremiumSearch}
              onFocusChange={handleFocusChange}
              initialQuery={searchQuery}
              suggestions={suggestions}
              aiRecommendations={aiRecs}
            />
          </motion.div>
        </div>
      </section>

      {/* Banner Carousel */}
      {banners.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 -mt-8 relative z-20">
          <BannerCarousel 
            banners={banners} 
            onNavigate={(url) => navigate(url)}
            onApplyCoupon={(code) => {
              handleBannerCoupon(code);
            }}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 md:-mt-12 relative z-20">
        {/* Butler Selection - NEW PREMIUM SECTION */}
        <ButlerSelection />

        {/* Orders Closed or Pickup Only Banner */}
        <AnimatePresence>
          {!isOrderingOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-6 backdrop-blur-xl"
            >
              <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle size={28} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter text-red-500 italic">Online Orders are Currently Closed</h3>
                <p className="text-sm font-bold text-red-500/80">🚫 We are not accepting new orders at the moment. Please check back later!</p>
              </div>
            </motion.div>
          ) : isPickupOnly ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-8 p-6 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 rounded-3xl flex items-center justify-between gap-6 backdrop-blur-xl shadow-lg shadow-amber-500/5"
            >
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 shrink-0">
                  <ShoppingBag size={28} className="animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black font-black text-[10px] uppercase tracking-wider">
                      🛍 Pickup Only
                    </span>
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">In-Store Bakery Collection Active</h3>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-amber-200/90 leading-relaxed">
                    Place your order online and collect it from our bakery at your preferred time. Home delivery is currently disabled.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Categories */}
        <div className="flex space-x-3 sm:space-x-4 overflow-x-auto pb-8 no-scrollbar -mx-4 px-4 touch-carousel overscroll-x-contain">
          {menuCategories.map((cat, idx) => {
            const isSelected = selectedCategory === cat;
            return (
              <motion.button
                key={`home-cat-${cat}-${idx}`}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "relative whitespace-nowrap px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-colors text-xs sm:text-sm z-10",
                  isSelected ? "text-white" : "glass-dark text-muted hover:text-white"
                )}
              >
                {isSelected && (
                  <motion.div
                    layoutId="category-active-bg"
                    className="absolute inset-0 bg-primary rounded-xl sm:rounded-2xl shadow-lg shadow-primary/25 -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
                <span>{cat === 'All' ? 'All Items' : cat}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Previous Favorites */}
        {previousPurchases.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="mb-16 content-visibility-section"
          >
            <div className="flex items-end justify-between mb-8">
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Previous Favorites</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">{previousPurchases.length} Items you've enjoyed before</p>
              </div>
              <Link to="/orders" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">View All Orders</Link>
            </div>
            
            <div className="flex space-x-6 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 touch-carousel overscroll-x-contain">
              {previousPurchases.map((item, idx) => (
                <div key={`prev-fav-${item.id || idx}-${idx}`} className="w-64 shrink-0">
                  <FoodCard item={item} variant="compact" />
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* You Might Also Like / Trending */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          className="mb-16 content-visibility-section"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
               <Sparkles size={24} />
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">You Might Also Like</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Our top picks for your sweet cravings</p>
            </div>
          </div>
          
          <div className="flex space-x-6 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 touch-carousel overscroll-x-contain">
            {recommendedItems.map((item, idx) => (
              <div key={`rec-item-${item.id || idx}-${idx}`} className="w-72 shrink-0">
                <FoodCard item={item} />
              </div>
            ))}
          </div>
        </motion.section>

        {/* Food Grid */}
        <div id="menu-section" className="mb-8 pt-8 border-t border-white/5 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                {selectedCategory === 'All' ? 'Our Baked Collection' : `${selectedCategory}`}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
                Showing {filteredItems.length} fresh {filteredItems.length === 1 ? 'treat' : 'treats'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Dietary Filters */}
              <div className="bg-white/5 border border-white/5 rounded-2xl p-1.5 flex items-center space-x-1">
                {[
                  { id: 'All', label: 'All', icon: null },
                  { id: 'Vegetarian', label: 'Vegetarian', icon: Leaf },
                  { id: 'Spicy', label: 'Spicy', icon: Flame },
                ].map((filter) => {
                  const isSelected = dietaryFilter === filter.id;
                  const Icon = filter.icon;
                  return (
                    <motion.button
                      key={filter.id}
                      type="button"
                      whileHover={{ scale: 1.05, y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      onClick={() => setDietaryFilter(filter.id as any)}
                      className={cn(
                        "relative px-3.5 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 z-10",
                        isSelected
                          ? "text-white"
                          : filter.id === 'Vegetarian'
                            ? "text-zinc-400 hover:text-green-400"
                            : filter.id === 'Spicy'
                              ? "text-zinc-400 hover:text-red-500"
                              : "text-zinc-400 hover:text-white"
                      )}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="dietary-active-bg"
                          className={cn(
                            "absolute inset-0 rounded-xl shadow-md -z-10",
                            filter.id === 'Vegetarian'
                              ? "bg-green-600 shadow-green-600/20"
                              : filter.id === 'Spicy'
                                ? "bg-red-600 shadow-red-600/20"
                                : "bg-primary shadow-primary/20"
                          )}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        />
                      )}
                      {Icon && <Icon size={12} className={isSelected && filter.id === 'Vegetarian' ? 'animate-pulse' : isSelected && filter.id === 'Spicy' ? 'animate-bounce' : ''} />}
                      <span>{filter.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Sort Dropdown */}
              <div className="relative flex items-center">
                <div className="absolute left-4.5 text-zinc-500 pointer-events-none">
                  <SlidersHorizontal size={14} />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-11 pr-10 py-3 text-xs font-black uppercase tracking-wider bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-white rounded-2xl outline-none focus:border-primary transition-all appearance-none cursor-pointer min-w-[200px]"
                >
                  <option value="popularity" className="bg-zinc-950 text-white font-bold">Popularity</option>
                  <option value="rating" className="bg-zinc-950 text-white font-bold">Top Rated</option>
                  <option value="price-asc" className="bg-zinc-950 text-white font-bold">Price (Low to High)</option>
                  <option value="price-desc" className="bg-zinc-950 text-white font-bold">Price (High to Low)</option>
                </select>
                <div className="absolute right-4.5 text-zinc-500 pointer-events-none">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Food Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 content-visibility-auto">
          {isMenuLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <FoodCardSkeleton key={`skeleton-${index}`} />
            ))
          ) : (
            filteredItems.map((item, idx) => (
              <FoodCard key={item.id ? `food-${item.id}` : `food-${idx}`} item={item} />
            ))
          )}
        </div>

        {!isMenuLoading && filteredItems.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted text-lg">No items found matching your search.</p>
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <div id="reviews" className="mb-20 content-visibility-section">
        <React.Suspense fallback={null}>
          <ReviewsSection />
        </React.Suspense>
      </div>

      {/* SEO Content Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24 text-gray-400 content-visibility-section">
        <div className="glass-dark p-8 md:p-12 rounded-[40px] border border-white/5">
          <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase mb-6">
            Welcome to Frosty Bite – Artisan Bakery & Frosty Treats
          </h1>
          <p className="text-lg leading-relaxed mb-12 max-w-4xl">
            Frosty Bite is your perfect destination for artisan bakery items, delicious cakes, and mouth-watering frosty treats. 
            We prepare every treat with high-quality ingredients to give you the best taste and experience.
          </p>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
            <div>
              <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-6 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-primary"></span>
                Our Specialties
              </h2>
              <ul className="space-y-4 text-gray-300">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="font-medium">Freshly Baked Cakes for every celebration</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="font-medium">Delicious Pastries made with premium butter</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="font-medium">Custom Cakes tailored to your special occasions</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="font-medium">Fast and Easy Online Ordering with real-time tracking</span>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-6 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-primary"></span>
                Why Choose Frosty Bite?
              </h2>
              <p className="text-gray-300 leading-relaxed text-base italic">
                At Frosty Bite, we focus on quality, freshness, and customer satisfaction. 
                Whether it's a birthday cake or a sweet pastry craving, we ensure every order is made with care and delivered fresh to your doorstep. 
                Our commitment to excellence makes us the top-rated artisan bakery.
              </p>
            </div>
          </div>

          <div className="mt-16 pt-12 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-4">
                Bulk Orders & Catering
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Planning a party or a corporate event? We offer specialized bulk order packages and catering services. 
                Contact us directly on WhatsApp to discuss your requirements and get a custom quote.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => window.open(`https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent("Hi! I'd like to inquire about a bulk order for an event.")}`, '_blank')}
                className="px-8 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-emerald-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <div className="w-5 h-5 bg-white/20 rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.761.459 3.474 1.33 4.988l-1.412 5.163 5.283-1.387c1.446.787 3.076 1.202 4.786 1.202 5.508 0 9.988-4.479 9.988-9.988s-4.48-9.988-9.988-9.988zm0 18.288c-1.554 0-3.079-.415-4.417-1.196l-.317-.188-3.284.862.877-3.208-.207-.329c-.859-1.365-1.312-2.946-1.312-4.57 0-4.569 3.717-8.287 8.287-8.287s8.287 3.717 8.287 8.287-3.718 8.287-8.287 8.287z"/></svg>
                </div>
                WhatsApp Inquiry
              </button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-4">
                Order Your Favorite Treats
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Browse our complete bakery collection and order cakes and pastries online. 
                Enjoy fast delivery and make every moment special with Frosty Bite. From our oven to your heart, we promise a delightful experience.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => {
                  const el = document.getElementById('menu-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all"
              >
                View Our Menu
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById('reviews');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/10 transition-all"
              >
                About Us
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Modern AI Voice Assistant */}
      <React.Suspense fallback={null}>
        <VoiceAssistant 
          onSearchQueryChange={setSearchQuery}
          onDietFilterChange={setDietaryFilter}
          onCategoryChange={setSelectedCategory}
        />
      </React.Suspense>
    </motion.div>
  );
};

export default Home;
