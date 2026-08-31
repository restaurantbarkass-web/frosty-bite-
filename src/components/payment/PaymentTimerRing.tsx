import React from 'react';
import { motion } from 'motion/react';
import { Clock, AlertCircle } from 'lucide-react';
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
  // Phase 1: Calm (>120s)
  // Phase 2: Warning (30s - 120s)
  // Phase 3: Urgent (<30s)
  const isUrgent = safeTime <= 30;
  const isWarning = safeTime > 30 && safeTime <= 120;
  
  const phaseTheme = isUrgent
    ? {
        stroke: '#EF4444', // Rose 500
        text: 'text-rose-400',
        bgGlow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]',
        badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        label: 'URGENT - EXPORTING SOON'
      }
    : isWarning
    ? {
        stroke: '#F59E0B', // Amber 500
        text: 'text-amber-400',
        bgGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.2)]',
        badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        label: 'TIME RUNNING LOW'
      }
    : {
        stroke: '#10B981', // Emerald 500
        text: 'text-emerald-400',
        bgGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        label: 'VERIFICATION ACTIVE'
      };

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center space-y-2 select-none">
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Background glow ring */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full transition-all duration-500",
            phaseTheme.bgGlow
          )} 
        />

        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          {/* Background Track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-zinc-800"
            strokeWidth="6"
            fill="none"
          />
          {/* Progress Path */}
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            stroke={phaseTheme.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: 'linear' }}
          />
        </svg>

        {/* Center Time Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
            TIME LEFT
          </p>
          <motion.p 
            animate={isUrgent && !reducedMotion ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            className={cn("text-xl font-black italic tracking-tight font-mono", phaseTheme.text)}
            aria-live="polite"
            aria-label={`Time remaining ${formattedTime}`}
          >
            {formattedTime}
          </motion.p>
        </div>
      </div>

      <div className={cn("px-2.5 py-0.5 rounded-full border text-[9px] font-black tracking-widest uppercase flex items-center gap-1.5", phaseTheme.badgeBg)}>
        {isUrgent ? <AlertCircle size={10} className="animate-pulse" /> : <Clock size={10} />}
        <span>{phaseTheme.label}</span>
      </div>
    </div>
  );
};
