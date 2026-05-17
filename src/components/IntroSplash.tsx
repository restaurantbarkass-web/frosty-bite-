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
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1, ease: "easeInOut" }}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden cursor-pointer"
      onClick={onComplete}
    >
      {/* Background is solid black from the main container */}

      {/* Brand Overlay */}
      <div className="relative z-10 text-center px-4">
        <AnimatePresence>
          {showContent && (
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="space-y-12"
              >
                <div className="flex flex-col items-center">
                  <div className="relative mb-8">
                    {/* Glowing Aura behind the logo */}
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.3, 0.1]
                      }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="absolute inset-0 bg-primary blur-[60px] rounded-full scale-150"
                    />
                    <Logo size="lg" className="relative z-10" />
                  </div>
                  
                    <h1 className="text-7xl md:text-9xl font-serif italic text-white tracking-tighter leading-none glow-text">
                      Frosty Bite
                    </h1>
                  <p className="text-primary/80 font-bold tracking-[0.4em] uppercase text-sm md:text-base">
                    Artisan Bakery & Frozen Treats
                  </p>
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onComplete}
                  className="group relative px-10 py-5 bg-white text-black font-black rounded-full text-lg tracking-widest uppercase flex items-center gap-3 mx-auto shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-primary/40 transition-all"
                >
                  <span>Discover</span>
                  <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                </motion.button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
