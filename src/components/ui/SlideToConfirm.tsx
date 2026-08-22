import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, Check, Loader2, ChevronRight, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export type SlideToConfirmState = 'idle' | 'dragging' | 'completed' | 'processing' | 'error';

export interface SlideToConfirmProps {
  onConfirm: () => Promise<void> | void;
  onSuccess?: () => void;
  onError?: (error: Error | any) => void;
  className?: string;
  label?: string;
  releaseLabel?: string;
  processingLabel?: string;
  successLabel?: string;
  threshold?: number; // 0.0 to 1.0 (default 0.88)
  disabled?: boolean;
  variant?: 'danger' | 'warning' | 'emerald' | 'orange';
  icon?: React.ReactNode;
}

export const SlideToConfirm: React.FC<SlideToConfirmProps> = ({
  onConfirm,
  onSuccess,
  onError,
  className,
  label = 'Slide to Confirm',
  releaseLabel = 'Release to Confirm',
  processingLabel = 'Processing…',
  successLabel = 'Confirmed!',
  threshold = 0.88,
  disabled = false,
  variant = 'danger',
  icon
}) => {
  const [state, setState] = useState<SlideToConfirmState>('idle');
  const [dragProgress, setDragProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSpringingBack, setIsSpringingBack] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const maxTravelRef = useRef<number>(0);
  const lastVibrateTimeRef = useRef<number>(0);
  const lastVibratedStepRef = useRef<number>(0);
  const dragProgressRef = useRef<number>(0);
  const springTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateDragProgress = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    dragProgressRef.current = clamped;
    setDragProgress(clamped);
  }, []);

  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Haptics not supported or restricted
      }
    }
  }, []);

  const triggerSpringReturn = useCallback(() => {
    setIsSpringingBack(true);
    setState('idle');
    updateDragProgress(0);
    triggerHaptic(8);

    if (springTimerRef.current) clearTimeout(springTimerRef.current);
    springTimerRef.current = setTimeout(() => {
      setIsSpringingBack(false);
    }, 450);
  }, [triggerHaptic, updateDragProgress]);

  useEffect(() => {
    return () => {
      if (springTimerRef.current) clearTimeout(springTimerRef.current);
    };
  }, []);

  const updateDimensions = useCallback(() => {
    if (!containerRef.current || !thumbRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const thumbWidth = thumbRef.current.clientWidth;
    const maxTravel = Math.max(0, containerWidth - thumbWidth - 16);
    maxTravelRef.current = maxTravel;
  }, []);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  const executeConfirm = useCallback(async () => {
    setIsSpringingBack(false);
    setState('processing');
    updateDragProgress(1);
    // Strong vibration pulse sequence on confirm trigger
    triggerHaptic([40, 50, 70, 50, 120]);

    const startTime = Date.now();

    try {
      await onConfirm();

      const elapsed = Date.now() - startTime;
      if (elapsed < 420) {
        await new Promise(res => setTimeout(res, 420 - elapsed));
      }

      setState('completed');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[SlideToConfirm] Action failed:', err);
      setState('error');
      setErrorMessage(err?.message || 'Action failed. Please try again.');
      if (onError) onError(err);

      setTimeout(() => {
        triggerSpringReturn();
        setErrorMessage(null);
      }, 2500);
    }
  }, [onConfirm, onSuccess, onError, triggerHaptic, updateDragProgress, triggerSpringReturn]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (disabled || state === 'processing' || state === 'completed') return;

    if ('button' in e && e.button !== 0 && (e as React.PointerEvent).pointerType === 'mouse') return;

    updateDimensions();
    const maxTravel = maxTravelRef.current;
    if (maxTravel <= 0) return;

    const clientX = 'touches' in e && e.touches.length > 0
      ? e.touches[0].clientX
      : (e as React.MouseEvent).clientX;

    if (clientX === undefined || isNaN(clientX)) return;

    if (springTimerRef.current) clearTimeout(springTimerRef.current);
    setIsSpringingBack(false);

    isDraggingRef.current = true;
    startXRef.current = clientX;
    lastVibrateTimeRef.current = Date.now();
    lastVibratedStepRef.current = 0;

    setState('dragging');
    setErrorMessage(null);

    // Initial haptic tick
    triggerHaptic(20);
  };

  useEffect(() => {
    if (state !== 'dragging') return;

    const handleWindowPointerMove = (e: PointerEvent | MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      const maxTravel = maxTravelRef.current;
      if (maxTravel <= 0) return;

      const clientX = 'touches' in e && (e as TouchEvent).touches.length > 0
        ? (e as TouchEvent).touches[0].clientX
        : (e as MouseEvent).clientX;

      const deltaX = clientX - startXRef.current;
      const clampedDistance = Math.max(0, Math.min(deltaX, maxTravel));
      const progress = clampedDistance / maxTravel;

      updateDragProgress(progress);

      // Throttled step haptics at progress milestones (every 20%)
      const currentStep = Math.floor(progress * 5);
      const now = Date.now();
      if (currentStep > lastVibratedStepRef.current && now - lastVibrateTimeRef.current > 90) {
        if (progress >= threshold) {
          triggerHaptic([30, 40, 50]);
        } else {
          triggerHaptic(15);
        }
        lastVibratedStepRef.current = currentStep;
        lastVibrateTimeRef.current = now;
      }
    };

    const handleWindowPointerUp = (e: PointerEvent | MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      const maxTravel = maxTravelRef.current;
      let finalProgress = dragProgressRef.current;

      if (maxTravel > 0) {
        const clientX = 'changedTouches' in e && (e as TouchEvent).changedTouches.length > 0
          ? (e as TouchEvent).changedTouches[0].clientX
          : (e as MouseEvent).clientX;

        if (clientX !== undefined && !isNaN(clientX)) {
          const deltaX = clientX - startXRef.current;
          const clampedDistance = Math.max(0, Math.min(deltaX, maxTravel));
          finalProgress = clampedDistance / maxTravel;
        }
      }

      if (finalProgress >= threshold) {
        updateDragProgress(1);
        executeConfirm();
      } else {
        triggerSpringReturn();
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);
    window.addEventListener('mousemove', handleWindowPointerMove);
    window.addEventListener('mouseup', handleWindowPointerUp);
    window.addEventListener('touchmove', handleWindowPointerMove, { passive: true });
    window.addEventListener('touchend', handleWindowPointerUp);
    window.addEventListener('touchcancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
      window.removeEventListener('mousemove', handleWindowPointerMove);
      window.removeEventListener('mouseup', handleWindowPointerUp);
      window.removeEventListener('touchmove', handleWindowPointerMove);
      window.removeEventListener('touchend', handleWindowPointerUp);
      window.removeEventListener('touchcancel', handleWindowPointerUp);
    };
  }, [state, threshold, executeConfirm, triggerHaptic, updateDragProgress, triggerSpringReturn]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || state === 'processing' || state === 'completed') return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIsSpringingBack(false);
      const nextProgress = Math.min(1, dragProgressRef.current + 0.25);
      updateDragProgress(nextProgress);
      triggerHaptic(15);
      if (nextProgress >= threshold) {
        executeConfirm();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIsSpringingBack(false);
      const nextProgress = Math.max(0, dragProgressRef.current - 0.25);
      updateDragProgress(nextProgress);
      triggerHaptic(15);
    } else if (e.key === 'End' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsSpringingBack(false);
      updateDragProgress(1);
      executeConfirm();
    } else if (e.key === 'Home' || e.key === 'Escape') {
      e.preventDefault();
      triggerSpringReturn();
    }
  };

  const thumbTranslateX = maxTravelRef.current > 0 ? dragProgress * maxTravelRef.current : 0;
  const isCompleted = state === 'completed';
  const isProcessing = state === 'processing';
  const isError = state === 'error';
  const isThresholdMet = dragProgress >= threshold;

  // Variant Styling
  const variantStyles = {
    danger: {
      trackBg: "bg-red-950/80 border-red-500/30 shadow-[0_12px_40px_rgba(239,68,68,0.2)]",
      thresholdBorder: "border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.4)]",
      gradient: "bg-gradient-to-r from-red-600/30 via-rose-600/40 to-red-500/60",
      thumbBg: "bg-gradient-to-br from-neutral-800 via-neutral-900 to-red-950 border-red-500/50",
      thumbActive: "bg-gradient-to-br from-red-500 to-rose-700 border-red-300 shadow-[0_0_25px_rgba(239,68,68,0.8)]",
      textColor: "text-red-400",
      arrowColor: "text-red-500/60",
    },
    warning: {
      trackBg: "bg-amber-950/80 border-amber-500/30 shadow-[0_12px_40px_rgba(245,158,11,0.2)]",
      thresholdBorder: "border-amber-500/80 shadow-[0_0_30px_rgba(245,158,11,0.4)]",
      gradient: "bg-gradient-to-r from-amber-600/30 via-orange-600/40 to-amber-500/60",
      thumbBg: "bg-gradient-to-br from-neutral-800 via-neutral-900 to-amber-950 border-amber-500/50",
      thumbActive: "bg-gradient-to-br from-amber-500 to-orange-700 border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.8)]",
      textColor: "text-amber-400",
      arrowColor: "text-amber-500/60",
    },
    emerald: {
      trackBg: "bg-emerald-950/80 border-emerald-500/30 shadow-[0_12px_40px_rgba(16,185,129,0.2)]",
      thresholdBorder: "border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.4)]",
      gradient: "bg-gradient-to-r from-emerald-600/30 via-teal-600/40 to-emerald-500/60",
      thumbBg: "bg-gradient-to-br from-neutral-800 via-neutral-900 to-emerald-950 border-emerald-500/50",
      thumbActive: "bg-gradient-to-br from-emerald-500 to-teal-700 border-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.8)]",
      textColor: "text-emerald-400",
      arrowColor: "text-emerald-500/60",
    },
    orange: {
      trackBg: "bg-neutral-950/85 border-orange-500/30 shadow-[0_12px_40px_rgba(249,115,22,0.2)]",
      thresholdBorder: "border-orange-500/80 shadow-[0_0_30px_rgba(249,115,22,0.4)]",
      gradient: "bg-gradient-to-r from-orange-600/30 via-amber-600/40 to-orange-500/60",
      thumbBg: "bg-gradient-to-br from-neutral-800 via-neutral-900 to-orange-950 border-orange-500/50",
      thumbActive: "bg-gradient-to-br from-orange-500 to-red-600 border-orange-300 shadow-[0_0_25px_rgba(249,115,22,0.8)]",
      textColor: "text-orange-400",
      arrowColor: "text-orange-500/60",
    }
  };

  const currentStyle = variantStyles[variant];

  const getDisplayText = () => {
    if (isProcessing) return processingLabel;
    if (isCompleted) return successLabel;
    if (isThresholdMet || (state === 'dragging' && dragProgress > 0.4)) return releaseLabel;
    return label;
  };

  const getTransitionStyle = (property: 'transform' | 'width') => {
    if (isDraggingRef.current) return 'none';
    if (isSpringingBack) return `${property} 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)`;
    return `${property} 0.35s cubic-bezier(0.16, 1, 0.3, 1)`;
  };

  return (
    <div className={cn("w-full select-none flex flex-col items-center gap-2", className)}>
      <div
        ref={containerRef}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(dragProgress * 100)}
        aria-valuetext={getDisplayText()}
        tabIndex={disabled || isProcessing ? -1 : 0}
        onKeyDown={handleKeyDown}
        style={{ touchAction: 'pan-y' }}
        className={cn(
          "relative w-full h-16 p-2 rounded-full overflow-hidden flex items-center transition-all duration-300 backdrop-blur-2xl border",
          currentStyle.trackBg,
          isThresholdMet && !isError && currentStyle.thresholdBorder,
          isError && "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Dynamic Gradient Fill */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 rounded-full pointer-events-none",
            isError ? "bg-gradient-to-r from-red-600/30 to-red-500/50" : currentStyle.gradient
          )}
          style={{
            width: `calc(${dragProgress * 100}% + ${thumbRef.current ? thumbRef.current.clientWidth : 56}px)`,
            maxWidth: '100%',
            transition: getTransitionStyle('width')
          }}
        />

        {/* Track Label */}
        <div className="relative w-full flex items-center justify-center pointer-events-none px-14 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.span
              key={isProcessing ? 'processing' : isCompleted ? 'completed' : isThresholdMet ? 'release' : 'idle'}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={cn(
                "text-xs font-black tracking-[0.15em] uppercase flex items-center gap-2",
                isThresholdMet ? `${currentStyle.textColor} scale-105` : dragProgress > 0.2 ? "text-zinc-200" : "text-zinc-400"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className={cn("w-4 h-4 animate-spin shrink-0", currentStyle.textColor)} />
                  <span>{processingLabel}</span>
                </>
              ) : isCompleted ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successLabel}</span>
                </>
              ) : (
                <>
                  <span>{getDisplayText()}</span>
                  {!isThresholdMet && state === 'idle' && (
                    <span className={cn("flex items-center -space-x-1 animate-pulse", currentStyle.arrowColor)}>
                      <ChevronRight size={14} />
                      <ChevronRight size={14} className="opacity-70" />
                      <ChevronRight size={14} className="opacity-40" />
                    </span>
                  )}
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Draggable Circular Thumb */}
        <div
          ref={thumbRef}
          onPointerDown={handlePointerDown}
          onMouseDown={handlePointerDown}
          onTouchStart={handlePointerDown}
          style={{
            transform: `translateX(${thumbTranslateX}px)`,
            touchAction: 'none',
            transition: `${getTransitionStyle('transform')}, box-shadow 0.2s`,
          }}
          className={cn(
            "absolute left-2 w-12 h-12 rounded-full flex items-center justify-center z-20 cursor-grab active:cursor-grabbing border shadow-lg",
            currentStyle.thumbBg,
            isThresholdMet && currentStyle.thumbActive,
            isError && "bg-gradient-to-br from-red-600 to-red-800 border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.7)]",
            isProcessing && "cursor-wait"
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : isCompleted ? (
            <Check className="w-5 h-5 text-white stroke-[3]" />
          ) : isError ? (
            <AlertCircle className="w-5 h-5 text-white" />
          ) : (
            icon ? (
              <span className={cn("transition-transform duration-200", isThresholdMet ? "text-white scale-110" : currentStyle.textColor)}>
                {icon}
              </span>
            ) : (
              <ShieldAlert className={cn("w-5 h-5 transition-transform duration-200", isThresholdMet ? "text-white scale-110" : currentStyle.textColor)} />
            )
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold tracking-wide">
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

export default SlideToConfirm;
