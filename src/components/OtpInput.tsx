import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { AlertCircle } from 'lucide-react';

export interface OtpInputProps {
  /** Current value of the OTP (can be string like "123456" or string array) */
  value?: string | string[];
  /** Callback fired whenever the OTP changes */
  onChange?: (otp: string, otpArray: string[]) => void;
  /** Number of digits (default: 6) */
  length?: number;
  /** Error state: boolean, or error message string */
  error?: boolean | string | null;
  /** Disable all input slots */
  disabled?: boolean;
  /** Automatically focus the first empty input on mount (default: true) */
  autoFocus?: boolean;
  /** Callback triggered when all digits are filled */
  onComplete?: (code: string) => void;
  /** Custom container class */
  className?: string;
  /** Unique HTML id for testing / automation */
  id?: string;
  /** Visual size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom input slot class */
  inputClassName?: string;
  /** Custom helper or error message to display */
  errorMessage?: string | null;
  /** Show subtle glowing bottom underline indicator */
  showUnderline?: boolean;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value = '',
  onChange,
  length = 6,
  error = false,
  disabled = false,
  autoFocus = true,
  onComplete,
  className = '',
  id = 'otp_input_group',
  size = 'md',
  inputClassName = '',
  errorMessage,
  showUnderline = true,
}) => {
  const isError = Boolean(error) || Boolean(errorMessage);
  const errorText = typeof error === 'string' ? error : errorMessage || null;

  // Internal state representation
  const [digits, setDigits] = useState<string[]>(() => {
    if (Array.isArray(value)) {
      return Array.from({ length }, (_, i) => value[i] || '');
    }
    const str = String(value || '');
    return Array.from({ length }, (_, i) => str[i] || '');
  });

  const [activeBox, setActiveBox] = useState<number | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevErrorRef = useRef<boolean>(false);

  // Sync external value changes
  useEffect(() => {
    if (Array.isArray(value)) {
      const next = Array.from({ length }, (_, i) => value[i] || '');
      setDigits(next);
    } else {
      const str = String(value || '');
      const next = Array.from({ length }, (_, i) => str[i] || '');
      setDigits(next);
    }
  }, [value, length]);

  // Trigger shake animation and focus on error change
  useEffect(() => {
    if (isError && !prevErrorRef.current) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 550);
      return () => clearTimeout(timer);
    }
    prevErrorRef.current = isError;
  }, [isError]);

  // Initial autofocus
  useEffect(() => {
    if (!autoFocus || disabled) return;
    const firstEmpty = digits.findIndex(d => !d);
    const targetIdx = firstEmpty === -1 ? 0 : firstEmpty;
    const timer = setTimeout(() => {
      inputRefs.current[targetIdx]?.focus();
      setActiveBox(targetIdx);
    }, 100);
    return () => clearTimeout(timer);
  }, [autoFocus, disabled]);

  const updateDigits = useCallback((newDigits: string[]) => {
    setDigits(newDigits);
    const joined = newDigits.join('');
    onChange?.(joined, newDigits);

    if (newDigits.length === length && newDigits.every(d => Boolean(d))) {
      onComplete?.(joined);
    }
  }, [length, onChange, onComplete]);

  const handleChange = (val: string, index: number) => {
    if (disabled) return;
    const cleaned = val.replace(/[^0-9]/g, '');
    const next = [...digits];
    next[index] = cleaned ? cleaned.slice(-1) : '';
    updateDigits(next);

    // Auto advance to next slot
    if (cleaned !== '' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setActiveBox(index + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (disabled) return;
    if (e.key === 'Backspace') {
      if (digits[index] === '' && index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        updateDigits(next);
        inputRefs.current[index - 1]?.focus();
        setActiveBox(index - 1);
      } else {
        const next = [...digits];
        next[index] = '';
        updateDigits(next);
        setActiveBox(index);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setActiveBox(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      setActiveBox(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < length; i++) {
      next[i] = pasted[i] || '';
    }
    updateDigits(next);

    const nextEmptyIndex = next.findIndex(d => !d);
    const focusTarget = nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex;
    inputRefs.current[focusTarget]?.focus();
    setActiveBox(focusTarget);
  };

  // Dimensions based on size
  const sizeClasses = {
    sm: 'max-w-[40px] min-w-[32px] h-11 sm:h-12 text-lg',
    md: 'max-w-[48px] min-w-[38px] h-14 sm:h-16 text-xl sm:text-2xl',
    lg: 'max-w-[56px] min-w-[44px] h-16 sm:h-20 text-2xl sm:text-3xl',
  }[size];

  return (
    <div className={`w-full flex flex-col items-center gap-3 ${className}`} id={id}>
      {/* Input Slot Fields Container with motion shake animation */}
      <motion.div
        animate={isShaking || isError ? { x: [0, -7, 7, -6, 6, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        className="flex justify-center items-center gap-2 sm:gap-2.5 w-full max-w-[360px] mx-auto py-1"
      >
        {Array.from({ length }).map((_, idx) => {
          const digit = digits[idx] || '';
          const isFocused = activeBox === idx;
          const isFilled = digit !== '';

          return (
            <div
              key={idx}
              className={`relative flex-1 aspect-square ${sizeClasses}`}
            >
              <input
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                maxLength={1}
                value={digit}
                disabled={disabled}
                onFocus={() => setActiveBox(idx)}
                onBlur={() => setActiveBox(null)}
                onChange={(e) => handleChange(e.target.value, idx)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                onPaste={handlePaste}
                className={`absolute inset-0 w-full h-full text-center border rounded-2xl font-black font-mono focus:outline-none transition-all duration-200 cursor-text select-all disabled:opacity-40 disabled:cursor-not-allowed
                  ${isError
                    ? 'border-red-500 bg-red-500/10 text-red-400 ring-2 ring-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.35)]'
                    : isFocused
                      ? 'border-amber-400 bg-amber-500/[0.08] shadow-[0_0_20px_rgba(245,158,11,0.35)] scale-105 text-amber-300 ring-2 ring-amber-400/20'
                      : isFilled
                        ? 'border-amber-500/40 text-white bg-white/[0.05]'
                        : 'border-white/10 text-white hover:border-white/20'
                  }
                  ${inputClassName}
                `}
                autoComplete="one-time-code"
                pattern="\d*"
                inputMode="numeric"
                id={`${id}_slot_${idx}`}
              />

              {/* Glowing bottom indicator */}
              {showUnderline && (
                <>
                  {isError ? (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-red-500 rounded-full blur-[0.4px]" />
                  ) : isFilled && !isFocused ? (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3.5 h-[2px] bg-amber-400/90 rounded-full blur-[0.4px]" />
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Optional inline error text banner */}
      {errorText && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-2.5 px-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 text-left max-w-[340px] w-full"
          id={`${id}_error_banner`}
        >
          <AlertCircle size={14} className="text-rose-400 shrink-0" />
          <span className="leading-tight font-medium">{errorText}</span>
        </motion.div>
      )}
    </div>
  );
};

export default OtpInput;
