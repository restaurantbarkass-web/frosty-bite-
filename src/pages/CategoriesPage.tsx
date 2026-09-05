import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Search, 
  X, 
  ShoppingBag, 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
  Leaf,
  Flame,
  LayoutGrid
} from 'lucide-react';
import { useMenu } from '../context/MenuContext';
import { useCartState, useCartActions } from '../context/CartContext';
import { useMetadata } from '../hooks/useMetadata';
import { cn } from '../lib/utils';
import { FoodItem } from '../types';
import { FoodCard } from '../components/FoodCard';
import { FoodCardSkeleton } from '../components/FoodCardSkeleton';

interface CategoryVisualMeta {
  image: string;
  emoji: string;
  badge?: string;
  description: string;
  bgColor: string;
  borderColor: string;
}

const CATEGORY_METADATA: Record<string, CategoryVisualMeta> = {
  'Cakes': {
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800',
    emoji: '🍰',
    badge: 'Popular',
    description: 'Custom tiered cakes, rich bento creations & velvet sponges.',
    bgColor: 'bg-white',
    borderColor: 'border-stone-200/90',
  },
  'Pastries': {
    image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=800',
    emoji: '🥐',
    badge: 'Fresh Daily',
    description: 'Flaky butter croissants, fruit tarts & Danish pastries.',
    bgColor: 'bg-white',
    borderColor: 'border-stone-200/90',
  },
  'Breads': {
    image: 'https://images.unsplash.com/photo-1585478282226-1d713204d95c?auto=format&fit=crop&q=80&w=800',
    emoji: '🍞',
    description: 'Artisanal sourdoughs, brioche loaves & crusty baguettes.',
    bgColor: 'bg-white',
    borderColor: 'border-stone-200/90',
  },
  'Cookies': {
    image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&q=80&w=800',
    emoji: '🍪',
    badge: 'Crispy',
    description: 'Soft-baked choc-chips, butter cookies & macarons.',
    bgColor: 'bg-white',
    borderColor: 'border-stone-200/90',
  },
  'Beverages': {
    image: 'https://images.unsplash.com/photo-1544787210-2211d44b5042?auto=format&fit=crop&q=80&w=800',
    emoji: '☕',
    description: 'Belgian hot chocolates, cold brews & signature shakes.',
    bgColor: 'bg-white',
    borderColor: 'border-stone-200/90',
  },
  'Cupcakes': {
    image: 'https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&q=80&w=800',
    emoji: '🧁',
    badge: 'Sweet Treat',
    description: 'Swirled buttercream frostings on moist sponge cupcakes.',
    bgColor: 'bg-white',
    borderColor: 'border-stone-200/90',
  },
  'Brownies': {
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800',
    emoji: '🍫',
    badge: 'Fudgy & Rich',
    description: 'Decadent Belgian chocolate fudge brownies and walnut sizzlers.',
    bgColor: 'bg-white',
    borderColor: 'border-stone-200/90',
  },
  'Desserts': {
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&q=80&w=800',
    emoji: '🍨',
    description: 'Cheesecakes, puddings, dessert jars & sweet delights.',
    bgColor: 'bg-white',
    borderColor: 'border-stone-200/90',
  },
};

const DEFAULT_CATEGORY_META: CategoryVisualMeta = {
  image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800',
  emoji: '✨',
  badge: undefined,
  description: 'Handcrafted artisan bakery delights baked daily.',
  bgColor: 'bg-white',
  borderColor: 'border-stone-200/90',
};

// Helpers for dietary filters
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
    descLower.includes('spicy') ||
    descLower.includes('chili')
  );
};

