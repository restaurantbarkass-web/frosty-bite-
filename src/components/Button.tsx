import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'google';
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  icon,
  fullWidth = true,
  className,
  disabled,
  ...props
}) => {
  const variants = {
    primary: "bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-600/20 active:shadow-none",
    secondary: "bg-white/10 text-white hover:bg-white/20 border border-white/10",
    outline: "bg-transparent border border-white/20 text-white hover:bg-white/5",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
    google: "bg-white text-gray-900 hover:bg-gray-100 shadow-md",
  };

  const { onDrag, onDragStart, onDragEnd, ...restProps } = props;
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  return (
    <motion.button
      whileHover={!isTouchDevice ? { 
        scale: 1.02,
        y: -2,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
      } : undefined}
      whileTap={{ scale: 0.96, y: 0 }}
      disabled={disabled || isLoading}
      className={cn(
        "relative flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group",
        fullWidth && "w-full",
        variants[variant],
        className
      )}
      {...(restProps as any)}
    >
      {/* Shine Effect */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine pointer-events-none" />
      
      {isLoading ? (
        <Loader2 className="animate-spin" size={20} />
      ) : (
        <>
          {icon && <span className="shrink-0 group-hover:scale-110 transition-transform duration-300">{icon}</span>}
          <span className="relative z-10">{children}</span>
        </>
      )}
    </motion.button>
  );
};
