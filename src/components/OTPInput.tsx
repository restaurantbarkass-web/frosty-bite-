import React, { useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  value,
  onChange,
  length = 6,
  disabled = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!/^\d*$/.test(val)) return; // Only allow numbers

    const newOTP = value.split('');
    // Take only the last character if multiple are pasted/typed
    newOTP[index] = val.slice(-1);
    const combined = newOTP.join('');
    onChange(combined);

    // Move to next input if value is entered
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    if (!/^\d*$/.test(pastedData)) return;
    onChange(pastedData);
    
    // Focus the last filled input or the next empty one
    const nextIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-4" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <motion.input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="w-10 h-12 sm:w-12 sm:h-14 bg-white/5 border border-white/10 rounded-xl text-center text-xl font-bold text-white outline-none transition-all focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 disabled:opacity-50"
        />
      ))}
    </div>
  );
};
