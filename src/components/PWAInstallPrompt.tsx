import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import installAnim from '../assets/offer.json';
import { Share, ExternalLink } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIOSDevice = [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
    
    setIsIOS(isIOSDevice);

    // Check if already installed or dismissed
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                          localStorage.getItem('appInstalled') === 'true';
    const isDismissed = localStorage.getItem('installDismissed') === 'true';

    if (isAppInstalled) {
      setIsInstalled(true);
      return;
    }

    // Handler for Android/Chrome/Edge
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      if (!isDismissed) {
        setTimeout(() => setIsVisible(true), 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsVisible(false);
      localStorage.setItem('appInstalled', 'true');
    });

    // Fallback for iOS since it doesn't fire beforeinstallprompt
    if (isIOSDevice && !isDismissed && !isAppInstalled) {
      setTimeout(() => setIsVisible(true), 4000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      // iOS doesn't support programmatic trigger, just keep the prompt visible with instructions
      return;
    }

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
          <div className="relative overflow-hidden rounded-[2.5rem] bg-black/80 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none" />
            
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-3xl bg-primary/20 flex items-center justify-center border border-primary/20 shrink-0 shadow-inner">
                  <Lottie 
                    animationData={installAnim} 
                    className="w-10 h-10" 
                    loop={true}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-black text-white uppercase italic tracking-wider leading-tight">Fast Orders Await</h3>
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em] mt-0.5">Install app for instant access</p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-2 text-white/10 hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {isIOS ? (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Share size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-white/80 font-bold leading-snug">
                        Tap <span className="text-blue-400">"Share"</span> then <span className="text-blue-400">"Add to Home Screen"</span>
                      </p>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1">Available in Safari on iPhone</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleInstall}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all active:scale-95 shadow-lg shadow-primary/40 flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} strokeWidth={3} />
                    <span>Get App Now</span>
                  </button>
                </div>
              )}
            </div>

            {/* Hint for Swipe */}
            <div className="mt-4 flex justify-center opacity-10">
              <div className="w-16 h-1.5 rounded-full bg-white" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
