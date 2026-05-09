import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                     (window.navigator as any).standalone === true;
    
    setIsStandalone(standalone);

    if (standalone) {
      setIsVisible(true); // Still show the "Open App" button even in standalone for some users, or maybe hide based on logic
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
    // If app already installed → open app behavior
    if (isStandalone) {
      window.location.href = "/";
      return;
    }

    // Trigger install popup
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback for unsupported browsers/iOS
      alert("Install option not available yet. On iOS, use Safari's 'Add to Home Screen'.");
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        id="appInstallContainer"
        initial={{ opacity: 0, scale: 0.9, x: '-50%', y: 20 }}
        animate={{ opacity: 1, scale: 1, x: '-50%', y: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: '-50%', y: 20 }}
        className="fixed bottom-20 left-1/2 z-[9999]"
      >
        <button
          id="installAppBtn"
          onClick={handleInstallClick}
          className="install-btn px-8 py-4 rounded-full font-semibold text-white shadow-2xl transition-all active:scale-95 bg-gradient-to-r from-[#ff7b00] to-[#ff0055] shadow-[#ff0055]/35 hover:scale-105 backdrop-blur-md"
          style={{
            border: 'none',
            outline: 'none',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <span id="btnText">{isStandalone ? 'Open App' : 'Add to Home Screen'}</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
