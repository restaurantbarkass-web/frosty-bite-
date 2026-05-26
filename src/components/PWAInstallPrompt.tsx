import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Share2, 
  PlusSquare, 
  MoreVertical, 
  Smartphone, 
  Laptop, 
  Sparkles,
  Download
} from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export const PWAInstallPrompt: React.FC = () => {
  const { install, isStandalone, isInstallable } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalledState, setIsInstalledState] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [installMethod, setInstallMethod] = useState<'ios' | 'manual' | null>(null);

  useEffect(() => {
    // Show prompt automatically after a short delay if not standalone, to encourage standalone app usage
    if (!isStandalone) {
      const timer = setTimeout(() => {
        // Only show if the user hasn't closed it in this session
        const closed = sessionStorage.getItem('pwa_prompt_closed');
        if (!closed) {
          setIsVisible(true);
        }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (navigator.vibrate) navigator.vibrate(20);

    const result = await install();
    if (result === 'native') {
      // Browser handles the install dialog natively
    } else if (result === 'ios') {
      setInstallMethod('ios');
      setShowModal(true);
    } else if (result === 'manual') {
      setInstallMethod('manual');
      setShowModal(true);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_prompt_closed', 'true');
  };

  // Listen for native app installed notifications
  useEffect(() => {
    const handleInstalled = () => {
      setIsInstalledState(true);
      setTimeout(() => {
        setIsVisible(false);
        setShowModal(false);
      }, 3000);
    };
    window.addEventListener('appinstalled', handleInstalled);
    return () => window.removeEventListener('appinstalled', handleInstalled);
  }, []);

  // Determine user device OS for standard help instructions
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  if (isStandalone) return null; // App is already running in standalone mode

  if (!isVisible && !isInstalledState) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {(isVisible || isInstalledState) && (
          <motion.div
            initial={{ opacity: 0, y: 70, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 70, x: '-55%' }}
            className="fixed bottom-28 md:bottom-12 left-1/2 z-[9999] flex items-center gap-1.5"
          >
            <button
              onClick={handleInstallClick}
              className={`
                flex items-center gap-3 px-6 py-3.5 rounded-full font-black text-xs uppercase tracking-widest text-white shadow-2xl transition-all active:scale-95
                backdrop-blur-2xl border border-white/10 group
                ${isInstalledState 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-400 border-green-400/20 shadow-green-500/20' 
                  : 'bg-zinc-950/90 border-white/10 hover:border-primary/40 text-white hover:scale-105'
                }
              `}
            >
              <div className="relative">
                <Download size={14} className={`text-primary group-hover:scale-110 transition-transform ${isInstalledState ? 'text-white' : ''}`} />
                <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                </span>
              </div>
              
              <span className="font-extrabold flex items-center gap-1">
                {isInstalledState ? 'Installed Successfully!' : 'Launch Standalone App'}
              </span>
            </button>

            {!isInstalledState && (
              <button 
                onClick={handleClose}
                className="p-3.5 bg-zinc-950/90 border border-white/10 rounded-full text-zinc-400 hover:text-white hover:border-white/20 active:scale-90 transition-all shadow-2xl"
                aria-label="Dismiss standalone app invitation"
              >
                <X size={12} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Standalone Installation Instructions Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-[32px] p-6 text-white overflow-hidden shadow-2xl"
            >
              {/* Aurora background accent */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              
              {/* Header */}
              <div className="flex items-start justify-between mb-6 relative">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-primary">
                    <Sparkles size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-tight italic">Frosty Bite App</h3>
                    <p className="text-zinc-500 text-xs uppercase tracking-wider font-extrabold">Open In Standalone Mode</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-xl text-zinc-400 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Instructions Content */}
              <div className="space-y-6 relative mb-6">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Run Frosty Bite as a standalone desktop or mobile application to enjoy fluid animations, native-like fullscreen tracking, and optimal culinary experiences without browser tabs.
                </p>

                {installMethod === 'ios' || isIOS ? (
                  // iOS Safari instructions
                  <div className="space-y-4">
                    <div className="p-3.5 bg-white/5 border border-white/5 rounded-2xl flex gap-3 text-xs">
                      <Smartphone size={16} className="text-primary mt-0.5" />
                      <span className="text-zinc-300 font-bold uppercase tracking-wider">iOS App Installation</span>
                    </div>

                    <div className="space-y-3.5 pl-2">
                      <div className="flex items-start gap-4">
                        <div className="w-6.5 h-6.5 rounded-full bg-white/5 border border-white/10 text-xs font-black flex items-center justify-center text-primary flex-shrink-0">
                          1
                        </div>
                        <div className="text-sm text-zinc-300">
                          Open this store inside your iOS <strong className="text-white font-medium">Safari</strong> mobile browser.
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-6.5 h-6.5 rounded-full bg-white/5 border border-white/10 text-xs font-black flex items-center justify-center text-primary flex-shrink-0">
                          2
                        </div>
                        <div className="text-sm text-zinc-300">
                          Tap the <strong className="text-white font-semibold inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5"><Share2 size={12} className="text-sky-400" /> Share button</strong> in Safari's bottom tab bar.
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-6.5 h-6.5 rounded-full bg-white/5 border border-white/10 text-xs font-black flex items-center justify-center text-primary flex-shrink-0">
                          3
                        </div>
                        <div className="text-sm text-zinc-300">
                          Scroll down and select <strong className="text-white font-semibold inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5"><PlusSquare size={12} className="text-primary" /> Add to Home Screen</strong>.
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-6.5 h-6.5 rounded-full bg-white/5 border border-white/10 text-xs font-black flex items-center justify-center text-primary flex-shrink-0">
                          4
                        </div>
                        <div className="text-sm text-zinc-300">
                          Launch <strong className="text-white font-semibold">Frosty Bite</strong> from your iPhone & iPad home screen!
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Desktop or Android Chrome/Edge instructions
                  <div className="space-y-4">
                    <div className="p-3.5 bg-white/5 border border-white/5 rounded-2xl flex gap-3 text-xs">
                      <Laptop size={16} className="text-primary mt-0.5" />
                      <span className="text-zinc-300 font-bold uppercase tracking-wider">Browser App Installation</span>
                    </div>

                    <div className="space-y-3.5 pl-2">
                      <div className="flex items-start gap-4">
                        <div className="w-6.5 h-6.5 rounded-full bg-white/5 border border-white/10 text-xs font-black flex items-center justify-center text-primary flex-shrink-0">
                          1
                        </div>
                        <div className="text-sm text-zinc-300">
                          Locate the <strong className="text-white font-medium">App Install Icon</strong> standardly found in your browser's horizontal address bar (usually a downward-arrow, screen icon, or `⊕` symbol).
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-6.5 h-6.5 rounded-full bg-white/5 border border-white/10 text-xs font-black flex items-center justify-center text-primary flex-shrink-0">
                          2
                        </div>
                        <div className="text-sm text-zinc-300 flex-1">
                          If not visible in the address bar, click your browser's menu button <strong className="text-white inline-flex items-center gap-0.5 bg-white/5 px-1 rounded border border-white/5 border-dashed"><MoreVertical size={11} /> (three dots)</strong> at the upper-right section.
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-6.5 h-6.5 rounded-full bg-white/5 border border-white/10 text-xs font-black flex items-center justify-center text-primary flex-shrink-0">
                          3
                        </div>
                        <div className="text-sm text-zinc-300">
                          Select <strong className="text-white font-semibold">Install Frosty Bite</strong> or <strong className="text-white font-semibold">Add / Save to Device</strong> from the dropdown checklist.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 relative">
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full py-3 bg-primary text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:scale-102 hover:brightness-110 active:scale-98 transition-all shadow-xl shadow-primary/20"
                >
                  Got It, Thanks!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
