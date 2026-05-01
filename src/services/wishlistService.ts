import { db } from '../firebase';
import { collection, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { FoodItem } from '../types';
import { handleFirestoreError, OperationType, safeFirestore } from './firestoreService';

export const toggleWishlist = async (userId: string, item: FoodItem) => {
  const cacheKey = `wishlist_cache_${userId}`;
  const docCacheKey = `wishlist_doc_${userId}_${item.id}`;
  
  // Get current local items
  const cached = localStorage.getItem(cacheKey);
  let localData: FoodItem[] = [];
  if (cached) {
    try {
      localData = JSON.parse(cached);
      if (!Array.isArray(localData)) {
        // Handle cases where data might be wrapped in {data: [...]}
        localData = (localData as any).data || [];
      }
    } catch (e) {}
  }

  try {
    // Check if exists
    const wishlistId = `${userId}_${item.id}`;
    const docRef = doc(db, 'wishlist', wishlistId);
    const exists = await safeFirestore.getDocument<any>(docRef, docCacheKey, `wishlist/${wishlistId}`);

    if (exists) {
      // Remove
      await deleteDoc(docRef);
      
      // Update local cache
      const updatedLocal = localData.filter(i => i.id !== item.id);
      localStorage.setItem(cacheKey, JSON.stringify(updatedLocal));
      localStorage.removeItem(docCacheKey);
      return false; // Removed
    } else {
      // Add
      await setDoc(docRef, {
        user_id: userId,
        item_id: item.id,
        item_details: item,
        added_at: new Date().toISOString()
      });

      // Update local cache
      const updatedLocal = [...localData, item];
      localStorage.setItem(cacheKey, JSON.stringify(updatedLocal));
      localStorage.setItem(docCacheKey, JSON.stringify({ user_id: userId, item_id: item.id }));
      return true; // Added
    }
  } catch (error: any) {
    console.error('Firestore error in toggleWishlist:', error);
    const isQuotaError = error.code === 'resource-exhausted' || error.message?.includes('Quota');
    if (error.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.WRITE, `wishlist/${userId}_${item.id}`);
    } else if (isQuotaError) {
       // Logged by safeFirestore or handleFirestoreError usually, 
       // but toggleWishlist calls setDoc/deleteDoc directly which don't have wrappers yet
       console.error('Database limit reached during wishlist toggle');
    }
    return false;
  }
};

export const checkIfWishlisted = async (userId: string, itemId: string) => {
  const docCacheKey = `wishlist_doc_${userId}_${itemId}`;
  
  try {
    const wishlistId = `${userId}_${itemId}`;
    const docRef = doc(db, 'wishlist', wishlistId);
    const exists = await safeFirestore.getDocument<any>(docRef, docCacheKey, `wishlist/${wishlistId}`);
    return !!exists;
  } catch (error: any) {
    console.warn('Error checking wishlist status in Firestore:', error);
    return false;
  }
};

export const getUserWishlist = async (userId: string) => {
  const cacheKey = `wishlist_cache_${userId}`;
  
  try {
    const q = query(collection(db, 'wishlist'), where('user_id', '==', userId));
    const wishlistDocs = await safeFirestore.getCollection<any>(q, cacheKey, 'wishlist');
    
    if (wishlistDocs) {
      const items = wishlistDocs.map(d => d.item_details as FoodItem).filter(Boolean);
      return items;
    }
    return [];
  } catch (error: any) {
    console.error('Firestore error in getUserWishlist:', error);
    return [];
  }
};
