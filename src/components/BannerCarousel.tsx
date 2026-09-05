import React, { useEffect, useState, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Banner } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Ticket, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePerformanceTier } from '../context/PerformanceTierContext';
import { OptimizedImage } from './ui/OptimizedImage';

interface BannerCarouselProps {
  banners: Banner[];
  onApplyCoupon: (code: string) => void;
  onNavigate: (url: string) => void;
}

export const BannerCarousel: React.FC<BannerCarouselProps> = React.memo(({ banners, onApplyCoupon, onNavigate }) => {
  const { reduceMotion } = usePerformanceTier();
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setIndex((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  useEffect(() => {
    if (isPaused || banners.length <= 1 || reduceMotion) return;

    // Slide in 2 seconds and loop
    timeoutRef.current = setTimeout(nextSlide, 2000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [index, isPaused, banners.length, reduceMotion]);

  const handlers = useSwipeable({
    onSwipedLeft: nextSlide,
    onSwipedRight: prevSlide,
    preventScrollOnSwipe: false,
    trackMouse: true,
    delta: 15
  });

  if (banners.length === 0) return null;

  return (
    <div 
      className="relative w-full perspective-1000"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div 
        {...handlers}
        className="relative h-[280px] sm:h-[320px] w-full overflow-hidden rounded-[2.5rem] shadow-xl border border-white/10 bg-[#0A0A0A] touch-pan-y"
      >
        <div
          className="flex h-full w-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((banner, i) => (
            <div
              key={banner.id ? `banner-${banner.id}` : `banner-${i}`}
              className="relative h-full w-full flex-shrink-0 cursor-pointer overflow-hidden group"
              onClick={() => {
                if (banner.redirect_url) onNavigate(banner.redirect_url);
                if (banner.auto_apply_coupon) onApplyCoupon(banner.auto_apply_coupon);
              }}
            >
              <OptimizedImage 
                src={banner.image_url} 
                alt={banner.title} 
                containerClassName="h-full w-full"
                className="h-full w-full object-cover transition-transform duration-[3000ms] group-hover:scale-110 brightness-75"
                priority={i === 0}
              />
              
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent p-6 sm:p-8 flex flex-col justify-end">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  key={`slide-title-${banner.id || i}-${index}`}
                  className="space-y-3"
                >
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tight leading-tight drop-shadow-2xl text-white">
                    {banner.title}
                  </h2>
                  
                  <div className="flex items-center justify-between">
                    {banner.auto_apply_coupon && (
                      <div className="flex items-center gap-2 bg-[#E76A54]/20 px-3.5 py-1.5 rounded-xl border border-[#E76A54]/30 backdrop-blur-md">
                         <Ticket size={16} className="text-[#E76A54]" />
                         <p className="text-[11px] font-black text-[#E76A54] uppercase tracking-wider">{banner.auto_apply_coupon}</p>
                      </div>
                    )}
                    
                    <button className="flex items-center gap-2 text-white/90 text-xs font-black uppercase tracking-wider group-hover:text-[#E76A54] transition-colors ml-auto">
                      <span>Order Now</span>
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </motion.div>
              </div>
            </div>
          ))}
        </div>

        {/* Carousel Indicators */}
        {banners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 z-20">
            {banners.map((b, i) => (
              <button
                key={b.id || i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-6 bg-[#E76A54]" : "w-1.5 bg-white/40 hover:bg-white/60"
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

BannerCarousel.displayName = 'BannerCarousel';
export default BannerCarousel;
