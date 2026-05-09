import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app already installed
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsStandalone(true);
      // We still show the button as "Open App" if standalone logic dictates, 
      // but usually PWAs hide this once inside.
      setIsVisible(false);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
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
    if (isStandalone) {
      window.location.href = "/";
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback for iOS or already installed but prompt lost
      alert("Install option not available yet. On iOS, use Share > Add to Home Screen.");
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          id="appInstallContainer"
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50, x: '-50%' }}
          className="fixed bottom-6 left-1/2 z-[9999]"
        >
          <button
            id="installAppBtn"
            onClick={handleInstallClick}
            className="px-8 py-4 rounded-full font-semibold text-white shadow-2xl transition-all active:scale-95 bg-gradient-to-r from-[#ff7b00] to-[#ff0055] shadow-[#ff0055]/35 backdrop-blur-md border border-white/10"
          >
            <span id="btnText">{isStandalone ? 'Open App' : 'Add to Home Screen'}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
