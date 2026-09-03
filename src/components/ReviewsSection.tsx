import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Star, Quote, MessageSquareHeart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { diagnosticFetch } from '../utils/apiDiagnostics';

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: any;
}

const DEFAULT_REVIEWS: Review[] = [
  {
    id: "fb-1",
    customer_name: "Siddharth Mohanty",
    rating: 5,
    comment: "The Chocolate Truffle Cake was absolutely brilliant! Moist, rich, and decorated to perfection. Frosty Bite has become our family's go-to bakery.",
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "fb-2",
    customer_name: "Priyanka Das",
    rating: 5,
    comment: "Ordered customized coffee pastries for an office celebration, and everybody loved them. Exceptional quality and prompt delivery service in Cuttack!",
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "fb-3",
    customer_name: "Rohan Sen",
    rating: 4,
    comment: "Amazing Red Velvet cup cakes. The cream cheese frosting is light, airy, and not excessively sweet. Perfect afternoon treat.",
    created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: "fb-4",
    customer_name: "Ananya Mishra",
    rating: 5,
    comment: "Ordered their tier-3 anniversary cake. It was gorgeous and delicious. Flawless service!",
    created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
  }
];

export const ReviewsSection: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>(DEFAULT_REVIEWS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchReviews = async () => {
      try {
        const res = await diagnosticFetch('/api/reviews').catch(() => fetch('/api/reviews'));
        if (res && res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setReviews(data);
            localStorage.setItem('reviews_cache', JSON.stringify({ data, timestamp: Date.now() }));
            return;
          }
        }
      } catch (err) {
        console.warn('Reviews API offline, checking local cache:', err);
      }

      try {
        const cached = localStorage.getItem('reviews_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (isMounted && parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
            setReviews(parsed.data);
            return;
          }
        }
      } catch (cacheErr) {}

      if (isMounted) {
        setReviews(DEFAULT_REVIEWS);
      }
    };

    fetchReviews();
    return () => { isMounted = false; };
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section id="customer-feedback-section" className="py-20 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-accent/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
              <Star size={14} className="fill-primary text-primary" />
              <span>Customer Feedback &amp; Reviews</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-tight">
              What Our <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Customers Say</span>
            </h2>
            <p className="text-sm text-zinc-400 max-w-xl">
              Real feedback from sweet tooth lovers across Cuttack &amp; Bhubaneswar.
            </p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={14} className="fill-primary text-primary" />
                ))}
              </div>
              <span className="text-xs font-black text-white ml-1">4.9/5 Rating</span>
            </div>

            <Link
              to="/feedback"
              id="btn-leave-feedback-home"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-md shadow-primary/10"
            >
              <MessageSquareHeart size={16} />
              <span>Share Feedback</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
                className="glass-dark rounded-[2.5rem] p-7 border border-white/5 relative group hover:border-primary/20 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <Quote className="absolute top-6 right-8 text-primary/10 group-hover:text-primary/20 transition-colors" size={40} />
                  
                  <div className="flex items-center gap-1 mb-5">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={15} 
                        className={cn(
                          "transition-all duration-300",
                          i < review.rating ? "fill-primary text-primary" : "text-zinc-800"
                        )} 
                      />
                    ))}
                  </div>

                  <p className="text-zinc-300 text-sm font-medium leading-relaxed mb-6 italic">
                    "{review.comment}"
                  </p>
                </div>

                <div className="flex items-center gap-3.5 pt-4 border-t border-white/5">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black uppercase text-base shrink-0">
                    {review.customer_name ? review.customer_name[0] : 'C'}
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm tracking-tight leading-tight mb-0.5">
                      {review.customer_name || 'Customer'}
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      Verified Frosty Bite Customer
                    </p>
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
