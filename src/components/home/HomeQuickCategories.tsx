import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, Layers } from 'lucide-react';
import { categoryService, Category, DEFAULT_BAKERY_CATEGORIES } from '../../services/categoryService';

interface HomeQuickCategoriesProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export const HomeQuickCategories: React.FC<HomeQuickCategoriesProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>(DEFAULT_BAKERY_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Load dynamic categories from backend/database
  useEffect(() => {
    let isMounted = true;
    const fetchCats = async () => {
      try {
        const data = await categoryService.getCategories();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setCategories(data.filter(c => c.is_active));
        }
      } catch (err) {
        console.warn('[HomeQuickCategories] Failed to load categories, using fallback:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCats();

    // Subscribe to admin updates in real-time
    const unsubscribe = categoryService.subscribe((updated) => {
      if (isMounted) {
        setCategories(updated.filter(c => c.is_active));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Update scroll arrow indicators
  const updateScrollButtons = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [categories]);

  // Smooth scroll controls
  const scrollSmooth = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = direction === 'left' ? -280 : 280;
    scrollContainerRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  };

  const handleSelect = (categoryName: string) => {
    onSelectCategory(categoryName);
    const el = document.getElementById('menu-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleViewAll = () => {
    navigate('/categories');
  };

  return (
    <section className="relative space-y-3 pt-1 select-none">
      {/* Section Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <h3 className="text-[19px] font-black text-[#1F1A17] tracking-tight">Categories</h3>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600">
            {categories.length} Handcrafted
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop Arrow Controls for Smooth Sliding */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollSmooth('left')}
              disabled={!canScrollLeft}
              className="w-7 h-7 rounded-full bg-white border border-stone-200 shadow-xs flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              aria-label="Previous categories"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => scrollSmooth('right')}
              disabled={!canScrollRight}
              className="w-7 h-7 rounded-full bg-white border border-stone-200 shadow-xs flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-50 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              aria-label="Next categories"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button 
            type="button"
            onClick={handleViewAll}
            className="text-[13px] font-semibold text-[#E76A54] hover:text-[#d35842] flex items-center gap-0.5 transition-colors cursor-pointer ml-1"
          >
            <span>View all</span>
            <span className="text-sm leading-none">→</span>
          </button>
        </div>
      </div>

      {/* Smooth Slide Container */}
      <div className="relative group">
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 scroll-smooth snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* "All" Category Pill Card */}
          <motion.div
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => handleSelect('All')}
            className="snap-start shrink-0 w-[84px] sm:w-[92px] flex flex-col items-center cursor-pointer group/card"
          >
            <div 
              className={`w-[80px] sm:w-[88px] h-[80px] sm:h-[88px] rounded-2xl flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden ${
                activeCategory.toLowerCase() === 'all'
                  ? 'bg-gradient-to-br from-[#E76A54] to-[#f27e69] text-white ring-2 ring-[#E76A54] shadow-lg shadow-orange-500/25 scale-105'
                  : 'bg-white border border-stone-200/90 text-stone-700 hover:border-orange-500/40 hover:shadow-md'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-1 group-hover/card:scale-110 transition-transform">
                <Sparkles size={20} className={activeCategory.toLowerCase() === 'all' ? 'text-white' : 'text-orange-500'} />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider">All Items</span>
            </div>
            <span className={`text-[12px] font-bold mt-2 text-center leading-tight truncate max-w-full ${
              activeCategory.toLowerCase() === 'all' ? 'text-[#E76A54]' : 'text-[#1F1A17]'
            }`}>
              All
            </span>
          </motion.div>

          {/* Dynamic Categories with High-Definition Category Imagery */}
          {categories.map((item) => {
            const isActive = activeCategory.toLowerCase() === item.name.toLowerCase() ||
                             activeCategory.toLowerCase() === item.slug.toLowerCase();

            return (
              <motion.div
                key={item.id}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleSelect(item.name)}
                className="snap-start shrink-0 w-[84px] sm:w-[92px] flex flex-col items-center cursor-pointer group/card"
              >
                {/* Category Image Frame */}
                <div 
                  className={`w-[80px] sm:w-[88px] h-[80px] sm:h-[88px] rounded-2xl p-1 transition-all duration-300 relative overflow-hidden bg-white ${
                    isActive 
                      ? 'ring-2 ring-[#E76A54] shadow-lg shadow-orange-500/25 scale-105 border-transparent' 
                      : 'border border-stone-200/90 hover:border-orange-500/40 hover:shadow-md'
                  }`}
                >
                  <div className="w-full h-full rounded-xl overflow-hidden relative bg-stone-100">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800';
                      }}
                    />
                    {/* Subtle bottom gradient overlay for depth */}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/40 via-transparent to-transparent pointer-events-none" />

                    {/* Active Check Dot */}
                    {isActive && (
                      <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#E76A54] ring-2 ring-white shadow-xs" />
                    )}
                  </div>
                </div>

                {/* Category Label */}
                <span className={`text-[12px] mt-2 text-center leading-tight truncate max-w-full font-medium transition-colors ${
                  isActive ? 'text-[#E76A54] font-black' : 'text-[#1F1A17] font-semibold'
                }`}>
                  {item.name}
                </span>

                {/* Product Count (if known) */}
                {typeof item.products_count === 'number' && item.products_count > 0 && (
                  <span className="text-[10px] text-stone-400 font-mono leading-none mt-0.5">
                    {item.products_count} items
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
