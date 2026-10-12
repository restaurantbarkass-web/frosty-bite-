import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
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
  const [, setIsLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Mouse drag & touch sliding state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const [isGrabbing, setIsGrabbing] = useState(false);

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
  const updateScrollButtons = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

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
  }, [categories, updateScrollButtons]);

  // Ultra-smooth easing scroll animation using requestAnimationFrame
  const smoothSlideBy = (distance: number, duration = 320) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const start = el.scrollLeft;
    const target = start + distance;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic formula
      const ease = 1 - Math.pow(1 - progress, 3);
      el.scrollLeft = start + (target - start) * ease;
      updateScrollButtons();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  // Mouse Drag to Slide smoothly
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    isDraggingRef.current = true;
    dragDistanceRef.current = 0;
    startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
    setIsGrabbing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.35; // fluid sensitivity
    dragDistanceRef.current = Math.abs(walk);
    scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
    updateScrollButtons();
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    setIsGrabbing(false);
  };

  const handleSelect = (categoryName: string) => {
    // If the user was dragging the slide, don't trigger selection
    if (dragDistanceRef.current > 6) return;

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
              onClick={() => smoothSlideBy(-280)}
              disabled={!canScrollLeft}
              className="w-8 h-8 rounded-full bg-white border border-stone-200/90 shadow-xs flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-50 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer active:scale-90"
              aria-label="Previous categories"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => smoothSlideBy(280)}
              disabled={!canScrollRight}
              className="w-8 h-8 rounded-full bg-white border border-stone-200/90 shadow-xs flex items-center justify-center text-stone-600 hover:text-stone-900 hover:bg-stone-50 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer active:scale-90"
              aria-label="Next categories"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>

          <button 
            type="button"
            onClick={handleViewAll}
            className="text-sm font-bold text-[#E76A54] hover:text-[#d35842] flex items-center gap-1 transition-all cursor-pointer px-2.5 py-1 rounded-xl hover:bg-orange-50/80 active:scale-95"
          >
            <span>View all</span>
            <span className="text-base leading-none">→</span>
          </button>
        </div>
      </div>

      {/* Smooth Slide Container with Drag */}
      <div className="relative group">

        <div 
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 scroll-smooth snap-x snap-mandatory ${
            isGrabbing ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ 
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {/* Cohesive "All Items" Category Card matching photography style */}
          {(() => {
            const isAllActive = activeCategory.toLowerCase() === 'all';
            return (
              <motion.div
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelect('All')}
                className="snap-start shrink-0 w-[84px] sm:w-[94px] flex flex-col items-center cursor-pointer group/card"
              >
                <div 
                  className={`w-[80px] sm:w-[90px] h-[80px] sm:h-[90px] rounded-2xl p-1 transition-all duration-300 relative overflow-hidden bg-white ${
                    isAllActive
                      ? 'ring-2 ring-[#E76A54] shadow-lg shadow-orange-500/25 scale-105 border-transparent'
                      : 'border border-stone-200/90 hover:border-orange-500/40 hover:shadow-md'
                  }`}
                >
                  <div className="w-full h-full rounded-xl overflow-hidden relative bg-stone-100">
                    <img
                      src="https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800"
                      alt="All Items"
                      className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent pointer-events-none" />
                    
                    {/* Golden All Star Badge */}
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-stone-900/70 backdrop-blur-xs text-[9px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-0.5">
                      <Sparkles size={8} />
                      <span>ALL</span>
                    </div>

                    {isAllActive && (
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#E76A54] ring-2 ring-white shadow-xs" />
                    )}
                  </div>
                </div>

                <span className={`text-[12px] mt-2 text-center leading-tight truncate max-w-full font-medium transition-colors ${
                  isAllActive ? 'text-[#E76A54] font-black' : 'text-[#1F1A17] font-semibold'
                }`}>
                  All Items
                </span>
                <span className="text-[10px] text-stone-400 font-mono leading-none mt-0.5">
                  Full Menu
                </span>
              </motion.div>
            );
          })()}

          {/* Dynamic Categories with High-Definition Category Imagery */}
          {categories.map((item) => {
            const isActive = activeCategory.toLowerCase() === item.name.toLowerCase() ||
                             activeCategory.toLowerCase() === item.slug.toLowerCase();

            return (
              <motion.div
                key={item.id}
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSelect(item.name)}
                className="snap-start shrink-0 w-[84px] sm:w-[94px] flex flex-col items-center cursor-pointer group/card"
              >
                {/* Category Image Frame */}
                <div 
                  className={`w-[80px] sm:w-[90px] h-[80px] sm:h-[90px] rounded-2xl p-1 transition-all duration-300 relative overflow-hidden bg-white ${
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
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/50 via-transparent to-transparent pointer-events-none" />

                    {/* Active Check Dot */}
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#E76A54] ring-2 ring-white shadow-xs" />
                    )}
                  </div>
                </div>

                {/* Category Label */}
                <span className={`text-[12px] mt-2 text-center leading-tight truncate max-w-full font-medium transition-colors ${
                  isActive ? 'text-[#E76A54] font-black' : 'text-[#1F1A17] font-semibold'
                }`}>
                  {item.name}
                </span>

                {/* Product Count */}
                {typeof item.products_count === 'number' && item.products_count > 0 ? (
                  <span className="text-[10px] text-stone-400 font-mono leading-none mt-0.5">
                    {item.products_count} items
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-400 font-mono leading-none mt-0.5">
                    Fresh
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
