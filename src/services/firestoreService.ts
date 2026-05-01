import { 
  getDoc, 
  getDocs, 
  DocumentReference, 
  Query, 
  DocumentData,
  onSnapshot,
  FirestoreError
} from 'firebase/firestore';

/**
 * Enhanced Firestore helper that handles Quota Exceeded errors gracefully
 * by falling back to localStorage cache.
 */
export const safeFirestore = {
  /**
   * Fetches a collection/query with caching
   */
  getCollection: async <T>(q: Query<DocumentData>, cacheKey: string): Promise<T[]> => {
    try {
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T[];
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      return data;
    } catch (error: any) {
      const isQuota = error.code === 'resource-exhausted' || error.message?.includes('Quota');
      
      if (isQuota) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            return (parsed.data || parsed) as T[];
          } catch (e) {}
        }
        return []; // Return empty instead of throwing if we have issues but want to keep UI alive
      }
      throw error;
    }
  },

  /**
   * Fetches a single document with caching
   */
  getDocument: async <T>(docRef: DocumentReference<DocumentData>, cacheKey: string): Promise<T | null> => {
    try {
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as T;
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        return data;
      }
      return null;
    } catch (error: any) {
      const isQuota = error.code === 'resource-exhausted' || error.message?.includes('Quota');
      
      if (isQuota) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            return (parsed.data || parsed) as T;
          } catch (e) {}
        }
      }
      return null;
    }
  },

  /**
   * Safe snapshot listener that doesn't explode on quota
   */
  listen: (
    ref: any, 
    onData: (data: any) => void,
    cacheKey?: string
  ) => {
    return onSnapshot(ref, (snapshot: any) => {
      const isCollection = !!snapshot.docs;
      let data: any;
      
      if (isCollection) {
        data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) || [];
      } else {
        data = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      }

      if (cacheKey && data) {
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      }
      onData(data);
    }, (error: FirestoreError) => {
      const isQuota = error.code === 'resource-exhausted' || error.message?.includes('Quota');
      
      if (isQuota) {
        if (cacheKey) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              onData(parsed.data || parsed);
              return;
            } catch (e) {}
          }
        }
        console.debug('Firestore hits quota, maintaining offline state.');
        return;
      }
      console.error('Firestore non-quota error:', error);
    });
  }
};
