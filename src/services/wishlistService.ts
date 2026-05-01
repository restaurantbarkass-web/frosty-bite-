import { db } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, getDoc, limit } from 'firebase/firestore';
import { FoodItem } from '../types';
import { handleFirestoreError, OperationType } from './firestoreService';

export const toggleWishlist = async (userId: string, item: FoodItem) => {
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
    // Check if exists
    const wishlistId = `${userId}_${item.id}`;
    const docRef = doc(db, 'wishlist', wishlistId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Remove
      await deleteDoc(docRef);
      
      // Update local cache
      const updatedLocal = localData.filter(i => i.id !== item.id);
      localStorage.setItem(cacheKey, JSON.stringify(updatedLocal));
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
      return true; // Added
    }
  } catch (error: any) {
    console.error('Firestore error in toggleWishlist:', error);
    if (error.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.WRITE, `wishlist/${userId}_${item.id}`);
    }
    return false;
  }
};

export const checkIfWishlisted = async (userId: string, itemId: string) => {
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
    const wishlistId = `${userId}_${itemId}`;
    const docRef = doc(db, 'wishlist', wishlistId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error: any) {
    console.warn('Error checking wishlist status in Firestore:', error);
    if (error.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.GET, `wishlist/${userId}_${itemId}`);
    }
    return false;
  }
};

export const getUserWishlist = async (userId: string) => {
  const cacheKey = `wishlist_cache_${userId}`;
  
  try {
    const q = query(collection(db, 'wishlist'), where('user_id', '==', userId));
    const snapshot = await getDocs(q);
    
    const items = snapshot.docs.map(d => d.data().item_details as FoodItem);
    localStorage.setItem(cacheKey, JSON.stringify(items));
    return items;
  } catch (error: any) {
    console.error('Firestore error in getUserWishlist:', error);
    if (error.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.LIST, 'wishlist');
    }
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try { return JSON.parse(cached) as FoodItem[]; } catch (e) {}
    }
    return [];
  }
};
