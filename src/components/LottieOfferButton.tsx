import React from 'react';
import Lottie from 'lottie-react';
import offerAnim from '../assets/offer.json';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface LottieOfferButtonProps {
  active: boolean;
  onClick?: () => void;
  className?: string;
}

export const LottieOfferButton: React.FC<LottieOfferButtonProps> = ({ active, onClick, className }) => {
  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        className={cn(
          "relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full transition-all duration-300 shadow-lg",
          active 
            ? "bg-gradient-to-r from-pink-500 to-indigo-500 scale-110 shadow-indigo-500/40 ring-2 ring-white/20"
            : "bg-white/5 border border-white/10"
        )}
      >
        {/* Lottie Animation */}
        <Lottie
          animationData={offerAnim}
          loop={true}
          autoplay={true}
          className="w-10 h-10"
        />

        {/* Small Badge */}
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full shadow-md border border-white/20">
          !
        </span>
      </motion.button>

      <span className={cn(
        "text-[9px] mt-2 uppercase font-black tracking-widest transition-colors",
        active ? "text-white" : "text-zinc-500"
      )}>
        Offers
      </span>
    </div>
  );
};
