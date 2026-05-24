import { useState, useEffect } from 'react';

let globalDeferredPrompt: any = null;
let listeners: Array<(prompt: any) => void> = [];

export const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches ||
             (window.navigator as any).standalone === true;
    };
    
    setIsStandalone(checkStandalone());

    const handlePrompt = (e: any) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setDeferredPrompt(e);
      listeners.forEach(l => l(e));
    };

    const handleInstalled = () => {
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      listeners.forEach(l => l(null));
    };

    // If we're already standalone, we don't need the prompt
    if (checkStandalone()) return;

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    const onUpdate = (prompt: any) => setDeferredPrompt(prompt);
    listeners.push(onUpdate);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      listeners = listeners.filter(l => l !== onUpdate);
    };
  }, []);

  const install = async () => {
    try {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          listeners.forEach(l => l(null));
        }
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        if (isIOS) {
          alert("To install: Tap Share then 'Add to Home Screen' (on Safari).");
        } else {
          alert("Install option not available yet. Please interact with the site more or check browser settings.");
        }
      }
    } catch (err) {
      console.warn('PWA install prompt was cancelled or failed:', err);
    }
  };

  return { deferredPrompt, isStandalone, install, isInstallable: !!deferredPrompt };
};
