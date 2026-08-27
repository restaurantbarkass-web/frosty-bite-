import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  containerClassName?: string;
  fallbackColor?: string;
  priority?: boolean;
}

// Utility to generate optimized Unsplash URLs with specific sizes and quality
const getUnsplashUrl = (url: string, params: { w?: number; q?: number; fm?: string; blur?: number; fit?: string }) => {
  if (!url || !url.includes('images.unsplash.com')) return url;
  try {
    const urlObj = new URL(url);
    if (params.w !== undefined) urlObj.searchParams.set('w', params.w.toString());
    if (params.q !== undefined) urlObj.searchParams.set('q', params.q.toString());
    if (params.fm !== undefined) urlObj.searchParams.set('fm', params.fm);
    else urlObj.searchParams.set('fm', 'webp'); // Default to high-performance webp format
    if (params.blur !== undefined) urlObj.searchParams.set('blur', params.blur.toString());
    if (params.fit !== undefined) urlObj.searchParams.set('fit', params.fit);
    return urlObj.toString();
  } catch (e) {
    return url;
  }
};

// Utility to generate optimized Cloudinary URLs with f_auto,q_auto,w_xxx
const getCloudinaryUrl = (url: string, params: { w?: number; q?: string; f?: string }) => {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  try {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return url;
    const prefix = url.substring(0, uploadIndex + 8);
    const suffix = url.substring(uploadIndex + 8);
    // Build transform string
    const transforms = ['f_auto', 'q_auto'];
    if (params.w) transforms.push(`w_${params.w},c_limit`);
    const transformStr = transforms.join(',') + '/';
    // If suffix already has transforms, replace or prepend safely
    if (suffix.startsWith('f_auto') || suffix.startsWith('q_auto') || suffix.startsWith('w_')) {
      return url;
    }
    return `${prefix}${transformStr}${suffix}`;
  } catch {
    return url;
  }
};

export const OptimizedImage: React.FC<OptimizedImageProps> = React.memo(({
  src,
  alt,
  className,
  containerClassName,
  fallbackColor = "bg-[#121214]",
  priority = false,
  sizes,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for performance lazy-loading
  useEffect(() => {
    if (priority) {
      setInView(true);
      return;
    }

    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '600px', // Load images 600px before they enter viewport
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  // Reset loading state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setError(false);
  }, [src]);

  if (!src) {
    return (
      <div className={cn("bg-zinc-900 flex items-center justify-center overflow-hidden", containerClassName)}>
        <span className="text-[8px] font-black uppercase text-zinc-700 italic tracking-widest">Image missing</span>
      </div>
    );
  }

  const isUnsplash = src.includes('images.unsplash.com');
  const isCloudinary = src.includes('res.cloudinary.com');

  // High-performance image formats and dimensions
  let placeholderSrc = src;
  let webpSrc = src;
  let srcSetString: string | undefined = undefined;

  if (isUnsplash) {
    placeholderSrc = getUnsplashUrl(src, { w: 80, q: 20, blur: 10 });
    webpSrc = getUnsplashUrl(src, { fm: 'webp' });
    srcSetString = `${getUnsplashUrl(src, { w: 400, q: 75 })} 400w, ${getUnsplashUrl(src, { w: 800, q: 80 })} 800w, ${getUnsplashUrl(src, { w: 1200, q: 80 })} 1200w`;
  } else if (isCloudinary) {
    placeholderSrc = getCloudinaryUrl(src, { w: 80, q: 'auto:low' });
    webpSrc = getCloudinaryUrl(src, { w: 800 });
    srcSetString = `${getCloudinaryUrl(src, { w: 400 })} 400w, ${getCloudinaryUrl(src, { w: 800 })} 800w, ${getCloudinaryUrl(src, { w: 1200 })} 1200w`;
  }

  // Standard responsive image sizes
  const defaultSizes = isUnsplash || isCloudinary
    ? sizes || "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    : undefined;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative overflow-hidden w-full h-full select-none",
        fallbackColor,
        containerClassName
      )}
    >
      <AnimatePresence mode="popLayout">
        {/* Shimmering Skeleton + Blur Placeholder */}
        {!isLoaded && !error && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0 z-10 w-full h-full flex items-center justify-center bg-zinc-950/20"
          >
            {/* Pulsing skeleton */}
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 bg-[length:200%_100%] animate-shimmer" 
                 style={{
                   backgroundImage: 'linear-gradient(90deg, rgba(24,24,27,0.1) 0%, rgba(39,39,42,0.6) 50%, rgba(24,24,27,0.1) 100%)',
                 }}
            />
            {/* Low Quality Blurry Placeholder for smooth progressive enhancement */}
            {isUnsplash && (
              <img 
                src={placeholderSrc} 
                alt="" 
                className="w-full h-full absolute inset-0 object-cover blur-md scale-105 select-none pointer-events-none opacity-80"
                referrerPolicy="no-referrer"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actual High Resolution Image */}
      {inView && (
        <img
          src={webpSrc}
          srcSet={srcSetString}
          sizes={defaultSizes}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            console.error("Image load fail:", src);
            setError(true);
          }}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300 ease-out",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm border border-white/5 z-20">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 italic">
            Preview Unavailable
          </span>
        </div>
      )}
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';
