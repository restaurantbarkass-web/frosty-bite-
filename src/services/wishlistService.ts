import { 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  collection, 
  getDocs,
  query,
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FoodItem } from '../types';

export const toggleWishlist = async (userId: string, item: FoodItem) => {
  const wishlistRef = doc(db, 'users', userId, 'wishlist', item.id);
  const cacheKey = `wishlist_cache_${userId}`;
  
  // Get current local items
  const cached = localStorage.getItem(cacheKey);
  let localData: FoodItem[] = [];
  if (cached) {
    try {
      localData = JSON.parse(cached);
    } catch (e) {}
  }

  try {
    const docSnap = await getDoc(wishlistRef);
    const exists = docSnap.exists();
    
    if (exists) {
      // Remove from Firestore
      await deleteDoc(wishlistRef);
      // Update local cache
      const updatedLocal = localData.filter(i => i.id !== item.id);
      localStorage.setItem(cacheKey, JSON.stringify(updatedLocal));
      return false; // Removed
    } else {
      // Add to Firestore
      const newItem = {
        ...item,
        addedAt: serverTimestamp()
      };
      await setDoc(wishlistRef, newItem);
      // Update local cache
      const updatedLocal = [...localData, item]; // item has id
      localStorage.setItem(cacheKey, JSON.stringify(updatedLocal));
      return true; // Added
    }
  } catch (error: any) {
    const isQuota = error?.message?.toLowerCase().includes('quota') || error?.message?.toLowerCase().includes('limit exceeded');
    
    if (isQuota) {
      console.warn('Firestore Quota Exceeded in toggleWishlist. Using local-only toggle.');
      // Persist locally even if Firestore fails
      const existsLocally = localData.some(i => i.id === item.id);
      if (existsLocally) {
        const updatedLocal = localData.filter(i => i.id !== item.id);
        localStorage.setItem(cacheKey, JSON.stringify(updatedLocal));
        return false;
      } else {
        const updatedLocal = [...localData, item];
        localStorage.setItem(cacheKey, JSON.stringify(updatedLocal));
        return true;
      }
    }

    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/wishlist/${item.id}`);
    throw error;
  }
};

export const checkIfWishlisted = async (userId: string, itemId: string) => {
  const wishlistRef = doc(db, 'users', userId, 'wishlist', itemId);
  const cacheKey = `wishlist_cache_${userId}`;
  
  // Quick local check
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const items = JSON.parse(cached) as FoodItem[];
      if (items.some(i => i.id === itemId)) return true;
    } catch (e) {}
  }

  try {
    const docSnap = await getDoc(wishlistRef);
    const exists = docSnap.exists();
    
    // Sync cache if we got a real answer
    if (exists && cached) {
       try {
         const items = JSON.parse(cached) as FoodItem[];
         if (!items.some(i => i.id === itemId)) {
           // Not in cache but exists in db, we should ideally sync better but this is fine for a quick check
         }
       } catch(e) {}
    }

    return exists;
  } catch (error: any) {
    const isQuota = error?.message?.toLowerCase().includes('quota') || error?.message?.toLowerCase().includes('limit exceeded');
    if (!isQuota) {
      console.error('Error checking wishlist status:', error);
    } else {
      // If we're here, we already did the local check at the top, so we can just return that result
    }
    
    // Fallback again just in case the first check was somehow bypassed or failed
    if (cached) {
      try {
        const items = JSON.parse(cached) as FoodItem[];
        return items.some(i => i.id === itemId);
      } catch (e) {}
    }
    return false;
  }
};

export const getUserWishlist = async (userId: string) => {
  const wishlistRef = collection(db, 'users', userId, 'wishlist');
  
  // Try to load from cache first for immediate UI
  const cacheKey = `wishlist_cache_${userId}`;
  const cached = localStorage.getItem(cacheKey);
  let localData: FoodItem[] = [];
  if (cached) {
    try {
      localData = JSON.parse(cached);
    } catch (e) {}
  }

  try {
    const querySnapshot = await getDocs(wishlistRef);
    const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodItem));
    localStorage.setItem(cacheKey, JSON.stringify(items));
    return items;
  } catch (error: any) {
    const isQuota = error?.message?.toLowerCase().includes('quota') || error?.message?.toLowerCase().includes('limit exceeded');
    if (!isQuota) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/wishlist`);
      throw error;
    }
    console.warn('Firestore Quota Exceeded in getUserWishlist. Using cache.');
    return localData;
  }
};