export const CategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, categories: rawCategories, loading, refreshMenu } = useMenu();
  const { totalItems } = useCartState();
  const { setIsCartOpen } = useCartActions();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<'All' | 'Vegetarian' | 'Spicy'>('All');
  const [sortBy, setSortBy] = useState<string>('popularity');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useMetadata({
    title: 'Categories & All Products — Frosty Bite Bakery',
    description: 'Explore all bakery categories and fresh products from Frosty Bite. Freshly baked cakes, pastries, sourdough breads, cookies, cupcakes and beverages.',
    keywords: ['bakery categories', 'all bakery products', 'cakes', 'pastries', 'breads', 'cookies', 'Frosty Bite menu']
  });

  // Sync category param from URL if navigated with state or search param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category') || (location.state as any)?.category;
    if (cat) {
      setSelectedCategory(cat);
    }
  }, [location.search, location.state]);

  // Calculate unique categories from database products
  const computedCategories = useMemo(() => {
    if (!items || items.length === 0) {
      const filtered = (rawCategories || []).filter(c => c && c.toLowerCase() !== 'all');
      return filtered.length > 0 ? filtered : ['Cakes', 'Pastries', 'Cupcakes', 'Brownies', 'Breads', 'Cookies', 'Beverages'];
    }

    const uniqueCats = Array.from(
      new Set(items.map(i => i.category).filter(Boolean))
    );

    return uniqueCats;
  }, [items, rawCategories]);

  // Aggregate stats per category
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; minPrice: number; image: string; items: FoodItem[] }> = {};

    computedCategories.forEach(cat => {
      const catItems = items.filter(i => (i.category || '').toLowerCase() === cat.toLowerCase());
      const availableItems = catItems.filter(i => i.available !== false);
      const minPrice = catItems.length > 0 ? Math.min(...catItems.map(i => i.price)) : 0;
      
      const topItem = [...catItems].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
      const fallbackMeta = CATEGORY_METADATA[cat] || DEFAULT_CATEGORY_META;
      const bestImage = topItem?.image || fallbackMeta.image;

      stats[cat] = {
        count: catItems.length,
        minPrice,
        image: bestImage,
        items: availableItems.length > 0 ? availableItems : catItems
      };
    });

    return stats;
  }, [computedCategories, items]);

  // Filtered & Sorted Product Items from Backend
  const displayedProducts = useMemo(() => {
    let result = [...items];

    // Filter by Category
    if (selectedCategory !== 'All') {
      result = result.filter(i => (i.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(i => 
        (i.name || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    }

    // Dietary Filter
    if (dietaryFilter === 'Vegetarian') {
      result = result.filter(i => isVegetarianItem(i));
    } else if (dietaryFilter === 'Spicy') {
      result = result.filter(i => isSpicyItem(i));
    }

    // Sort
    if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else {
      // Popularity (default: available first, then highest rating/recommended)
      result.sort((a, b) => {
        if (a.available === false && b.available !== false) return 1;
        if (a.available !== false && b.available === false) return -1;
        if (b.is_recommended && !a.is_recommended) return 1;
        if (a.is_recommended && !b.is_recommended) return -1;
        return (b.rating || 0) - (a.rating || 0);
      });
    }

    return result;
  }, [items, selectedCategory, searchQuery, dietaryFilter, sortBy]);

  // Handle Category selection
  const handleSelectCategory = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
  }, []);

  // Handle Back Navigation
  const handleBack = useCallback(() => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  // Handle Refresh Action
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setLoadError(null);
      await refreshMenu();
    } catch (err: any) {
      setLoadError('Failed to refresh products');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col selection:bg-[#E76A54]/20">
      
      {/* 1. Professional White Sticky Header */}
      <header 
        className="sticky top-0 z-40 bg-white border-b border-stone-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)]"
        style={{
          paddingTop: 'max(10px, env(safe-area-inset-top, 10px))'
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          
          {/* Back Button */}
          <motion.button
            type="button"
            onClick={handleBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="w-10 h-10 rounded-2xl bg-white border border-stone-200/90 shadow-2xs flex items-center justify-center text-stone-700 hover:text-stone-950 hover:bg-stone-50 transition-all cursor-pointer shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={18} strokeWidth={2.2} />
          </motion.button>

          {/* Title & Branding */}
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E76A54]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#E76A54]">
                Frosty Bite Bakery
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold font-serif text-stone-900 tracking-tight leading-tight">
              Categories & Menu
            </h1>
          </div>

          {/* Action: Cart Button with live count */}
          <motion.button
            type="button"
            onClick={() => setIsCartOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="w-10 h-10 rounded-2xl bg-white border border-stone-200/90 shadow-2xs flex items-center justify-center text-stone-700 hover:text-stone-950 hover:bg-stone-50 transition-all cursor-pointer relative shrink-0"
            aria-label="View Cart"
          >
            <ShoppingBag size={18} strokeWidth={2} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[#E76A54] text-white text-[10px] font-black flex items-center justify-center px-1 shadow-xs animate-in zoom-in-50">
                {totalItems > 99 ? '99+' : totalItems}
              </span>
            )}
          </motion.button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-4 pb-32 sm:pb-36 space-y-5">

        {/* 2. Live Search Bar */}
        <section className="relative">
          <div className="relative flex items-center">
            <Search 
              size={18} 
              className="absolute left-3.5 text-stone-400 pointer-events-none stroke-[2.2]" 
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cakes, pastries, cookies, breads…"
              className="w-full bg-white text-stone-900 placeholder:text-stone-400 text-sm font-medium pl-10 pr-10 py-3 rounded-2xl border border-stone-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#E76A54]/20 focus:border-[#E76A54] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 w-6 h-6 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {searchQuery && (
            <div className="flex items-center justify-between mt-2 px-1 text-xs text-stone-500">
              <span>
                Showing treats matching <strong className="text-stone-900 font-bold">"{searchQuery}"</strong>
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#E76A54] font-semibold hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </section>

        {/* 3. Category Horizontal Pills Selector */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Select Category
            </h2>
            <span className="text-xs text-stone-400 font-medium">
              {items.length} total treats
            </span>
          </div>

          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide -mx-1 px-1">
            {/* 'All' Tab */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSelectCategory('All')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs",
                selectedCategory === 'All'
                  ? "bg-[#E76A54] text-white shadow-xs"
                  : "bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/90"
              )}
            >
              <LayoutGrid size={13} />
              <span>All ({items.length})</span>
            </motion.button>

            {/* Dynamic Category Tabs from Backend */}
            {computedCategories.map((cat) => {
              const meta = CATEGORY_METADATA[cat] || DEFAULT_CATEGORY_META;
              const count = categoryStats[cat]?.count || 0;
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();

              return (
                <motion.button
                  key={cat}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectCategory(cat)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs",
                    isSelected
                      ? "bg-[#E76A54] text-white shadow-xs"
                      : "bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/90"
                  )}
                >
                  <span>{meta.emoji}</span>
                  <span>{cat}</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-full font-black",
                    isSelected ? "bg-white/20 text-white" : "bg-stone-100 text-stone-600 border border-stone-200/60"
                  )}>
                    {count}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* 4. Visual Category Exploration Cards (Shown on 'All' view) */}
        {selectedCategory === 'All' && !searchQuery && (
          <section className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-0.5">
              <h3 className="text-sm font-bold font-serif text-stone-900">
                Explore Collections
              </h3>
              <span className="text-xs text-stone-500">
                Tap card to view category
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {computedCategories.map((categoryName) => {
                const meta = CATEGORY_METADATA[categoryName] || DEFAULT_CATEGORY_META;
                const stats = categoryStats[categoryName] || { count: 0, minPrice: 0, image: meta.image };

                return (
                  <motion.div
                    key={categoryName}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleSelectCategory(categoryName)}
                    className="group bg-white rounded-2xl p-2.5 border border-stone-200/90 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between"
                  >
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 relative mb-2 shadow-2xs">
                      <img
                        src={stats.image || meta.image}
                        alt={categoryName}
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-white/95 backdrop-blur-md shadow-xs flex items-center justify-center text-xs">
                        {meta.emoji}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-[#E76A54] transition-colors truncate">
                        {categoryName}
                      </h4>
                      <p className="text-[10px] text-stone-500 font-medium">
                        {stats.count} {stats.count === 1 ? 'item' : 'items'}
                        {stats.minPrice > 0 && ` • ₹${stats.minPrice}+`}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. Product Controls & Toolbar */}
        <section className="pt-2 border-t border-stone-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold font-serif text-stone-900">
                  {selectedCategory === 'All' ? 'All Products' : selectedCategory}
                </h2>
                {selectedCategory !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('All')}
                    className="text-[11px] font-bold text-[#E76A54] hover:underline cursor-pointer"
                  >
                    Show All
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Showing {displayedProducts.length} {displayedProducts.length === 1 ? 'fresh treat' : 'fresh treats'} connected to bakery kitchen
              </p>
            </div>

            {/* Filters and Sort */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Dietary Toggle */}
              <div className="bg-white rounded-xl p-1 flex items-center gap-1 border border-stone-200/90 shadow-2xs">
                {(['All', 'Vegetarian', 'Spicy'] as const).map((mode) => {
                  const isSelected = dietaryFilter === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDietaryFilter(mode)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1",
                        isSelected
                          ? mode === 'Vegetarian'
                            ? "bg-emerald-600 text-white shadow-xs"
                            : mode === 'Spicy'
                              ? "bg-red-600 text-white shadow-xs"
                              : "bg-stone-900 text-white shadow-xs"
                          : "text-stone-600 hover:text-stone-900"
                      )}
                    >
                      {mode === 'Vegetarian' && <Leaf size={11} />}
                      {mode === 'Spicy' && <Flame size={11} />}
                      <span>{mode === 'Vegetarian' ? 'Veg' : mode}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sort Selector */}
              <div className="relative flex items-center">
                <SlidersHorizontal size={13} className="absolute left-3 text-stone-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-8 pr-7 py-1.5 text-xs font-semibold bg-white border border-stone-200/90 text-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-[#E76A54]/20 focus:border-[#E76A54] transition-all appearance-none cursor-pointer shadow-2xs"
                >
                  <option value="popularity">Popularity</option>
                  <option value="rating">Top Rated</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 text-stone-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* 6. Products Grid (Direct from Backend) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <FoodCardSkeleton key={`cat-skeleton-${n}`} />
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-white border border-red-200 rounded-2xl p-6 text-center space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <h3 className="font-bold text-stone-900 text-base">Unable to load bakery items</h3>
            <p className="text-xs text-stone-600 max-w-sm mx-auto">
              We encountered an issue retrieving products from the backend. Tap below to reload.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E76A54] hover:bg-[#d65943] text-white text-xs font-bold uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Retrying...' : 'Retry'}</span>
            </button>
          </div>
        ) : displayedProducts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 border border-stone-200 text-center space-y-3 shadow-2xs"
          >
            <div className="w-14 h-14 rounded-full bg-[#FFF2EE] text-[#E76A54] flex items-center justify-center mx-auto text-2xl shadow-inner">
              🍰
            </div>
            <h3 className="text-base font-bold font-serif text-stone-900">
              No products found
            </h3>
            <p className="text-xs text-stone-500 max-w-xs mx-auto">
              {searchQuery 
                ? `No treats matched "${searchQuery}". Try a different keyword.`
                : `There are currently no products available in ${selectedCategory}.`
              }
            </p>
            <div className="pt-2 flex justify-center gap-2">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
              )}
              {selectedCategory !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('All')}
                  className="px-4 py-2 rounded-xl bg-[#E76A54] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  View All Products
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedProducts.map((product) => (
              <FoodCard
                key={product.id}
                item={product}
                variant="default"
              />
            ))}
          </div>
        )}

      </main>

    </div>
  );
};

export default CategoriesPage;
