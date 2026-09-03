import React, { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Star, 
  Heart, 
  CheckCircle2, 
  ShoppingBag, 
  ArrowLeft, 
  Sparkles, 
  Clock, 
  MessageSquare, 
  AlertCircle,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  User
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { formatOrderId } from '../utils/orderUtils';
import toast from 'react-hot-toast';

const RATING_LABELS: Record<number, string> = {
  1: 'Very Poor',
  2: 'Poor',
  3: 'Average',
  4: 'Great',
  5: 'Excellent'
};

const QUICK_TAGS = [
  'Delicious 🍰',
  'Fresh',
  'Beautiful presentation',
  'Great packaging',
  'Fast service',
  'Friendly service',
  'Value for money',
  'Loved it ❤️',
  'Taste',
  'Order accuracy',
  'Pickup experience',
  'Delivery experience',
  'Portion size'
];

export const FeedbackPage: React.FC = () => {
  const { orderId: routeOrderId } = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Resolution of orderId from URL path or query params (?order= or ?orderId=)
  const initialOrderId = routeOrderId || searchParams.get('order') || searchParams.get('orderId') || '';
  const [orderSearchId, setOrderSearchId] = useState(initialOrderId);
  const [activeOrderId, setActiveOrderId] = useState(initialOrderId);

  const [order, setOrder] = useState<any>(null);
  const [loadingOrder, setLoadingOrder] = useState(Boolean(initialOrderId));
  const [orderError, setOrderError] = useState<string | null>(null);

  // Review states
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);
  const [existingReviewData, setExistingReviewData] = useState<any>(null);

  // Generate unique IDs for accessibility
  const orderSearchInputId = useId();
  const feedbackCommentInputId = useId();
  const feedbackNameInputId = useId();

  // Reviewer Name (automatically prefilled from checkout page entered name)
  const [customerNameInput, setCustomerNameInput] = useState('');

  // Fetch and verify order whenever activeOrderId changes
  useEffect(() => {
    let isCancelled = false;

    async function loadOrder() {
      if (!activeOrderId || activeOrderId.trim() === '') {
        setOrder(null);
        setLoadingOrder(false);
        setOrderError(null);
        return;
      }

      setLoadingOrder(true);
      setOrderError(null);

      try {
        const cleanId = activeOrderId.trim();
        // Fetch order from Supabase
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', cleanId)
          .maybeSingle();

        if (isCancelled) return;

        if (error) {
          console.warn('[FeedbackPage] Supabase error loading order:', error.message);
          setOrderError('Could not verify this order. Please double check the order ID.');
          setOrder(null);
          setLoadingOrder(false);
          return;
        }

        if (!data) {
          setOrderError(`We could not find order #${formatOrderId(cleanId)}. Please check the order ID and try again.`);
          setOrder(null);
          setLoadingOrder(false);
          return;
        }

        setOrder(data);

        // Pre-fill customer name from the checkout page entered name
        const checkoutName = (data.customer_name || data.customerName || '').trim();
        const fallbackUserName = (user?.displayName || user?.email?.split('@')[0] || '').trim();
        setCustomerNameInput(checkoutName || fallbackUserName || 'Guest Customer');

        // Check if a review already exists for this order
        const { data: revData } = await supabase
          .from('reviews')
          .select('*')
          .eq('order_id', cleanId)
          .maybeSingle();

        if (isCancelled) return;

        if (revData) {
          setHasExistingReview(true);
          setExistingReviewData(revData);
        } else {
          // Also check local storage for idempotency in case of network latency
          const localKey = `fb_reviewed_${cleanId}`;
          if (localStorage.getItem(localKey)) {
            setHasExistingReview(true);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          setOrderError('An unexpected error occurred while loading order details.');
        }
      } finally {
        if (!isCancelled) {
          setLoadingOrder(false);
        }
      }
    }

    loadOrder();

    return () => {
      isCancelled = true;
    };
  }, [activeOrderId]);

  const handleSearchOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderSearchId.trim()) {
      setActiveOrderId(orderSearchId.trim());
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const activeRating = hoverRating !== null ? hoverRating : rating;

  // Eligibility check:
  // Pickup: order.status must be 'delivered' (collected)
  // Delivery: order.status must be 'delivered'
  const isOrderEligible = order?.status === 'delivered';
  const isPickup = order?.order_type === 'pickup' || order?.orderType === 'pickup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    if (!rating || rating < 1 || rating > 5) {
      toast.error('Please select a star rating between 1 and 5.');
      return;
    }

    if (!isOrderEligible) {
      toast.error(
        isPickup 
          ? 'Feedback unlocks once your order has been collected from our bakery counter.' 
          : 'Feedback unlocks once your order has been delivered.'
      );
      return;
    }

    if (isSubmitting || isSubmitted || hasExistingReview) {
      return;
    }

    setIsSubmitting(true);

    try {
      const resolvedName = (
        customerNameInput.trim() ||
        order.customer_name ||
        order.customerName ||
        user?.displayName ||
        user?.email?.split('@')[0] ||
        'Guest Customer'
      ).trim();

      const payload = {
        orderId: order.id,
        rating,
        tags: selectedTags,
        comment: comment.trim(),
        customerName: resolvedName,
        userId: user?.uid || order.user_id || 'guest'
      };

      // Call API route
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 409) {
          setHasExistingReview(true);
          toast.success('Feedback was already received for this order! Thank you.');
          return;
        }
        throw new Error(resJson?.error || 'Failed to submit feedback.');
      }

      // Success
      localStorage.setItem(`fb_reviewed_${order.id}`, 'true');
      setIsSubmitted(true);
      toast.success('Thank you for your feedback! ❤️', {
        icon: '🍰',
        style: {
          background: '#121212',
          color: '#fff',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }
      });
    } catch (err: any) {
      console.warn('[FeedbackPage] API submit error, trying direct Supabase fallback:', err.message);
      
      // Resilient fallback direct to Supabase
      try {
        const resolvedName = (
          customerNameInput.trim() ||
          order.customer_name ||
          order.customerName ||
          user?.displayName ||
          user?.email?.split('@')[0] ||
          'Guest Customer'
        ).trim();
        const safeComment = comment.trim().replace(/<[^>]*>?/gm, '').slice(0, 500);
        const tagsHeader = selectedTags.length > 0 ? `Tags: ${selectedTags.join(', ')}` : '';
        const finalComment = tagsHeader ? (safeComment ? `${tagsHeader}\n\n${safeComment}` : tagsHeader) : safeComment;

        const { error: sbErr } = await supabase.from('reviews').insert({
          order_id: order.id,
          user_id: user?.uid || order.user_id || 'guest',
          customer_name: resolvedName,
          rating,
          comment: finalComment,
          created_at: new Date().toISOString()
        });

        if (sbErr) throw sbErr;

        localStorage.setItem(`fb_reviewed_${order.id}`, 'true');
        setIsSubmitted(true);
        toast.success('Thank you for your feedback! ❤️');
      } catch (fallbackErr: any) {
        toast.error(err.message || 'Unable to submit feedback right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white selection:bg-amber-500/30 selection:text-amber-400 font-sans relative overflow-x-hidden pb-16">
      {/* Ambient background glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-96 bg-gradient-to-b from-amber-500/10 via-rose-500/5 to-transparent blur-[120px] pointer-events-none" />

      {/* Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#070709]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/"
            id="feedback-nav-back-btn"
            className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Bakery</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">Frosty Bite Feedback</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-8 relative z-10 space-y-6">

        {/* Hero Section */}
        <section id="feedback-hero" className="text-center space-y-3 pt-2">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold"
          >
            <Sparkles size={14} className="text-amber-400" />
            <span>Customer Experience</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight"
          >
            ✨ How was your Frosty Bite experience?
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-base text-zinc-400 font-medium"
          >
            We'd love to hear from you ❤️
            <span className="block text-xs text-zinc-500 mt-1 font-normal">
              Your feedback helps us make every order sweeter.
            </span>
          </motion.p>
        </section>

        {/* Order Lookup Form (if no active order or user wants to switch order) */}
        {!activeOrderId && (
          <motion.section
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0f0f13] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <ShoppingBag size={24} />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Find Your Order</h2>
              <p className="text-xs text-zinc-400">
                Enter your order ID from your receipt or WhatsApp message to leave feedback.
              </p>
            </div>

            <form onSubmit={handleSearchOrder} className="flex gap-2 max-w-md mx-auto pt-2">
              <label htmlFor={orderSearchInputId} className="sr-only">Order ID</label>
              <input
                id={orderSearchInputId}
                type="text"
                value={orderSearchId}
                onChange={(e) => setOrderSearchId(e.target.value)}
                placeholder="e.g. FB1024 or full Order ID"
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-all font-mono"
              />
              <button
                type="submit"
                id="feedback-find-order-btn"
                className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <Search size={16} />
                <span>Verify</span>
              </button>
            </form>
          </motion.section>
        )}

        {/* Loading state */}
        {loadingOrder && (
          <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-10 text-center space-y-4">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-zinc-400 font-medium">Verifying order eligibility…</p>
          </div>
        )}

        {/* Error state */}
        {!loadingOrder && orderError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 text-center space-y-3">
            <AlertCircle size={32} className="text-red-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Order Check</h3>
            <p className="text-xs text-red-300 max-w-md mx-auto">{orderError}</p>
            <button
              type="button"
              id="feedback-try-different-order-btn"
              onClick={() => {
                setActiveOrderId('');
                setOrderSearchId('');
                setOrderError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer mt-2"
            >
              <span>Try a different Order ID</span>
            </button>
          </div>
        )}

        {/* Order Details & Feedback Container */}
        {!loadingOrder && order && (
          <div className="space-y-6">

            {/* Order Card Badge */}
            <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-5 shadow-lg flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-white font-mono">
                      #{formatOrderId(order.id)}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isPickup 
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {isPickup ? 'Bakery Pickup' : 'Delivery'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {order.customer_name || 'Customer'} • ₹{order.total ?? order.total_amount ?? 0}
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="feedback-change-order-btn"
                onClick={() => {
                  setActiveOrderId('');
                  setOrder(null);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium cursor-pointer"
              >
                Change Order
              </button>
            </div>

            {/* Ineligibility notice (order not yet collected or delivered) */}
            {!isOrderEligible && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 text-center space-y-3"
              >
                <Clock size={36} className="text-amber-400 mx-auto animate-pulse" />
                <h2 className="text-base font-bold text-white">
                  {isPickup ? 'Order Still Awaiting Collection' : 'Order On Its Way'}
                </h2>
                <p className="text-xs text-zinc-300 max-w-md mx-auto leading-relaxed">
                  {isPickup 
                    ? 'Your treats are being prepared with love at Frosty Bite Bakery! Feedback will open as soon as your order has been collected from the counter.'
                    : 'Your sweet treats are still being prepared or are out for delivery. Feedback unlocks once your order arrives safely at your doorstep.'}
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <Link
                    to={`/track/${order.id}`}
                    id="feedback-track-order-btn"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/20"
                  >
                    Track Live Order
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Already Reviewed Notice */}
            {hasExistingReview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0f0f13] border border-amber-500/30 rounded-3xl p-8 text-center space-y-4 shadow-2xl relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                  <CheckCircle2 size={32} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-white">✨ Feedback Already Received</h2>
                  <p className="text-sm text-zinc-400">
                    You have already submitted feedback for order #{formatOrderId(order.id)}. Thank you for supporting Frosty Bite Bakery! ❤️
                  </p>
                </div>

                {existingReviewData && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-md mx-auto text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Your Rating</span>
                      <div className="flex gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star 
                            key={s} 
                            size={14} 
                            className={s <= existingReviewData.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'} 
                          />
                        ))}
                      </div>
                    </div>
                    {existingReviewData.comment && (
                      <p className="text-xs text-zinc-300 italic pt-1 border-t border-white/5">
                        "{existingReviewData.comment}"
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2 flex justify-center gap-3">
                  <Link
                    to="/"
                    id="feedback-already-reviewed-home-btn"
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20"
                  >
                    Explore Bakery Menu
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Success State After Submission */}
            {isSubmitted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0f0f13] border border-amber-500/40 rounded-3xl p-8 sm:p-10 text-center space-y-5 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-black flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/30"
                >
                  <Check size={40} className="stroke-[3]" />
                </motion.div>

                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    ✨ Thank You!
                  </h2>
                  <p className="text-base text-zinc-300 font-medium">
                    Your feedback means a lot to Frosty Bite Bakery. ❤️
                  </p>
                  <p className="text-xs text-amber-400 font-bold">
                    See you again for something sweet! 🍰
                  </p>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                  <Link
                    to="/"
                    id="feedback-success-home-btn"
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-amber-500/20"
                  >
                    Explore Bakery Menu
                  </Link>
                  <Link
                    to="/orders"
                    id="feedback-success-orders-btn"
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-2xl transition-all"
                  >
                    View My Orders
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Main Interactive Feedback Form */}
            {isOrderEligible && !hasExistingReview && !isSubmitted && (
              <motion.form
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="bg-[#0f0f13] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
              >
                {/* Part 8: 1-5 Star Rating */}
                <div className="space-y-3 text-center">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Rate Your Experience <span className="text-amber-400">*</span>
                  </span>

                  {/* Stars Group */}
                  <div className="flex justify-center items-center gap-2 sm:gap-3 py-2">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = star <= activeRating;
                      return (
                        <button
                          key={star}
                          type="button"
                          id={`feedback-star-${star}`}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-1 sm:p-2 rounded-2xl hover:bg-white/5 transition-all transform hover:scale-115 active:scale-95 cursor-pointer focus:outline-none"
                          aria-label={`${star} star rating - ${RATING_LABELS[star]}`}
                        >
                          <Star
                            size={36}
                            className={`transition-colors duration-150 ${
                              isFilled
                                ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                                : 'text-zinc-600 hover:text-zinc-400'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Visually Obvious Rating Indicator */}
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-sm">
                    <span>
                      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
                    </span>
                    <span>•</span>
                    <span>{rating} / 5 — {RATING_LABELS[rating]}</span>
                  </div>
                </div>

                {/* Part 9: Quick Feedback Tags */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">
                      What made it special? <span className="text-zinc-500 font-normal">(Optional)</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">Tap to select</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {QUICK_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          id={`feedback-tag-${tag.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20 scale-105'
                              : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Part 10: Customer Name (Auto-populated from Checkout page) */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={feedbackNameInputId} className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <User size={14} className="text-amber-400" />
                      <span>Your Name</span>
                    </label>
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      From Checkout Details
                    </span>
                  </div>

                  <input
                    id={feedbackNameInputId}
                    type="text"
                    maxLength={80}
                    value={customerNameInput}
                    onChange={(e) => setCustomerNameInput(e.target.value)}
                    placeholder="e.g. Swaleha, Wasif, Rahul"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-all font-sans"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Automatically retrieved from your checkout order details. Guest customers can confirm or adjust this name.
                  </p>
                </div>

                {/* Part 11: Written Feedback */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label htmlFor={feedbackCommentInputId} className="text-xs font-bold text-zinc-300">
                      Tell us more <span className="text-zinc-500 font-normal">(Optional)</span>
                    </label>
                    <span className={`text-[10px] font-mono ${comment.length > 450 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {comment.length} / 500
                    </span>
                  </div>

                  <textarea
                    id={feedbackCommentInputId}
                    rows={3}
                    maxLength={500}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="What did you love about your order?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-all resize-none font-sans leading-relaxed"
                  />
                </div>

                {/* Part 12: Submission Button */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <button
                    type="submit"
                    id="feedback-submit-btn"
                    disabled={isSubmitting || !rating}
                    className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-black font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Sending your feedback…</span>
                      </>
                    ) : (
                      <>
                        <Heart size={18} className="fill-black" />
                        <span>Submit Feedback</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-zinc-500 text-center">
                    Your review will be associated with order #{formatOrderId(order.id)}. One review per completed order.
                  </p>
                </div>
              </motion.form>
            )}

          </div>
        )}

      </main>
    </div>
  );
};

export default FeedbackPage;
