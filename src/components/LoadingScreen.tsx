import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Heart } from 'lucide-react';

interface LoadingScreenProps {
  fullScreen?: boolean;
  message?: string;
}

const MESSAGES = [
  "Preparing the finest artisan treats...",
  "Warming the stone ovens...",
  "Whipping fresh velvety frosting...",
  "Selecting organic vanilla & cocoa...",
  "Adding the finishing sprinkle of magic..."
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ fullScreen = true, message }) => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [message]);

  const activeMessage = message || MESSAGES[msgIndex];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`${
        fullScreen ? 'fixed inset-0 z-[100]' : 'w-full h-full min-h-[400px]'
      } flex flex-col items-center justify-center bg-[#FAF8F5] text-stone-900 overflow-hidden select-none`}
    >
      {/* Ambient Warm Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.35, 0.55, 0.35],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-orange-200/50 via-[#E76A54]/20 to-transparent blur-3xl"
        />
        <motion.div 
          animate={{ 
            scale: [1.1, 1, 1.1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gradient-to-tl from-amber-200/50 via-orange-100/30 to-transparent blur-3xl"
        />
      </div>

      <div className="relative flex flex-col items-center max-w-sm w-full px-6 z-10">
        {/* Animated Cake & Whisk Illustration */}
        <div className="relative w-40 h-40 flex items-center justify-center mb-6">
          {/* Subtle Outer Glowing Ring */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border border-dashed border-[#E76A54]/25"
          />

          <motion.div 
            animate={{ 
              scale: [0.95, 1.05, 0.95],
              rotate: [0, 2, -2, 0]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-white via-orange-50/70 to-amber-50 border border-orange-200/70 shadow-[0_12px_36px_rgba(231,106,84,0.12)] flex items-center justify-center"
          >
            {/* Artistic Cake Icon */}
            <svg viewBox="0 0 64 64" className="w-14 h-14" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="frosty-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E76A54" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>

              {/* Cake base */}
              <motion.path
                d="M12 40 C12 36, 52 36, 52 40 L52 50 C52 54, 12 54, 12 50 Z"
                stroke="url(#frosty-orange)"
                fill="#FFF5F2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />

              {/* Middle Layer */}
              <motion.path
                d="M16 28 C16 24, 48 24, 48 28 L48 38 C48 42, 16 42, 16 38 Z"
                stroke="url(#frosty-orange)"
                fill="#FFFFFF"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, delay: 0.1, ease: "easeInOut" }}
              />

              {/* Cake Top Frosting */}
              <motion.path
                d="M18 30 Q24 34 30 30 Q36 34 42 30 Q48 34 48 28"
                stroke="#f97316"
                strokeWidth="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              />

              {/* Candle / Cherry Top */}
              <motion.circle
                cx="32"
                cy="18"
                r="3.5"
                fill="#E76A54"
                stroke="#d55943"
                animate={{ 
                  scale: [1, 1.2, 1],
                  y: [0, -2, 0]
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Candle flame or cherry shine */}
              <motion.path
                d="M32 10 Q34 13 32 15 Q30 13 32 10 Z"
                fill="#f59e0b"
                animate={{ 
                  scaleY: [1, 1.3, 0.9, 1],
                  opacity: [0.8, 1, 0.7, 0.8]
                }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>

            {/* Sparkle badge */}
            <motion.div 
              animate={{ 
                scale: [0.8, 1.15, 0.8],
                rotate: [0, 45, 0]
              }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-400/30"
            >
              <Sparkles size={13} className="text-white fill-white" />
            </motion.div>
          </motion.div>

          {/* Floating Warm Dust Particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                y: [0, -40, -60],
                x: [0, (i % 2 === 0 ? 12 : -12)],
                opacity: [0, 0.7, 0],
                scale: [0.5, 1, 0.2]
              }}
              transition={{ 
                duration: 2.4 + (i * 0.4),
                repeat: Infinity,
                delay: i * 0.35,
                ease: "easeOut"
              }}
              className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-amber-400/80 pointer-events-none"
            />
          ))}
        </div>

        {/* Brand & Title */}
        <div className="text-center space-y-2 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-2"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#E76A54] bg-[#E76A54]/10 px-3 py-1 rounded-full border border-[#E76A54]/20">
              Artisan Patisserie
            </span>
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-3xl sm:text-4xl font-display uppercase tracking-tight text-stone-900"
          >
            Frosty Bite
          </motion.h2>
        </div>

        {/* Smooth Progress Track */}
        <div className="w-44 h-1.5 bg-stone-200/80 rounded-full overflow-hidden relative mb-4 shadow-inner">
          <motion.div 
            animate={{ 
              x: ["-100%", "200%"] 
            }}
            transition={{ 
              duration: 1.6, 
              repeat: Infinity, 
              ease: [0.4, 0, 0.2, 1] 
            }}
            className="absolute top-0 bottom-0 w-2/3 bg-gradient-to-r from-[#E76A54] via-amber-400 to-[#E76A54] rounded-full shadow-[0_0_12px_rgba(231,106,84,0.5)]"
          />
        </div>

        {/* Dynamic Reassuring Message */}
        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={activeMessage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="text-xs font-semibold text-stone-500 tracking-wide text-center"
            >
              {activeMessage}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Subtle Footer Note */}
      {fullScreen && (
        <div className="absolute bottom-8 text-center pointer-events-none opacity-60">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
            Crafted with <Heart size={10} className="fill-[#E76A54] text-[#E76A54]" /> for sweet moments
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default LoadingScreen;
