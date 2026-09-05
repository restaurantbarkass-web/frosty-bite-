import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight, Tag, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Banner } from '../../types';
import { BannerService } from '../../services/BannerService';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';

interface FallbackSlide {
  id: string;
  badgeEmoji: string;
  badgeText: string;
  badgeColor: string;
  badgeTextColor: string;
  title1: string;
  title2: string;
  title2Italic: boolean;
  subtitle: string;
  ctaText: string;
  bgGradient: string;
  glowColor: string;
  imageSrc: string;
  imageAlt: string;
  actionCategory?: string;
}

const DEFAULT_SLIDES: FallbackSlide[] = [
  {
    id: 'slide-1',
    badgeEmoji: '👑',
    badgeText: 'PREMIUM BAKERY',
    badgeColor: 'bg-white/10 border-white/15',
    badgeTextColor: 'text-[#E5A970]',
    title1: 'Crafted with love,',
    title2: 'made for you',
    title2Italic: true,
    subtitle: 'Freshly baked cakes & desserts for every celebration.',
    ctaText: 'ORDER NOW',
    bgGradient: 'from-[#181411] via-[#211A16] to-[#2D211B]',
    glowColor: 'bg-[#E5A970]/10',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAri7SLq3Bu-wWAys7tUDLoqRsCKsCs42CAvWcwMrAYYmJF-yo1Du4BfC16QvOJ0e8G7I6oEMdh7jsDskg1Wt83DAxF1WHyskHTkrQGSeUGAJ7K9trEZykuw0WlUEOD_4Q-RTp_5-aRMYCufene86S_hWz14un85bsrLUmhokLOPYNBv5qk0xGxzXS-oXzl6OZ_NcoOJVwPUGLfOnQ1GTpvyaYTcnEUANuGqrYTPcBGaWESnei8rA',
    imageAlt: 'Crafted Chocolate Cake',
  },
  {
    id: 'slide-2',
    badgeEmoji: '✨',
    badgeText: 'FRESH ARRIVALS',
    badgeColor: 'bg-white/10 border-white/15',
    badgeTextColor: 'text-[#8EB8E5]',
    title1: 'Artisanal',
    title2: 'Cheesecakes',
    title2Italic: true,
    subtitle: 'Crafted with fresh wild blueberries & Belgian cream cheese.',
    ctaText: 'EXPLORE NOW',
    bgGradient: 'from-[#14181B] via-[#1A2127] to-[#1F2730]',
    glowColor: 'bg-blue-500/10',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA9yVItWiRJ4cy_mVHFQtpmvWi9ahnnbh4eVaCdwMB2yDblCamzEUeqclyTisgAsbxFYOkNEmEyeqPtS1z5z8kCagMW-KlRY2ojwz2yehdoltvSqeqREp59QLvoNgNquy3Nqprh61c5Pp-F36NwzX_1-GCpjdMrOoFPCCghYk8A2PcD85LUUwntlEHZVxNzirunShzAGMhtvXZnwX0_ulRi_f5Y9Qz8VNmVGC6znuetH-qCA5_tRrg',
    imageAlt: 'Artisanal Blueberry Cheesecake',
    actionCategory: 'Pastries',
  },
  {
    id: 'slide-3',
    badgeEmoji: '🎉',
    badgeText: 'CELEBRATE TODAY',
    badgeColor: 'bg-white/10 border-white/15',
    badgeTextColor: 'text-[#F7B2BD]',
    title1: 'Signature',
    title2: 'Birthday Cakes',
    title2Italic: true,
    subtitle: 'Customizable message & express 60-min delivery.',
    ctaText: 'CUSTOMIZE',
    bgGradient: 'from-[#21161A] via-[#2A1D23] to-[#34232C]',
    glowColor: 'bg-rose-500/10',
    imageSrc: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6Lo7H6qA5pbgSWGLN_dLwkFERBLX0Aev7M8WeuLh_PK7cxtHLCTchIBzQk1UJgaVl_djlKBuVYxwvenHAVZKwPFC4L6u59wpYVJTtvTq9CI9jTCSOHNy4DSSFgDzUKdsmyDzoUZCc_5x8c1Gxq1R76O1jQLGlnQGWXEq2scSgitgmiwifyZ-6ECfQyefUf7tPBTfUZ1jH1WeXqWx0URY_Da16xFwnQfJUKgbESRy8xdF_A_h1Hng',
    imageAlt: 'Celebration Birthday Cake',
    actionCategory: 'Cakes',
  },
];

