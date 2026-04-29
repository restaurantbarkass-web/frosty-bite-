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
  
  try {
    const docSnap = await getDoc(wishlistRef);
    
    if (docSnap.exists()) {
      await deleteDoc(wishlistRef);
      return false; // Removed
    } else {
      await setDoc(wishlistRef, {
        ...item,
        addedAt: serverTimestamp()
      });
      return true; // Added
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/wishlist/${item.id}`);
    throw error;
  }
};

export const checkIfWishlisted = async (userId: string, itemId: string) => {
  const wishlistRef = doc(db, 'users', userId, 'wishlist', itemId);
  try {
    const docSnap = await getDoc(wishlistRef);
    return docSnap.exists();
  } catch (error: any) {
    const isQuota = error?.message?.toLowerCase().includes('quota') || error?.message?.toLowerCase().includes('limit exceeded');
    if (!isQuota) {
      console.error('Error checking wishlist status:', error);
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
