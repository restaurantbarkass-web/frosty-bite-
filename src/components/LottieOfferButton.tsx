import React, { useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import offerAnim from '../assets/offer.json';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';

interface LottieOfferButtonProps {
  active: boolean;
  onClick?: () => void;
  className?: string;
}

export const LottieOfferButton: React.FC<LottieOfferButtonProps> = ({ active, onClick, className }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Floating animation for the icon
    gsap.to(iconRef.current, {
      y: -4,
      scale: 1.05,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    // Mesh Gradient Animation (Active Only)
    if (active && meshRef.current) {
      gsap.to(meshRef.current, {
        rotate: 360,
        duration: 15,
        repeat: -1,
        ease: "none"
      });
      
      // Secondary scale/pulse for mesh
      gsap.to(meshRef.current, {
        scale: 1.4,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    }
  }, [active]);

  const handleInternalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tl = gsap.timeline();
    tl.to(btnRef.current, { 
      scale: 0.85, 
      duration: 0.1 
    }).to(btnRef.current, { 
      scale: 1, 
      duration: 0.6, 
      ease: "elastic.out(1, 0.3)" 
    });
    
    gsap.fromTo(iconRef.current, 
      { rotate: 0 }, 
      { rotate: 12, duration: 0.2, yoyo: true, repeat: 1 }
    );

    if (onClick) onClick();
  };

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <button
        ref={btnRef}
        onClick={handleInternalClick}
        className={cn(
          "relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-[2rem] transition-all duration-700 overflow-hidden",
          active 
            ? "bg-black shadow-[0_20px_50px_rgba(249,115,22,0.4)] border border-white/20"
            : "bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20"
        )}
      >
        {/* Premium Mesh Gradient Background (Active Only) */}
        {active && (
          <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
            <div 
              ref={meshRef}
              className="absolute -inset-[100%] bg-gradient-to-tr from-orange-400 via-rose-500 to-amber-300 opacity-90 blur-[20px]"
            />
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.4),transparent_50%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
          </div>
        )}

        {/* Static Background for Inactive */}
        {!active && (
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
        )}

        {/* Lottie Animation */}
        <div ref={iconRef} className="relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
          <Lottie
            animationData={offerAnim}
            loop={true}
            autoplay={true}
            className="w-10 h-10 sm:w-12 sm:h-12 transform scale-125"
          />
        </div>

        {/* Small "NEW" Badge */}
        <AnimatePresence>
          {!active && (
            <motion.span 
              initial={{ scale: 0, x: 10 }}
              animate={{ scale: 1, x: 0 }}
              className="absolute -top-1 -right-1 bg-primary text-white text-[7px] font-black italic px-2 py-0.5 rounded-full shadow-lg border border-white/20 tracking-tighter"
            >
              ELITE
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <span className={cn(
        "text-[8px] mt-2 uppercase font-black tracking-[0.3em] transition-all duration-500",
        active ? "text-primary italic translate-y-0.5" : "text-zinc-500"
      )}>
        Offers
      </span>
    </div>
  );
};