interface UnifiedSlide {
  id: string;
  isBackend: boolean;
  title: string;
  subtitle?: string;
  imageUrl: string;
  autoApplyCoupon?: string;
  redirectUrl?: string;
  isFlashDeal?: boolean;
  badgeEmoji?: string;
  badgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  title1?: string;
  title2?: string;
  title2Italic?: boolean;
  ctaText?: string;
  bgGradient?: string;
  glowColor?: string;
  actionCategory?: string;
  bannerObj?: Banner;
}

interface HomeHeroBannerProps {
  onOrderNow?: (category?: string) => void;
}

// Directional slide animation variants for smooth 2-second looping transitions
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0.6,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      x: { type: 'spring' as const, stiffness: 260, damping: 28 },
      opacity: { duration: 0.3 },
    },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0.4,
    transition: {
      x: { type: 'spring' as const, stiffness: 260, damping: 28 },
      opacity: { duration: 0.3 },
    },
  }),
};

export const HomeHeroBanner: React.FC<HomeHeroBannerProps> = ({ onOrderNow }) => {
  const [backendBanners, setBackendBanners] = useState<Banner[]>([]);
  const [[currentSlide, direction], setSlide] = useState<[number, number]>([0, 1]);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number>(0);
  const navigate = useNavigate();

  // Fetch banners from backend and listen for realtime updates
  const fetchBanners = useCallback(async () => {
    try {
      const data = await BannerService.getBanners((updated) => {
        if (Array.isArray(updated)) {
          const active = updated.filter((b) => b.is_active !== false);
          setBackendBanners(active);
        }
      });
      if (Array.isArray(data)) {
        const active = data.filter((b) => b.is_active !== false);
        setBackendBanners(active);
      }
    } catch (err) {
      console.warn('[HomeHeroBanner] Error fetching banners:', err);
    }
  }, []);

  useEffect(() => {
    fetchBanners();

    const channel = supabase
      .channel('home_hero_banners_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'banners' },
        () => {
          fetchBanners();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBanners]);

  // Combine backend banners or fallback to handcrafted default slides
  const slides: UnifiedSlide[] = useMemo(() => {
    if (backendBanners.length > 0) {
      return backendBanners.map((banner, idx) => ({
        id: banner.id || `backend-banner-${idx}`,
        isBackend: true,
        title: banner.title,
        subtitle: banner.auto_apply_coupon
          ? `Special Offer: Apply code ${banner.auto_apply_coupon} for instant discounts!`
          : 'Freshly baked goodness handcrafted with pure passion & premium ingredients.',
        imageUrl: banner.image_url,
        autoApplyCoupon: banner.auto_apply_coupon,
        redirectUrl: banner.redirect_url,
        isFlashDeal: banner.is_flash_deal,
        ctaText: banner.auto_apply_coupon ? 'CLAIM & ORDER' : 'ORDER NOW',
        bannerObj: banner,
      }));
    }
    return DEFAULT_SLIDES.map((s) => ({
      ...s,
      isBackend: false,
      title: `${s.title1} ${s.title2}`,
      imageUrl: s.imageSrc,
    }));
  }, [backendBanners]);

  const slideCount = slides.length;

  const paginate = useCallback((newDirection: number) => {
    setSlide(([curr]) => {
      let nextIndex = curr + newDirection;
      if (nextIndex < 0) nextIndex = slideCount - 1;
      else if (nextIndex >= slideCount) nextIndex = 0;
      return [nextIndex, newDirection];
    });
  }, [slideCount]);

  // Auto-scroll slides every 2 SECONDS and seamlessly LOOP
  useEffect(() => {
    if (isPaused || slideCount <= 1) return;
    
    const timer = setInterval(() => {
      paginate(1);
    }, 2000); // 2 seconds auto-slide loop

    return () => clearInterval(timer);
  }, [isPaused, slideCount, paginate]);

  // Ensure currentSlide is within bounds if slide count changes
  useEffect(() => {
    if (currentSlide >= slideCount) {
      setSlide([0, 1]);
    }
  }, [slideCount, currentSlide]);

  const handleSlideAction = (slide: UnifiedSlide) => {
    // 1. If coupon is available, copy & notify
    if (slide.autoApplyCoupon) {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(slide.autoApplyCoupon);
      }
      toast.success(`Coupon code "${slide.autoApplyCoupon}" copied & ready to apply!`, {
        id: `coupon-${slide.id}`,
        icon: '🏷️',
      });
    }

    // 2. Track click analytics in backend if backend banner
    if (slide.bannerObj?.id) {
      supabase
        .from('banner_clicks')
        .insert({
          banner_id: slide.bannerObj.id,
          clicked_at: new Date().toISOString(),
        })
        .then(() => {}, () => {});
    }

    // 3. Navigation
    if (slide.redirectUrl) {
      if (slide.redirectUrl.startsWith('http://') || slide.redirectUrl.startsWith('https://')) {
        window.location.href = slide.redirectUrl;
      } else if (slide.redirectUrl.startsWith('/')) {
        navigate(slide.redirectUrl);
      } else {
        if (onOrderNow) onOrderNow(slide.redirectUrl);
      }
    } else if (slide.actionCategory) {
      if (onOrderNow) onOrderNow(slide.actionCategory);
      else {
        const el = document.getElementById('menu-section');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      if (onOrderNow) onOrderNow();
      else {
        const el = document.getElementById('menu-section');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 40) {
      paginate(1);
    } else if (diff < -40) {
      paginate(-1);
    }
    setIsPaused(false);
  };

  const current = slides[currentSlide] || slides[0];

  return (
    <section 
      aria-label="Hero Carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="group relative w-full rounded-3xl bg-[#14110F] overflow-hidden shadow-xl min-h-[240px] sm:min-h-[270px] h-[255px] sm:h-[285px] select-none border border-stone-800/60 transition-colors duration-500"
    >
      <div className="relative w-full h-full overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          {current.isBackend ? (
            // Backend Banner Slide with Directional Slide Transition
            <motion.div
              key={`backend-slide-${current.id}-${currentSlide}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              onClick={() => handleSlideAction(current)}
              className="absolute inset-0 w-full h-full cursor-pointer overflow-hidden"
            >
              {/* Background Image Layer */}
              <div className="absolute inset-0 w-full h-full bg-stone-900">
                <img
                  src={current.imageUrl}
                  alt={current.title}
                  className="w-full h-full object-cover object-center transform transition-transform duration-1000 group-hover:scale-105"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/stitch/hero-cake.png';
                  }}
                />
              </div>

              {/* Gradient Overlay for high-contrast legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/60 to-stone-950/20 sm:bg-gradient-to-r sm:from-stone-950/90 sm:via-stone-950/65 sm:to-transparent flex flex-col justify-end sm:justify-center p-5 sm:p-7 z-10">
                <div className="max-w-md">
                  {/* Badge Tag */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] tracking-wider uppercase font-bold mb-2 backdrop-blur-md shadow-xs border bg-black/40 border-white/20 text-[#E5A970]">
                    {current.isFlashDeal ? (
                      <>
                        <span>⚡</span>
                        <span className="text-rose-400">FLASH DEAL</span>
                      </>
                    ) : current.autoApplyCoupon ? (
                      <>
                        <Tag size={12} className="text-amber-400" />
                        <span className="text-amber-300">CODE: {current.autoApplyCoupon}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} className="text-[#E5A970]" />
                        <span>EXCLUSIVE OFFER</span>
                      </>
                    )}
                  </div>

                  {/* Banner Title */}
                  <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-md">
                    {current.title}
                  </h2>

                  {/* Subtitle */}
                  <p className="text-[11.5px] sm:text-xs md:text-sm text-stone-200 mt-1.5 mb-3.5 leading-snug line-clamp-2 drop-shadow-xs max-w-sm">
                    {current.subtitle}
                  </p>

                  {/* CTA & Auto-Coupon Buttons */}
                  <div className="flex items-center gap-2">
                    <motion.button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSlideAction(current);
                      }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#E5A970] to-[#D49A5E] hover:brightness-105 text-[#181411] px-4 py-2 rounded-full font-bold text-[11px] uppercase tracking-wider shadow-md active:scale-95 transition-transform cursor-pointer"
                    >
                      <span>{current.ctaText || 'ORDER NOW'}</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </motion.button>

                    {current.autoApplyCoupon && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(current.autoApplyCoupon || '');
                          }
                          toast.success(`Coupon code ${current.autoApplyCoupon} copied!`, { id: 'copy-code' });
                        }}
                        className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-[10px] font-bold tracking-wider uppercase transition-colors"
                      >
                        COPY CODE
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            // Default Handcrafted Slide with Directional Slide Transition
            <motion.div
              key={`default-slide-${current.id}-${currentSlide}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className={`absolute inset-0 w-full h-full flex items-center justify-between px-5 pt-4 pb-6 bg-gradient-to-r ${current.bgGradient} overflow-hidden`}
            >
              {/* Subtle Ambient Glow */}
              <div className={`absolute -top-12 -left-12 w-48 h-48 ${current.glowColor} rounded-full blur-3xl pointer-events-none`} />

              {/* Left Text Block */}
              <div className="relative z-10 w-[58%] flex flex-col justify-center items-start pr-1">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${current.badgeColor} text-[9px] tracking-wider uppercase font-semibold ${current.badgeTextColor} mb-2 backdrop-blur-sm`}>
                  <span>{current.badgeEmoji}</span>
                  <span>{current.badgeText}</span>
                </div>

                <h2 className="font-serif text-[21px] sm:text-[23px] font-bold leading-[1.18] tracking-tight text-[#FFF9F5]">
                  {current.title1} <br />
                  <span className={current.title2Italic ? 'italic font-normal font-serif text-[#F8ECE3]' : ''}>
                    {current.title2}
                  </span>
                </h2>

                <p className="text-[11.5px] sm:text-[12px] text-[#D8CEC4] font-normal mt-1.5 mb-3.5 leading-snug line-clamp-2">
                  {current.subtitle}
                </p>

                <motion.button
                  type="button"
                  onClick={() => handleSlideAction(current)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#E5A970] to-[#D49A5E] hover:brightness-105 text-[#181411] px-4 py-2 rounded-full font-bold text-[11px] uppercase tracking-wider shadow-md active:scale-95 transition-transform cursor-pointer"
                >
                  <span>{current.ctaText || 'ORDER NOW'}</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </motion.button>
              </div>

              {/* Right Cake Visual */}
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-[48%] h-[90%] flex items-center justify-center pointer-events-none">
                <motion.div 
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative w-44 h-44 drop-shadow-[0_16px_22px_rgba(0,0,0,0.7)] flex items-center justify-center"
                >
                  <img
                    src={current.imageUrl}
                    alt={current.title}
                    className="w-full h-full object-contain rounded-full transform scale-105"
                    loading="eager"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/images/stitch/hero-cake.png';
                    }}
                  />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Prev / Next Buttons */}
      {slideCount > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              paginate(-1);
            }}
            aria-label="Previous Slide"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              paginate(1);
            }}
            aria-label="Next Slide"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Bottom Carousel Indicators with Smooth Transitions */}
      {slideCount > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 z-20">
          {slides.map((s, index) => {
            const isActive = index === currentSlide;
            return (
              <button
                key={`indicator-${s.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSlide([index, index > currentSlide ? 1 : -1]);
                }}
                aria-label={`Slide ${index + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive ? 'w-7 bg-[#E5A970]' : 'w-1.5 bg-white/35 hover:bg-white/50'
                }`}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
