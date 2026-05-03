import { FoodItem } from '../types';
import { supabase } from '../supabase';

export const toggleWishlist = async (userId: string, item: FoodItem) => {
  const cacheKey = `wishlist_cache_${userId}`;
  
  try {
    // 1. Get user from supabase auth if they are logged in there (as per user's snippet preference)
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    // We prefer the provided userId (from Firebase) as it's the primary identity in this app
    const effectiveUserId = userId; 

    // 2. Check if item exists in Supabase wishlist
    const { data: existing, error: checkError } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', effectiveUserId)
      .eq('product_id', item.id)
      .maybeSingle();

    if (checkError) {
      console.error('Supabase check error:', checkError);
    }

    if (existing) {
      // 3. REMOVE Case
      console.log(`Removing from Supabase: ${existing.id}`);
      const { error: deleteError } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', existing.id);

      if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        throw new Error(`Remove from Supabase failed: ${deleteError.message}`);
      }

      // Update Local Cache
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const localData = JSON.parse(cached);
          const filtered = Array.isArray(localData) ? localData.filter((i: any) => i.id !== item.id) : [];
          localStorage.setItem(cacheKey, JSON.stringify(filtered));
        } catch (e) {}
      }
      localStorage.removeItem(`wishlist_doc_${userId}_${item.id}`);

      return false; // Removed successfully
    } else {
      // 4. ADD Case
      console.log('Adding to Supabase...');
      const { error: insertError } = await supabase
        .from('wishlist')
        .insert({
          user_id: effectiveUserId,
          product_id: item.id,
          item_details: item // Store details for UI
        });

      if (insertError) {
        // Handle unique constraint conflict gracefully
        if (insertError.code === '23505') return true;
        
        console.error('Supabase insert error:', insertError);
        throw new Error(`Add to Supabase failed: ${insertError.message}`);
      }

      // Update Local Cache
      const cached = localStorage.getItem(cacheKey);
      let localData = [];
      try {
        localData = cached ? JSON.parse(cached) : [];
      } catch (e) {}
      
      const updated = Array.isArray(localData) ? [...localData, item] : [item];
      localStorage.setItem(cacheKey, JSON.stringify(updated));
      localStorage.setItem(`wishlist_doc_${userId}_${item.id}`, JSON.stringify({ user_id: userId, product_id: item.id }));

      return true; // Added successfully
    }
  } catch (error: any) {
    console.error('Error in toggleWishlist:', error);
    throw error; 
  }
};

export const checkIfWishlisted = async (userId: string, itemId: string) => {
  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', itemId)
      .maybeSingle();
    
    return !error && !!data;
  } catch (error: any) {
    console.warn('Error checking wishlist status:', error);
    return false;
  }
};

export const getUserWishlist = async (userId: string) => {
  const cacheKey = `wishlist_cache_${userId}`;
  
  try {
    // Only use Supabase
    console.log(`Fetching wishlist for user: ${userId}`);
    const { data, error } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Supabase error fetching wishlist:', error);
      throw error;
    }

    if (data) {
      console.log(`Found ${data.length} wishlist items in Supabase`);
      const items = data.map(d => d.item_details).filter(Boolean);
      localStorage.setItem(cacheKey, JSON.stringify(items));
      return items;
    }
    
    return [];
  } catch (error: any) {
    console.error('Error in getUserWishlist:', error);
    return [];
  }
};
