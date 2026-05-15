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
    if (!src) {
      setError(true);
      return;
    }

    // Reset states when src changes
    setIsLoaded(false);
    setError(false);
    
    // Check if image is already cached
    const img = new Image();
    img.src = src;
    if (img.complete) {
      setIsLoaded(true);
    }
  }, [src]);

  if (!src) {
    return (
      <div className={cn("bg-zinc-900 flex items-center justify-center overflow-hidden", containerClassName)}>
        <span className="text-[8px] font-black uppercase text-zinc-700 italic tracking-widest">Image missing</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "relative overflow-hidden w-full h-full",
        !isLoaded && !error && fallbackColor,
        containerClassName
      )}
    >
      {/* Loading Pulse */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-zinc-900 animate-pulse transition-opacity duration-300" />
      )}

      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        // @ts-ignore
        fetchpriority={priority ? "high" : "auto"}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          console.error("Image load fail:", src);
          setError(true);
        }}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        referrerPolicy="no-referrer"
        {...props}
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm border border-white/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">
            Preview Unavailable
          </span>
        </div>
      )}
    </div>
  );
};
