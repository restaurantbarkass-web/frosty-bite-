import React from 'react';
import { motion } from 'motion/react';
import { Construction, Sparkles } from 'lucide-react';

interface FeatureComingSoonProps {
  title?: string;
  description?: string;
  className?: string;
}

export const FeatureComingSoon: React.FC<FeatureComingSoonProps> = ({
  title = "Mobile Login Under Construction",
  description = "We are baking a fresh and secure mobile verification experience. Stay tuned!",
  className = ""
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-tr from-amber-500/[0.02] via-white/[0.02] to-amber-500/[0.01] border border-amber-500/15 p-4 flex gap-4 text-left shadow-[0_8px_32px_rgba(245,158,11,0.02)] ${className}`}
    >
      {/* Visual background highlight for glowing tech look */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/[0.03] rounded-full blur-2xl" />
      
      {/* Icon Area */}
      <div className="relative shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500">
        {/* Pulsing indicator ring */}
        <span className="absolute inset-0 rounded-xl bg-amber-500/10 animate-ping opacity-60" />
        <Construction size={22} className="relative z-10" />
        
        {/* Sparkle badge */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <Sparkles size={10} className="text-amber-400 animate-pulse" />
        </span>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm font-black text-amber-100 font-sans tracking-wide truncate">
            {title}
          </h3>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/25 leading-none">
            Soon
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed font-sans">
          {description}
        </p>
      </div>
    </motion.div>
  );
};
