import { useState, useEffect } from 'react';

let globalDeferredPrompt: any = null;
let listeners: Array<(prompt: any) => void> = [];

export const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      return window.matchMedia('(display-mode: standalone)').matches ||
             (window.navigator as any).standalone === true ||
             window.location.search.includes('standalone=true');
    };
    
    setIsStandalone(checkStandalone());

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches || checkStandalone());
    };

    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch (_) {
      try {
        (mediaQuery as any).addListener(handleMediaChange);
      } catch (_) {}
    }

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
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    const onUpdate = (prompt: any) => setDeferredPrompt(prompt);
    listeners.push(onUpdate);

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch (_) {
        try {
          (mediaQuery as any).removeListener(handleMediaChange);
        } catch (_) {}
      }
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      listeners = listeners.filter(l => l !== onUpdate);
    };
  }, []);

  const install = async (): Promise<'native' | 'ios' | 'manual' | 'cancelled'> => {
    try {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          globalDeferredPrompt = null;
          setDeferredPrompt(null);
          listeners.forEach(l => l(null));
          setIsStandalone(true);
          return 'native';
        }
        return 'cancelled';
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        if (isIOS) {
          return 'ios';
        }
        return 'manual';
      }
    } catch (err) {
      console.warn('PWA install prompt issue:', err);
      return 'manual';
    }
  };

  return { deferredPrompt, isStandalone, install, isInstallable: !!deferredPrompt };
};
