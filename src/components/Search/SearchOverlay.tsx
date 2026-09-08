import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  QrCode,
  Loader2,
  Camera,
  Trash2,
  Flame,
  Check,
  ShoppingBag
} from 'lucide-react';

import { safeTrim, safeTrimLowerCase } from '../../utils/string';

const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
  const highlightTrimmed = safeTrim(highlight);
  if (!highlightTrimmed) return <span>{text}</span>;
  const escaped = highlightTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        safeTrimLowerCase(part) === safeTrimLowerCase(highlightTrimmed) ? (
          <mark key={i} className="bg-primary/30 text-primary font-extrabold px-0.5 rounded-sm">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

import { cn } from '../../lib/utils';
import { FoodItem } from '../../types';
import { useSearch } from '../../hooks/useSearch';
import { FoodCard } from '../FoodCard';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { OptimizedImage } from '../ui/OptimizedImage';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: FoodItem[];
  initialScan?: boolean;
  initialQuery?: string;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ 
  isOpen, 
  onClose, 
  allItems, 
  initialScan,
  initialQuery = '' 
}) => {
  const { 
    query, 
    setQuery, 
    results, 
    aiSuggestions, 
    trending, 
    recent, 
    performSearch,
    removeRecent,
    clearRecent,
    clear,
    smartRec,
    isProcessingRec
  } = useSearch(allItems);

  const { addToCart, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const bestMatch = allItems.find(i => String(i.id) === String(smartRec?.bestMatchId));

  // Compute actual trending items from the menu
  const trendingItems = React.useMemo(() => {
    return allItems
      .filter(item => item.available !== false && (item.is_recommended || item.is_ai_boosted || item.rating >= 4.7))
      .slice(0, 4);
  }, [allItems]);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Compute real-time live suggestions as user types
  const liveSuggestions = React.useMemo(() => {
    const norm = safeTrimLowerCase(query);
    if (!norm) return { keywords: [], mostOrdered: [], directMatches: [] };

    const keywordsSet = new Set<string>();

    allItems.forEach(item => {
      const name = item.name;
      if (name.toLowerCase().includes(norm)) {
        keywordsSet.add(name);
      }
      if (item.category.toLowerCase().includes(norm)) {
        keywordsSet.add(item.category);
      }
      if (Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          if (tag.toLowerCase().includes(norm)) {
            keywordsSet.add(tag);
          }
        });
      }
    });

    const keywords = Array.from(keywordsSet).slice(0, 6);

    const matchedItems = allItems.filter(item => {
      if (item.available === false) return false;
      const name = item.name.toLowerCase();
      const cat = item.category.toLowerCase();
      const desc = (item.description || '').toLowerCase();
      const tags = (item.tags || []).map(t => t.toLowerCase());
      return name.includes(norm) || cat.includes(norm) || desc.includes(norm) || tags.some(t => t.includes(norm));
    });

    // Most-ordered & trending items matching search term
    const mostOrdered = matchedItems
      .filter(item => item.is_recommended || item.is_ai_boosted || item.rating >= 4.7)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3);

    const directMatches = matchedItems.slice(0, 5);

    return {
      keywords,
      mostOrdered,
      directMatches
    };
  }, [query, allItems]);

  // Scroll to top when query or results change
  useEffect(() => {
    if (query && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [query, results.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
          setQuery(initialQuery);
          performSearch(initialQuery);
      }
      
      if (initialScan) {
          handleQRSearch();
      } else {
          setTimeout(() => inputRef.current?.focus(), 300);
      }
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      stopScanner();
    }
    return () => {
      document.body.style.overflow = 'unset';
      stopScanner();
    };
  }, [isOpen]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                scannerRef.current = null;
                setIsScanning(false);
            }).catch(err => console.error("Error stopping scanner", err));
        } else {
            scannerRef.current.clear();
            scannerRef.current = null;
            setIsScanning(false);
        }
    }
  }, []);

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
      const result = event.results[0][0].transcript;
      setQuery(result);
      setIsListening(false);
      performSearch(result);
    };

    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'no-speech') {
            // Silently handle no-speech or maybe show a small toast if we had a toast system
            // For now, we'll just stop the listening state
        } else if (event.error === 'not-allowed') {
            alert("Microphone access denied. Please check permissions.");
        }
        setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleQRSearch = async () => {
    if (isScanning) {
      stopScanner();
      return;
    }

    setIsScanning(true);
    
    // Give DOM time to render the reader div
    setTimeout(async () => {
        try {
            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;
            
            const qrCodeSuccessCallback = (decodedText: string) => {
              setQuery(decodedText);
              performSearch(decodedText);
              stopScanner();
            };
            
            const config = { 
              fps: 10, 
              qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const size = Math.floor(minEdge * 0.7);
                return {
                  width: size,
                  height: size * 0.6 // Slightly wider/shorter for barcodes
                };
              },
              aspectRatio: 1.0
            };
            
            await html5QrCode.start(
              { facingMode: "environment" }, 
              config, 
              qrCodeSuccessCallback,
              () => {} // error callback - ignore
            );
        } catch (err) {
            console.error("Unable to start scanning", err);
            setIsScanning(false);
            alert("Failed to access camera. Please check permissions.");
        }
    }, 100);
  };

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
          if (isScanning) {
              stopScanner();
          } else {
              onClose();
          }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        if (!isOpen) {
            e.preventDefault();
            inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, isScanning, stopScanner]);

  const filteredResults = selectedCategory 
    ? results.filter(item => item.category === selectedCategory)
    : results;

  const categories = useMemo(() => Array.from(new Set(allItems.map(i => i.category).filter(Boolean))), [allItems]);

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
                    <button 
                        onClick={handleQRSearch}
                        className={cn(
                            "p-2 transition-colors",
                            isScanning ? "text-primary bg-primary/10 rounded-lg" : "text-gray-500 hover:text-primary"
                        )}
                    >
                        <QrCode size={20} />
                    </button>
                    <button 
                        onClick={handleVoiceSearch}
                        className={cn(
                            "p-2 transition-colors",
                            isListening ? "text-red-500 bg-red-500/10 rounded-lg scale-110" : "text-gray-500 hover:text-primary"
                        )}
                    >
                        {isListening ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
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

          {/* QR Scanner Overlay */}
          <AnimatePresence>
            {isScanning && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-x-0 top-32 z-50 flex justify-center px-4"
                >
                    <div className="w-full max-w-sm bg-black border border-primary/30 rounded-3xl overflow-hidden shadow-2xl shadow-primary/20">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900">
                            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
                                <Camera size={14} />
                                Scanner Active
                            </div>
                            <button onClick={stopScanner} className="text-gray-500 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>
                        <div id="reader" className="w-full aspect-square bg-black"></div>
                        <div className="p-4 text-center text-[10px] text-gray-400 font-medium">
                            Point your camera at a QR code or barcode
                        </div>
                    </div>
                </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto custom-scrollbar"
            data-lenis-prevent
          >
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
              
              {!query && (
                <div className="space-y-12 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Upgraded Recent Searches / Search History */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-gray-400">
                        <div className="flex items-center gap-2">
                          <History size={16} className="text-primary/70" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest font-mono">Search History</h3>
                        </div>
                        {recent.length > 0 && (
                          <button
                            onClick={clearRecent}
                            className="text-[9px] font-black uppercase tracking-wider text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={11} /> Clear All
                          </button>
                        )}
                      </div>

                      {recent.length > 0 ? (
                        <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto no-scrollbar">
                          {recent.map((s, i) => (
                            <div
                              key={`recent-${s}-${i}`}
                              className="flex items-center justify-between group p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all"
                            >
                              <button
                                onClick={() => {
                                  setQuery(s);
                                  performSearch(s);
                                }}
                                className="flex-1 flex items-center gap-2 text-left text-sm text-gray-300 hover:text-white transition-colors min-w-0"
                              >
                                <Clock size={13} className="text-gray-600 group-hover:text-primary transition-colors flex-shrink-0" />
                                <span className="truncate">{s}</span>
                              </button>
                              <button
                                onClick={() => removeRecent(s)}
                                className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-500/10"
                                title="Remove search"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-8 bg-white/[0.01] border border-dashed border-white/5 rounded-2xl text-center space-y-2">
                          <History size={24} className="text-gray-700" />
                          <p className="text-xs text-gray-500">Your recent searches will appear here.</p>
                        </div>
                      )}
                    </div>

                    {/* Trending Searches */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-400">
                        <TrendingUp size={16} className="text-accent" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest font-mono">Trending Now</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {trending.map((s, i) => (
                          <motion.button
                            key={`trending-term-${s}-${i}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setQuery(s);
                              performSearch(s);
                            }}
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
                        <h3 className="text-[10px] font-black uppercase tracking-widest font-mono">AI Recommendations</h3>
                      </div>
                      <div className="p-6 bg-primary/10 border border-primary/20 rounded-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Sparkles size={80} />
                        </div>
                        <p className="text-sm text-gray-300 italic mb-4 leading-relaxed">
                          "I'm looking for a premium tiered chocolate cake for a 25th anniversary celebration..."
                        </p>
                        <button 
                          onClick={handleVoiceSearch}
                          className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:gap-4 transition-all"
                        >
                          Try AI Butler <Mic size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* New Beautiful Trending Items Section */}
                  {trendingItems.length > 0 && (
                    <div className="space-y-6 pt-6 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp size={16} className="text-primary" />
                          <h3 className="text-[11px] font-black uppercase tracking-widest text-white font-mono">Trending Delicacies</h3>
                        </div>
                        <span className="text-[9px] font-mono text-gray-500 uppercase">Freshly Baked & Highly Rated</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {trendingItems.map((item, idx) => (
                          <div 
                            key={item.id ? `trending-item-${item.id}` : `trending-item-${idx}`}
                            onClick={() => {
                              navigate(`/product/${item.id}`);
                              onClose();
                            }}
                            className="group relative bg-zinc-950/80 border border-white/5 rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 flex flex-col cursor-pointer shadow-lg hover:shadow-primary/5"
                          >
                            <div className="relative aspect-video w-full overflow-hidden bg-zinc-900 flex-shrink-0">
                              <OptimizedImage 
                                src={item.image} 
                                alt={item.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-6" />
                              <div className="absolute top-2 right-2 flex gap-1">
                                {item.is_ai_boosted && (
                                  <span className="px-2 py-0.5 bg-primary/20 backdrop-blur-md rounded-full text-[8px] font-black text-primary uppercase tracking-wider">
                                    AI Pick
                                  </span>
                                )}
                                <span className="px-2 py-0.5 bg-zinc-900/60 backdrop-blur-md rounded-full text-[8px] font-black text-amber-500 uppercase tracking-wider">
                                  ★ {item.rating.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col justify-between">
                              <div>
                                <h4 className="font-bold text-white text-sm group-hover:text-primary transition-colors line-clamp-1">{item.name}</h4>
                                <p className="text-xs text-gray-500 line-clamp-2 mt-1 min-h-[2rem] leading-relaxed">{item.description}</p>
                              </div>
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                <span className="text-sm font-black text-primary">₹{item.price}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(item);
                                    onClose();
                                    setIsCartOpen(true);
                                  }}
                                  className="px-3 py-1.5 bg-white/5 rounded-lg text-[9px] font-black uppercase tracking-widest text-white group-hover:bg-primary group-hover:text-white transition-all hover:scale-105"
                                >
                                  Quick Add
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {query && (
                <div className="space-y-8">
                  {/* Real-time Instant Suggestions Bar (Appears as user types) */}
                  {liveSuggestions && (liveSuggestions.keywords.length > 0 || liveSuggestions.mostOrdered.length > 0 || liveSuggestions.directMatches.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 sm:p-6 bg-zinc-950/90 border border-primary/30 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden group"
                    >
                      {/* Background Ambient Glow */}
                      <div className="absolute -top-10 -right-10 w-48 h-48 bg-primary/10 blur-[80px] pointer-events-none" />

                      {/* Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-primary animate-pulse" />
                          <h3 className="text-xs font-black uppercase tracking-widest text-white font-mono">
                            Real-Time Suggestions
                          </h3>
                          <span className="px-2 py-0.5 bg-primary/20 border border-primary/30 text-primary text-[9px] font-black rounded-full font-mono uppercase tracking-wider">
                            Instant
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                          Matches updated live as you type
                        </span>
                      </div>

                      {/* 1. Keyword Auto-Complete Suggestions */}
                      {liveSuggestions.keywords.length > 0 && (
                        <div className="space-y-2.5 relative z-10">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 font-mono">
                            <Search size={12} className="text-primary" />
                            Suggested Searches
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {liveSuggestions.keywords.map((kw, i) => (
                              <motion.button
                                key={`suggested-kw-${kw}-${i}`}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => {
                                  setQuery(kw);
                                  performSearch(kw);
                                }}
                                className="px-3.5 py-1.5 bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/40 rounded-xl text-xs font-medium text-gray-200 hover:text-white transition-all flex items-center gap-2 group shadow-sm"
                              >
                                <HighlightText text={kw} highlight={query} />
                                <ArrowRight size={12} className="text-gray-500 group-hover:text-primary transition-colors" />
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2. Most Ordered / Trending Hits matching search query */}
                      {liveSuggestions.mostOrdered.length > 0 && (
                        <div className="space-y-3 pt-2 relative z-10 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-mono">
                              <Flame size={14} className="text-amber-500 fill-amber-500/20 animate-bounce" />
                              Most Ordered & Trending Matches
                            </div>
                            <span className="text-[9px] text-amber-500/80 font-mono uppercase tracking-wider">Top Customer Picks</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {liveSuggestions.mostOrdered.map((item, idx) => (
                              <div
                                key={item.id ? `most-ordered-${item.id}` : `most-ordered-${idx}`}
                                onClick={() => {
                                  navigate(`/product/${item.id}`);
                                  onClose();
                                }}
                                className="p-3 bg-zinc-900/80 hover:bg-zinc-800/90 border border-white/10 hover:border-amber-500/40 rounded-2xl transition-all cursor-pointer flex items-center gap-3 group relative overflow-hidden shadow-lg"
                              >
                                <div className="w-14 h-14 rounded-xl overflow-hidden bg-black flex-shrink-0 relative">
                                  <OptimizedImage
                                    src={item.image}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[8px] font-black rounded uppercase font-mono">
                                      ★ {item.rating.toFixed(1)}
                                    </span>
                                    {item.is_recommended && (
                                      <span className="px-1.5 py-0.2 bg-primary/20 text-primary text-[8px] font-black rounded uppercase font-mono">
                                        Best Seller
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                                    <HighlightText text={item.name} highlight={query} />
                                  </h4>
                                  <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-xs font-black text-primary font-mono">₹{item.price}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addToCart(item);
                                        setAddedItemId(String(item.id));
                                        setTimeout(() => setAddedItemId(null), 1500);
                                      }}
                                      className="px-2 py-1 bg-primary/20 hover:bg-primary text-primary hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                                    >
                                      {addedItemId === String(item.id) ? (
                                        <>
                                          <Check size={10} /> Added
                                        </>
                                      ) : (
                                        <>+ Quick Add</>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. Quick Direct Item Suggestions */}
                      {liveSuggestions.directMatches.length > 0 && (
                        <div className="space-y-2 pt-2 relative z-10 border-t border-white/5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 font-mono">
                            <ChevronRight size={12} className="text-primary" />
                            Direct Matches ({liveSuggestions.directMatches.length})
                          </div>
                          <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                            {liveSuggestions.directMatches.map((item, idx) => (
                              <div
                                key={item.id ? `direct-match-${item.id}` : `direct-match-${idx}`}
                                onClick={() => {
                                  navigate(`/product/${item.id}`);
                                  onClose();
                                }}
                                className="p-3 hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0">
                                    <OptimizedImage
                                      src={item.image}
                                      alt={item.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                                      <HighlightText text={item.name} highlight={query} />
                                    </div>
                                    <div className="text-[10px] text-gray-500 truncate flex items-center gap-2">
                                      <span className="capitalize">{item.category}</span>
                                      <span>•</span>
                                      <span className="text-amber-400">★ {item.rating}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span className="text-xs font-bold text-primary font-mono">₹{item.price}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToCart(item);
                                      setAddedItemId(String(item.id));
                                      setTimeout(() => setAddedItemId(null), 1500);
                                    }}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-primary/20 text-gray-300 hover:text-primary border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                  >
                                    {addedItemId === String(item.id) ? '✓ Added' : '+ Add'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* AI Processing / Best Match Section */}
                  <AnimatePresence>
                    {(isProcessingRec || smartRec) && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="p-1 rounded-[2.5rem] bg-gradient-to-br from-primary/30 via-white/5 to-accent/30 shadow-2xl overflow-hidden"
                      >
                        <div className="relative p-6 sm:p-10 rounded-[2.4rem] bg-zinc-950/90 backdrop-blur-3xl overflow-hidden group">
                          {/* Background Glow */}
                          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] pointer-events-none" />
                          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 blur-[100px] pointer-events-none" />

                          <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start relative z-10">
                            {/* AI Identity */}
                            <div className="flex-shrink-0 flex flex-col items-center">
                              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary to-accent p-[2px] mb-4">
                                <div className="w-full h-full rounded-[22px] bg-black flex items-center justify-center relative overflow-hidden">
                                  <Sparkles size={32} className="text-white animate-pulse" />
                                  <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border border-white/10 rounded-full scale-150 border-dashed"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Frosty Butler</span>
                                <div className="flex gap-1">
                                  {[1,2,3].map(i => (
                                    <motion.div 
                                      key={i}
                                      animate={{ scale: [1, 1.5, 1] }} 
                                      transition={{ repeat: Infinity, delay: i * 0.2 }}
                                      className="w-1 h-1 bg-primary rounded-full" 
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Recommendation Logic */}
                            <div className="flex-1 text-center lg:text-left">
                              {isProcessingRec ? (
                                <div className="space-y-4">
                                  <h3 className="text-2xl font-black text-white italic">Analyzing your intent...</h3>
                                  <div className="space-y-2 max-w-lg mx-auto lg:mx-0">
                                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ x: "-100%" }}
                                        animate={{ x: "100%" }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        className="w-1/2 h-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" 
                                      />
                                    </div>
                                    <p className="text-gray-500 text-xs font-mono">Personalizing recommendations based on "{query}"</p>
                                  </div>
                                </div>
                              ) : smartRec ? (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="space-y-6"
                                >
                                  <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-[10px] font-black text-primary uppercase tracking-widest mb-4">
                                      <Sparkles size={12} />
                                      AI concierge
                                    </div>
                                    {bestMatch ? (
                                      <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tighter leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-500">
                                        "{smartRec.reason}"
                                      </h3>
                                    ) : (
                                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-snug">
                                        {smartRec.butlerResponse}
                                      </h3>
                                    )}
                                  </div>

                                  {bestMatch && (
                                    <div 
                                      onClick={() => {
                                        navigate(`/product/${bestMatch.id}`);
                                        onClose();
                                      }}
                                      className="flex flex-col sm:flex-row items-center gap-6 p-4 sm:p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all cursor-pointer"
                                    >
                                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl relative group">
                                            <OptimizedImage 
                                              src={bestMatch.image} 
                                              alt={bestMatch.name} 
                                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        </div>
                                        <div className="flex-1 text-center sm:text-left">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                                <h4 className="text-xl font-black text-white">{bestMatch.name}</h4>
                                                <span className="text-primary font-black text-lg">₹{bestMatch.price}</span>
                                            </div>
                                            <p className="text-gray-400 text-sm line-clamp-2 mb-4">{bestMatch.description}</p>
                                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                                                <div className="flex gap-2">
                                                  {bestMatch.tags?.slice(0, 2).map((tag, tagIdx) => (
                                                    <span key={`${tag}-${tagIdx}`} className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-gray-500">#{tag}</span>
                                                  ))}
                                                </div>
                                                
                                                <div className="flex items-center gap-3 ml-auto">
                                                  <button 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      navigate(`/product/${bestMatch.id}`);
                                                      onClose();
                                                    }}
                                                    className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-white transition-all"
                                                  >
                                                      Details
                                                  </button>
                                                  <button 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      addToCart(bestMatch);
                                                      onClose();
                                                      setIsCartOpen(true);
                                                    }}
                                                    className="px-6 py-2.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                                                  >
                                                      Buy Now
                                                  </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                  )}

                                  {!bestMatch && smartRec.butlerResponse && (
                                    <p className="text-gray-400 text-sm italic">
                                      I couldn't find a direct match for this specific request, but please explore our exquisite collection below.
                                    </p>
                                  )}
                                </motion.div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                            key={`ai-suggestion-${s}-${i}`}
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
                      {categories.map((cat, idx) => (
                        <button
                          key={`cat-filter-${cat}-${idx}`}
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
                            key={item.id ? `search-res-${item.id}` : `search-res-${idx}`}
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <FoodCard 
                                item={item} 
                                onClick={onClose}
                                showBuyNow={true}
                                isAiRecommended={
                                    item.id === smartRec?.bestMatchId || 
                                    smartRec?.alternatives?.includes(item.id)
                                }
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <div className="space-y-12">
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-gray-700">
                          <Search size={48} />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold text-white">No exact results found</h3>
                          <p className="text-gray-500 max-w-sm">
                            We couldn't find an exact match for "{query}". <br/>
                            But you might love these instead.
                          </p>
                        </div>
                        <button 
                          onClick={clear}
                          className="px-8 py-4 bg-primary/10 text-primary border border-primary/20 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-primary/20 transition-all font-mono"
                        >
                          Clear Search
                        </button>
                      </div>

                      {/* Fallback items: items in the same category or popular items */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Sparkles size={16} className="text-primary" />
                          <h3 className="text-[10px] font-black uppercase tracking-widest">Recommended for you</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                          {allItems.slice(0, 4).map((item, idx) => (
                            <FoodCard 
                              key={item.id ? `fallback-item-${item.id}` : `fallback-item-${idx}`} 
                              item={item} 
                              onClick={onClose}
                              showBuyNow={true}
                            />
                          ))}
                        </div>
                      </div>
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

export default SearchOverlay;
