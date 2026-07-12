import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ShoppingCart, Info, Star, Clock } from 'lucide-react';
import { FoodItem } from './types';
import { AiRecommendationResponse } from './services/searchService';
import { cn } from './lib/utils';
import { OptimizedImage } from './components/ui/OptimizedImage';

interface AiRecommendationCardProps {
  recommendation: AiRecommendationResponse;
  item: FoodItem;
  onAddToCart: () => void;
  onViewDetails: () => void;
}

export const AiRecommendationCard: React.FC<AiRecommendationCardProps> = ({
  recommendation,
  item,
  onAddToCart,
  onViewDetails
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group w-full"
    >
      {/* Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent to-primary rounded-[2.5rem] blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
      
      <div className="relative p-1 rounded-[2.5rem] bg-zinc-900/50 backdrop-blur-xl border border-white/10 overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] pointer-events-none group-hover:bg-primary/30 transition-all" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/20 blur-[100px] pointer-events-none group-hover:bg-accent/30 transition-all" />

        <div className="p-6 sm:p-8 flex flex-col lg:flex-row gap-8 items-center lg:items-start relative z-10">
          {/* AI Butler Identity */}
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
                {[1, 2, 3].map(i => (
                  <motion.div 
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }} 
                    transition={{ repeat: Infinity, delay: i * 0.2 }}
                    className="w-1.5 h-1.5 bg-primary rounded-full" 
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Butler Response */}
          <div className="flex-1 text-center lg:text-left space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <div className="px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20">
                  <Sparkles size={12} fill="currentColor" />
                  AI Recommended
                </div>
                {recommendation.occasionDetected && (
                   <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {recommendation.occasionDetected}
                   </span>
                )}
                {recommendation.moodDetected && (
                   <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {recommendation.moodDetected}
                   </span>
                )}
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-black text-white italic tracking-tight leading-tight">
                 &ldquo;{recommendation.butlerResponse}&rdquo;
              </h3>
            </div>

            {/* Product Feature */}
            <div className="p-4 sm:p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-white/10 transition-all group/item">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-full sm:w-40 aspect-square rounded-2xl overflow-hidden shadow-2xl relative">
                  <OptimizedImage 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                    <div className="bg-yellow-500 text-black p-1 rounded-md">
                      <Star size={10} fill="currentColor" />
                    </div>
                    <span className="text-[10px] font-black text-white">{item.rating} Rating</span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                       <h4 className="text-xl font-bold text-white group-hover/item:text-primary transition-colors">{item.name}</h4>
                       <span className="text-2xl font-black text-primary">₹{item.price}</span>
                    </div>
                    <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed mb-4">{item.description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-6">
                      {item.tags?.slice(0, 3).map((tag, tagIdx) => (
                        <span key={`${tag}-${tagIdx}`} className="px-2 py-0.5 bg-white/5 rounded text-[10px] font-medium text-gray-400 capitalize">
                          {tag}
                        </span>
                      ))}
                      {item.is_recommended && (
                        <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-[10px] font-bold text-yellow-500 uppercase tracking-tighter">
                          Customer Favorite
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={onViewDetails}
                      className="flex-1 sm:flex-none px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Info size={14} />
                      Details
                    </button>
                    <button
                      onClick={onAddToCart}
                      className="flex-[2] sm:flex-none px-8 py-3 bg-primary hover:bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={14} />
                      Quick Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
