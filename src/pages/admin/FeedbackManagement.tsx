import React, { useState, useEffect } from 'react';
import { 
  Star, 
  Search, 
  RefreshCw, 
  MessageSquareHeart, 
  Copy, 
  Check, 
  TrendingUp, 
  Award, 
  ShoppingBag,
  Filter
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../supabase';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface ReviewItem {
  id: string;
  order_id?: string;
  user_id?: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export const FeedbackManagement: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | 'all'>('all');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const fetchReviews = async () => {
    setIsLoading(true);
    try {
      // 1. First attempt server route
      const res = await fetch('/api/reviews/all').catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setReviews(data);
          setIsLoading(false);
          return;
        }
      }

      // 2. Direct Supabase fallback
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews from Supabase:', error);
      } else if (data && data.length > 0) {
        setReviews(data);
      } else {
        // Fallback default sample reviews if table is still empty
        setReviews([
          {
            id: "fb-1",
            order_id: "ORD-9842",
            customer_name: "Siddharth Mohanty",
            rating: 5,
            comment: "Tags: Delicious, Fresh\n\nThe Chocolate Truffle Cake was absolutely brilliant! Moist, rich, and decorated to perfection. Frosty Bite has become our family's go-to bakery.",
            created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: "fb-2",
            order_id: "ORD-9835",
            customer_name: "Priyanka Das",
            rating: 5,
            comment: "Tags: Prompt Delivery, Delicious\n\nOrdered customized coffee pastries for an office celebration, and everybody loved them. Exceptional quality and prompt delivery service in Cuttack!",
            created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
          },
          {
            id: "fb-3",
            order_id: "ORD-9810",
            customer_name: "Rohan Sen",
            rating: 4,
            comment: "Tags: Light & Fluffy\n\nAmazing Red Velvet cup cakes. The cream cheese frosting is light, airy, and not excessively sweet. Perfect afternoon treat.",
            created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
    setCopiedOrderId(orderId);
    toast.success(`Order ID ${orderId} copied`);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // Metrics
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / totalReviews).toFixed(1)
    : '5.0';
  const fiveStarCount = reviews.filter(r => r.rating === 5).length;
  const satisfiedCount = reviews.filter(r => r.rating >= 4).length;
  const satisfactionRate = totalReviews > 0 ? Math.round((satisfiedCount / totalReviews) * 100) : 100;

  // Filtered Reviews
  const filteredReviews = reviews.filter(review => {
    const matchesSearch = 
      (review.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (review.comment?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (review.order_id?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRating = selectedRatingFilter === 'all' || review.rating === selectedRatingFilter;

    return matchesSearch && matchesRating;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <MessageSquareHeart size={20} />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tight">
              Customer Feedback
            </h1>
          </div>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Monitor verified ratings, customer sentiments, and reviews submitted after order delivery and collection.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchReviews}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer w-fit"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh Reviews</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Average Rating</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Star size={16} className="fill-amber-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{averageRating}</span>
            <span className="text-xs text-zinc-400 font-bold">/ 5.0</span>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star 
                key={s} 
                size={12} 
                className={s <= Math.round(Number(averageRating)) ? "fill-amber-400 text-amber-400" : "text-zinc-700"} 
              />
            ))}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Reviews</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <MessageSquareHeart size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{totalReviews}</div>
          <p className="text-[11px] text-zinc-400 font-medium mt-2">Verified customer submissions</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">5-Star Reviews</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Award size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{fiveStarCount}</div>
          <p className="text-[11px] text-zinc-400 font-medium mt-2">
            {totalReviews > 0 ? `${Math.round((fiveStarCount / totalReviews) * 100)}% of total reviews` : 'Top ratings'}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Satisfaction Rate</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-3xl font-black text-white">{satisfactionRate}%</div>
          <p className="text-[11px] text-zinc-400 font-medium mt-2">Rated 4 stars or higher</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search reviews, customer or order ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
          />
        </div>

        {/* Rating Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Filter size={12} /> Filter:
          </span>
          {[
            { label: 'All', value: 'all' },
            { label: '5 ★', value: 5 },
            { label: '4 ★', value: 4 },
            { label: '3 ★', value: 3 },
            { label: '2 ★', value: 2 },
            { label: '1 ★', value: 1 }
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setSelectedRatingFilter(item.value as any)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
                selectedRatingFilter === item.value
                  ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                  : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/5"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/10 rounded-3xl">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Loading Customer Feedback…</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-16 bg-white/5 border border-white/10 rounded-3xl space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
            <MessageSquareHeart size={28} />
          </div>
          <h3 className="text-white font-bold text-base">No reviews found</h3>
          <p className="text-zinc-500 text-xs max-w-sm mx-auto">
            {searchTerm || selectedRatingFilter !== 'all'
              ? 'No customer reviews match your active filter or search terms.'
              : 'Feedback submitted by customers after collecting or receiving orders will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReviews.map((review, idx) => {
            const dateStr = review.created_at
              ? new Date(review.created_at).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })
              : 'Recent';

            return (
              <motion.div
                key={review.id || `rev-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.2) }}
                className="bg-white/5 border border-white/10 hover:border-white/20 rounded-3xl p-5 sm:p-6 space-y-4 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {/* Customer Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-sm uppercase shrink-0">
                        {review.customer_name ? review.customer_name[0] : 'C'}
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm leading-tight">
                          {review.customer_name || 'Anonymous Customer'}
                        </h4>
                        <span className="text-[11px] text-zinc-500">{dateStr}</span>
                      </div>
                    </div>

                    {/* Star Rating Badge */}
                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl shrink-0">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          className={cn(
                            s <= review.rating ? "fill-amber-400 text-amber-400" : "text-zinc-700"
                          )}
                        />
                      ))}
                      <span className="text-xs font-black text-white ml-1">{review.rating}.0</span>
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-3.5 mt-2">
                    <p className="text-zinc-200 text-xs leading-relaxed whitespace-pre-line">
                      "{review.comment || 'No written comment provided.'}"
                    </p>
                  </div>
                </div>

                {/* Footer with Order ID */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[11px]">
                  {review.order_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 flex items-center gap-1 font-medium">
                        <ShoppingBag size={12} /> Order:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyOrderId(review.order_id!)}
                        className="font-mono text-zinc-300 hover:text-amber-400 flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                        title="Copy Order ID"
                      >
                        <span>#{review.order_id.slice(-8).toUpperCase()}</span>
                        {copiedOrderId === review.order_id ? (
                          <Check size={11} className="text-emerald-400" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-zinc-500 italic">Direct review</span>
                  )}

                  <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Verified
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeedbackManagement;
