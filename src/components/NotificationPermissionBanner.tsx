import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestForToken } from '../utils/messaging';

export const NotificationPermissionBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    // Check if permission is already granted or denied
    if (window.Notification.permission === 'default') {
      const dismissedUntil = localStorage.getItem('frostybite_push_prompt_dismissed_until');
      if (!dismissedUntil || Date.now() > Number(dismissedUntil)) {
        // Show after a subtle delay for optimal user experience
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 3500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const token = await requestForToken();
      if (token) {
        setIsVisible(false);
      } else {
        setIsVisible(false);
      }
    } catch (e) {
      console.warn('Error enabling notifications:', e);
      setIsVisible(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Dismiss for 3 days before soft prompting again
    localStorage.setItem('frostybite_push_prompt_dismissed_until', String(Date.now() + 3 * 86400000));
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          aria-label="Notification permissions prompt"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 left-6 sm:left-auto sm:max-w-md z-[80] bg-[#121212]/95 backdrop-blur-md border border-amber-500/30 rounded-2xl p-4 shadow-2xl shadow-black/80 text-white"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20 text-white">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Live Order Alerts
                </span>
              </div>
              <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                Stay updated on your sweetest moments 🍰
              </h4>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                Get instant push notifications as your treats are prepared, packed, and delivered to your doorstep.
              </p>

              <div className="flex items-center gap-2.5 mt-3.5">
                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Enable Live Alerts</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDismiss}
                  className="text-xs text-gray-400 hover:text-white py-2.5 px-3 rounded-xl hover:bg-white/5 transition-colors font-medium"
                >
                  Later
                </button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
