import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useBoot, BootState } from '../context/BootContext';
import { Logo } from './Logo';

interface IntroSplashProps {
  onComplete: () => void;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete }) => {
  const { bootState, progress, errorMessage, retryBoot } = useBoot();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // When boot completes, we can trigger the onComplete auto-forward after 800ms
  // to give a satisfying finish animation without requiring user interaction, but
  // also allowing them to click immediately if they want.
  useEffect(() => {
    if (bootState === BootState.READY) {
      const autoTimer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(autoTimer);
    }
  }, [bootState, onComplete]);

  const getStatusLabel = (state: BootState) => {
    switch (state) {
      case BootState.BOOTING:
        return 'Spinning up premium engine...';
      case BootState.CHECKING_AUTH:
        return 'Restoring unified user session...';
      case BootState.CHECKING_PROFILE:
        return 'Synchronizing custom confectionery dashboard...';
      case BootState.CHECKING_SETTINGS:
        return 'Sensing delivery area & configurations...';
      case BootState.CHECKING_CACHE:
        return 'Pre-warming fresh cakes & confectionery caches...';
      case BootState.READY:
        return 'Gourmet experience ready.';
      case BootState.ERROR:
        return 'Confectionery offline. Please check connection.';
      default:
        return 'Crafting excellence...';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden"
    >
      {/* Background Fallback Frame and Video */}
      <div className="absolute inset-0">
        <img 
          src="https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1600" 
          alt="Premium Bakery" 
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          referrerPolicy="no-referrer"
        />
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1600"
          className="w-full h-full object-cover scale-105 relative z-10"
        >
          <source src="https://www.image2url.com/r2/default/videos/1777129733458-51f20911-d45e-4ad3-acc5-92796570d181.mp4" type="video/mp4" />
        </video>
        {/* Cinematic Overlays */}
        <div className="absolute inset-0 bg-black/60 z-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 z-20" />
      </div>

      {/* Brand Overlay */}
      <div className="relative z-30 text-center px-4 w-full max-w-lg mx-auto">
        <AnimatePresence>
          {showContent && (
            <div className="space-y-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div className="flex flex-col items-center">
                  <Logo size="lg" className="mb-6 scale-110" />
                  
                  <h1 className="text-6xl md:text-8xl font-serif italic text-white tracking-tighter leading-none mb-2 select-none">
                    Frosty Bite
                  </h1>
                  <p className="text-primary font-bold tracking-[0.5em] uppercase text-xs md:text-sm select-none">
                    Artisan Bakery & Frozen Treats
                  </p>
                </div>

                {/* CENTRAL BOOT MANAGER STATS & PROGRESS PIPELINE */}
                <div className="pt-4 max-w-xs mx-auto space-y-4">
                  {bootState === BootState.ERROR ? (
                    <div className="space-y-3">
                      <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                        ⚠️ {errorMessage || 'Initialization Error'}
                      </p>
                      <button
                        onClick={retryBoot}
                        className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 text-xs font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                      >
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Retry Boot</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Premium Horizontal Progress Rail */}
                      <div className="relative w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.4, ease: 'easeOut' }}
                          className="absolute top-0 bottom-0 left-0 bg-primary shadow-[0_0_8px_rgba(249,115,22,0.6)]"
                        />
                      </div>
                      
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/50">
                          {getStatusLabel(bootState)}
                        </span>
                        <span className="text-[10px] font-mono font-black text-primary/90">
                          {progress}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* READY ACTION BUTTON */}
                {bootState === BootState.READY && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onComplete}
                    className="group relative px-10 py-4.5 bg-white text-black font-black rounded-full text-sm tracking-widest uppercase flex items-center gap-3 mx-auto shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-primary/40 transition-all"
                  >
                    <span>Enter Patisserie</span>
                    <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                  </motion.button>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Branding Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.05 }}
        className="absolute bottom-10 left-10 text-white font-black text-7xl pointer-events-none select-none font-serif italic"
      >
        Est. 2026
      </motion.div>
    </motion.div>
  );
};
