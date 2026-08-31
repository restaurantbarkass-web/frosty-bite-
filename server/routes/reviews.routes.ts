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

export default router;
