import React from 'react';

export const CartSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5">
          <div className="w-16 h-16 rounded-xl bg-white/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-white/10 rounded" />
            <div className="h-3 w-1/3 bg-primary/20 rounded" />
          </div>
          <div className="w-20 h-8 bg-white/10 rounded-xl" />
        </div>
      ))}
    </div>
  );
};
