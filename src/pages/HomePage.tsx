import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Search, MapPin, Sparkles, ChevronRight, AlertTriangle, X } from 'lucide-react';
import { MENU_ITEMS, CATEGORIES } from '../constants';
import { FoodCard } from '../components/FoodCard';
import { getFoodRecommendations } from '../services/geminiService';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FoodItem } from '../types';
import { appConfigService, AppConfig } from '../services/appConfigService';
import { ReviewsSection } from '../components/ReviewsSection';
import { useAppConfig } from '../hooks/useAppConfig';

// Home Page Component
export const Home: React.FC = () => {
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState(new URLSearchParams(location.search).get('search') || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [aiRecs, setAiRecs] = useState<string[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [firestoreMenu, setFirestoreMenu] = useState<FoodItem[]>([]);
  const { isOrderingOpen } = useAppConfig();

  useEffect(() => {
    // Notify App component about search state to hide/show navigation
    window.dispatchEvent(new CustomEvent('is-searching', { detail: showSuggestions && searchQuery.length > 0 }));
  }, [showSuggestions, searchQuery]);

  useEffect(() => {
    const handleNavbarSearch = (e: any) => {
      setSearchQuery(e.detail);
      const element = document.getElementById('menu-section');
      element?.scrollIntoView({ behavior: 'smooth' });
    };

    window.addEventListener('navbar-search', handleNavbarSearch);
    return () => window.removeEventListener('navbar-search', handleNavbarSearch);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(location.search).get('search');
    if (query) {
      setSearchQuery(query);
      setTimeout(() => {
        const element = document.getElementById('menu-section');
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [location.search]);

  useEffect(() => {
    const q = collection(db, 'menu');
    
    // Initial load from cache to show something immediately
    const cachedMenu = localStorage.getItem('menu_cache');
    if (cachedMenu) {
      try {
        setFirestoreMenu(JSON.parse(cachedMenu));
      } catch (e) {
        console.error('Failed to parse menu cache', e);
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FoodItem[];
      setFirestoreMenu(items);
      localStorage.setItem('menu_cache', JSON.stringify(items));
    }, (error) => {
      const isQuota = error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('limit exceeded');
      if (!isQuota) {
        handleFirestoreError(error, OperationType.GET, 'menu');
      } else {
        console.warn('Firestore Quota Exceeded for menu. Showing last known items from cache.');
        // If firestoreMenu is still empty, try one last time from cache
        if (firestoreMenu.length === 0) {
          const lastResort = localStorage.getItem('menu_cache');
          if (lastResort) {
            try {
              setFirestoreMenu(JSON.parse(lastResort));
            } catch (e) {}
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchRecs = async () => {
      // Check cache first
      const cachedRecs = localStorage.getItem('ai_recs');
      const cacheTimestamp = localStorage.getItem('ai_recs_timestamp');
      const now = Date.now();
      
      if (cachedRecs && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 3600000) { // 1 hour cache
        setAiRecs(JSON.parse(cachedRecs));
        return;
      }

      setIsLoadingRecs(true);
      try {
        const recs = await getFoodRecommendations("I want something spicy and filling for dinner");
        if (recs && recs.length > 0) {
          setAiRecs(recs);
          localStorage.setItem('ai_recs', JSON.stringify(recs));
          localStorage.setItem('ai_recs_timestamp', now.toString());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingRecs(false);
      }
    };
    fetchRecs();
  }, []);

  const displayItems = firestoreMenu.length > 0 ? firestoreMenu : MENU_ITEMS;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        setSearchQuery(suggestions[activeIndex]);
        setShowSuggestions(false);
        setActiveIndex(-1);
        setTimeout(() => {
          const element = document.getElementById('menu-section');
          element?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        const element = document.getElementById('menu-section');
        element?.scrollIntoView({ behavior: 'smooth' });
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span className="font-medium text-gray-400">
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="text-white font-black group-hover:text-primary transition-colors">{part}</span>
          ) : part
        )}
      </span>
    );
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    const itemSuggestions = displayItems
      .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(item => item.name);

    const categorySuggestions = CATEGORIES
      .filter(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()));

    const combined = Array.from(new Set([...itemSuggestions, ...categorySuggestions]))
      .slice(0, 6);

    setSuggestions(combined);
    setActiveIndex(-1);
  }, [searchQuery, displayItems]);

  const filteredItems = displayItems.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative min-h-[600px] md:min-h-[750px] flex items-center justify-center py-20 overflow-hidden">
        <img 
          src="https://www.image2url.com/r2/default/images/1777124818386-bf0124a4-a64f-4911-90db-48cbce3395c2.blob" 
          alt="Artisanal Bakery Background" 
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-12"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-white to-primary rounded-full blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-gradient-x" />
              <div className="relative w-56 h-56 bg-white backdrop-blur-3xl rounded-full flex items-center justify-center border-2 border-white/10 shadow-[0_0_80px_rgba(125,211,252,0.15)] p-0 overflow-hidden outline outline-1 outline-white/5 outline-offset-8">
                <img 
                  src="https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg" 
                  alt="Frosty Bite" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </motion.div>
            <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-7xl md:text-[10rem] font-serif italic text-white tracking-tighter leading-none mb-12"
          >
            Frosty <span className="font-sans font-black NOT-italic text-primary block md:inline">Bite</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted text-lg md:text-xl mb-10 max-w-2xl mx-auto"
          >
            Artisan bakery and frosty treats. Freshly baked delights from our oven to your heart.
          </motion.p>

          <motion.div
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl mx-auto relative group/search"
          >
            <div className={cn(
              "relative bg-black/80 backdrop-blur-2xl p-2 rounded-2xl flex items-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/20 transition-all duration-500",
              showSuggestions && searchQuery.length > 0 && "rounded-b-none border-b-transparent shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
            )}>
              {/* Focus Glow Background */}
              <div className="absolute -inset-1 bg-primary/20 rounded-2xl blur-xl opacity-0 group-focus-within/search:opacity-100 transition-opacity duration-1000 -z-10" />
              
              <div className="flex-1 flex items-center px-2 sm:px-4 space-x-2 sm:space-x-3 min-w-0">
                <Search className={cn("transition-colors duration-300 flex-shrink-0", showSuggestions ? "text-primary" : "text-gray-500")} size={20} />
                <input
                  type="text"
                  placeholder="Search Cakes, Pastries or Breads..."
                  className="w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base py-3 sm:py-4 text-white placeholder:text-gray-400 font-medium min-w-0 px-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onKeyDown={handleKeyDown}
                />
                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => setSearchQuery('')}
                      className="p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors"
                    >
                      <X size={20} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <button 
                onClick={() => {
                  const element = document.getElementById('menu-section');
                  element?.scrollIntoView({ behavior: 'smooth' });
                  setShowSuggestions(false);
                }}
                className="bg-primary text-white px-3 sm:px-10 py-3 sm:py-4 rounded-xl font-black uppercase tracking-widest hover:bg-accent transition-all shadow-xl shadow-primary/40 flex-shrink-0 active:scale-95 text-[10px] sm:text-sm"
              >
                Search
              </button>
            </div>

            {/* Search Suggestions */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute left-0 right-0 top-full bg-black/90 backdrop-blur-3xl border border-white/20 border-t-transparent rounded-b-2xl overflow-hidden z-50 shadow-2xl origin-top"
                >
                  <div className="h-[1px] mx-6 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <motion.div 
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.05
                        }
                      }
                    }}
                    className="py-2"
                  >
                    {suggestions.map((suggestion, index) => (
                      <motion.button
                        key={index}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          show: { opacity: 1, x: 0 }
                        }}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          setSearchQuery(suggestion);
                          setShowSuggestions(false);
                          setTimeout(() => {
                            const element = document.getElementById('menu-section');
                            element?.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                        className={cn(
                          "w-full px-6 py-4 text-left transition-all flex items-center space-x-4 group relative",
                          activeIndex === index ? "bg-white/10" : "hover:bg-white/5"
                        )}
                      >
                        {activeIndex === index && (
                          <motion.div 
                            layoutId="suggestion-pill"
                            className="absolute inset-y-2 left-2 w-1 bg-primary rounded-full shadow-[0_0_10px_rgba(125,211,252,0.5)]"
                          />
                        )}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                          activeIndex === index ? "bg-primary text-white scale-110 shadow-lg shadow-primary/20" : "bg-white/5 text-gray-500"
                        )}>
                          <Search size={14} />
                        </div>
                        <span className="flex-1 truncate">
                          {highlightMatch(suggestion, searchQuery)}
                        </span>
                        <AnimatePresence>
                          {activeIndex === index && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5, x: 10 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.5, x: 10 }}
                            >
                              <ChevronRight size={16} className="text-primary" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>



      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 md:-mt-12 relative z-20">
        {/* Orders Closed Banner */}
        <AnimatePresence>
          {!isOrderingOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-6 backdrop-blur-xl"
            >
              <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shrink-0">
                <AlertTriangle size={28} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter text-red-500 italic">Online Orders are Currently Closed</h3>
                <p className="text-sm font-bold text-red-500/80">🚫 We are not accepting new orders at the moment. Please check back later!</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories */}
        <div className="flex space-x-4 overflow-x-auto pb-8 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('All')}
            className={cn(
              "whitespace-nowrap px-6 py-3 rounded-2xl font-bold transition-all",
              selectedCategory === 'All' ? "bg-primary text-white shadow-lg shadow-primary/20" : "glass-dark text-muted hover:text-white"
            )}
          >
            All Items
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "whitespace-nowrap px-6 py-3 rounded-2xl font-bold transition-all",
                selectedCategory === cat ? "bg-primary text-white shadow-lg shadow-primary/20" : "glass-dark text-muted hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* AI Recommendations */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mb-12 p-6 glass-dark rounded-3xl border border-primary/10"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Sparkles className="text-primary" size={24} />
              <h2 className="text-xl font-bold">AI Recommendations</h2>
            </div>
            <span className="text-xs text-muted">Powered by Frosty Bite</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {isLoadingRecs ? (
              <div className="animate-pulse flex space-x-3">
                {[1, 2, 3].map(i => <div key={i} className="h-10 w-32 bg-white/5 rounded-full" />)}
              </div>
            ) : (
              aiRecs.map((rec, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className="px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-full text-sm font-medium cursor-pointer"
                  onClick={() => setSearchQuery(rec)}
                >
                  {rec}
                </motion.div>
              ))
            )}
          </div>
        </motion.section>

        {/* Food Grid */}
        <div id="menu-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item) => (
            <FoodCard key={item.id} item={item} />
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted text-lg">No items found matching your search.</p>
          </div>
        )}
      </div>

      {/* Reviews Section */}
      <div id="reviews" className="mb-20">
        <ReviewsSection />
      </div>

      {/* SEO Content Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24 text-gray-400">
        <div className="glass-dark p-8 md:p-12 rounded-[40px] border border-white/5">
          <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase mb-6">
            Welcome to Frosty Bite – Artisan Bakery & Frosty Treats
          </h1>
          <p className="text-lg leading-relaxed mb-12 max-w-4xl">
            Frosty Bite is your perfect destination for artisan bakery items, delicious cakes, and mouth-watering frosty treats. 
            We prepare every treat with high-quality ingredients to give you the best taste and experience.
          </p>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
            <div>
              <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-6 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-primary"></span>
                Our Specialties
              </h2>
              <ul className="space-y-4 text-gray-300">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="font-medium">Freshly Baked Cakes for every celebration</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="font-medium">Delicious Pastries made with premium butter</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="font-medium">Custom Cakes tailored to your special occasions</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span className="font-medium">Fast and Easy Online Ordering with real-time tracking</span>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-6 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-primary"></span>
                Why Choose Frosty Bite?
              </h2>
              <p className="text-gray-300 leading-relaxed text-base italic">
                At Frosty Bite, we focus on quality, freshness, and customer satisfaction. 
                Whether it's a birthday cake or a sweet pastry craving, we ensure every order is made with care and delivered fresh to your doorstep. 
                Our commitment to excellence makes us the top-rated artisan bakery.
              </p>
            </div>
          </div>

          <div className="mt-16 pt-12 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-white uppercase italic tracking-tight mb-4">
                Order Your Favorite Treats
              </h2>
              <p className="text-gray-400 leading-relaxed">
                Browse our complete bakery collection and order cakes and pastries online. 
                Enjoy fast delivery and make every moment special with Frosty Bite. From our oven to your heart, we promise a delightful experience.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => {
                  const el = document.getElementById('menu-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all"
              >
                View Our Menu
              </button>
              <button 
                onClick={() => {
                  const el = document.getElementById('reviews');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/10 transition-all"
              >
                About Us
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
