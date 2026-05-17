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
      transition={{ duration: 1.5, ease: [0.43, 0.13, 0.23, 0.96] }}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden cursor-pointer"
      onClick={onComplete}
    >
      {/* Background Video - Cinematic & Moody */}
      <div className="absolute inset-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-110 brightness-[0.4]"
        >
          <source src="https://www.image2url.com/r2/default/videos/1777129733458-51f20911-d45e-4ad3-acc5-92796570d181.mp4" type="video/mp4" />
        </video>
        {/* Cinematic Overlays for Depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      </div>

      {/* Brand Overlay */}
      <div className="relative z-10 flex flex-col items-center max-w-4xl px-4">
        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2 }}
              className="relative flex flex-col items-center"
            >
              {/* Circular Logo - Matching the image */}
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative mb-12"
              >
                <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-black border-2 border-white/20 p-2 shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
                  <img 
                    src="https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg" 
                    alt="Frosty Bite Logo" 
                    className="w-full h-full object-cover rounded-full"
                  />
                  {/* Subtle inner glow */}
                  <div className="absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgba(249,115,22,0.2)]" />
                </div>
              </motion.div>
              
              {/* Signature Large Typography */}
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 1.5, ease: "easeOut" }}
                className="text-center space-y-6"
              >
                <h1 className="text-7xl md:text-[140px] leading-tight font-serif italic tracking-tighter flex items-baseline justify-center gap-2">
                  <span className="text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">Frosty</span>
                  <span className="text-primary font-sans font-black not-italic drop-shadow-[0_10px_30px_rgba(249,115,22,0.3)]">Bite</span>
                </h1>
                
                <p className="text-white/60 font-bold tracking-[0.6em] uppercase text-xs md:text-sm max-w-md mx-auto leading-relaxed">
                  Artisan Bakery & Frozen Treats Crafted For Extraordinary Moments
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Interaction Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: showContent ? 0.4 : 0 }}
        transition={{ delay: 3, duration: 1.5 }}
        className="absolute bottom-12 flex flex-col items-center gap-4"
      >
        <div className="w-[1px] h-12 bg-gradient-to-b from-transparent via-white/50 to-transparent" />
        <span className="text-white/40 text-[10px] tracking-[0.8em] uppercase font-bold animate-pulse">
          Begin Experience
        </span>
      </motion.div>
    </motion.div>
  );
};
