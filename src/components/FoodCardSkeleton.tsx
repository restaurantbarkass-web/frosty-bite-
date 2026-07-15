import React from 'react';
import { cn } from '../lib/utils';

interface FoodCardSkeletonProps {
  variant?: 'default' | 'compact';
}

export const FoodCardSkeleton: React.FC<FoodCardSkeletonProps> = ({ variant = 'default' }) => {
  return (
    <div
      className={cn(
        "relative bg-white/5 overflow-hidden border border-white/5 transition-all shadow-xl",
        variant === 'compact' ? "rounded-2xl" : "rounded-3xl"
      )}
    >
      {/* Shimmer Effect */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent -translate-x-full animate-shine" />
      </div>

      {/* Image Area Placeholder */}
      <div className="relative aspect-[4/3] bg-white/[0.03] overflow-hidden">
        {/* Rating and Heart/Share actions on the top right */}
        <div className="absolute top-5 right-5 flex flex-col gap-2">
          <div className="w-14 h-7 bg-white/[0.05] rounded-2xl" />
          <div className="w-10 h-10 bg-white/[0.05] rounded-2xl" />
          <div className="w-10 h-10 bg-white/[0.05] rounded-2xl" />
        </div>

        {/* Category Badge on the top left */}
        <div className="absolute top-5 left-5">
          <div className="w-24 h-7 bg-white/[0.05] rounded-xl" />
        </div>
      </div>

      {/* Card Content Placeholder */}
      <div className={cn(
        "p-6",
        variant === 'compact' ? "p-4" : "p-6"
      )}>
        <div className="flex justify-between items-start mb-4">
          {/* Title Placeholder */}
          <div className={cn(
            "bg-white/[0.08] rounded-xl",
            variant === 'compact' ? "w-28 h-5" : "w-40 h-6"
          )} />
          {/* Price Placeholder */}
          <div className={cn(
            "bg-primary/20 rounded-xl",
            variant === 'compact' ? "w-12 h-5" : "w-16 h-6"
          )} />
        </div>

        {/* Description Placeholder */}
        {variant !== 'compact' && (
          <div className="space-y-2 mb-4">
            <div className="w-full h-3 bg-white/[0.04] rounded-lg" />
            <div className="w-4/5 h-3 bg-white/[0.04] rounded-lg" />
          </div>
        )}

        {/* Delivery Time Placeholder */}
        <div className="mb-4">
          <div className="w-32 h-6 bg-white/[0.06] rounded-xl" />
        </div>

        {/* Action Buttons Placeholder */}
        <div className="flex gap-2">
          <div className="flex-1 h-12 bg-white/[0.08] rounded-2xl" />
          <div className="w-12 h-12 bg-white/[0.08] rounded-2xl" />
        </div>
      </div>
    </div>
  );
};
