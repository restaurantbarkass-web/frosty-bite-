import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
  error?: string;
  rightElement?: React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  icon: Icon,
  error,
  rightElement,
  className,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-full space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
      {label && (
        <motion.label 
          animate={{ color: isFocused ? '#ff6b26' : '#cbd5e1' }}
          transition={{ duration: 0.2 }}
          className="text-xs font-black uppercase tracking-widest text-gray-300 ml-1 block"
        >
          {label}
        </motion.label>
      )}
      <motion.div 
        animate={{ 
          scale: isFocused ? 1.01 : 1,
          boxShadow: isFocused 
            ? '0 0 24px 2px rgba(255, 107, 38, 0.12)' 
            : '0 0 0px 0px rgba(0,0,0,0)'
        }}
        transition={{ type: "spring", stiffness: 450, damping: 25 }}
        className="relative rounded-xl overflow-hidden border border-white/10"
        style={{
          borderColor: isFocused ? '#ff6b26' : 'rgba(255, 255, 255, 0.1)'
        }}
      >
        {/* Animated slide background highlight */}
        <motion.div
          animate={{ opacity: isFocused ? 1 : 0 }}
          className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 z-10"
          transition={{ duration: 0.3 }}
        />
        
        {Icon && (
          <motion.div 
            animate={{ 
              scale: isFocused ? 1.12 : 1,
              color: isFocused ? '#ff6b26' : '#94a3b8'
            }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
          >
            <Icon size={18} />
          </motion.div>
        )}
        <input
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={cn(
            "w-full bg-white/5 rounded-xl py-3.5 px-4 transition-all duration-300 outline-none text-white text-sm placeholder:text-gray-500 font-medium",
            Icon && "pl-12",
            rightElement && "pr-12",
            isFocused && "bg-white/[0.08]",
            error && "border-red-500/50 focus:border-red-500/50",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            {rightElement}
          </div>
        )}
      </motion.div>
      {error && (
        <p className="text-xs text-red-400 ml-1 mt-1 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
};
