import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Sparkles, 
  ShoppingBag, 
  Bell, 
  Shield, 
  Flame, 
  Cake, 
  ArrowRight, 
  CheckCircle2,
  Sparkle
} from 'lucide-react';
import { useVersion } from '../context/VersionContext';
import { UpdateHighlight } from '../config/version';
import { Logo } from './Logo';

export const AppUpdateScreen: React.FC = () => {
  const { isUpdateAvailable, releaseInfo, acknowledgeUpdate, currentVersion, previousVersion } = useVersion();
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the Continue button when the modal appears for seamless accessibility & keyboard navigation
  useEffect(() => {
    if (isUpdateAvailable) {
      const timer = setTimeout(() => {
        continueButtonRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isUpdateAvailable]);

  // Handle keyboard Escape or Enter key shortcuts safely
  useEffect(() => {
    if (!isUpdateAvailable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        acknowledgeUpdate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUpdateAvailable, acknowledgeUpdate]);

  if (!isUpdateAvailable) return null;

  const renderIcon = (iconType: UpdateHighlight['icon']) => {
    switch (iconType) {
      case 'zap':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'bell':
        return <Bell className="w-5 h-5 text-orange-400" />;
      case 'shopping-bag':
        return <ShoppingBag className="w-5 h-5 text-amber-500" />;
      case 'sparkles':
        return <Sparkles className="w-5 h-5 text-yellow-400" />;
      case 'cake':
        return <Cake className="w-5 h-5 text-orange-400" />;
      case 'flame':
        return <Flame className="w-5 h-5 text-rose-400" />;
      case 'shield':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-heading"
        aria-describedby="update-desc"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="fixed inset-0 z-[2000] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto overscroll-contain"
      >
        {/* Ambient Warm Patisserie Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[650px] bg-gradient-to-b from-orange-400/20 via-amber-400/10 to-transparent rounded-full blur-3xl opacity-75" />
          <div className="absolute -bottom-32 -left-20 w-[450px] h-[450px] bg-amber-400/10 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-32 -right-20 w-[450px] h-[450px] bg-orange-400/10 rounded-full blur-3xl opacity-50" />
        </div>

        {/* Main Update Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl bg-white border border-stone-200/90 rounded-[2.5rem] p-6 sm:p-8 md:p-10 shadow-2xl flex flex-col justify-between my-auto text-stone-900"
        >
          {/* Top Brand Header & Version Badge */}
          <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
            <Logo size="sm" className="scale-105" />

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-200 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-stone-700 uppercase">
                {currentVersion}
              </span>
            </div>
          </div>

          {/* Core Title & Bakery Narrative */}
          <div className="space-y-3 sm:space-y-4 mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600">
              <Sparkle size={12} className="text-orange-500 fill-orange-500 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-[10px] font-black uppercase tracking-[0.25em]">
                {releaseInfo.badge}
              </span>
            </div>

            <h1 
              id="update-heading"
              className="text-2xl sm:text-4xl md:text-[2.6rem] font-black text-stone-900 italic tracking-tight leading-[1.1] uppercase font-serif"
            >
              {releaseInfo.heading}
            </h1>

            <p 
              id="update-desc"
              className="text-stone-600 text-xs sm:text-sm md:text-base leading-relaxed max-w-xl font-normal"
            >
              {releaseInfo.description}
            </p>
          </div>

          {/* "What's New" Highlights Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-8 sm:mb-10">
            {releaseInfo.highlights.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 + index * 0.05 }}
                className="group relative p-4 sm:p-5 rounded-2xl bg-stone-50 hover:bg-orange-50/50 border border-stone-200 hover:border-orange-300 transition-all duration-300 flex items-start gap-3.5"
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center group-hover:scale-110 group-hover:bg-orange-50 group-hover:border-orange-200 transition-all duration-300 shadow-xs">
                  {renderIcon(item.icon)}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-900 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-stone-500 leading-snug">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Primary Action Button Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-100">
            <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-500 font-bold">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Your session & cart are safely preserved</span>
            </div>

            <button
              ref={continueButtonRef}
              id="btn-continue-frosty-bite"
              onClick={acknowledgeUpdate}
              className="w-full sm:w-auto h-14 px-8 sm:px-10 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-500 text-white font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_10px_35px_rgba(249,115,22,0.35)] hover:shadow-[0_15px_45px_rgba(249,115,22,0.5)] active:scale-[0.98] transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-orange-400/80 focus:ring-offset-2 focus:ring-offset-white"
            >
              <span>Continue to Frosty Bite</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AppUpdateScreen;
