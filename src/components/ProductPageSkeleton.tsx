import React from 'react';

export const ProductPageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 pb-36">
      {/* Header bar skeleton */}
      <div className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 py-3 sm:py-6 flex items-center justify-between pointer-events-none">
        {/* Back Button */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 shadow-lg animate-pulse" />
        {/* Actions */}
        <div className="flex gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 shadow-lg animate-pulse" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/80 shadow-lg animate-pulse" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 shadow-lg animate-pulse" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 backdrop-blur-md border border-stone-200/80 shadow-lg animate-pulse" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-16">
        {/* Product Image Section Skeleton */}
        <div className="relative aspect-square md:h-screen lg:sticky lg:top-0 overflow-hidden bg-stone-100 shadow-sm animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-stone-200/40 to-transparent -translate-x-full animate-shine" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F5] via-transparent to-transparent lg:hidden" />
        </div>

        {/* Product Details Section Skeleton */}
        <div className="px-4 sm:px-6 py-6 sm:py-12 lg:py-32 space-y-6 sm:space-y-8 max-w-full overflow-hidden">
          {/* Category & Badge */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap animate-pulse">
              <div className="h-6 w-24 bg-[#E76A54]/20 rounded-full border border-[#E76A54]/30" />
              <div className="h-6 w-36 bg-amber-100 rounded-full border border-amber-200" />
            </div>

            {/* Title */}
            <div className="space-y-2 animate-pulse">
              <div className="h-10 sm:h-14 w-4/5 bg-stone-200 rounded-2xl" />
              <div className="h-10 sm:h-14 w-3/5 bg-stone-200 rounded-2xl" />
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 pt-2 animate-pulse">
              <div className="h-9 w-28 bg-[#E76A54]/25 rounded-xl" />
              <div className="h-6 w-20 bg-stone-200 rounded-lg" />
              <div className="h-6 w-36 bg-emerald-100 rounded-lg" />
            </div>
          </div>

          {/* Quick Features Row */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={`feature-skel-${i}`}
                className="bg-white rounded-2xl p-3 border border-stone-200/90 shadow-2xs space-y-2 animate-pulse"
              >
                <div className="w-7 h-7 rounded-xl bg-stone-100" />
                <div className="w-16 h-3 bg-stone-200 rounded" />
                <div className="w-20 h-2.5 bg-stone-100 rounded" />
              </div>
            ))}
          </div>

          {/* Description Block */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs space-y-3 animate-pulse">
            <div className="w-28 h-4 bg-stone-200 rounded" />
            <div className="w-full h-3 bg-stone-100 rounded" />
            <div className="w-5/6 h-3 bg-stone-100 rounded" />
            <div className="w-4/6 h-3 bg-stone-100 rounded" />
          </div>

          {/* Purchase Controls Bar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/90 shadow-xs space-y-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-11 w-36 bg-stone-100 rounded-2xl border border-stone-200/80" />
              <div className="h-6 w-24 bg-stone-200 rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="h-13 bg-stone-100 rounded-2xl border border-stone-200/90" />
              <div className="h-13 bg-[#E76A54]/30 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPageSkeleton;
