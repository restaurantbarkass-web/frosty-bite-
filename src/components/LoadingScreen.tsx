import React from 'react';
import { motion } from 'motion/react';
import { Logo } from './Logo';

interface LoadingScreenProps {
  fullScreen?: boolean;
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ fullScreen = true, message }) => {
  return (
    <div className={`${fullScreen ? 'fixed inset-0 z-[100]' : 'w-full h-full min-h-[400px]'} flex flex-col items-center justify-center bg-[#030303] text-white overflow-hidden`}>
      {/* Cinematic Background */}
      <div className="absolute inset-0">
        <motion.div 
          animate={{ 
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.1, 1],
            rotate: [0, 5, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent blur-3xl"
        />
        <motion.div 
          animate={{ 
            opacity: [0.1, 0.3, 0.1],
            scale: [1.1, 1, 1.1],
            rotate: [0, -5, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent blur-3xl"
        />
        
        {/* Film Grain/Noise overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      <div className="relative flex flex-col items-center max-w-sm w-full px-8">
        {/* Elegant Animated Logo/Icon Assembly */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* Orbital Progress Rings */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            <motion.circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="white"
              strokeWidth="0.5"
              strokeOpacity="0.05"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="url(#progress-gradient)"
              strokeWidth="1"
              strokeDasharray="301"
              initial={{ strokeDashoffset: 301 }}
              animate={{ strokeDashoffset: [301, 150, 301] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="50%" stopColor="white" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
          </svg>

          {/* Artistic Cake Illustration */}
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Stand */}
              <motion.path
                d="M30,85 L70,85 M50,85 L50,75"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.3 }}
                transition={{ duration: 0.8 }}
              />
              
              {/* Cake Body */}
              <motion.path
                d="M25,75 L25,45 Q50,35 75,45 L75,75 Q50,85 25,75"
                fill="none"
                stroke="url(#gold-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
              />

              {/* Decorative Swirl */}
              <motion.path
                d="M30,55 Q50,65 70,55"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
                strokeOpacity="0.2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, delay: 0.2, repeat: Infinity }}
              />

              {/* Topping */}
              <motion.circle
                cx="50"
                cy="38"
                r="4"
                fill="#f97316"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              <defs>
                <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="50%" stopColor="white" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Magical Particles */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ 
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                  translateY: [-20, -100],
                  translateX: [0, (i % 2 === 0 ? 20 : -20)]
                }}
                transition={{ 
                  duration: 2.5 + Math.random() * 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
                className="absolute top-1/2 left-1/2 w-1 h-1 bg-primary rounded-full blur-[1px]"
              />
            ))}
          </div>
        </div>

        {/* Sophisticated Typography */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center w-full space-y-12"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.8em] text-white/30">
                Est. 2024
              </span>
            </div>
            <motion.h3 
              className="text-5xl md:text-6xl font-serif italic text-white tracking-tighter"
            >
              Frosty Bite
            </motion.h3>
            <div className="flex items-center justify-center gap-6">
              <div className="h-[1px] w-16 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary whitespace-nowrap">
                Master Bakers
              </span>
              <div className="h-[1px] w-16 bg-gradient-to-l from-transparent via-primary/50 to-transparent" />
            </div>
          </div>

          {/* Modern Progress Indicator */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative w-48 h-[1px] bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                animate={{ 
                  left: ["-100%", "100%"] 
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute top-0 bottom-0 w-2/3 bg-gradient-to-r from-transparent via-primary to-transparent"
              />
            </div>
            
            <div className="space-y-1">
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.4em]"
              >
                {message || "Refining the artisan crumb"}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-12 flex flex-col items-center gap-4 opacity-40">
        <div className="flex items-center gap-6">
          <span className="text-[8px] font-black tracking-[0.2em]">01</span>
          <div className="w-1 h-1 bg-white/30 rounded-full" />
          <span className="text-[8px] font-black tracking-[0.2em]">02</span>
          <div className="w-1 h-1 bg-white/30 rounded-full" />
          <span className="text-[8px] font-black tracking-[0.2em]">03</span>
        </div>
        <div className="text-[10px] font-serif italic text-white/60">
          Since 2024
        </div>
      </div>
    </div>
  );
};
