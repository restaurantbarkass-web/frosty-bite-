import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, Cpu, MessageSquare, ArrowRight } from 'lucide-react';
import { AiRecommendationCard } from '../AiRecommendationCard';
import { searchService, AiRecommendationResponse } from '../services/searchService';
import { FoodItem } from '../types';
import { useMenu } from '../context/MenuContext';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export const ButlerSelection: React.FC = () => {
  const { items } = useMenu();
  const [recommendation, setRecommendation] = useState<AiRecommendationResponse | null>(null);
  const [recommendedItem, setRecommendedItem] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [thoughtIndex, setThoughtIndex] = useState(0);

  const thoughts = [
    "Analyzing recent flavor trends...",
    "Consulting the artisanal archives...",
    "Evaluating palate satisfaction scores...",
    "Crafting your personalized selection...",
    "Finalizing the Frosty Butler's choice..."
  ];

  useEffect(() => {
    if (items.length === 0) return;

    const fetchFeaturedRec = async () => {
      setLoading(true);
      
      // Rotate thoughts
      const interval = setInterval(() => {
        setThoughtIndex(prev => (prev + 1) % thoughts.length);
      }, 2000);

      try {
        // Use a generic premium query for the butler's featured choice
        const query = "Recommend a masterpiece for a luxury treat";
        const rec = await searchService.getSmartRecommendation(query, items);
        
        if (rec) {
          const item = items.find(i => i.id === rec.bestMatchId);
          if (item) {
            setRecommendation(rec);
            setRecommendedItem(item);
          } else {
            throw new Error("Recommended item not found in local menu");
          }
        } else {
          throw new Error("No recommendation from Butler");
        }
      } catch (error) {
        console.error("Butler featured rec failed, using fallback:", error);
        // Fallback to a random recommended item or just the first item
        const fallbackItem = items.find(i => i.is_recommended) || items[0];
        if (fallbackItem) {
          setRecommendedItem(fallbackItem);
          setRecommendation({
            bestMatchId: fallbackItem.id,
            reason: "Timeless classic choice",
            intent: "Luxury Indulgence",
            alternatives: [],
            isEmotionalMatch: true,
            occasionDetected: "Special Moment",
            moodDetected: "Luxurious",
            recommendationType: "trending",
            butlerResponse: "Although my neural archives are currently updating, this exquisite selection remains the pinnacle of our collection today."
          });
        }
      } finally {
        clearInterval(interval);
        setTimeout(() => setLoading(false), 800);
      }
    };

    fetchFeaturedRec();
  }, [items.length]);

  return (
    <section className="mb-24 relative">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[120%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
              <Brain size={16} className="text-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Neural Selection Engine v2.0</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter leading-[0.9]">
              Frosty Butler's <br /> <span className="text-primary">Featured Selection</span>
            </h2>
            <p className="text-zinc-500 font-medium max-w-lg">
              Our AI Butler has analyzed over 1,000 pairings and customer feedback loops to select a treat perfectly suited for this very moment.
            </p>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex -space-x-3">
                {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-black bg-zinc-800 overflow-hidden">
                        <img 
                            src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${i + 10}`} 
                            alt="User" 
                            className="w-full h-full object-cover" 
                        />
                    </div>
                ))}
             </div>
             <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                Trusted by <span className="text-white">5,000+</span> Connoisseurs
             </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full min-h-[400px] rounded-[3rem] glass-dark border border-white/5 flex flex-col items-center justify-center p-12 text-center space-y-8"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <div className="w-24 h-24 rounded-3xl bg-black border border-primary/30 flex items-center justify-center relative overflow-hidden group">
                  <Cpu size={40} className="text-primary animate-spin-slow" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border border-primary/20 rounded-full scale-125 border-dashed"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white tracking-tight">{thoughts[thoughtIndex]}</h3>
                <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Neural connection stable • Processing menu data</p>
              </div>
              <div className="flex items-center gap-1.5 justify-center">
                {[0,1,2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 bg-primary rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            recommendation && recommendedItem && (
              <motion.div
                key="content"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
              >
                <div className="lg:col-span-8">
                  <AiRecommendationCard
                    recommendation={recommendation}
                    item={recommendedItem}
                    onAddToCart={() => {
                        // This will trigger the global search context logic effectively
                        window.dispatchEvent(new CustomEvent('add-to-cart-featured', { detail: recommendedItem }));
                    }}
                    onViewDetails={() => {
                        window.location.href = `/product/${recommendedItem.id}`;
                    }}
                  />
                </div>

                {/* Sidebar Context */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="p-8 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                       <MessageSquare className="text-primary" size={20} />
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-white italic">Butler's Commentary</h4>
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed italic">
                      "I have observed a significant surge in appreciation for {recommendedItem.category} lately. This particular masterpiece represents the pinnacle of our baker's craftsmanship today."
                    </p>
                    <div className="pt-6 border-t border-white/5 space-y-4">
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Why it matches:</h5>
                       <ul className="space-y-3">
                          {[
                            "Complexity of flavor profile",
                            "Ingredient peak-freshness score: 98%",
                            "Visual presentation excellence"
                          ].map(point => (
                            <li key={point} className="flex items-center gap-3 text-xs text-white/80 font-bold">
                               <div className="w-1 h-1 bg-primary rounded-full" />
                               {point}
                            </li>
                          ))}
                       </ul>
                    </div>
                  </div>

                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
                    className="w-full group p-8 rounded-[2.5rem] bg-gradient-to-br from-primary to-accent overflow-hidden relative"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform">
                       <Sparkles size={100} />
                    </div>
                    <div className="relative text-left space-y-2">
                      <h4 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">Want a custom <br/> recommendation?</h4>
                      <div className="flex items-center gap-2 text-[10px] font-black text-white/80 uppercase tracking-widest">
                         Talk to the Butler <ArrowRight size={14} />
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
