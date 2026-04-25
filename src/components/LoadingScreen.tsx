import React from 'react';
import { motion } from 'motion/react';
import { Logo } from './Logo';

interface LoadingScreenProps {
  fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ fullScreen = true }) => {
  return (
    <div className={`${fullScreen ? 'fixed inset-0 z-[100]' : 'w-full h-full min-h-[400px]'} flex flex-col items-center justify-center bg-[#050505] text-white overflow-hidden`}>
      {/* Background Ambience */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        className="absolute inset-0 bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-primary/5 via-transparent to-transparent"
      />

      <div className="relative flex flex-col items-center">
        {/* Outer Pulsing Ring */}
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute w-40 h-40 rounded-full border border-primary/20"
        />

        {/* Progress Ring */}
        <div className="relative w-28 h-28">
          <svg className="w-full h-full rotate-[-90deg]">
            <motion.circle
              cx="56"
              cy="56"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-white/5"
            />
            <motion.circle
              cx="56"
              cy="56"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="326.7"
              initial={{ strokeDashoffset: 326.7 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="text-primary"
            />
          </svg>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Logo size="sm" />
            </motion.div>
          </div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-[0.4em] text-white">
              Baking perfection...
            </h3>
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                  className="w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                />
              ))}
            </div>
            <motion.p 
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest italic"
            >
              Master Batch #0425
            </motion.p>
          </div>
        </motion.div>
      </div>

      {/* Decorative Accents */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-20">
        <div className="w-[1px] h-12 bg-gradient-to-t from-white to-transparent" />
        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white">ESTD 2024</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white to-transparent" />
      </div>
    </div>
  );
};
