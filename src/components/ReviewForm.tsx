import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Star, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface ReviewFormProps {
  orderId: string;
  onSuccess: () => void;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({ orderId, onSuccess }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        order_id: orderId,
        user_id: user.uid,
        customer_name: user.displayName || user.email?.split('@')[0] || 'Customer',
        rating,
        comment,
        created_at: new Date().toISOString(),
      });

      setSubmitted(true);
      setTimeout(onSuccess, 2000);
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12 text-center space-y-4"
      >
        <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-white italic uppercase tracking-tight">Review Received!</h3>
          <p className="text-zinc-500 font-medium">Thank you for helping us improve our bakes.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.form 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit} 
      className="glass-dark rounded-3xl border-2 border-primary/20 p-8 space-y-8 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="space-y-2 relative z-10">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Rate Your Experience</h3>
        <p className="text-zinc-500 text-sm font-medium">How was the Frosty Bite treat you ordered?</p>
      </div>

      <div className="flex flex-col items-center space-y-4 relative z-10">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-transform active:scale-90"
            >
              <Star
                size={40}
                className={cn(
                  "transition-all duration-300",
                  (hoverRating || rating) >= star 
                    ? "fill-primary text-primary drop-shadow-[0_0_8px_rgba(255,107,0,0.5)]" 
                    : "text-zinc-800"
                )}
              />
            </button>
          ))}
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary animate-pulse">
          {rating === 5 ? 'Amazing' : rating === 4 ? 'Good' : rating === 3 ? 'Average' : rating === 2 ? 'Poor' : 'Awful'}
        </span>
      </div>

      <div className="space-y-4 relative z-10">
        <div className="relative">
          <div className="absolute top-4 left-4 text-primary">
            <MessageSquare size={18} />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            placeholder="Share your feedback..."
            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pl-12 h-32 focus:border-primary/50 focus:ring-0 text-white placeholder:text-zinc-600 font-medium resize-none transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2 group/btn"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Submit Review
              <Send size={16} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
};
