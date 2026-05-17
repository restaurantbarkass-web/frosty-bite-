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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.12)_0%,transparent_60%)]" />

      {/* Brand Overlay */}
      <div className="relative z-10 flex flex-col items-center">
        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 2.5, 
                ease: [0.16, 1, 0.3, 1] 
              }}
              className="relative flex flex-col items-center"
            >
              {/* Outer Pulsing Glow behind Logo */}
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.15, 0.3, 0.15]
                }}
                transition={{ 
                  duration: 5, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-primary blur-[100px] rounded-full"
              />
              
              <Logo size="lg" iconOnly className="relative z-20 scale-[2.5] md:scale-[3.5] shadow-[0_0_60px_rgba(249,115,22,0.1)]" />
              
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
                className="mt-32 space-y-4 text-center"
              >
                <h1 className="text-white font-display text-4xl md:text-6xl tracking-[0.4em] uppercase opacity-95">
                  Frosty Bite
                </h1>
                <div className="h-[1px] w-32 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mt-6 opacity-30" />
                <p className="text-primary/50 font-bold tracking-[0.8em] uppercase text-[9px] md:text-xs pt-4">
                  Artisan Bakery & Frozen Treats
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Luxury Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showContent ? 0.3 : 0 }}
        transition={{ delay: 3, duration: 1 }}
        className="absolute bottom-16 text-white/30 text-[9px] tracking-[0.6em] uppercase font-bold"
      >
        Tap to Begin
      </motion.div>
    </motion.div>
  );
};
