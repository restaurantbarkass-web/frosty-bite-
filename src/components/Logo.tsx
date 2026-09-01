import React from 'react';
import { motion } from 'motion/react';
import { ChefHat } from 'lucide-react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  white?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className, size = 'md', white = false }) => {
  const [imgError, setImgError] = React.useState(false);
  const logoUrl = "/logo.svg";
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  const iconSizes = {
    sm: 18,
    md: 24,
    lg: 40
  };

  return (
    <div className={cn("flex items-center gap-2 group cursor-pointer", className)}>
      <motion.div 
        whileHover={{ rotate: [-5, 5, -5, 0], scale: 1.1 }}
        className={cn(
          "relative flex items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-primary to-orange-600 text-white",
          size === 'sm' ? "w-8 h-8" : size === 'md' ? "w-10 h-10" : "w-16 h-16",
          "shadow-lg shadow-primary/20"
        )}
      >
        {!imgError ? (
          <img 
            src={logoUrl} 
            alt="Frosty Bite" 
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
          />
        ) : (
          <ChefHat size={iconSizes[size]} className="text-white" />
        )}
        
        {/* Shimmer Effect */}
        <motion.div 
          animate={{ x: ['100%', '-100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
        />
      </motion.div>

      <div className="flex flex-col -space-y-1">
        <span className={cn(
          "font-black tracking-tighter italic uppercase",
          sizes[size],
          white ? "text-white" : "text-white"
        )}>
          Frosty<span className="text-primary italic">Bite</span>
        </span>
        <span className={cn(
          "text-[8px] font-black uppercase tracking-[0.3em]",
          white ? "text-white/40" : "text-zinc-500"
        )}>
          Artisan Bakery
        </span>
      </div>
    </div>
  );
};
