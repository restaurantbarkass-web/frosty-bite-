import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowRight, 
  Check, 
  Loader2, 
  Wallet, 
  HandCoins, 
  ShieldCheck, 
  Sparkles,
  Lock
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { cn, haptic } from '../../lib/utils';

export type CheckoutState = 'idle' | 'swiping' | 'processing' | 'waiting_for_payment' | 'confirmed' | 'failed';

interface SwipeToConfirmProps {
  paymentMethod: 'upi' | 'cod';
  amount: number;
  onConfirm: () => Promise<void> | void;
  isProcessing?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  id?: string;
}

export const SwipeToConfirm: React.FC<SwipeToConfirmProps> = ({
  paymentMethod,
  amount,
  onConfirm,
  isProcessing = false,
  disabled = false,
  disabledReason,
  className,
  id = 'swipe-to-confirm-control'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxDrag, setMaxDrag] = useState<number>(200);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showTapFallback, setShowTapFallback] = useState<boolean>(false);

  // Motion values for fluid spring animation
  const dragX = useMotionValue(0);

  // Derive progress and styles at top-level (always unconditional)
  const progress = useTransform(dragX, [0, maxDrag || 1], [0, 1]);
  const textOpacity = useTransform(progress, [0, 0.6], [1, 0.15]);
  const handleScale = useTransform(progress, [0, 0.85, 1], [1, 1.08, 1.15]);
  const fillWidth = useTransform(dragX, (x) => `${x + 52}px`);

  // Recalculate max draggable width based on container & handle size
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const handleWidth = 52; // handle size with padding
      const padding = 8; // container internal padding total
      const available = Math.max(80, containerWidth - handleWidth - padding);
      setMaxDrag(available);
    }
  }, []);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Reset slider if processing ends without confirmation or if disabled state changes
  useEffect(() => {
    if (!isProcessing && !isCompleted) {
      animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  }, [isProcessing, isCompleted, dragX]);

  // Reset completed state if payment method changes
  useEffect(() => {
    setIsCompleted(false);
    animate(dragX, 0, { type: 'spring', stiffness: 500, damping: 35 });
  }, [paymentMethod, dragX]);

  const handleDragEnd = async () => {
    setIsDragging(false);
    if (disabled || isProcessing || isCompleted) return;

    const currentX = dragX.get();
    const threshold = maxDrag * 0.85; // 85% threshold

    if (currentX >= threshold) {
      // Snap to full completion
      haptic.medium();
      setIsCompleted(true);
      await animate(dragX, maxDrag, { type: 'spring', stiffness: 500, damping: 30 });
      try {
        await onConfirm();
      } catch (err) {
        setIsCompleted(false);
        animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 25 });
      }
    } else {
      // Snap back to starting position
      haptic.light();
      animate(dragX, 0, { type: 'spring', stiffness: 450, damping: 28 });
    }
  };

  const handleAccessibleTap = async () => {
    if (disabled || isProcessing || isCompleted) return;
    haptic.medium();
    setIsCompleted(true);
    await animate(dragX, maxDrag, { type: 'spring', stiffness: 500, damping: 30 });
    try {
      await onConfirm();
    } catch (err) {
      setIsCompleted(false);
      animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 25 });
    }
  };

  // Dynamic button labels adhering strictly to specification
  const isUpi = paymentMethod === 'upi';
  
  const primaryText = isUpi 
    ? `Slide to Pay | ₹${amount}` 
    : 'Slide to Confirm Order';

  const processingText = isUpi 
    ? 'Opening UPI…' 
    : 'Confirming your order…';

  const accessibleTapText = isUpi 
    ? `Tap to Pay (₹${amount})` 
    : 'Tap to Confirm Order';

  return (
    <div className={cn("w-full select-none space-y-2", className)} id={id}>
      {/* Outer Swipe Track */}
      <div
        ref={containerRef}
        className={cn(
          "relative w-full h-[58px] sm:h-[62px] p-1.5 rounded-2xl flex items-center overflow-hidden transition-all duration-300 shadow-sm border",
          disabled
            ? "bg-stone-100 border-stone-200 cursor-not-allowed opacity-75"
            : isUpi
              ? "bg-[#1E1B18] border-stone-800 shadow-stone-900/10"
              : "bg-[#18181B] border-zinc-800 shadow-zinc-900/10"
        )}
        role="slider"
        aria-label={primaryText}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((dragX.get() / (maxDrag || 1)) * 100)}
        aria-disabled={disabled || isProcessing}
      >
        {/* Dynamic Progress Fill Backdrop */}
        {!disabled && (
          <motion.div
            className={cn(
              "absolute inset-y-0 left-0 rounded-2xl transition-opacity pointer-events-none",
              isUpi 
                ? "bg-gradient-to-r from-[#E76A54]/20 via-[#E76A54]/30 to-[#E76A54]/40" 
                : "bg-gradient-to-r from-emerald-600/20 via-emerald-600/30 to-emerald-600/40"
            )}
            style={{ width: fillWidth }}
          />
        )}

        {/* Ambient Subtle Shimmer / Glow */}
        {!disabled && !isProcessing && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />
        )}

        {/* Centered Track Text / Feedback Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-12">
          {disabled ? (
            <div className="flex items-center gap-2 text-stone-400 font-bold text-xs uppercase tracking-wider text-center">
              <Lock size={14} className="shrink-0" />
              <span className="truncate">{disabledReason || 'Checkout Unavailable'}</span>
            </div>
          ) : isProcessing ? (
            <div className="flex items-center gap-2.5 text-white font-bold text-xs sm:text-sm tracking-wide">
              <Loader2 className="animate-spin shrink-0 text-white" size={18} />
              <span>{processingText}</span>
            </div>
          ) : (
            <motion.div 
              style={{ opacity: textOpacity }}
              className="flex items-center gap-2 text-center"
            >
              <span className="text-white/90 font-bold text-xs sm:text-sm tracking-wide flex items-center gap-2 whitespace-nowrap">
                {isUpi && <Wallet size={15} className="text-[#E76A54] shrink-0" />}
                {!isUpi && <HandCoins size={15} className="text-emerald-400 shrink-0" />}
                {primaryText}
              </span>
            </motion.div>
          )}
        </div>

        {/* Draggable Circular Handle */}
        {!disabled && (
          <motion.div
            drag={!isProcessing && !isCompleted ? "x" : false}
            dragConstraints={{ left: 0, right: maxDrag }}
            dragElastic={0.08}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            style={{ x: dragX, scale: handleScale }}
            className={cn(
              "relative z-10 w-[46px] h-[46px] sm:w-[50px] sm:h-[50px] rounded-xl flex items-center justify-center text-white cursor-grab active:cursor-grabbing shadow-md transition-colors",
              isProcessing || isCompleted
                ? isUpi ? "bg-[#E76A54]" : "bg-emerald-600"
                : isUpi
                  ? "bg-[#E76A54] hover:bg-[#d85c46] shadow-[#E76A54]/30"
                  : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
            )}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAccessibleTap();
              }
            }}
          >
            {isProcessing ? (
              <Loader2 className="animate-spin text-white" size={20} />
            ) : isCompleted ? (
              <Check className="text-white stroke-[2.5]" size={22} />
            ) : (
              <ArrowRight className="text-white stroke-[2.5] animate-pulse" size={20} />
            )}
          </motion.div>
        )}
      </div>

      {/* Accessible Alternative: Tap Action & Screen Reader Support */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setShowTapFallback(!showTapFallback)}
          className="text-[11px] font-semibold text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors cursor-pointer"
        >
          {showTapFallback ? 'Hide direct button' : 'Prefer tapping instead of sliding?'}
        </button>

        <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-400">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Encrypted</span>
        </div>
      </div>

      {/* Accessible Direct Click / Tap Fallback for Motor Accessibility */}
      {showTapFallback && !disabled && (
        <motion.button
          type="button"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          onClick={handleAccessibleTap}
          disabled={disabled || isProcessing || isCompleted}
          className={cn(
            "w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border transition-all cursor-pointer",
            isUpi
              ? "bg-[#E76A54]/10 text-[#E76A54] border-[#E76A54]/30 hover:bg-[#E76A54]/20"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
            (disabled || isProcessing) && "opacity-50 pointer-events-none"
          )}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              <span>{processingText}</span>
            </>
          ) : (
            <>
              <span>{accessibleTapText}</span>
              <ArrowRight size={14} />
            </>
          )}
        </motion.button>
      )}
    </div>
  );
};
