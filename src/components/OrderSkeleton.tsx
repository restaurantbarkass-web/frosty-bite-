import React from 'react';
import { motion } from 'motion/react';

export const OrderSkeleton: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-16 space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-3">
        <div className="h-9 w-56 bg-stone-200/80 rounded-2xl" />
        <div className="h-4 w-72 bg-stone-200/50 rounded-xl" />
      </div>

      {/* Cards Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div 
            key={item}
            className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-xs space-y-5"
          >
            {/* Top row */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div className="space-y-2">
                <div className="h-5 w-36 bg-stone-200/80 rounded-xl" />
                <div className="h-3.5 w-24 bg-stone-200/50 rounded-lg" />
              </div>
              <div className="h-7 w-28 bg-[#E76A54]/15 rounded-full" />
            </div>

            {/* Items list preview */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-stone-200/70 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 bg-stone-200/80 rounded-lg" />
                <div className="h-3 w-1/4 bg-stone-200/50 rounded-lg" />
              </div>
              <div className="h-5 w-16 bg-stone-200/80 rounded-xl" />
            </div>

            {/* Bottom action row */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <div className="h-4 w-28 bg-stone-200/60 rounded-lg" />
              <div className="h-9 w-32 bg-stone-200/80 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
