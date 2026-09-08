import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, AlertCircle, XCircle, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SlideToConfirm } from './SlideToConfirm';

interface SlideConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  slideLabel?: string;
  releaseLabel?: string;
  processingLabel?: string;
  successLabel?: string;
  variant?: 'danger' | 'warning' | 'emerald' | 'orange';
  icon?: React.ReactNode;
  backLabel?: string;
}

export const SlideConfirmModal: React.FC<SlideConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  slideLabel = 'Slide to Confirm',
  releaseLabel = 'Release to Confirm',
  processingLabel = 'Processing…',
  successLabel = 'Completed!',
  variant = 'danger',
  icon,
  backLabel = 'Back to Orders'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if ((window as any).lenis) (window as any).lenis.stop();
    } else {
      document.body.style.overflow = 'unset';
      if ((window as any).lenis) (window as any).lenis.start();
    }
    return () => {
      document.body.style.overflow = 'unset';
      if ((window as any).lenis) (window as any).lenis.start();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className={cn(
            "relative bg-[#141414] border border-white/10 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl p-6 sm:p-8"
          )}
        >
          {/* Top Navigation Row with Back Button */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-full text-xs font-bold transition-all border border-white/10 hover:border-white/20 hover:scale-105 active:scale-95"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white bg-white/5 rounded-full transition-all hover:scale-105"
              title="Close Modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col items-center text-center space-y-3 mb-6">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center border shadow-xl mb-2",
              variant === 'danger' && "bg-red-500/10 border-red-500/20 text-red-500 shadow-red-500/10",
              variant === 'warning' && "bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-amber-500/10",
              variant === 'emerald' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/10",
              variant === 'orange' && "bg-orange-500/10 border-orange-500/20 text-orange-500 shadow-orange-500/10"
            )}>
              {icon || (variant === 'danger' ? <XCircle size={32} /> : <AlertCircle size={32} />)}
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight">{title}</h3>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed px-2">{description}</p>
          </div>

          <div className="space-y-4">
            <SlideToConfirm
              onConfirm={onConfirm}
              onSuccess={() => {
                setTimeout(() => {
                  onClose();
                }, 600);
              }}
              label={slideLabel}
              releaseLabel={releaseLabel}
              processingLabel={processingLabel}
              successLabel={successLabel}
              variant={variant}
              icon={icon || (variant === 'danger' ? <Trash2 size={20} /> : undefined)}
            />

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-full font-extrabold text-xs uppercase tracking-widest transition-all border border-white/10 hover:border-white/20 flex items-center justify-center gap-2 group"
            >
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
              <span>{backLabel}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SlideConfirmModal;
