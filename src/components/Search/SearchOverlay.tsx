import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  X, 
  Command, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  ChevronRight,
  Filter,
  History,
  Info,
  Mic,
  ArrowRight,
  QrCode
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { FoodItem } from '../../types';
import { useSearch } from '../../hooks/useSearch';
import { FoodCard } from '../FoodCard';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: FoodItem[];
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose, allItems }) => {
  const { 
    query, 
    setQuery, 
    results, 
    aiSuggestions, 
    trending, 
    recent, 
    performSearch,
    clear
  } = useSearch(allItems);

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (!isOpen) {
            e.preventDefault();
            // This would be handled by the parent, but inside here we just keep focus
            inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const filteredResults = selectedCategory 
    ? results.filter(item => item.category === selectedCategory)
    : results;

  const categories = Array.from(new Set(allItems.map(i => i.category)));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex flex-col bg-black/95 backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-center px-4 md:px-8 py-4 sm:py-6 border-b border-white/10 glass-dark">
            <div className="flex-1 max-w-4xl mx-auto flex items-center gap-4 relative">
              <div className="relative flex-1 group">
                <Search className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300",
                  query ? "text-primary" : "text-gray-500"
                )} size={20} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search for cakes, pastries, flavors..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-24 py-4 text-white text-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all placeholder:text-gray-600"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performSearch(query)}
                />
                
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {query && (
                    <button 
                        onClick={clear}
                        className="p-2 text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                    )}
                    <button className="p-2 text-gray-500 hover:text-primary transition-colors">
                        <QrCode size={20} />
                    </button>
                    <button className="p-2 text-gray-500 hover:text-primary transition-colors">
                        <Mic size={20} />
                    </button>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-500 font-mono text-xs">
                <Command size={14} />
                <span>K / ESC</span>
              </div>

              <button 
                onClick={onClose}
                className="p-3 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all sm:hidden"
              >
                <X size={24} />
              </button>
              
              <button 
                onClick={onClose}
                className="hidden sm:flex px-6 py-4 bg-white/5 hover:bg-white/10 rounded-xl text-white font-bold uppercase tracking-widest text-[10px] transition-all"
              >
                Close
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
              
              {!query && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {/* Recent Searches */}
                  {recent.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-400">
                        <History size={16} />
                        <h3 className="text-[10px] font-black uppercase tracking-widest">Recent Searches</h3>
                      </div>
                      <div className="flex flex-col gap-1">
                        {recent.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => setQuery(s)}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-all group"
                          >
                            <span className="text-sm">{s}</span>
                            <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending Searches */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-gray-400">
                      <TrendingUp size={16} />
                      <h3 className="text-[10px] font-black uppercase tracking-widest">Trending Now</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {trending.map((s, i) => (
                        <motion.button
                          key={i}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setQuery(s)}
                          className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-gray-400 hover:text-primary hover:border-primary/30 transition-all"
                        >
                          {s}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommendations */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles size={16} className="animate-pulse" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest">AI Recommendations</h3>
                    </div>
                    <div className="p-6 bg-primary/10 border border-primary/20 rounded-3xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Sparkles size={80} />
                      </div>
                      <p className="text-sm text-gray-300 italic mb-4 leading-relaxed">
                        "I'm looking for a premium tiered chocolate cake for a 25th anniversary celebration..."
                      </p>
                      <button className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:gap-4 transition-all">
                        Try AI Butler <Mic size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {query && (
                <div className="space-y-8">
                  {/* AI Suggestions Bar */}
                  <AnimatePresence>
                    {aiSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap gap-2"
                      >
                        {aiSuggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => setQuery(s)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary/5 hover:bg-primary/20 border border-primary/10 rounded-xl text-xs font-medium text-primary transition-all"
                          >
                            <Sparkles size={12} />
                            {s}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Results Header with Categories */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <span className="text-primary">{results.length}</span> Results found
                      </h2>
                      <p className="text-gray-500 text-sm">Showing top matches for "{query}"</p>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                          !selectedCategory ? "bg-primary text-white" : "bg-white/5 text-gray-500 hover:text-white"
                        )}
                      >
                        All
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                            selectedCategory === cat ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 text-gray-500 hover:text-white"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Results Grid */}
                  {filteredResults.length > 0 ? (
                    <motion.div 
                      layout
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                      <AnimatePresence mode="popLayout">
                        {filteredResults.map((item, idx) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <FoodCard item={item} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-gray-700">
                        <Search size={48} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white">No results found</h3>
                        <p className="text-gray-500 max-w-sm">
                          We couldn't find anything matching "{query}". <br/>
                          Try using more general terms or browse categories.
                        </p>
                      </div>
                      <button 
                        onClick={clear}
                        className="px-8 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-accent transition-all"
                      >
                        Clear Search
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Status */}
          <div className="p-4 border-t border-white/5 bg-black/40 flex items-center justify-center gap-4 text-gray-600 text-[10px] font-medium uppercase tracking-[0.2em]">
            <span className="flex items-center gap-1">
                <Info size={12} />
                Fast Intelligent Search Enabled
            </span>
            <span className="w-1 h-1 bg-gray-800 rounded-full" />
            <span>Frosty AI v2.0</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
