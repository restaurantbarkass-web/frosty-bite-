import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Leaf, Flame, Sparkles, ArrowUpDown } from 'lucide-react';

interface HomeFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  dietaryFilter: 'All' | 'Vegetarian' | 'Spicy';
  onDietaryChange: (filter: 'All' | 'Vegetarian' | 'Spicy') => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

export const HomeFilterModal: React.FC<HomeFilterModalProps> = ({
  isOpen,
  onClose,
  dietaryFilter,
  onDietaryChange,
  sortBy,
  onSortChange,
}) => {
  const dietaryOptions: Array<{ id: 'All' | 'Vegetarian' | 'Spicy'; label: string; icon?: React.ReactNode }> = [
    { id: 'All', label: 'All Delights', icon: <Sparkles size={14} className="text-amber-500" /> },
    { id: 'Vegetarian', label: '100% Veg / Eggless', icon: <Leaf size={14} className="text-emerald-500" /> },
    { id: 'Spicy', label: 'Spicy / Savory', icon: <Flame size={14} className="text-red-500" /> },
  ];

  const sortOptions = [
    { id: 'popularity', label: 'Most Popular' },
    { id: 'price-asc', label: 'Price: Low to High' },
    { id: 'price-desc', label: 'Price: High to Low' },
    { id: 'rating', label: 'Top Customer Rated' },
  ];

  const handleReset = () => {
    onDietaryChange('All');
    onSortChange('popularity');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs"
          />

          {/* Modal / Bottom Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden z-10 pb-[max(16px,env(safe-area-inset-bottom))]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FDF0EB] text-orange-600 flex items-center justify-center">
                  <ArrowUpDown size={16} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900">Filter & Sort</h3>
                  <p className="text-xs text-stone-500">Refine treats to match your taste</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                aria-label="Close filter"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Dietary Preferences */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                  Dietary Preference
                </h4>
                <div className="grid grid-cols-1 gap-2.5">
                  {dietaryOptions.map((opt) => {
                    const isSelected = dietaryFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onDietaryChange(opt.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/60 text-orange-950 font-bold shadow-xs'
                            : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-stone-50/50'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          {opt.icon}
                          {opt.label}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                  Sort Treats By
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {sortOptions.map((opt) => {
                    const isSelected = sortBy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSortChange(opt.id)}
                        className={`flex items-center justify-between px-3.5 py-3 rounded-2xl border text-xs sm:text-sm transition-all ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/60 text-orange-950 font-bold'
                            : 'border-stone-200 hover:border-stone-300 text-stone-700 bg-stone-50/50'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 ml-1">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 px-6 pt-3 border-t border-stone-100 bg-stone-50/50">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 px-4 rounded-xl border border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-100 transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-500 text-white text-sm font-bold shadow-md shadow-orange-500/25 hover:bg-orange-600 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
