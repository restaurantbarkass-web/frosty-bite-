import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Camera
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { FoodItem } from '../../types';
import { useSearch } from '../../hooks/useSearch';
import { FoodCard } from '../FoodCard';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: FoodItem[];
  initialScan?: boolean;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose, allItems, initialScan }) => {
  const { 
    query, 
    setQuery, 
    results, 
    aiSuggestions, 
    trending, 
    recent, 
    performSearch,
    clear,
    smartRec,
    isProcessingRec
  } = useSearch(allItems);

  const { addToCart, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const bestMatch = allItems.find(i => i.id === smartRec?.bestMatchId);

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
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
                      <button 
                        onClick={handleVoiceSearch}
                        className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:gap-4 transition-all"
                      >
                        Try AI Butler <Mic size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {query && (
                <div className="space-y-8">
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
                              ) : smartRec && bestMatch ? (
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="space-y-6"
                                >
                                  <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-[10px] font-black text-primary uppercase tracking-widest mb-4">
                                      <Sparkles size={12} />
                                      AI Best Match
                                    </div>
                                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tighter leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-500">
                                      "{smartRec.reason}"
                                    </h3>
                                  </div>

                                  <div 
                                    onClick={() => {
                                      navigate(`/product/${bestMatch.id}`);
                                      onClose();
                                    }}
                                    className="flex flex-col sm:flex-row items-center gap-6 p-4 sm:p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all cursor-pointer"
                                  >
                                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden flex-shrink-0 shadow-2xl relative group">
                                          <img 
                                            src={bestMatch.image} 
                                            alt={bestMatch.name} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                            referrerPolicy="no-referrer"
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
                                                {bestMatch.tags?.slice(0, 2).map(tag => (
                                                  <span key={tag} className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-gray-500">#{tag}</span>
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
                                </motion.div>
                              ) : (
                                <p className="text-gray-500">No AI-specific matches found, showing best search matches.</p>
                              )}
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
