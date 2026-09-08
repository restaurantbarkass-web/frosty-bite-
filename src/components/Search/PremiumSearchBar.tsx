import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Mic, 
  X, 
  TrendingUp, 
  Clock, 
  Sparkles, 
  ChevronRight,
  Command,
  ArrowRight,
  Loader2,
  Cpu,
  QrCode
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { safeTrim } from '../../utils/string';

interface PremiumSearchBarProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
  className?: string;
  suggestions?: string[];
  trendingSearches?: string[];
  aiRecommendations?: string[];
  onFocusChange?: (focused: boolean) => void;
}

const PLACEHOLDERS = [
  "Search for Chocolate Truffle...",
  "Looking for some Bento Cakes?",
  "Search for freshly baked Croissants...",
  "Try 'Eggless Strawberry Cake'",
  "Search for Designer Cupcakes...",
  "How about some Almond Brownies?"
];

export const PremiumSearchBar: React.FC<PremiumSearchBarProps> = ({
  onSearch,
  initialQuery = '',
  className,
  suggestions = [],
  trendingSearches = ['Chocolate Cake', 'Vanilla Bento', 'Butter Cookies', 'Red Velvet'],
  aiRecommendations = ['Artisanal Sourdough', 'Custom Celebration Cake', 'Belgian Hot Chocolate', 'Macaron Gift Box'],
  onFocusChange
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  // Sync initial query
  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(prev => (prev !== initialQuery ? initialQuery : prev));
    }
  }, [initialQuery]);

  // Debounced search logic
  useEffect(() => {
    if (query !== initialQuery && isFocused) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        onSearchRef.current(query);
      }, 400);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, initialQuery, isFocused]);

  // Animated Placeholder Typing Effect
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      const target = PLACEHOLDERS[placeholderIndex];
      if (placeholderText.length < target.length) {
        timeout = setTimeout(() => {
          setPlaceholderText(target.slice(0, placeholderText.length + 1));
        }, 50);
      } else {
        timeout = setTimeout(() => setIsTyping(false), 2000);
      }
    } else {
      if (placeholderText.length > 0) {
        timeout = setTimeout(() => {
          setPlaceholderText(placeholderText.slice(0, -1));
        }, 30);
      } else {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [placeholderText, placeholderIndex, isTyping]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = useCallback((searchTerm: string) => {
    const trimmed = safeTrim(searchTerm);
    if (!trimmed) return;

    // Save to recent
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    try {
      localStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch (e) {}

    onSearch(trimmed);
    inputRef.current?.blur();
    setIsFocused(false);
  }, [onSearch, recentSearches]);

  const handleVoiceSearch = () => {
    // @ts-ignore
    if (window.__voiceAssistantReady) {
      window.dispatchEvent(new CustomEvent('open-voice-assistant'));
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    setIsListening(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1][0].transcript;
      setQuery(result);
      setIsListening(false);
      handleSearch(result);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn("relative w-full z-50", className)}>
      {/* Backdrop overlay when focused */}
      <AnimatePresence>
        {isFocused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-xs -z-10 cursor-pointer"
            onClick={() => setIsFocused(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          scale: isFocused ? 1.01 : 1,
          y: isFocused ? -2 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={cn(
          "relative bg-white rounded-3xl border transition-all duration-200 overflow-hidden",
          isFocused 
            ? "border-[#E76A54] shadow-[0_10px_30px_rgba(231,106,84,0.15)] ring-2 ring-[#E76A54]/15" 
            : "border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:border-stone-300"
        )}
      >
        <div className="flex items-center px-3 sm:px-4 py-2 sm:py-3 h-[56px] sm:h-[66px]">
          {/* Search Icon */}
          <div className="flex items-center justify-center w-10 sm:w-12 text-stone-400 shrink-0">
            <motion.div
              animate={{
                rotate: isListening ? [0, 360] : 0,
                scale: isFocused ? 1.1 : 1,
                color: isFocused ? "#E76A54" : "#a8a29e"
              }}
              transition={{
                rotate: isListening ? { repeat: Infinity, duration: 2, ease: "linear" } : { duration: 0.2 }
              }}
            >
              {isListening ? <Loader2 size={20} className="animate-spin text-[#E76A54]" /> : <Search size={20} />}
            </motion.div>
          </div>

          {/* Input field */}
          <div className="flex-1 relative h-full flex items-center mx-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setIsFocused(true);
                onFocusChange?.(true);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsFocused(false);
                  onFocusChange?.(false);
                }, 200);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch(query);
                if (e.key === 'Escape') inputRef.current?.blur();
              }}
              className="w-full bg-transparent border-none focus:ring-0 text-stone-900 font-medium text-sm sm:text-base placeholder:text-transparent"
            />
            
            {/* Animated Placeholder Overlay */}
            {!query && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none text-stone-400 font-normal text-sm sm:text-base flex items-center gap-1">
                <span>{placeholderText}</span>
                <motion.div 
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-[2px] h-5 bg-[#E76A54]"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={clearSearch}
                className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={18} />
              </motion.button>
            )}

            {!isFocused && !query && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-stone-100 border border-stone-200/80 rounded-lg text-stone-500 font-semibold text-[10px] uppercase tracking-widest mr-1">
                <Command size={10} />
                <span>K</span>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-search', { detail: { scan: true } }));
              }}
              className="hidden sm:flex p-2.5 bg-stone-100 hover:bg-orange-50 text-stone-600 hover:text-[#E76A54] rounded-xl transition-all cursor-pointer"
              title="Scan QR / Butler"
            >
              <QrCode size={18} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleVoiceSearch}
              className={cn(
                "p-2.5 rounded-xl transition-all relative overflow-hidden cursor-pointer",
                isListening ? "bg-red-50 text-red-600 border border-red-200" : "bg-stone-100 text-stone-600 hover:text-stone-900 hover:bg-stone-200"
              )}
              title="Voice Search"
            >
              {isListening && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 bg-red-500 rounded-full -z-10"
                />
              )}
              {isListening ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
            </motion.button>

            <button 
              type="button"
              onClick={() => handleSearch(query)}
              className="bg-[#E76A54] hover:bg-[#d55943] text-white h-[40px] sm:h-[46px] px-5 sm:px-7 rounded-2xl font-bold uppercase tracking-wider text-[11px] sm:text-xs shadow-md shadow-[#E76A54]/25 active:scale-95 transition-all cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>

        {/* Suggestions & Recent Dropdown Panel */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="w-full bg-white/98 backdrop-blur-2xl border-t border-stone-200/80 overflow-hidden shadow-xl"
            >
              <div 
                className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[65vh] overflow-y-auto custom-scrollbar"
                data-lenis-prevent
              >
                {/* Left Column: Recent & Trending */}
                <div className="space-y-5">
                  {recentSearches.length > 0 && !query && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400">Recent Searches</h4>
                        <button 
                          type="button"
                          onMouseDown={() => {
                            setRecentSearches([]);
                            try {
                              localStorage.removeItem('recent_searches');
                            } catch (e) {}
                          }}
                          className="text-[10px] text-[#E76A54] hover:underline uppercase font-bold cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onMouseDown={() => {
                              setQuery(s);
                              handleSearch(s);
                            }}
                            className="w-full flex items-center gap-3 p-2 hover:bg-stone-50 rounded-xl text-stone-700 transition-all group cursor-pointer"
                          >
                            <Clock size={14} className="text-stone-400 group-hover:text-[#E76A54]" />
                            <span className="text-xs sm:text-sm font-medium">{s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400">Trending Now</h4>
                    <div className="flex flex-wrap gap-2">
                      {trendingSearches.map((s, idx) => (
                        <motion.button
                          key={idx}
                          type="button"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onMouseDown={() => {
                            setQuery(s);
                            handleSearch(s);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-orange-50 border border-stone-200/80 rounded-full text-xs font-bold text-stone-700 hover:text-[#E76A54] hover:border-[#E76A54]/30 transition-all cursor-pointer"
                        >
                          <TrendingUp size={12} className="text-[#E76A54]" />
                          <span>{s}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: AI & Suggestions */}
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[#E76A54]">
                      <Sparkles size={14} className="animate-pulse" />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.15em]">Smart Recommendations</h4>
                    </div>
                    <div className="space-y-1">
                      {(query ? suggestions.slice(0, 5) : aiRecommendations.slice(0, 4)).map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={() => {
                            setQuery(s);
                            handleSearch(s);
                          }}
                          className="w-full flex items-center justify-between p-2.5 bg-stone-50 hover:bg-orange-50/60 border border-stone-200/60 hover:border-[#E76A54]/30 rounded-xl text-stone-800 transition-all group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-orange-100/70 flex items-center justify-center text-[#E76A54] group-hover:scale-110 transition-transform">
                              <Cpu size={13} />
                            </div>
                            <span className="text-xs sm:text-sm font-medium">{s}</span>
                          </div>
                          <ChevronRight size={14} className="text-stone-400 group-hover:text-[#E76A54] transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Promo Banner */}
                  {!query && (
                    <div className="p-4 bg-gradient-to-br from-orange-500/10 via-amber-500/10 to-orange-500/5 border border-orange-200/60 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                        <Sparkles size={48} className="text-[#E76A54]" />
                      </div>
                      <h5 className="text-xs font-bold text-stone-900 mb-1">Ask our AI Bakery Assistant</h5>
                      <p className="text-[11px] text-stone-600 leading-relaxed mb-3">
                        "Find me an eggless chocolate birthday cake under ₹1000..."
                      </p>
                      <button 
                        type="button"
                        onClick={handleVoiceSearch}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-[#E76A54] hover:underline cursor-pointer"
                      >
                        <span>Try AI Voice Search</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default PremiumSearchBar;
