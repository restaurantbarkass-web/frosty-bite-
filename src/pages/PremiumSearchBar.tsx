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
import { cn } from '../lib/utils';

interface PremiumSearchBarProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
  className?: string;
  suggestions: string[];
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
  suggestions,
  trendingSearches = ['Chocolate Cake', 'Vanilla Bento', 'Butter Cookies', 'Red Velvet'],
  aiRecommendations = [],
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

  // Load recent searches on mount
  useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Sync initial query
  useEffect(() => {
    if (initialQuery !== undefined) setQuery(initialQuery);
  }, [initialQuery]);

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
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    // Save to recent
    const updated = [trimmed, ...recentSearches.filter(s => s !== trimmed)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));

    onSearch(trimmed);
    inputRef.current?.blur();
    setIsFocused(false);
  }, [onSearch, recentSearches]);

  const handleVoiceSearch = () => {
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
        if (event.error === 'no-speech') {
            // Silently handle no-speech
        } else if (event.error === 'not-allowed') {
            alert("Microphone access denied. Please check permissions.");
        }
        setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const containerVariants = {
    blurred: {
      scale: 1,
      y: 0,
      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)",
    },
    focused: {
      scale: 1.02,
      y: -4,
      boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
    }
  };

  return (
    <div className={cn("relative w-full z-50", className)}>
      {/* Background Particles / Glow (Only visible when focused) */}
      <AnimatePresence>
        {isFocused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10 cursor-pointer"
            onClick={() => setIsFocused(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        animate={isFocused ? "focused" : "blurred"}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className={cn(
          "relative glass-dark rounded-[24px] border border-white/10 overflow-hidden group/search-bar",
          isFocused ? "border-primary/50" : "hover:border-white/20"
        )}
      >
        {/* Animated Gradient Border */}
        {isFocused && (
          <motion.div 
            layoutId="glow-border"
            className="absolute -inset-[2px] bg-gradient-to-r from-primary/50 via-white/50 to-primary/50 -z-10 opacity-50 animate-gradient-x"
          />
        )}

        <div className="flex items-center p-1 sm:p-2 h-[56px] sm:h-[72px]">
          {/* Search Icon / Morph */}
          <div className="flex items-center justify-center w-12 sm:w-16 h-full text-gray-500">
            <motion.div
              animate={{
                rotate: isListening ? [0, 360] : 0,
                scale: isFocused ? 1.1 : 1,
                color: isFocused ? "#7dd3fc" : "#6b7280"
              }}
              transition={{
                rotate: isListening ? { repeat: Infinity, duration: 2, ease: "linear" } : { duration: 0.2 }
              }}
            >
              {isListening ? <Loader2 size={24} className="animate-spin" /> : <Search size={22} />}
            </motion.div>
          </div>

          {/* Input field */}
          <div className="flex-1 relative h-full flex items-center">
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
                // Delay so clicks on suggestions work
                setTimeout(() => {
                  setIsFocused(false);
                  onFocusChange?.(false);
                }, 200);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch(query);
                if (e.key === 'Escape') inputRef.current?.blur();
              }}
              className="w-full bg-transparent border-none focus:ring-0 text-white font-medium text-lg placeholder:text-transparent"
            />
            
            {/* Animated Placeholder Overlay */}
            {!query && (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 font-medium text-lg flex items-center gap-1">
                <span>{placeholderText}</span>
                <motion.div 
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-[2px] h-6 bg-primary"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center pr-2 gap-1 sm:gap-2">
            {query && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={clearSearch}
                className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                title="Clear search"
              >
                <X size={20} />
              </motion.button>
            )}

            {!isFocused && !query && (
              <div className="hidden sm:flex items-center gap-1 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-500 font-semibold text-[10px] uppercase tracking-widest mr-2 group-hover/search-bar:border-primary/30 transition-colors">
                <Command size={10} />
                <span>K</span>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                // If we are in the premium search bar, we might want to just open the overlay
                // which has the full scanning UI.
                window.dispatchEvent(new CustomEvent('open-search', { detail: { scan: true } }));
              }}
              className="hidden sm:flex p-2.5 sm:p-3 bg-white/5 text-gray-400 hover:text-white rounded-xl transition-all"
              title="Scan QR"
            >
              <QrCode size={20} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleVoiceSearch}
              className={cn(
                "p-2.5 sm:p-3 rounded-xl transition-all relative overflow-hidden",
                isListening ? "bg-red-500/20 text-red-500" : "bg-white/5 text-gray-400 hover:text-white"
              )}
            >
              {isListening && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 bg-red-500 rounded-full -z-10"
                />
              )}
              {isListening ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
            </motion.button>

            <button 
              onClick={() => handleSearch(query)}
              className="bg-primary text-white h-[44px] sm:h-[56px] px-6 sm:px-10 rounded-xl font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-xl shadow-primary/30 active:scale-95 transition-all hover:bg-accent"
            >
              Search
            </button>
          </div>
        </div>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="w-full bg-black/60 backdrop-blur-3xl overflow-hidden"
            >
              <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Left Column: Recent & Trending */}
                <div className="space-y-6">
                  {recentSearches.length > 0 && !query && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Recent Searches</h4>
                        <button 
                          onMouseDown={() => {
                            setRecentSearches([]);
                            localStorage.removeItem('recent_searches');
                          }}
                          className="text-[10px] text-primary hover:underline uppercase font-bold"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((s, idx) => (
                          <button
                            key={idx}
                            onMouseDown={() => {
                              setQuery(s);
                              handleSearch(s);
                            }}
                            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all group"
                          >
                            <Clock size={14} className="text-gray-600 group-hover:text-primary" />
                            <span className="text-sm font-medium">{s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Trending Now</h4>
                    <div className="flex flex-wrap gap-2">
                      {trendingSearches.map((s, idx) => (
                        <motion.button
                          key={idx}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onMouseDown={() => {
                            setQuery(s);
                            handleSearch(s);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-gray-400 hover:text-primary hover:border-primary/30 transition-all"
                        >
                          <TrendingUp size={12} />
                          {s}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: AI & Suggestions */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles size={14} className="animate-pulse" />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Smart Recommendations</h4>
                    </div>
                    <div className="space-y-1">
                      {(query ? suggestions.slice(0, 5) : aiRecommendations.slice(0, 4)).map((s, idx) => (
                        <button
                          key={idx}
                          onMouseDown={() => {
                            setQuery(s);
                            handleSearch(s);
                          }}
                          className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/5 hover:border-primary/20 hover:bg-primary/5 rounded-xl text-gray-300 hover:text-white transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <Cpu size={14} />
                            </div>
                            <span className="text-sm font-medium">{s}</span>
                          </div>
                          <motion.div
                            animate={{ x: [0, 5, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          >
                            <ChevronRight size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </motion.div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Promo Banner */}
                  {!query && (
                    <div className="p-4 bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles size={64} />
                      </div>
                      <h5 className="text-sm font-black text-white italic mb-1 uppercase">Ask our AI Butler</h5>
                      <p className="text-[10px] text-gray-400 leading-relaxed mb-3">
                        "I need a tiered eggless cake for a corporate event under ₹3000..."
                      </p>
                      <button 
                        onClick={handleVoiceSearch}
                        className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:gap-3 transition-all"
                      >
                        Try AI Search <ArrowRight size={12} />
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
