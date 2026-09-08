import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // If lenis is active, stop it
      if ((window as any).lenis) {
        (window as any).lenis.stop();
      }
    } else {
      document.body.style.overflow = 'unset';
      if ((window as any).lenis) {
        (window as any).lenis.start();
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
      if ((window as any).lenis) {
        (window as any).lenis.start();
      }
    };
  }, [isOpen]);

  const variants = {
    danger: {
      icon: <Trash2 size={28} />,
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-500',
      confirmBg: 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
    },
    warning: {
      icon: <AlertCircle size={28} />,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-500',
      confirmBg: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
    },
    info: {
      icon: <AlertCircle size={28} />,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-500',
      confirmBg: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
    }
  };

  const style = variants[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className={cn(
              "relative bg-[#1a1a1a] border border-white/10 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl",
              "p-6 sm:p-8"
            )}
          >
            <div className={cn("w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6", style.iconBg, style.iconColor)}>
              {style.icon}
            </div>

            <div className="text-center space-y-2 mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">{title}</h3>
              <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed px-2">{description}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-3.5 sm:py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all order-2 sm:order-1 disabled:opacity-50 text-sm"
              >
                {cancelText}
              </button>
              <button 
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  "flex-1 py-3.5 sm:py-4 text-white font-bold rounded-2xl transition-all shadow-lg order-1 sm:order-2 disabled:opacity-50 flex items-center justify-center gap-2 text-sm",
                  style.confirmBg
                )}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
