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
      <div className="absolute -inset-1 bg-gradient-to-r from-orange-400/20 via-amber-400/20 to-orange-400/20 rounded-[2.5rem] blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
      
      <div className="relative p-1 rounded-[2.5rem] bg-white border border-stone-200/90 shadow-xl overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] pointer-events-none group-hover:bg-orange-500/20 transition-all" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 blur-[100px] pointer-events-none group-hover:bg-amber-500/20 transition-all" />

        <div className="p-6 sm:p-8 flex flex-col lg:flex-row gap-8 items-center lg:items-start relative z-10">
          {/* AI Butler Identity */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-primary to-amber-500 p-[2px] mb-4">
              <div className="w-full h-full rounded-[22px] bg-primary flex items-center justify-center relative overflow-hidden">
                <Sparkles size={32} className="text-white animate-pulse" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border border-white/20 rounded-full scale-150 border-dashed"
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
                <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2 shadow-sm">
                  <Sparkles size={12} fill="currentColor" />
                  AI Recommended
                </div>
                {recommendation.occasionDetected && (
                   <span className="px-3 py-1 bg-stone-100 border border-stone-200 rounded-full text-[10px] font-black text-stone-600 uppercase tracking-widest">
                    {recommendation.occasionDetected}
                   </span>
                )}
                {recommendation.moodDetected && (
                   <span className="px-3 py-1 bg-stone-100 border border-stone-200 rounded-full text-[10px] font-black text-stone-600 uppercase tracking-widest">
                    {recommendation.moodDetected}
                   </span>
                )}
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-black text-stone-900 italic tracking-tight leading-tight">
                 &ldquo;{recommendation.butlerResponse}&rdquo;
              </h3>
            </div>

            {/* Product Feature */}
            <div className="p-4 sm:p-6 bg-stone-50/80 border border-stone-200 rounded-[2rem] hover:bg-stone-50 transition-all group/item">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-full sm:w-40 aspect-square rounded-2xl overflow-hidden shadow-md relative">
                  <OptimizedImage 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                    <div className="bg-amber-400 text-stone-900 p-1 rounded-md">
                      <Star size={10} fill="currentColor" />
                    </div>
                    <span className="text-[10px] font-black text-white">{item.rating} Rating</span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2">
                       <h4 className="text-xl font-bold text-stone-900 group-hover/item:text-primary transition-colors">{item.name}</h4>
                       <span className="text-2xl font-black text-primary">₹{item.price}</span>
                    </div>
                    <p className="text-stone-600 text-sm line-clamp-2 leading-relaxed mb-4">{item.description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-6">
                      {item.tags?.slice(0, 3).map((tag, tagIdx) => (
                        <span key={`${tag}-${tagIdx}`} className="px-2 py-0.5 bg-stone-200/70 rounded text-[10px] font-medium text-stone-600 capitalize">
                          {tag}
                        </span>
                      ))}
                      {item.is_recommended && (
                        <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[10px] font-bold text-amber-700 uppercase tracking-tighter">
                          Customer Favorite
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={onViewDetails}
                      className="flex-1 sm:flex-none px-6 py-3 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Info size={14} />
                      Details
                    </button>
                    <button
                      onClick={onAddToCart}
                      className="flex-[2] sm:flex-none px-8 py-3 bg-primary hover:bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
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
