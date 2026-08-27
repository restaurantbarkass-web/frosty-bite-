import React, { useEffect, useState, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Banner } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Ticket, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface BannerCarouselProps {
  banners: Banner[];
  onApplyCoupon: (code: string) => void;
  onNavigate: (url: string) => void;
}

import { OptimizedImage } from './ui/OptimizedImage';

export const BannerCarousel: React.FC<BannerCarouselProps> = React.memo(({ banners, onApplyCoupon, onNavigate }) => {
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
    if (isPaused || banners.length <= 1) return;

    timeoutRef.current = setTimeout(nextSlide, 4000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [index, isPaused, banners.length]);

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
        className="relative h-[280px] sm:h-[320px] w-full overflow-hidden rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 bg-[#0A0A0A] touch-pan-y"
      >
        <div
          className="flex h-full w-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((banner, i) => (
            <div
              key={banner.id}
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
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent p-8 flex flex-col justify-end">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  key={index} // Re-animate on slide change
                  className="space-y-4"
                >
                  <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter leading-tight drop-shadow-2xl text-white">
                    {banner.title}
                  </h2>
                  
                  <div className="flex items-center justify-between">
                    {banner.auto_apply_coupon && (
                      <div className="flex items-center gap-2 bg-primary/20 px-4 py-2 rounded-xl border border-primary/30 backdrop-blur-md">
                         <Ticket size={16} className="text-primary" />
                         <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">{banner.auto_apply_coupon}</p>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-[1.25rem] bg-white/10 backdrop-blur-xl flex items-center justify-center text-white border border-white/20 group-hover:bg-primary group-hover:border-primary transition-all shadow-2xl">
                       <ArrowRight size={20} />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Premium Glint */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none group-hover:opacity-0 transition-opacity" />
            </div>
          ))}
        </div>

        {/* Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-20">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i === index ? "w-8 bg-primary shadow-[0_0_10px_rgba(255,82,0,0.5)]" : "w-1.5 bg-white/20 hover:bg-white/40"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

BannerCarousel.displayName = 'BannerCarousel';
