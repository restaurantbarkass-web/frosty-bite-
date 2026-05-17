import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import { Logo } from './Logo';

interface IntroSplashProps {
  onComplete: () => void;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete }) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 1500);
    // Auto-complete after 5 seconds
    const autoTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] }}
      className="fixed inset-0 z-[1000] bg-[#000000] flex items-center justify-center overflow-hidden cursor-pointer"
      onClick={onComplete}
    >
      {/* Cinematic Vignette */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] opacity-80" />
      
      {/* Subtle Radial Glow in Center */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.08)_0%,transparent_60%)]" />

      {/* Brand Overlay */}
      <div className="relative z-10 flex flex-col items-center">
        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 2, 
                ease: [0.16, 1, 0.3, 1] 
              }}
              className="relative"
            >
              {/* Outer Pulsing Glow */}
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-primary blur-[80px] rounded-full scale-125"
              />
              
              {/* The Logo with Metallic Shine (Logo component handles internal shimmer) */}
              <Logo size="lg" iconOnly className="relative z-20 scale-[2.5] md:scale-[3]" />
              
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 1.5 }}
                className="mt-32 space-y-3 text-center"
              >
                <h1 className="text-white font-display text-4xl md:text-6xl tracking-[0.4em] uppercase opacity-95">
                  Frosty Bite
                </h1>
                <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mt-6 opacity-50" />
                <p className="text-primary/60 font-bold tracking-[0.6em] uppercase text-[10px] md:text-xs pt-2">
                  Artisan Bakery & Frozen Treats
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interaction Hint (Discover replaced with subtle hint if needed, or just auto-timer) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showContent ? 0.3 : 0 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="absolute bottom-12 text-white/40 text-[10px] tracking-[0.5em] uppercase font-bold"
      >
        Tap to Begin
      </motion.div>
    </motion.div>
  );
};
