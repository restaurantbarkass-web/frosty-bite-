import { FoodItem } from '../types';
import { supabase } from '../supabase';

export const toggleWishlist = async (userId: string | null | undefined, item: FoodItem) => {
  if (!userId) {
    // Guest Wishlist (Local Storage)
    try {
      const guestKey = 'frostybite_guest_wishlist';
      const cached = localStorage.getItem(guestKey);
      const list: FoodItem[] = cached ? JSON.parse(cached) : [];
      const exists = list.some(i => i.id === item.id);
      
      let updated: FoodItem[];
      if (exists) {
        updated = list.filter(i => i.id !== item.id);
        localStorage.setItem(guestKey, JSON.stringify(updated));
        return false;
      } else {
        updated = [...list, item];
        localStorage.setItem(guestKey, JSON.stringify(updated));
        return true;
      }
    } catch (e) {
      console.warn('Guest wishlist error:', e);
      return false;
    }
  }

  const cacheKey = `wishlist_cache_${userId}`;
  
  try {
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
      const { error: deleteError } = await supabase
        .from('wishlist')
        .delete()
        .eq('id', existing.id);

      if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        throw new Error(`Remove from Supabase failed: ${deleteError.message}`);
      }

      // Update Local Cache
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const localData = JSON.parse(cached);
            const filtered = Array.isArray(localData) ? localData.filter((i: any) => i.id !== item.id) : [];
            localStorage.setItem(cacheKey, JSON.stringify(filtered));
          } catch (e) {}
        }
      } catch (e) {}

      try {
        localStorage.removeItem(`wishlist_doc_${userId}_${item.id}`);
      } catch (e) {}

      return false; // Removed successfully
    } else {
      // 4. ADD Case
      const { error: insertError } = await supabase
        .from('wishlist')
        .insert({
          user_id: effectiveUserId,
          product_id: item.id,
          item_details: item // Store details for UI
        });

      if (insertError) {
        if (insertError.code === '23505') return true;
        console.error('Supabase insert error:', insertError);
        throw new Error(`Add to Supabase failed: ${insertError.message}`);
      }

      // Update Local Cache
      let localData = [];
      try {
        const cached = localStorage.getItem(cacheKey);
        localData = cached ? JSON.parse(cached) : [];
      } catch (e) {}
      
      const updated = Array.isArray(localData) ? [...localData, item] : [item];
      try {
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      } catch (e) {}
      try {
        localStorage.setItem(`wishlist_doc_${userId}_${item.id}`, JSON.stringify({ user_id: userId, product_id: item.id }));
      } catch (e) {}

      return true; // Added successfully
    }
  } catch (error: any) {
    console.error('Error in toggleWishlist:', error);
    throw error; 
  }
};

export const checkIfWishlisted = async (userId: string | null | undefined, itemId: string) => {
  if (!userId) {
    try {
      const guestKey = 'frostybite_guest_wishlist';
      const cached = localStorage.getItem(guestKey);
      if (!cached) return false;
      const list: FoodItem[] = JSON.parse(cached);
      return list.some(i => i.id === itemId);
    } catch {
      return false;
    }
  }

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

export const getUserWishlist = async (userId: string | null | undefined) => {
  if (!userId) {
    try {
      const guestKey = 'frostybite_guest_wishlist';
      const cached = localStorage.getItem(guestKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  const cacheKey = `wishlist_cache_${userId}`;
  
  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Supabase error fetching wishlist:', error);
      throw error;
    }

    if (data) {
      const items = data.map(d => d.item_details).filter(Boolean);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(items));
      } catch (e) {}
      return items;
    }
    
    return [];
  } catch (error: any) {
    console.error('Error in getUserWishlist:', error);
    return [];
  }
};
