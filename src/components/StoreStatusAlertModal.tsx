import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { liveAlertService, LiveAlertEvent } from '../services/liveAlertService';
import { useConfig } from '../context/ConfigContext';
import { 
  Sparkles, 
  ArrowRight, 
  LogOut, 
  ShoppingBag, 
  MapPin, 
  Clock, 
  Calendar,
  Phone, 
  Heart,
  ChevronRight,
  Coffee,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RESTAURANT_WHATSAPP } from '../constants';
import { Logo } from './Logo';
import { UNIVERSAL_LOGO_URL } from '../constants/logo';
import toast from 'react-hot-toast';

export const StoreStatusAlertModal: React.FC = () => {
  const { config } = useConfig();
  const [activeAlert, setActiveAlert] = useState<LiveAlertEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExited, setIsExited] = useState(false);
  const navigate = useNavigate();

  // RULE 4: WHEN STORE IS OPEN:
  // - NEVER display the closure popup
  // - Automatically allow customers to enter the normal homepage
  // - Immediately close if open
  useEffect(() => {
    if (config?.isOrderingOpen) {
      if (isOpen) {
        // Show reopening celebration toast when store reopens in real time
        const reopeningMsg = config.reopeningMessage || 'WE ARE BACK! 🎉 Frosty Bite Bakery is officially OPEN again! Your favourite cakes and desserts are waiting for you.';
        toast.success(reopeningMsg, {
          duration: 6000,
          icon: '🍰'
        });
      }
      setIsOpen(false);
      setActiveAlert(null);
      setIsExited(false);
      try {
        sessionStorage.removeItem('frostybite_closure_dismissed');
      } catch (e) {}
    }
  }, [config?.isOrderingOpen, config?.reopeningMessage, isOpen]);

  // Subscribe to real-time events over Supabase channel (<100ms)
  useEffect(() => {
    const unsubscribe = liveAlertService.subscribe((event) => {
      // RULE: When store opens, popup will NOT show!
      if (event.type === 'STORE_OPEN') {
        setIsOpen(false);
        setActiveAlert(null);
        setIsExited(false);
        try {
          sessionStorage.removeItem('frostybite_closure_dismissed');
        } catch (e) {}

        const msg = event.reopeningMessage || event.message || 'WE ARE BACK! 🎉 Frosty Bite Bakery is officially OPEN again!';
        toast.success(msg, { duration: 6000, icon: '🎉' });
        return;
      }

      // Show full-screen closure announcement for store closed or closing broadcast
      if (event.type === 'STORE_CLOSED' || event.type === 'CUSTOM_ANNOUNCEMENT') {
        setActiveAlert(event);
        setIsOpen(true);
        setIsExited(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Check if store is currently closed on initial cold start and user hasn't dismissed yet
  useEffect(() => {
    if (config && !config.isOrderingOpen) {
      let isDismissed = false;
      try {
        isDismissed = sessionStorage.getItem('frostybite_closure_dismissed') === 'true';
      } catch (e) {}

      if (!isDismissed && !isOpen) {
        const title = config.closureTitle || 'Taking a Little Break! ❤️';
        const reason = config.closureReason || config.storeClosedReason || 'Our bakery is temporarily closed while we prepare something special for you.';
        const message = config.closureMessage || "Thank you for your love and patience. We can't wait to serve you again.";
        const reopenDate = config.reopenDate || '';
        const reopenTime = config.reopenTime || '';
        const closureImage = config.closureImage || '';

        setActiveAlert({
          id: `initial-closed-${Date.now()}`,
          type: 'STORE_CLOSED',
          title,
          message,
          reason,
          reopenDate,
          reopenTime,
          closureTitle: title,
          closureMessage: message,
          closureImage,
          badge: '🔴 Store Temporarily Closed',
          timestamp: Date.now()
        });
        setIsOpen(true);
      }
    }
  }, [config?.isOrderingOpen, config?.closureTitle, config?.closureReason, config?.closureMessage, config?.reopenDate, config?.reopenTime, config?.closureImage, isOpen]);

  // BUTTON 1: CONTINUE EXPLORING
  const handleContinueExploring = useCallback(() => {
    try {
      sessionStorage.setItem('frostybite_closure_dismissed', 'true');
    } catch (e) {}
    setIsOpen(false);
    setActiveAlert(null);
    toast('Browsing mode active. Orders are temporarily paused.', {
      icon: '🛍️',
      duration: 4000
    });
  }, []);

  // BUTTON 2: EXIT APP
  const handleExitApp = useCallback(async () => {
    // 1. Android Capacitor App exit
    try {
      const { App } = await import('@capacitor/app');
      if (App && typeof App.exitApp === 'function') {
        await App.exitApp();
        return;
      }
    } catch (e) {
      // Not running in Capacitor or plugin unavailable
    }

    // 2. Web browser close attempt
    try {
      window.close();
    } catch (e) {}

    // 3. Fallback: If browser prevents tab close, show elegant exit screen
    setIsExited(true);
  }, []);

  const handleReenter = useCallback(() => {
    setIsExited(false);
    handleContinueExploring();
  }, [handleContinueExploring]);

  // CRITICAL: When store is open, popup will NEVER show
  if (config?.isOrderingOpen) {
    return null;
  }

  if (!isOpen && !isExited) {
    return null;
  }

  // Dynamic Content Resolution (never hardcoded)
  const displayTitle = activeAlert?.closureTitle || activeAlert?.title || config?.closureTitle || 'Taking a Little Break! ❤️';
  const displayReason = activeAlert?.closureReason || activeAlert?.reason || config?.closureReason || config?.storeClosedReason || 'Our bakery is temporarily closed while we prepare something special for you.';
  const displayMessage = activeAlert?.closureMessage || activeAlert?.message || config?.closureMessage || "Thank you for your love and patience. We can't wait to serve you again.";
  const displayReopenDate = activeAlert?.reopenDate || config?.reopenDate || '';
  const displayReopenTime = activeAlert?.reopenTime || config?.reopenTime || '';
  const displayImage = activeAlert?.closureImage || config?.closureImage || '';

  return (
    <AnimatePresence>
      {(isOpen || isExited) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[1400] bg-[#FFF9F5] text-[#4A2E2A] flex flex-col justify-between overflow-y-auto selection:bg-[#F3A6B8]/30 font-sans"
          style={{
            backgroundImage: `radial-gradient(#D8B56D 0.8px, transparent 0.8px), radial-gradient(#F3A6B8 0.8px, #FFF9F5 0.8px)`,
            backgroundSize: `32px 32px`,
            backgroundPosition: `0 0, 16px 16px`
          }}
        >
          {isExited ? (
            /* Friendly Exit Screen (when browser security prevents window.close) */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-6">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 rounded-3xl bg-black border-2 border-[#D8B56D]/60 shadow-2xl overflow-hidden flex items-center justify-center p-2.5"
              >
                <img 
                  src={UNIVERSAL_LOGO_URL} 
                  alt="Frosty Bite Bakery" 
                  className="w-full h-full object-cover rounded-2xl" 
                />
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black text-[#4A2E2A] tracking-tight">
                  Thank You for Visiting! ❤️
                </h2>
                <p className="text-stone-600 text-sm font-medium leading-relaxed">
                  We look forward to baking fresh, decadent treats for you when we reopen. You can return anytime to explore our menu.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReenter}
                className="w-full py-4 px-8 rounded-2xl bg-[#4A2E2A] text-white font-bold text-sm shadow-xl hover:bg-[#382320] transition-all flex items-center justify-center gap-2"
              >
                <span>Re-enter Bakery Menu</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            /* Luxury Zomato/Swiggy Quality Full-Screen Closure Experience */
            <div className="flex-1 flex flex-col justify-between min-h-screen max-w-2xl mx-auto w-full p-6 sm:p-10 text-center">
              {/* Header: Bakery Brand & Status Indicator */}
              <div className="pt-4 pb-2 flex flex-col items-center space-y-3">
                <div className="flex items-center justify-center">
                  <Logo size="md" />
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-100/95 border border-rose-300 text-rose-800 text-[11px] sm:text-xs font-black uppercase tracking-widest shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                  <span>Orders Temporarily Closed</span>
                </div>
              </div>

              {/* Central Section: Illustration, Dynamic Title, Reason & Reopening Date */}
              <div className="my-auto py-6 sm:py-8 space-y-6">
                {/* Bakery Logo Feature Card with Ambient Gold Glow */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-[#F3A6B8]/40 via-amber-200/50 to-rose-200/40 blur-2xl opacity-75 animate-pulse" />
                  
                  <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-white/90 backdrop-blur-md border-2 border-[#D8B56D]/50 shadow-2xl flex flex-col items-center justify-center p-3 overflow-hidden">
                    <motion.div
                      animate={{ y: [-4, 4, -4], scale: [1, 1.02, 1] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-lg border border-[#D8B56D]/40 mb-2 flex items-center justify-center bg-black"
                    >
                      <img 
                        src={displayImage || UNIVERSAL_LOGO_URL} 
                        alt="Frosty Bite Bakery" 
                        className="w-full h-full object-cover" 
                      />
                    </motion.div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#E76A54] flex items-center gap-1">
                      <Clock size={11} /> Kitchen Resting
                    </span>
                  </div>
                </div>

                {/* Dynamic Closure Title */}
                <div className="space-y-2 max-w-lg mx-auto">
                  <h1 className="text-2xl sm:text-4xl font-black text-[#4A2E2A] tracking-tight leading-tight">
                    {displayTitle}
                  </h1>
                  <p className="text-stone-600 text-xs sm:text-sm font-medium leading-relaxed max-w-md mx-auto">
                    {displayReason}
                  </p>
                </div>

                {/* Expected Reopening Card (Date & Time) */}
                {(displayReopenDate || displayReopenTime) && (
                  <motion.div 
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-gradient-to-r from-amber-500/10 via-[#D8B56D]/15 to-amber-500/10 rounded-2xl p-4 sm:p-5 border-2 border-[#D8B56D]/60 max-w-md mx-auto text-center shadow-xs"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#8A5A18] mb-1.5">
                      <Sparkles size={14} className="text-[#D8B56D]" />
                      <span>Expected Reopening</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-sm sm:text-base font-extrabold text-[#4A2E2A]">
                      {displayReopenDate && (
                        <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-xl border border-[#D8B56D]/40 shadow-xs">
                          <Calendar size={16} className="text-[#E76A54]" />
                          <span>{displayReopenDate}</span>
                        </div>
                      )}
                      {displayReopenTime && (
                        <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1.5 rounded-xl border border-[#D8B56D]/40 shadow-xs">
                          <Clock size={16} className="text-[#D8B56D]" />
                          <span>{displayReopenTime}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Additional Announcement Message Written by Admin */}
                {displayMessage && (
                  <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-[#D8B56D]/40 shadow-md max-w-md mx-auto text-center space-y-2">
                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-medium italic">
                      "{displayMessage}"
                    </p>
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-center gap-1 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      <span>— Frosty Bite Bakery Team</span>
                    </div>
                  </div>
                )}

                {/* Helpful Customer Notice */}
                <div className="flex items-center justify-center gap-2 text-xs text-stone-500 font-semibold max-w-md mx-auto">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>Menu, prices, and dessert showcase remain open for browsing!</span>
                </div>
              </div>

              {/* Bottom Action Area: The Two Required Buttons */}
              <div className="pb-4 pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mx-auto">
                {/* BUTTON 1: CONTINUE EXPLORING */}
                <button
                  type="button"
                  onClick={handleContinueExploring}
                  className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#E76A54] via-[#f07b66] to-[#E76A54] text-white font-black text-sm sm:text-base shadow-xl shadow-orange-500/25 hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
                >
                  <ShoppingBag size={18} />
                  <span>CONTINUE EXPLORING</span>
                </button>

                {/* BUTTON 2: EXIT APP */}
                <button
                  type="button"
                  onClick={handleExitApp}
                  className="w-full sm:w-auto py-4 px-7 rounded-2xl bg-white/90 border-2 border-stone-300 text-stone-700 hover:bg-stone-100 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <LogOut size={16} className="text-stone-500" />
                  <span>EXIT APP</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
