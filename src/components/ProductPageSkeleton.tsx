import React from 'react';
import { motion } from 'motion/react';

export const ProductPageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground pb-32 animate-pulse">
      {/* Header bar skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex items-center justify-between pointer-events-none">
        <div className="w-12 h-12 rounded-2xl bg-white/10" />
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10" />
          <div className="w-12 h-12 rounded-2xl bg-white/10" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 md:pt-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Main Visual Image Skeleton */}
          <div className="lg:col-span-7 space-y-6">
            <div className="w-full aspect-[4/3] sm:aspect-[16/10] bg-white/5 rounded-3xl border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            </div>
            <div className="flex gap-3 overflow-hidden">
              <div className="w-24 h-24 rounded-2xl bg-white/5 shrink-0" />
              <div className="w-24 h-24 rounded-2xl bg-white/5 shrink-0" />
              <div className="w-24 h-24 rounded-2xl bg-white/5 shrink-0" />
            </div>
          </div>

          {/* Details & Action Column Skeleton */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-6 w-24 bg-primary/20 rounded-full" />
                <div className="h-6 w-20 bg-white/10 rounded-full" />
              </div>
              <div className="h-10 w-3/4 bg-white/15 rounded-2xl" />
              <div className="h-8 w-1/3 bg-primary/30 rounded-xl" />
              <div className="space-y-2 pt-4">
                <div className="h-4 w-full bg-white/5 rounded" />
                <div className="h-4 w-5/6 bg-white/5 rounded" />
                <div className="h-4 w-2/3 bg-white/5 rounded" />
              </div>
            </div>

            {/* Quick Action Skeleton */}
            <div className="space-y-4 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div className="h-12 w-36 bg-white/10 rounded-2xl" />
                <div className="h-6 w-24 bg-white/10 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="h-14 bg-white/10 rounded-2xl" />
                <div className="h-14 bg-primary/30 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
