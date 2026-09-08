import React from 'react';
import { motion } from 'motion/react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PaymentTimerRingProps {
  timeLeftSeconds: number;
  totalDurationSeconds?: number; // default 360 (6 minutes)
  reducedMotion?: boolean;
}

export const PaymentTimerRing: React.FC<PaymentTimerRingProps> = ({
  timeLeftSeconds,
  totalDurationSeconds = 360,
  reducedMotion = false
}) => {
  const safeTime = Math.max(0, timeLeftSeconds);
  const minutes = Math.floor(safeTime / 60);
  const seconds = safeTime % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Progress fraction (1 at start, 0 at expiry)
  const progress = Math.min(1, Math.max(0, safeTime / totalDurationSeconds));

  // Urgency Phase determination
  // Phase 1: Calm (>120s) - Emerald
  // Phase 2: Warning (30s - 120s) - Amber
  // Phase 3: Urgent (<30s) - Rose with subtle pulse
  const isUrgent = safeTime <= 30;
  const isWarning = safeTime > 30 && safeTime <= 120;

  const phaseTheme = isUrgent
    ? {
        stroke: '#EF4444',
        text: 'text-rose-400',
        bgGlow: 'shadow-[0_0_24px_rgba(239,68,68,0.35)]',
        pulseGlow: 'bg-rose-500/10 border-rose-500/30'
      }
    : isWarning
    ? {
        stroke: '#F59E0B',
        text: 'text-amber-400',
        bgGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]',
        pulseGlow: 'bg-amber-500/10 border-amber-500/30'
      }
    : {
        stroke: '#10B981',
        text: 'text-emerald-400',
        bgGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
        pulseGlow: 'bg-emerald-500/10 border-emerald-500/30'
      };

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div 
      className="flex flex-col items-center select-none"
      role="timer"
      aria-label={`Time remaining: ${minutes} minutes and ${seconds} seconds`}
    >
      <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
        {/* Ambient radial glow */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full transition-all duration-700 pointer-events-none",
            phaseTheme.bgGlow
          )} 
        />

        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          {/* Background Track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-zinc-800/80"
            strokeWidth="5.5"
            fill="none"
          />
          {/* Progress Path */}
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            stroke={phaseTheme.stroke}
            strokeWidth="5.5"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: 'easeInOut' }}
          />
        </svg>

        {/* Center Time Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 mb-0.5">
            Time Left
          </span>
          <span className={cn(
            "text-base sm:text-lg font-black tracking-tight font-mono leading-none transition-colors duration-300",
            phaseTheme.text
          )}>
            {formattedTime}
          </span>
        </div>
      </div>
    </div>
  );
};

