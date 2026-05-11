import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Star, Sparkles, X, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';

interface BadgeUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierName: string;
  themeColor?: string;
}

export const BadgeUnlockModal: React.FC<BadgeUnlockModalProps> = ({ 
  isOpen, 
  onClose, 
  tierName,
  themeColor = '#F97316'
}) => {
  useEffect(() => {
    if (isOpen) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 100 }}
            className="relative w-full max-w-md glass-dark border border-white/10 rounded-[3rem] p-10 text-center overflow-hidden"
          >
            {/* Background Glow */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ background: `radial-gradient(circle at center, ${themeColor}, transparent)` }}
            />

            <div className="relative z-10 space-y-6">
              <div className="relative inline-block">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-[-20px] border border-dashed border-white/20 rounded-full"
                />
                <div 
                  className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl relative"
                  style={{ backgroundColor: themeColor }}
                >
                  <Crown size={64} className="text-white drop-shadow-lg" />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-2 -right-2 bg-yellow-400 text-black p-2 rounded-full shadow-lg"
                  >
                    <Sparkles size={16} />
                  </motion.div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.4em] text-white/50">New Rank Unlocked</p>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">
                  {tierName}
                </h2>
              </div>

              <p className="text-zinc-400 text-sm leading-relaxed">
                Congratulations! You've ascended to the <span className="text-white font-bold">{tierName}</span> tier. Enjoy exclusive benefits, premium dishes, and priority service.
              </p>

              <div className="pt-4 grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-500" />
                  <span className="text-[10px] font-black text-white uppercase">Exclusive Menu</span>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-500" />
                  <span className="text-[10px] font-black text-white uppercase">Fast Priority</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-5 bg-white text-black rounded-[2rem] font-black uppercase text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
              >
                Claim Rewards
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
