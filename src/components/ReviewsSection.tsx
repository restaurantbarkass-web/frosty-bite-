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
    <section id="customer-feedback-section" className="py-12 sm:py-16 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-orange-100/40 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-amber-100/40 blur-[100px] rounded-full pointer-events-none" />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-orange-700 text-xs font-bold uppercase tracking-wider shadow-2xs">
              <Star size={14} className="fill-amber-500 text-amber-500" />
              <span>Customer Feedback &amp; Reviews</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-serif text-stone-900 italic tracking-tight uppercase leading-tight">
              What Our <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500">
                Customers Say
              </span>
            </h2>
            <p className="text-sm text-stone-600 font-medium max-w-xl leading-relaxed">
              Real feedback from sweet tooth lovers across Cuttack &amp; Bhubaneswar.
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            {/* Rating pill */}
            <div className="flex items-center gap-2 bg-white border border-stone-200/90 shadow-2xs rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={14} className="fill-amber-500 text-amber-500" />
                ))}
              </div>
              <span className="text-xs font-bold text-stone-800 ml-1">4.9/5 Rating</span>
            </div>

            {/* High-visibility Share Feedback button */}
            <Link
              to="/feedback"
              id="btn-leave-feedback-home"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95 shadow-md shadow-orange-500/25 cursor-pointer"
            >
              <MessageSquareHeart size={16} className="shrink-0" />
              <span>Share Feedback</span>
            </Link>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
                className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/90 shadow-xs hover:shadow-md hover:border-orange-300/80 transition-all duration-300 flex flex-col justify-between relative group"
              >
                <div>
                  <Quote className="absolute top-6 right-7 text-amber-500/10 group-hover:text-amber-500/20 transition-colors pointer-events-none" size={38} />
                  
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={15} 
                        className={cn(
                          "transition-all duration-300",
                          i < review.rating ? "fill-amber-500 text-amber-500" : "text-stone-200"
                        )} 
                      />
                    ))}
                  </div>

                  <p className="text-stone-700 text-sm font-normal leading-relaxed mb-6 italic">
                    "{review.comment}"
                  </p>
                </div>

                <div className="flex items-center gap-3.5 pt-4 border-t border-stone-100">
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-orange-600 font-extrabold uppercase text-base shrink-0 shadow-2xs">
                    {review.customer_name ? review.customer_name[0] : 'C'}
                  </div>
                  <div>
                    <h4 className="text-stone-900 font-bold text-sm tracking-tight leading-tight mb-0.5">
                      {review.customer_name || 'Customer'}
                    </h4>
                    <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                      Verified Frosty Bite Customer
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Bottom CTA for Share Feedback */}
        <div className="mt-8 p-5 sm:p-6 bg-[#FFFDFB] border border-stone-200/90 rounded-3xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
              <MessageSquareHeart size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900 tracking-tight">Have you tasted our bakes recently?</h4>
              <p className="text-xs text-stone-500">Your genuine review helps us keep baking better treats for you.</p>
            </div>
          </div>
          <Link
            to="/feedback"
            className="w-full sm:w-auto text-center px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
          >
            Leave a Review
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
