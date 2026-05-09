import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Lottie from 'lottie-react';

// Using a similar animation to the one requested
const INSTALL_ANIM_URL = "https://assets2.lottiefiles.com/packages/lf20_myejiggj.json";

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalledState, setIsInstalledState] = useState(false);
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // Fetch animation data
    fetch(INSTALL_ANIM_URL)
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error("Lottie fetch error:", err));

    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches ||
             (window.navigator as any).standalone === true;
    };
    
    setIsStandalone(checkStandalone());

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!checkStandalone()) setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsInstalledState(true);
      setTimeout(() => setIsVisible(false), 2000);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (navigator.vibrate) navigator.vibrate(20);

    if (isStandalone) {
      window.location.reload();
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalledState(true);
        setTimeout(() => setIsVisible(false), 2000);
      }
      setDeferredPrompt(null);
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert("To install: Tap Share then 'Add to Home Screen' (on Safari).");
      } else {
        alert("Install option not available yet. Please interact with the site more or check browser settings.");
      }
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          className="fixed bottom-24 md:bottom-10 left-1/2 z-[10000]"
        >
          <button
            onClick={handleInstallClick}
            className={`
              flex items-center gap-4 px-8 py-4 rounded-full font-black text-white shadow-2xl transition-all active:scale-95
              backdrop-blur-2xl border border-white/10 group
              ${isInstalledState 
                ? 'bg-gradient-to-r from-green-500 to-emerald-400 shadow-green-500/30' 
                : 'bg-black/40 shadow-black/40 hover:scale-105 hover:bg-black/60'
              }
            `}
          >
            {animationData && !isInstalledState && (
              <div className="w-10 h-10 -ml-2 group-hover:scale-110 transition-transform">
                <Lottie animationData={animationData} loop={true} />
              </div>
            )}
            
            <span className="whitespace-nowrap text-sm tracking-[0.15em] uppercase italic">
              {isInstalledState ? 'Installed ✅' : (isStandalone ? 'Open App' : 'Get the App')}
            </span>

            {!isInstalledState && !isStandalone && (
                <div className="flex gap-1 items-center opacity-40 group-hover:opacity-100 transition-opacity">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse delay-75" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse delay-150" />
                </div>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
