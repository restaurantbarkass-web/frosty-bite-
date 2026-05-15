import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  containerClassName?: string;
  fallbackColor?: string;
  priority?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  containerClassName,
  fallbackColor = "bg-secondary",
  priority = false,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setError(false);
  }, [src]);

  return (
    <div 
      className={cn(
        "relative overflow-hidden",
        !isLoaded && !error && fallbackColor,
        containerClassName
      )}
    >
      <AnimatePresence>
        {!isLoaded && !error && (
          <motion.div
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-secondary/50 to-secondary animate-pulse"
          />
        )}
      </AnimatePresence>

      <motion.img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        // @ts-ignore
        fetchpriority={priority ? "high" : "auto"}
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={cn(
          "w-full h-full object-cover",
          isLoaded ? "blur-0" : "blur-lg scale-105",
          "transition-[filter,transform] duration-500",
          className
        )}
        {...props}
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/20 p-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Image failed to load
          </span>
        </div>
      )}
    </div>
  );
};
