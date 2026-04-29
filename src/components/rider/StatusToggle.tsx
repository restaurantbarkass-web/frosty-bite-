import React from 'react';
import { Power, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatusToggleProps {
  isOnline: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}

export const StatusToggle: React.FC<StatusToggleProps> = ({ isOnline, onToggle, isLoading }) => {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      disabled={isLoading}
      className={`
        relative flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all duration-500
        ${isOnline 
          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className={`
        w-8 h-8 rounded-xl flex items-center justify-center transition-colors
        ${isOnline ? 'bg-white/20' : 'bg-zinc-700'}
      `}>
        {isOnline ? <CheckCircle size={18} /> : <XCircle size={18} />}
      </div>
      
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[10px] uppercase tracking-widest opacity-70">Status</span>
        <span className="text-sm">{isOnline ? 'Online' : 'Offline'}</span>
      </div>

      <div className={`
        ml-2 w-2 h-2 rounded-full animate-pulse
        ${isOnline ? 'bg-white' : 'bg-zinc-500'}
      `} />
    </motion.button>
  );
};
