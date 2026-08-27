import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Star, Quote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { diagnosticFetch } from '../utils/apiDiagnostics';

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: any;
}

export const ReviewsSection: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await diagnosticFetch('/api/reviews');
        if (!res.ok) throw new Error('Reviews API non-ok response');
        const data = await res.json();
        
        if (data && data.length > 0) {
          setReviews(data);
          localStorage.setItem('reviews_cache', JSON.stringify({ data, timestamp: Date.now() }));
        }
      } catch (err) {
        console.warn('Reviews API offline, using fallback reviews cache:', err);
        try {
          const cached = localStorage.getItem('reviews_cache');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.data) {
              setReviews(parsed.data);
            }
          }
        } catch (cacheErr) {}
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, []);

  if (loading || reviews.length === 0) return null;

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-accent/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-[1px] w-12 bg-primary/50" />
              <span className="text-primary font-black uppercase tracking-[0.4em] text-xs">Community Voice</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter uppercase leading-none">
              What Our <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Customers Say</span>
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-12 h-12 rounded-full border-4 border-[#050505] bg-zinc-800 flex items-center justify-center overflow-hidden">
                   <img src={`https://i.pravatar.cc/150?u=${i}`} alt="Avatar" className="w-full h-full object-cover opacity-50 hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => <Star key={s} size={14} className="fill-primary text-primary" />)}
              </div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">4.9/5 Average Rating</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 content-visibility-auto">
          <AnimatePresence mode="popLayout">
            {reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
                className="glass-dark rounded-[2.5rem] p-8 border border-white/5 relative group hover:border-primary/20 transition-all duration-300 card-contain"
              >
                <Quote className="absolute top-6 right-8 text-primary/10 group-hover:text-primary/20 transition-colors" size={48} />
                
                <div className="flex items-center gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      size={16} 
                      className={cn(
                        "transition-all duration-300",
                        i < review.rating ? "fill-primary text-primary" : "text-zinc-800"
                      )} 
                    />
                  ))}
                </div>

                <p className="text-zinc-300 font-medium leading-relaxed mb-8 italic">
                  "{review.comment}"
                </p>

                <div className="flex items-center gap-4 mt-auto pt-6 border-t border-white/5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-xl">
                    {review.customer_name[0]}
                  </div>
                  <div>
                    <h4 className="text-white font-black uppercase tracking-tight leading-none mb-1">{review.customer_name}</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Verified Baker Lover</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
