import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { X, ZoomIn, ZoomOut, Maximize2, RotateCcw, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface ImageZoomProps {
  src: string;
  alt: string;
  className?: string;
  triggerClassName?: string;
}

export const ImageZoom: React.FC<ImageZoomProps> = ({ src, alt, className, triggerClassName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Motion values for smooth panning
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  // Spring configurations for natural feel
  const springConfig = { stiffness: 300, damping: 30 };
  const smoothX = useSpring(x, springConfig);
  const smoothY = useSpring(y, springConfig);

  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    resetState();
  };

  const resetState = () => {
    setScale(1);
    x.set(0);
    y.set(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isOpen) {
      const delta = e.deltaY > 0 ? -0.2 : 0.2;
      const newScale = Math.min(Math.max(1, scale + delta), 4);
      setScale(newScale);
      
      // If zooming out to 1, reset position
      if (newScale === 1) {
        x.set(0);
        y.set(0);
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      resetState();
    } else {
      setScale(2.5);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded successfully');
    } catch (error) {
      toast.error('Failed to download image');
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <>
      <div 
        className={cn("relative group cursor-zoom-in overflow-hidden", triggerClassName)}
        onClick={toggleZoom}
      >
        <img 
          src={src} 
          alt={alt} 
          className={cn("transition-transform duration-700 group-hover:scale-105", className)} 
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1, opacity: 1 }}
            className="bg-white/10 backdrop-blur-xl p-3 rounded-2xl border border-white/20 shadow-2xl"
          >
            <Maximize2 size={24} className="text-white" />
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden touch-none">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleZoom}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            
            {/* Controls */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute top-0 inset-x-0 p-6 flex items-center justify-between z-10 pointer-events-none"
            >
              <div className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                <p className="text-xs font-black text-white/60 uppercase tracking-[0.2em]">{alt || 'Image Preview'}</p>
              </div>

              <div className="flex gap-2 pointer-events-auto">
                <button 
                  onClick={handleDownload}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all border border-white/10 group"
                  title="Download Image"
                >
                  <Download size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                <div className="w-px h-10 bg-white/10 mx-1" />
                <button 
                  onClick={() => setScale(prev => Math.min(prev + 0.5, 4))}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all border border-white/10"
                  title="Zoom In"
                >
                  <ZoomIn size={20} />
                </button>
                <button 
                  onClick={() => setScale(prev => Math.max(prev - 0.5, 1))}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all border border-white/10"
                  title="Zoom Out"
                >
                  <ZoomOut size={20} />
                </button>
                <button 
                  onClick={resetState}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all border border-white/10"
                  title="Reset Zoom"
                >
                  <RotateCcw size={20} />
                </button>
                <button 
                  onClick={toggleZoom}
                  className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all ml-2"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </motion.div>

            {/* Image Container */}
            <div 
              ref={containerRef}
              className="w-full h-full flex items-center justify-center p-4 relative"
              onWheel={handleWheel}
            >
              <motion.div
                style={{ 
                  x: smoothX, 
                  y: smoothY,
                  scale: scale,
                  cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
                drag={scale > 1}
                dragConstraints={containerRef}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={() => setIsDragging(false)}
                onDoubleClick={handleDoubleClick}
                className="relative max-w-full max-h-full flex items-center justify-center"
              >
                <motion.img
                  src={src}
                  alt={alt}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded-2xl select-none"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              </motion.div>
            </div>

            {/* Footer Hint */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 px-8 py-3 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 pointer-events-none"
            >
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">
                    {scale > 1 ? 'Drag to Pan' : 'Scroll to Zoom'}
                  </p>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  Double Click to Toggle
                </p>
                <div className="w-px h-3 bg-white/10" />
                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  {Math.round(scale * 100)}%
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
