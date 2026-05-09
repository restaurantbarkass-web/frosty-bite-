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

    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                     (window.navigator as any).standalone === true;
    
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!standalone) setIsVisible(true);
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
      window.location.href = "/";
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
      alert("Install option not available yet. On iOS, use Share > Add to Home Screen.");
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        exit={{ opacity: 0, y: 30, x: '-50%' }}
        className="fixed bottom-6 left-1/2 z-[9999]"
      >
        <button
          onClick={handleInstallClick}
          className={`
            flex items-center gap-3 px-6 py-3.5 rounded-full font-semibold text-white shadow-2xl transition-all active:scale-95
            backdrop-blur-xl border border-white/10
            ${isInstalledState 
              ? 'bg-gradient-to-r from-green-500 to-emerald-400 shadow-green-500/20' 
              : 'bg-white/10 shadow-black/20 hover:scale-105'
            }
          `}
        >
          {animationData && !isInstalledState && (
            <div className="w-10 h-10 -ml-2">
              <Lottie animationData={animationData} loop={true} />
            </div>
          )}
          
          <span className="whitespace-nowrap text-base tracking-tight">
            {isInstalledState ? 'Installed ✅' : (isStandalone ? 'Open App' : 'Install App')}
          </span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
