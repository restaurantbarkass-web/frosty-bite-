import React from 'react';
import { FoodCardSkeleton } from './FoodCardSkeleton';

export const CategoriesPageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col font-sans">
      {/* 1. Header Bar Skeleton */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Back Button Skeleton */}
            <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200/80 animate-pulse" />
            <div>
              <div className="w-40 h-5 bg-stone-200 rounded-md animate-pulse" />
              <div className="w-24 h-3 bg-stone-100 rounded-md mt-1 animate-pulse" />
            </div>
          </div>
          {/* Cart Icon Skeleton */}
          <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200/80 animate-pulse" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-4 pb-32 sm:pb-36 space-y-5">
        {/* 2. Search Bar Skeleton */}
        <div className="w-full h-11 bg-white rounded-2xl border border-stone-200/90 shadow-2xs flex items-center px-3.5 gap-3 animate-pulse">
          <div className="w-4 h-4 rounded-full bg-stone-200" />
          <div className="w-48 h-3.5 bg-stone-100 rounded" />
        </div>

        {/* 3. Category Horizontal Pills Selector Skeleton */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="w-28 h-3 bg-stone-200 rounded animate-pulse" />
            <div className="w-16 h-3 bg-stone-100 rounded animate-pulse" />
          </div>

          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide -mx-1 px-1">
            {/* Pill Skeletons */}
            {[
              { width: 'w-24', active: true },
              { width: 'w-28', active: false },
              { width: 'w-32', active: false },
              { width: 'w-24', active: false },
              { width: 'w-26', active: false },
              { width: 'w-28', active: false },
            ].map((pill, idx) => (
              <div
                key={`cat-pill-skel-${idx}`}
                className={`h-8 rounded-xl shrink-0 px-3.5 py-2 flex items-center gap-2 border animate-pulse ${
                  pill.active
                    ? 'bg-[#E76A54]/20 border-[#E76A54]/30'
                    : 'bg-white border-stone-200/90'
                }`}
              >
                <div className="w-3.5 h-3.5 rounded-full bg-stone-200" />
                <div className={`${pill.width} h-3 bg-stone-200 rounded`} />
              </div>
            ))}
          </div>
        </div>

        {/* 4. Visual Category Exploration Cards Skeleton */}
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <div className="w-36 h-4 bg-stone-200 rounded animate-pulse" />
            <div className="w-28 h-3 bg-stone-100 rounded animate-pulse" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={`collection-skel-${i}`}
                className="bg-white rounded-2xl p-2.5 border border-stone-200/90 shadow-2xs flex flex-col justify-between animate-pulse"
              >
                <div className="w-full aspect-[4/3] rounded-xl bg-stone-100 relative mb-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-stone-200/40 to-transparent -translate-x-full animate-shine" />
                  <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-white/80" />
                </div>
                <div className="space-y-1.5">
                  <div className="w-20 h-3.5 bg-stone-200 rounded" />
                  <div className="w-14 h-2.5 bg-stone-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Product Controls & Toolbar Skeleton */}
        <section className="pt-2 border-t border-stone-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="w-32 h-6 bg-stone-200 rounded animate-pulse" />
              <div className="w-48 h-3 bg-stone-100 rounded animate-pulse" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Dietary Toggle Skeleton */}
              <div className="bg-white rounded-xl p-1 flex items-center gap-1 border border-stone-200/90 shadow-2xs animate-pulse">
                <div className="w-12 h-6 bg-stone-200 rounded-lg" />
                <div className="w-12 h-6 bg-stone-100 rounded-lg" />
                <div className="w-12 h-6 bg-stone-100 rounded-lg" />
              </div>
              {/* Sort Selector Skeleton */}
              <div className="w-32 h-8 bg-white border border-stone-200/90 rounded-xl animate-pulse" />
            </div>
          </div>
        </section>

        {/* 6. Products Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <FoodCardSkeleton key={`cat-skel-card-${n}`} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default CategoriesPageSkeleton;
