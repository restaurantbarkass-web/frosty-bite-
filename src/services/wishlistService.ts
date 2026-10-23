import { FoodItem } from '../types';
import { supabase } from '../supabase';

// In-memory wishlist cache and deduplication map
const userWishlistMemoryCache = new Map<string, { ids: Set<string>; timestamp: number }>();
const userWishlistInFlight = new Map<string, Promise<Set<string>>>();
const WISHLIST_CACHE_TTL = 90 * 1000; // 90 seconds fresh

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

      // Update in-memory cache
      const mem = userWishlistMemoryCache.get(effectiveUserId);
      if (mem) {
        mem.ids.delete(item.id);
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

      // Update in-memory cache
      const mem = userWishlistMemoryCache.get(effectiveUserId);
      if (mem) {
        mem.ids.add(item.id);
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

  // 1. Instant check in memory cache (0ms)
  const cachedEntry = userWishlistMemoryCache.get(userId);
  if (cachedEntry && (Date.now() - cachedEntry.timestamp < WISHLIST_CACHE_TTL)) {
    return cachedEntry.ids.has(itemId);
  }

  // 2. Check individual document cache in localStorage (0ms)
  try {
    if (localStorage.getItem(`wishlist_doc_${userId}_${itemId}`)) {
      return true;
    }
  } catch {}

  // 3. Check bulk localStorage cache (0ms)
  try {
    const cachedList = localStorage.getItem(`wishlist_cache_${userId}`);
    if (cachedList) {
      const parsed = JSON.parse(cachedList);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const idSet = new Set<string>();
        parsed.forEach((p: any) => {
          if (p?.id) idSet.add(p.id);
          else if (p?.product_id) idSet.add(p.product_id);
        });
        userWishlistMemoryCache.set(userId, { ids: idSet, timestamp: Date.now() });
        return idSet.has(itemId);
      }
    }
  } catch {}

  // 4. Batch in-flight query: if multiple cards mount together, execute only 1 network query
  try {
    let inFlight = userWishlistInFlight.get(userId);
    if (!inFlight) {
      inFlight = (async () => {
        try {
          const { data, error } = await supabase
            .from('wishlist')
            .select('product_id')
            .eq('user_id', userId);
          const idSet = new Set<string>();
          if (!error && Array.isArray(data)) {
            data.forEach((row: any) => {
              if (row?.product_id) idSet.add(row.product_id);
            });
          }
          userWishlistMemoryCache.set(userId, { ids: idSet, timestamp: Date.now() });
          return idSet;
        } catch (err) {
          console.warn('Error fetching bulk wishlist:', err);
          return new Set<string>();
        } finally {
          userWishlistInFlight.delete(userId);
        }
      })();
      userWishlistInFlight.set(userId, inFlight);
    }

    const idSet = await inFlight;
    return idSet.has(itemId);
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
      const idSet = new Set<string>();
      data.forEach(d => {
        if (d?.product_id) idSet.add(d.product_id);
        else if (d?.item_details?.id) idSet.add(d.item_details.id);
      });
      userWishlistMemoryCache.set(userId, { ids: idSet, timestamp: Date.now() });

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
