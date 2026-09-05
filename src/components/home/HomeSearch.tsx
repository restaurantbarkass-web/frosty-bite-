import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { PremiumSearchBar } from '../Search/PremiumSearchBar';

interface HomeSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onOpenFilter: () => void;
  hasActiveFilters?: boolean;
}

export const HomeSearch: React.FC<HomeSearchProps> = React.memo(({
  query,
  onQueryChange,
  onOpenFilter,
  hasActiveFilters = false,
}) => {
  return (
    <div className="w-full bg-[#FAF8F5] px-4 sm:px-6 py-2 transition-colors">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        {/* Premium Search Bar */}
        <div className="flex-1">
          <PremiumSearchBar
            initialQuery={query}
            onSearch={(searchTerm) => onQueryChange(searchTerm)}
          />
        </div>

        {/* Circular Filter Button */}
        <motion.button
          type="button"
          onClick={onOpenFilter}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.05 }}
          className="relative w-12 h-12 sm:w-[52px] sm:h-[52px] rounded-2xl bg-[#FDF0EB] border border-orange-200/60 flex items-center justify-center text-stone-800 shadow-[0_2px_10px_rgba(249,115,22,0.06)] hover:bg-[#FBE4DA] active:bg-[#F9D8CC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 cursor-pointer shrink-0"
          aria-label="Filter products"
          title="Filter and sort"
        >
          <SlidersHorizontal size={19} className="text-stone-800" />
          {hasActiveFilters && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#E76A54] ring-2 ring-[#FDF0EB]" />
          )}
        </motion.button>
      </div>
    </div>
  );
});

HomeSearch.displayName = 'HomeSearch';
