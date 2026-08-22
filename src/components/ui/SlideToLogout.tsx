import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LogOut, Check, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export type SlideToLogoutState = 'idle' | 'dragging' | 'completed' | 'loggingOut' | 'error';

export interface SlideToLogoutProps {
  onLogout?: () => Promise<void> | void;
  onSuccess?: () => void;
  onError?: (error: Error | any) => void;
  className?: string;
  label?: string;
  releaseLabel?: string;
  loggingOutLabel?: string;
  threshold?: number; // 0.0 to 1.0 (default 0.90)
  disabled?: boolean;
  autoRedirect?: boolean;
  redirectPath?: string;
}

export const SlideToLogout: React.FC<SlideToLogoutProps> = ({
  onLogout,
  onSuccess,
  onError,
  className,
  label = 'Slide to Logout',
  releaseLabel = 'Release to Logout',
  loggingOutLabel = 'Logging out…',
  threshold = 0.90,
  disabled = false,
  autoRedirect = true,
  redirectPath = '/login',
}) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<SlideToLogoutState>('idle');
  const [dragProgress, setDragProgress] = useState<number>(0); // 0 to 1
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);
  const maxTravelRef = useRef<number>(0);
  const lastVibrateTimeRef = useRef<number>(0);
  const lastVibratedStepRef = useRef<number>(0);

  const dragProgressRef = useRef<number>(0);

  const updateDragProgress = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    dragProgressRef.current = clamped;
    setDragProgress(clamped);
  }, []);

  // Check prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Safe Haptic feedback handler
  const triggerHaptic = useCallback((pattern: number | number[]) => {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Feature not supported or blocked by browser policy
      }
    }
  }, []);

  // Update track dimensions
  const updateDimensions = useCallback(() => {
    if (!containerRef.current || !thumbRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    const thumbWidth = thumbRef.current.clientWidth;
    // Calculate effective travel distance with 8px internal padding on each side
    const maxTravel = Math.max(0, containerWidth - thumbWidth - 16);
    maxTravelRef.current = maxTravel;
  }, []);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Execute Logout
  const executeLogout = useCallback(async () => {
    setState('loggingOut');
    updateDragProgress(1);
    triggerHaptic([20, 40, 60]);

    try {
      if (onLogout) {
        await onLogout();
      } else {
        // Bypass confirmation modal since Slide-to-Logout is the deliberate gesture
        await logout(true);
      }

      setState('completed');
      if (onSuccess) {
        onSuccess();
      }

      if (autoRedirect) {
        setTimeout(() => {
          navigate(redirectPath, { replace: true });
        }, 350);
      }
    } catch (err: any) {
      console.error('[SlideToLogout] Logout failed:', err);
      setState('error');
      setErrorMessage('Logout failed. Please try again.');
      if (onError) onError(err);

      // Reset after error delay so user can retry smoothly
      setTimeout(() => {
        setState('idle');
        updateDragProgress(0);
        setErrorMessage(null);
      }, 2500);
    }
  }, [onLogout, logout, onSuccess, onError, autoRedirect, navigate, redirectPath, triggerHaptic, updateDragProgress]);

  // Handle Start of Drag / Click
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (disabled || state === 'loggingOut' || state === 'completed') return;

    // Only accept primary pointer click / touch
    if ('button' in e && e.button !== 0 && (e as React.PointerEvent).pointerType === 'mouse') return;

    updateDimensions();
    const maxTravel = maxTravelRef.current;
    if (maxTravel <= 0) return;

    const clientX = 'touches' in e && e.touches.length > 0
      ? e.touches[0].clientX
      : (e as React.MouseEvent).clientX;

    if (clientX === undefined || isNaN(clientX)) return;

    isDraggingRef.current = true;
    startXRef.current = clientX;
    currentXRef.current = clientX;
    lastVibrateTimeRef.current = Date.now();
    lastVibratedStepRef.current = 0;

    setState('dragging');
    setErrorMessage(null);

    // Initial subtle touch feedback
    triggerHaptic(10);
  };

  // Global window listeners during active dragging
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

      // Throttled step-based haptics (at 25%, 50%, 75%, and threshold)
      const currentStep = Math.floor(progress * 4);
      const now = Date.now();
      if (currentStep > lastVibratedStepRef.current && now - lastVibrateTimeRef.current > 120) {
        triggerHaptic(10);
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
        executeLogout();
      } else {
        setState('idle');
        updateDragProgress(0);
        triggerHaptic(5);
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
  }, [state, threshold, executeLogout, triggerHaptic, updateDragProgress]);

  // Keyboard accessibility handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || state === 'loggingOut' || state === 'completed') return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextProgress = Math.min(1, dragProgressRef.current + 0.25);
      updateDragProgress(nextProgress);
      triggerHaptic(10);
      if (nextProgress >= threshold) {
        executeLogout();
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextProgress = Math.max(0, dragProgressRef.current - 0.25);
      updateDragProgress(nextProgress);
      triggerHaptic(10);
    } else if (e.key === 'End' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Slide directly to completion
      updateDragProgress(1);
      executeLogout();
    } else if (e.key === 'Home' || e.key === 'Escape') {
      e.preventDefault();
      setState('idle');
      updateDragProgress(0);
    }
  };

  // Compute translateX pixel offset
  const thumbTranslateX = maxTravelRef.current > 0 
    ? dragProgress * maxTravelRef.current 
    : 0;

  const isCompleted = state === 'completed';
  const isLoggingOut = state === 'loggingOut';
  const isError = state === 'error';
  const isThresholdMet = dragProgress >= threshold;

  // Determine center text based on progress and state
  const getDisplayText = () => {
    if (isLoggingOut) return loggingOutLabel;
    if (isCompleted) return 'Success!';
    if (isThresholdMet) return releaseLabel;
    if (state === 'dragging' && dragProgress > 0.4) return releaseLabel;
    return label;
  };

  return (
    <div className={cn("w-full select-none flex flex-col items-center gap-2", className)}>
      {/* Outer Pill Track */}
      <div
        ref={containerRef}
        role="slider"
        aria-label="Slide to logout"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(dragProgress * 100)}
        aria-valuetext={getDisplayText()}
        tabIndex={disabled || isLoggingOut ? -1 : 0}
        onKeyDown={handleKeyDown}
        style={{ touchAction: 'pan-y' }}
        className={cn(
          "relative w-full h-16 md:h-18 p-2 rounded-full overflow-hidden flex items-center transition-all duration-300",
          "bg-neutral-950/85 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/80 focus-visible:border-orange-500/50",
          isThresholdMet && !isError && "border-orange-500/50 shadow-[0_0_30px_rgba(249,115,22,0.25)]",
          isError && "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Dynamic Gradient Fill behind Thumb */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 rounded-full transition-all pointer-events-none",
            isError
              ? "bg-gradient-to-r from-red-600/30 to-red-500/50"
              : "bg-gradient-to-r from-orange-600/30 via-amber-600/40 to-orange-500/50",
            !isDraggingRef.current && !prefersReducedMotion ? "duration-300 ease-out" : "duration-0"
          )}
          style={{
            width: `calc(${dragProgress * 100}% + ${thumbRef.current ? thumbRef.current.clientWidth : 56}px)`,
            maxWidth: '100%'
          }}
        />

        {/* Ambient track glow dots */}
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-red-500/5 pointer-events-none" />

        {/* Track Label with dynamic shimmer & arrow guide */}
        <div className="relative w-full flex items-center justify-center pointer-events-none px-14">
          <span
            className={cn(
              "text-xs md:text-sm font-black tracking-[0.15em] uppercase transition-all duration-200 flex items-center gap-2",
              isThresholdMet
                ? "text-orange-400 scale-105"
                : dragProgress > 0.2
                ? "text-zinc-200"
                : "text-zinc-400"
            )}
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                {loggingOutLabel}
              </>
            ) : isCompleted ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                Session Ended
              </>
            ) : (
              <>
                {getDisplayText()}
                {!isThresholdMet && state === 'idle' && (
                  <span className="flex items-center text-orange-500/60 -space-x-1 animate-pulse">
                    <ChevronRight size={14} />
                    <ChevronRight size={14} className="opacity-70" />
                    <ChevronRight size={14} className="opacity-40" />
                  </span>
                )}
              </>
            )}
          </span>
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
            transition: !isDraggingRef.current && !prefersReducedMotion 
              ? 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s' 
              : 'box-shadow 0.2s',
          }}
          className={cn(
            "absolute left-2 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center z-20 cursor-grab active:cursor-grabbing",
            "bg-gradient-to-br from-neutral-800 via-neutral-900 to-orange-950 border border-orange-500/40",
            "shadow-[0_4px_18px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)]",
            "hover:border-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.4)]",
            isThresholdMet && "bg-gradient-to-br from-orange-500 to-red-600 border-orange-300 shadow-[0_0_25px_rgba(249,115,22,0.7)]",
            isError && "bg-gradient-to-br from-red-600 to-red-800 border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.7)]",
            isLoggingOut && "cursor-wait"
          )}
        >
          {isLoggingOut ? (
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-white animate-spin" />
          ) : isCompleted ? (
            <Check className="w-5 h-5 md:w-6 md:h-6 text-white stroke-[3]" />
          ) : isError ? (
            <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
          ) : (
            <LogOut
              className={cn(
                "w-5 h-5 md:w-6 md:h-6 transition-all duration-200",
                isThresholdMet ? "text-white scale-110" : "text-orange-400 group-hover:text-orange-300",
                state === 'dragging' && "rotate-12"
              )}
            />
          )}

          {/* Glowing ring animation on thumb */}
          {state === 'idle' && (
            <div className="absolute inset-0 rounded-full border border-orange-500/20 animate-ping opacity-30 pointer-events-none" />
          )}
        </div>
      </div>

      {/* Accessible hint & Error messaging */}
      {errorMessage ? (
        <div className="flex items-center gap-1.5 text-xs text-red-400 font-bold tracking-wide animate-shake">
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </div>
      ) : (
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center">
          Drag slider right or press <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] text-zinc-300 font-mono">Space</kbd> / <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px] text-zinc-300 font-mono">Enter</kbd>
        </p>
      )}
    </div>
  );
};

export default SlideToLogout;
