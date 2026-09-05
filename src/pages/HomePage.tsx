import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useMetadata } from '../hooks/useMetadata';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Search, Sparkles, ChevronRight, AlertTriangle, X, Flame, Leaf, ChevronDown, SlidersHorizontal, ShoppingBag } from 'lucide-react';
import { CATEGORIES, MENU_ITEMS, RESTAURANT_WHATSAPP } from '../constants';
import { FoodCard } from '../components/FoodCard';
import { FoodCardSkeleton } from '../components/FoodCardSkeleton';
import { getFoodRecommendations } from '../services/geminiService';
import { supabase } from '../supabase';
import { FoodItem } from '../types';
import { useAppConfig } from '../hooks/useAppConfig';
import { useAuth } from '../context/AuthContext';
import { useMenu } from '../context/MenuContext';
import toast from 'react-hot-toast';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { ReviewsSection } from '../components/ReviewsSection';
import { VoiceAssistant } from '../components/VoiceAssistant';
import { UNIVERSAL_LOGO_URL } from '../constants/logo';
import { HomeShell } from '../components/home/HomeShell';
import { HomeHeader } from '../components/home/HomeHeader';
import { HomeSearch } from '../components/home/HomeSearch';
import { HomeFilterModal } from '../components/home/HomeFilterModal';
import { HomeHeroBanner } from '../components/home/HomeHeroBanner';
import { HomeQuickCategories } from '../components/home/HomeQuickCategories';
import { HomePromoBanner } from '../components/home/HomePromoBanner';
import { HomeCollections } from '../components/home/HomeCollections';
import { HomeBestsellers } from '../components/home/HomeBestsellers';
import { HomeValuePropositions } from '../components/home/HomeValuePropositions';

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
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
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
    const params = new URLSearchParams(location.search);
    const catParam = params.get('category');
    const stateCategory = (location.state as any)?.category;
    const targetCat = catParam || stateCategory;

    if (targetCat) {
      setSelectedCategory(targetCat);
      setTimeout(() => {
        const element = document.getElementById('menu-section');
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 350);
    }
  }, [location.search, location.state]);

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

  return (
    <HomeShell>
      {/* 1. Home Page Top / Header Bar */}
      <HomeHeader />

      {/* 2. Search Bar + 3. Circular Filter Button */}
      <HomeSearch 
        query={searchQuery}
        onQueryChange={(q) => setSearchQuery(q)}
        onOpenFilter={() => setIsFilterModalOpen(true)}
        hasActiveFilters={dietaryFilter !== 'All' || sortBy !== 'popularity'}
      />

      {/* Filter Modal / Sheet */}
      <HomeFilterModal 
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        dietaryFilter={dietaryFilter}
        onDietaryChange={setDietaryFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* 4. Home Page Content Shell */}
      <div id="home-content-shell" className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-32">
        {/* Slot 1: Hero Banner */}
        <div className="mb-6">
          <HomeHeroBanner onOrderNow={() => {
            const el = document.getElementById('menu-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }} />
        </div>

        {/* Slot 2: Quick Categories Section */}
        <div className="mb-6">
          <HomeQuickCategories 
            activeCategory={selectedCategory} 
            onSelectCategory={(cat) => setSelectedCategory(cat)} 
          />
        </div>

        {/* Slot 3: Promotional Banner */}
        <div className="mb-6">
          <HomePromoBanner onOrderNow={() => {
            const el = document.getElementById('menu-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }} />
        </div>

        {/* Slot 4: Collections for you */}
        <div className="mb-6">
          <HomeCollections onSelectCollection={(tag) => {
            if (tag) {
              setSearchQuery(tag);
            } else {
              setSearchQuery('');
            }
          }} />
        </div>

        {/* Slot 5: Bestsellers */}
        <div className="mb-6">
          <HomeBestsellers 
            items={displayItems}
            onViewAll={() => {
              const el = document.getElementById('menu-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }} 
          />
        </div>

        {/* Slot 6: Value Propositions (Trust Badges) */}
        <div className="mb-8">
          <HomeValuePropositions />
        </div>

        {/* Orders Closed or Pickup Only Banner */}
        <AnimatePresence>
          {!isOrderingOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-8 p-4 sm:p-5 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-center gap-4 text-rose-950 shadow-xs"
            >
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle size={20} className="animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-bold tracking-tight text-rose-900">Online Orders are Currently Closed</h4>
                <p className="text-xs text-rose-700/90 mt-0.5">We are not accepting new orders at this moment. Please check back later!</p>
              </div>
            </motion.div>
          ) : isPickupOnly ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-8 p-4 sm:p-5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center gap-4 text-amber-950 shadow-xs"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
                <ShoppingBag size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px] uppercase tracking-wider">
                    🛍 Pickup Only
                  </span>
                  <h4 className="text-sm font-bold text-amber-950">In-Store Bakery Collection Active</h4>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Place your order online and pick it up fresh from our bakery counter. Home delivery is currently paused.
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Food Grid / Baked Goods Menu Section */}
        <div id="menu-section" className="pt-6 border-t border-neutral-200/80 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="space-y-0.5">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-stone-900 tracking-tight">
                {selectedCategory === 'All' ? 'Our Baked Collection' : `${selectedCategory}`}
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Showing {filteredItems.length} fresh {filteredItems.length === 1 ? 'treat' : 'treats'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Dietary Filters */}
              <div className="bg-stone-100/90 border border-stone-200/80 rounded-2xl p-1 flex items-center space-x-1 shadow-2xs">
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
                      whileHover={{ scale: 1.03, y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      onClick={() => setDietaryFilter(filter.id as any)}
                      className={cn(
                        "relative px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 z-10 cursor-pointer",
                        isSelected
                          ? "text-white"
                          : filter.id === 'Vegetarian'
                            ? "text-stone-600 hover:text-emerald-700"
                            : filter.id === 'Spicy'
                              ? "text-stone-600 hover:text-red-600"
                              : "text-stone-600 hover:text-stone-900"
                      )}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="dietary-active-bg"
                          className={cn(
                            "absolute inset-0 rounded-xl shadow-xs -z-10",
                            filter.id === 'Vegetarian'
                              ? "bg-emerald-600"
                              : filter.id === 'Spicy'
                                ? "bg-red-600"
                                : "bg-stone-900"
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
                <div className="absolute left-3.5 text-stone-400 pointer-events-none">
                  <SlidersHorizontal size={14} />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-9 pr-8 py-2 text-xs font-semibold bg-white border border-stone-200 hover:border-stone-300 text-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500/50 transition-all appearance-none cursor-pointer min-w-[170px] shadow-2xs"
                >
                  <option value="popularity">Popularity</option>
                  <option value="rating">Top Rated</option>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="price-desc">Price (High to Low)</option>
                </select>
                <div className="absolute right-3 text-stone-400 pointer-events-none">
                  <ChevronDown size={14} />
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
            <div className="text-center py-16 bg-stone-50 rounded-2xl border border-stone-200/60 p-8 my-4">
              <p className="text-stone-700 font-semibold text-base mb-2">No treats found matching your search.</p>
              <p className="text-stone-500 text-xs mb-4">Try clearing your filters or exploring our recommended bestsellers.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setDietaryFilter('All');
                }}
                className="px-4 py-2 bg-stone-900 text-white rounded-full text-xs font-bold hover:bg-stone-800 transition-colors"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Reviews Section */}
        <div id="reviews" className="pt-8 border-t border-neutral-200/80">
          <ReviewsSection />
        </div>

        {/* Clean Warm Bakery Story Banner */}
        <section className="mt-8 pt-8 pb-4 border-t border-neutral-200/80">
          <div className="bg-[#FFFDFB] p-6 sm:p-10 rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl text-center md:text-left">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#E5A970]">Artisan Craftsmanship</span>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
                Bulk Orders &amp; Custom Celebration Cakes
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                Planning a birthday, anniversary, or special event? Speak directly with our master bakers for personalized tiered cakes and bulk dessert catering.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => window.open(`https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent("Hi! I'd like to inquire about a custom cake / bulk bakery order.")}`, '_blank')}
                className="px-5 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs rounded-full shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.761.459 3.474 1.33 4.988l-1.412 5.163 5.283-1.387c1.446.787 3.076 1.202 4.786 1.202 5.508 0 9.988-4.479 9.988-9.988s-4.48-9.988-9.988-9.988zm0 18.288c-1.554 0-3.079-.415-4.417-1.196l-.317-.188-3.284.862.877-3.208-.207-.329c-.859-1.365-1.312-2.946-1.312-4.57 0-4.569 3.717-8.287 8.287-8.287s8.287 3.717 8.287 8.287-3.718 8.287-8.287 8.287z"/></svg>
                WhatsApp Inquiry
              </button>
              <button
                type="button"
                onClick={() => navigate('/custom-cake')}
                className="px-5 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs rounded-full shadow-sm transition-all cursor-pointer active:scale-95"
              >
                Build 3D Cake
              </button>
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
      </div>
    </HomeShell>
  );
};

export default Home;
