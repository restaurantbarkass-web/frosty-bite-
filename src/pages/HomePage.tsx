import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Search, MapPin, Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';
import { MENU_ITEMS, CATEGORIES } from '../constants';
import { FoodCard } from '../components/FoodCard';
import { getFoodRecommendations } from '../services/geminiService';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { FoodItem } from '../types';
import { appConfigService, AppConfig } from '../services/appConfigService';

// Home Page Component
export const Home: React.FC = () => {
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState(new URLSearchParams(location.search).get('search') || '');
  const [aiRecs, setAiRecs] = useState<string[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [firestoreMenu, setFirestoreMenu] = useState<FoodItem[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);

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
    const unsubscribe = appConfigService.subscribeToConfig((data) => {
      setConfig(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'menu'), where('available', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FoodItem[];
      setFirestoreMenu(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'menu');
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
            className="text-5xl md:text-7xl font-black tracking-tighter mb-6"
          >
            SWEET BLISS IN <span className="text-primary">EVERY</span> BITE
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
            className="max-w-xl mx-auto bg-black/80 backdrop-blur-2xl p-2 rounded-2xl flex items-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/20"
          >
            <div className="flex-1 flex items-center px-4 space-x-3">
              <Search className="text-primary" size={24} />
              <input
                type="text"
                placeholder="Search for Cakes, Pastries or Breads..."
                className="w-full bg-transparent border-none focus:ring-0 text-base py-4 text-white placeholder:text-gray-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => {
                const element = document.getElementById('menu-section');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-primary text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-accent transition-all shadow-xl shadow-primary/40 flex-shrink-0"
            >
              Search
            </button>
          </motion.div>
        </div>
      </section>



      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        {/* Orders Closed Banner */}
        <AnimatePresence>
          {config && !config.isOrderingOpen && (
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
    </div>
  );
};
