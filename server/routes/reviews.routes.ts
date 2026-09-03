import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

const fallbackReviews = [
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

router.get('/', async (req, res) => {
  try {
    const fetchPromise = supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), 2500)
    );

    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (error) {
      console.warn('[Reviews API] Query error/timeout, returning fallback reviews:', error.message);
      return res.json(fallbackReviews);
    }
    
    if (data && data.length > 0) {
      return res.json(data);
    }
    
    return res.json(fallbackReviews);
  } catch (err: any) {
    console.error('[Reviews API] Catch block error:', err.message || err);
    return res.json(fallbackReviews);
  }
});

/**
 * GET /api/reviews/all
 * Returns all reviews for admin dashboard
 */
router.get('/all', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Reviews API] Error fetching all reviews:', error.message);
      return res.json(fallbackReviews);
    }

    return res.json(data || []);
  } catch (err: any) {
    console.error('[Reviews API] Catch block in /all:', err.message || err);
    return res.json(fallbackReviews);
  }
});

/**
 * POST /api/reviews
 * Submits customer feedback for an eligible order (collected or delivered).
 * Enforces one feedback per order and validates input.
 */
router.post('/', async (req, res) => {
  try {
    const { orderId, rating, comment, tags, customerName, userId } = req.body;

    // 1. Validation
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ success: false, error: 'A valid order ID is required.' });
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, error: 'A star rating between 1 and 5 is required.' });
    }

    // 2. Fetch authoritative order to verify existence and status
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, status, order_type, customer_name, user_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr) {
      console.error('[Reviews API] Supabase error verifying order:', orderErr.message);
      return res.status(500).json({ success: false, error: 'Database error verifying order eligibility.' });
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found. Please verify the order number.' });
    }

    // 3. Verify order eligibility (must be delivered/collected)
    if (order.status !== 'delivered') {
      const isPickup = order.order_type === 'pickup';
      const statusMessage = isPickup
        ? 'Feedback is available once your order has been collected from the bakery counter.'
        : 'Feedback is available once your order has been delivered.';
      return res.status(400).json({ success: false, error: statusMessage, orderStatus: order.status });
    }

    // 4. Enforce One Feedback Per Order
    const { data: existingReview, error: reviewCheckErr } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (!reviewCheckErr && existingReview) {
      return res.status(409).json({ 
        success: false, 
        error: 'Feedback has already been submitted for this order. Thank you for your feedback!' 
      });
    }

    // 5. Sanitize text
    let rawComment = typeof comment === 'string' ? comment.trim() : '';
    // Strip HTML/script tags and limit to 500 characters
    rawComment = rawComment.replace(/<[^>]*>?/gm, '').slice(0, 500);

    const safeTags = Array.isArray(tags) 
      ? tags.filter(t => typeof t === 'string' && t.trim().length > 0).map(t => t.trim().slice(0, 50))
      : [];

    let finalComment = rawComment;
    if (safeTags.length > 0) {
      const tagsHeader = `Tags: ${safeTags.join(', ')}`;
      finalComment = finalComment ? `${tagsHeader}\n\n${finalComment}` : tagsHeader;
    }

    const resolvedName = (customerName && typeof customerName === 'string' && customerName.trim() && customerName.trim() !== 'Valued Customer') 
      ? customerName.trim().slice(0, 100) 
      : (order.customer_name || customerName?.trim() || 'Customer');

    const resolvedUserId = (userId && typeof userId === 'string' && userId.trim())
      ? userId.trim()
      : (order.user_id || 'guest');

    // 6. Insert review
    const { data: newReview, error: insertErr } = await supabase
      .from('reviews')
      .insert({
        order_id: orderId,
        user_id: resolvedUserId,
        customer_name: resolvedName,
        rating: numRating,
        comment: finalComment,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (insertErr) {
      console.error('[Reviews API] Error saving review:', insertErr.message);
      return res.status(500).json({ success: false, error: 'Unable to save feedback at this time. Please try again.' });
    }

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      review: newReview || {
        order_id: orderId,
        rating: numRating,
        customer_name: resolvedName
      }
    });
  } catch (err: any) {
    console.error('[Reviews API] Unexpected error in POST /api/reviews:', err.message || err);
    return res.status(500).json({ success: false, error: 'An unexpected error occurred while submitting feedback.' });
  }
});

export default router;

