import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

interface BrandAnimationProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandAnimation: React.FC<BrandAnimationProps> = ({ 
  className,
  size = 'md'
}) => {
  const containerSizes = {
    sm: 'h-16',
    md: 'h-32',
    lg: 'h-64'
  };

  const textSizes = {
    sm: 'text-xl',
    md: 'text-4xl',
    lg: 'text-7xl'
  };

  return (
    <div className={cn("flex flex-col items-center justify-center overflow-hidden", containerSizes[size], className)}>
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={cn("font-black tracking-tighter italic uppercase flex flex-col items-center leading-none", textSizes[size])}
        >
          <motion.span
            animate={{ 
              x: [-2, 2, -2],
              filter: ["contrast(1.2)", "contrast(1)", "contrast(1.2)"]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="text-white"
          >
            Frosty
          </motion.span>
          <motion.span
            animate={{ 
              x: [2, -2, 2],
              color: ["#FBBF24", "#F59E0B", "#FBBF24"]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="text-primary NOT-italic"
          >
            Bite
          </motion.span>
        </motion.div>

        {/* Decorative elements */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-4 border border-dashed border-primary/20 rounded-full pointer-events-none"
        />
        
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-8 border border-dotted border-white/10 rounded-full pointer-events-none"
        />
      </div>
      
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "60%" }}
        transition={{ delay: 0.5, duration: 1 }}
        className="h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent mt-4"
      />
    </div>
  );
};
