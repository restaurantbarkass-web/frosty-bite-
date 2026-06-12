import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

const defaultTrending = [
  'Anniversary Cakes',
  'Chocolate Truffle',
  'Coffee Pastries',
  'Custom Gifts',
  'Cupcakes',
  'Fresh Fruit Cake'
];

router.post('/log', async (req, res) => {
  const { searchTerm, userId = 'anonymous' } = req.body;

  if (!searchTerm) {
    return res.status(400).json({ error: 'searchTerm is required' });
  }

  const trimmed = searchTerm.trim().toLowerCase();

  if (!trimmed) {
    return res.json({ success: true, message: 'empty query ignored' });
  }

  try {
    // Log search history
    try {
      const { error: historyError } = await supabase
        .from('search_history')
        .insert({
          query: trimmed,
          user_id: userId
        });

      if (historyError) {
        console.warn('[Search History] Insert failed:', historyError.message);
      }
    } catch (historyErr: any) {
      console.warn('[Search History] Error:', historyErr.message);
    }

    // Check if search term already exists
    const { data: existing, error: selectErr } = await supabase
      .from('search_analytics')
      .select('*')
      .eq('query', trimmed)
      .maybeSingle();

    if (selectErr) {
      console.error('[Search Analytics] Select failed:', selectErr.message);
      return res.status(500).json({
        success: false,
        error: selectErr.message
      });
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('search_analytics')
        .update({
          count: (existing.count || 0) + 1,
          last_searched: new Date().toISOString()
        })
        .eq('query', trimmed);

      if (updateError) {
        console.warn('[Search Analytics] Update failed:', updateError.message);
      }
    } else {
      const { error: insertError } = await supabase
        .from('search_analytics')
        .insert({
          query: trimmed,
          count: 1,
          last_searched: new Date().toISOString()
        });

      if (insertError) {
        console.warn('[Search Analytics] Insert failed:', insertError.message);
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Search API] Logging error on server:', err.message || err);

    return res.status(500).json({
      success: false,
      error: err.message || 'Unknown server error'
    });
  }
});
export default router;
