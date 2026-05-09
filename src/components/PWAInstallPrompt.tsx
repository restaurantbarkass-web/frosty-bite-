import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Lottie from 'lottie-react';
import { usePWA } from '../hooks/usePWA';

// Using a similar animation to the one requested
const INSTALL_ANIM_URL = "https://assets2.lottiefiles.com/packages/lf20_myejiggj.json";

export const PWAInstallPrompt: React.FC = () => {
  const { install, isStandalone, isInstallable } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalledState, setIsInstalledState] = useState(false);
  const [animationData, setAnimationData] = useState<any>(null);

  useEffect(() => {
    // Fetch animation data with error handling
    const fetchAnim = async () => {
      try {
        const res = await fetch(INSTALL_ANIM_URL);
        if (!res.ok) throw new Error('Failed to fetch Lottie');
        const data = await res.json();
        setAnimationData(data);
      } catch (err) {
        console.warn("Lottie fetch error:", err);
      }
    };
    fetchAnim();

    // Show prompt after a delay if installable and not standalone
    if (isInstallable && !isStandalone) {
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isStandalone]);

  const handleInstallClick = async () => {
    if (navigator.vibrate) navigator.vibrate(20);

    if (isStandalone) {
      window.location.reload();
      return;
    }

    await install();
    // If we're successful, the hook state will update or we can assume success if no error
  };

  // Listen for appinstalled globally to show success state in the button
  useEffect(() => {
    const handleInstalled = () => {
      setIsInstalledState(true);
      setTimeout(() => setIsVisible(false), 2000);
    };
    window.addEventListener('appinstalled', handleInstalled);
    return () => window.removeEventListener('appinstalled', handleInstalled);
  }, []);

  if (!isVisible && !isInstalledState) return null;

  return (
    <AnimatePresence>
      {(isVisible || isInstalledState) && (
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
