import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import installAnim from '../assets/offer.json'; // Reusing or using a gift-like anim for "getting" the app

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed or dismissed
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                          localStorage.getItem('appInstalled') === 'true';
    const isDismissed = localStorage.getItem('installDismissed') === 'true';

    if (isAppInstalled) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      if (!isDismissed) {
        // Show after a short delay for better UX
        setTimeout(() => setIsVisible(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsVisible(false);
      localStorage.setItem('appInstalled', 'true');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('installDismissed', 'true');
  };

  const swipeHandlers = useSwipeable({
    onSwipedDown: handleDismiss,
    onSwipedRight: handleDismiss,
    preventScrollOnSwipe: true,
  });

  if (isInstalled || !isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-8 md:w-96"
          {...swipeHandlers}
        >
          <div className="relative overflow-hidden rounded-3xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20 shrink-0">
                  <Lottie 
                    animationData={installAnim} 
                    className="w-8 h-8" 
                    loop={true}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase italic tracking-wider leading-tight">Install Frosty Bite</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Faster orders & exclusive deals</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleInstall}
                  className="px-5 py-2.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                >
                  Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="p-2.5 text-white/20 hover:text-white transition-colors"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            {/* Hint for Swipe */}
            <div className="mt-3 flex justify-center opacity-20">
              <div className="w-12 h-1 rounded-full bg-white/50" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
