import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSwipeable } from 'react-swipeable';
import { cn } from '../lib/utils';
import { ArrowRight, ChevronRight, Sparkles, Clock, MapPin, Cake, Trophy } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const SCREENS = [
  {
    title: "Freshly baked happiness.",
    description: "Desserts, shakes, pastries and cravings delivered fast.",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?q=80&w=1980&auto=format&fit=crop",
    cta: "Taste the Magic",
    accent: "from-orange-600/30 to-transparent"
  },
  {
    title: "Crafted with love.",
    description: "Handcrafted by master bakers with the finest premium ingredients.",
    image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=2070&auto=format&fit=crop",
    features: [
      { icon: Cake, label: "Artisan Quality" },
      { icon: Sparkles, label: "Pure Elegance" }
    ],
    accent: "from-pink-600/30 to-transparent"
  },
  {
    title: "Late night sweet cravings?",
    description: "We deliver happiness till midnight. Your cravings, our mission.",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?q=80&w=1974&auto=format&fit=crop",
    accent: "from-purple-900/50 to-transparent"
  },
  {
    title: "Track your treats live.",
    description: "Follow your dessert's journey with our elegant real-time tracking interface.",
    image: "https://images.unsplash.com/photo-1595164402263-ef99015ba6a0?q=80&w=1964&auto=format&fit=crop",
    accent: "from-blue-600/30 to-transparent"
  },
  {
    title: "Your dessert identity.",
    description: "Create your unique AI avatar and unlock high-end loyalty rewards.",
    image: "https://images.unsplash.com/photo-1618335829737-2228ad3088be?q=80&w=1974&auto=format&fit=crop",
    accent: "from-bakery-pink/30 to-transparent"
  }
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [direction, setDirection] = useState(0);

  const paginate = (newDirection: number) => {
    if (currentScreen + newDirection >= 0 && currentScreen + newDirection < SCREENS.length) {
      setDirection(newDirection);
      setCurrentScreen(prev => prev + newDirection);
    } else if (currentScreen + newDirection === SCREENS.length) {
      onComplete();
    }
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => paginate(1),
    onSwipedRight: () => paginate(-1),
    trackMouse: true
  });

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 1.1
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.9
    })
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-background overflow-hidden flex flex-col font-sans"
      {...handlers}
    >
      {/* Background Images Layer */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={currentScreen}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.5 },
              scale: { duration: 0.8 }
            }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-black/40 z-10" />
            <div className={cn("absolute inset-0 z-20 bg-gradient-to-t from-background via-background/40 to-transparent", SCREENS[currentScreen].accent)} />
            <img 
              src={SCREENS[currentScreen].image} 
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            
            {/* Ambient Particles (Floating Cocoa Particles) */}
            {currentScreen === 0 && (
              <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: Math.random() * window.innerWidth, 
                      y: Math.random() * window.innerHeight,
                      opacity: 0 
                    }}
                    animate={{ 
                      y: [null, Math.random() * -100 - 50],
                      opacity: [0, 0.4, 0],
                      rotate: Math.random() * 360
                    }}
                    transition={{ 
                      duration: Math.random() * 3 + 2, 
                      repeat: Infinity,
                      ease: "linear",
                      delay: Math.random() * 5
                    }}
                    className="absolute w-1 h-1 bg-[#4A2F24] rounded-full blur-[1px]"
                  />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Content Layer */}
      <div className="relative z-50 flex-1 flex flex-col justify-end p-8 pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <motion.h1 
                className="text-4xl md:text-6xl font-serif font-black leading-tight tracking-tight text-white"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                {SCREENS[currentScreen].title}
              </motion.h1>
              <motion.p 
                className="text-lg text-white/70 max-w-sm leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                {SCREENS[currentScreen].description}
              </motion.p>
            </div>

            {SCREENS[currentScreen].features && (
              <div className="flex gap-4">
                {SCREENS[currentScreen].features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                    <feature.icon className="text-bakery-pink w-4 h-4" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-white/90">{feature.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-8">
              {/* Pagination Indicators */}
              <div className="flex gap-2">
                {SCREENS.map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "h-1 transition-all duration-500 rounded-full",
                      i === currentScreen ? "w-8 bg-primary" : "w-2 bg-white/20"
                    )}
                  />
                ))}
              </div>

              {/* Action Button */}
              <button 
                onClick={() => paginate(1)}
                className="group relative flex items-center justify-center gap-2"
              >
                <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/40 transition-all rounded-full" />
                <div className="relative bg-primary text-white p-6 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all">
                  <ChevronRight size={32} />
                </div>
              </button>
            </div>

            {currentScreen === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, type: "spring" }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-amber-400 rounded-2xl blur-lg opacity-40 group-hover:opacity-75 transition-opacity duration-1000 group-hover:duration-200 animate-pulse" />
                <button
                  onClick={() => paginate(1)}
                  className="relative w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl hover:bg-white/95 transition-all active:scale-[0.98]"
                >
                  {SCREENS[0].cta}
                  <Sparkles size={20} className="text-orange-500" />
                </button>
              </motion.div>
            )}

            {currentScreen === SCREENS.length - 1 && (
              <motion.button
                onClick={onComplete}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full bg-bakery-pink text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(255,139,167,0.3)] hover:scale-[1.02] transition-all active:scale-[0.98]"
              >
                Create My Identity
                <ArrowRight size={20} />
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Top Skip Button */}
      <button 
        onClick={onComplete}
        className="absolute top-12 right-8 z-[60] text-sm font-black uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors"
      >
        Skip
      </button>
    </div>
  );
};
