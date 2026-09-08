import React from 'react';
import { cn } from '../lib/utils';

interface FoodCardSkeletonProps {
  variant?: 'default' | 'compact';
}

export const FoodCardSkeleton: React.FC<FoodCardSkeletonProps> = ({ variant = 'default' }) => {
  return (
    <div
      className={cn(
        "relative bg-white overflow-hidden border border-stone-200/90 transition-all shadow-xs",
        variant === 'compact' ? "rounded-2xl" : "rounded-3xl"
      )}
    >
      {/* Shimmer Effect */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-stone-200/40 to-transparent -translate-x-full animate-shine" />
      </div>

      {/* Image Area Placeholder */}
      <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
        {/* Rating and Heart/Share actions on the top right */}
        <div className="absolute top-3.5 right-3.5 flex flex-col gap-1.5">
          <div className="w-12 h-6 bg-stone-200 rounded-xl" />
          <div className="w-8 h-8 bg-stone-200 rounded-xl" />
          <div className="w-8 h-8 bg-stone-200 rounded-xl" />
        </div>

        {/* Category Badge on the top left */}
        <div className="absolute top-3.5 left-3.5">
          <div className="w-20 h-6 bg-stone-200 rounded-lg" />
        </div>
      </div>

      {/* Card Content Placeholder */}
      <div className={cn(
        variant === 'compact' ? "p-3.5" : "p-5"
      )}>
        <div className="flex justify-between items-start mb-3">
          {/* Title Placeholder */}
          <div className={cn(
            "bg-stone-200 rounded-lg",
            variant === 'compact' ? "w-24 h-4" : "w-36 h-5"
          )} />
          {/* Price Placeholder */}
          <div className={cn(
            "bg-orange-100 rounded-lg",
            variant === 'compact' ? "w-10 h-4" : "w-14 h-5"
          )} />
        </div>

        {/* Description Placeholder */}
        {variant !== 'compact' && (
          <div className="space-y-2 mb-3">
            <div className="w-full h-3 bg-stone-100 rounded-md" />
            <div className="w-3/4 h-3 bg-stone-100 rounded-md" />
          </div>
        )}

        {/* Delivery Time Placeholder */}
        <div className="mb-4">
          <div className="w-28 h-5 bg-orange-50 rounded-lg border border-orange-100" />
        </div>

        {/* Action Buttons Placeholder */}
        <div className="flex gap-2">
          <div className="flex-1 h-11 bg-stone-100 rounded-xl border border-stone-200/80" />
          <div className="flex-[2] h-11 bg-orange-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
