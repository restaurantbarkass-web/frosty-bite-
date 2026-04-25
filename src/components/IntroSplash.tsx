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
    return () => {
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1, ease: "easeInOut" }}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden cursor-pointer"
      onClick={onComplete}
    >
      {/* Background Video */}
      <div className="absolute inset-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-105"
        >
          <source src="https://www.image2url.com/r2/default/videos/1777129733458-51f20911-d45e-4ad3-acc5-92796570d181.mp4" type="video/mp4" />
        </video>
        {/* Cinematic Overlays */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
      </div>

      {/* Brand Overlay */}
      <div className="relative z-10 text-center px-4">
        <AnimatePresence>
          {showContent && (
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="flex justify-center mb-8">
                  <Logo size="lg" />
                </div>
                
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-2 italic">
                  FROSTY <span className="text-primary NOT-italic">BITE</span>
                </h1>
                <p className="text-primary/80 font-bold tracking-[0.4em] uppercase text-sm md:text-base">
                  Artisan Bakery & Frozen Treats
                </p>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onComplete}
                className="group relative px-10 py-5 bg-white text-black font-black rounded-full text-lg tracking-widest uppercase flex items-center gap-3 mx-auto shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-primary/40 transition-all"
              >
                <span>Discover</span>
                <ArrowRight className="group-hover:translate-x-2 transition-transform" />
              </motion.button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.05 }}
        className="absolute bottom-10 left-10 text-white font-black text-8xl pointer-events-none select-none"
      >
        2026
      </motion.div>
    </motion.div>
  );
};
