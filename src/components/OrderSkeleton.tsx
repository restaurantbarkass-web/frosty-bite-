import React from 'react';

export const OrderSkeleton: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse space-y-6">
      <div className="h-8 w-48 bg-white/10 rounded-xl" />
      <div className="bg-white/5 border border-white/5 rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 bg-white/10 rounded" />
          <div className="h-6 w-24 bg-primary/20 rounded-full" />
        </div>
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-white/10 rounded" />
          <div className="h-4 w-2/3 bg-white/10 rounded" />
        </div>
      </div>
    </div>
  );
};
