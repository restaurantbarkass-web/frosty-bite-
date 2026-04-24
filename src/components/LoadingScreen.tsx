import React from 'react';
import { Logo } from './Logo';

interface LoadingScreenProps {
  fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ fullScreen = true }) => {
  return (
    <div className={`${fullScreen ? 'fixed inset-0 z-[100]' : 'w-full h-full min-h-[400px]'} flex flex-col items-center justify-center bg-[#050505] text-white`}>
      <div className="relative">
        {/* Simple CSS spinner */}
        <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <Logo size="sm" />
        </div>
      </div>

      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Preparing the Feast...</span>
        </div>
      </div>
    </div>
  );
};
