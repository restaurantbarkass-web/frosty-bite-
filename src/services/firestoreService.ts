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
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        const processed: any = { id: doc.id };
        for (const key in docData) {
          if (docData[key] && typeof docData[key].toDate === 'function') {
            processed[key] = docData[key].toDate().toISOString();
          } else {
            processed[key] = docData[key];
          }
        }
        return processed;
      }) as T[];
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      return data;
    } catch (error: any) {
      console.warn(`Firestore fetch failed for ${cacheKey}, checking cache.`, error.message);
      
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return (parsed.data || parsed) as T[];
        } catch (e) {}
      }
      return []; 
    }
  },

  /**
   * Fetches a single document with caching
   */
  getDocument: async <T>(docRef: DocumentReference<DocumentData>, cacheKey: string): Promise<T | null> => {
    try {
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const docData = snapshot.data();
        const data: any = { id: snapshot.id };
        for (const key in docData) {
          if (docData[key] && typeof docData[key].toDate === 'function') {
            data[key] = docData[key].toDate().toISOString();
          } else {
            data[key] = docData[key];
          }
        }
        localStorage.setItem(cacheKey, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        return data as T;
      }
      return null;
    } catch (error: any) {
      console.warn(`Firestore document fetch failed for ${cacheKey}, checking cache.`, error.message);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return (parsed.data || parsed) as T;
        } catch (e) {}
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
        data = snapshot.docs.map((d: any) => {
          const docData = d.data();
          // Normalize Firestore Timestamps to ISO strings for easier handling in frontend components
          const processed: any = { id: d.id };
          for (const key in docData) {
            if (docData[key] && typeof docData[key].toDate === 'function') {
              processed[key] = docData[key].toDate().toISOString();
            } else {
              processed[key] = docData[key];
            }
          }
          return processed;
        }) || [];
      } else {
        if (snapshot.exists()) {
          const docData = snapshot.data();
          data = { id: snapshot.id };
          for (const key in docData) {
            if (docData[key] && typeof docData[key].toDate === 'function') {
              data[key] = docData[key].toDate().toISOString();
            } else {
              data[key] = docData[key];
            }
          }
        } else {
          data = null;
        }
      }

      if (cacheKey && data) {
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
      }
      onData(data);
    }, (error: FirestoreError) => {
      console.warn(`Firestore listener error for ${cacheKey || 'unknown'}:`, error.message);
      
      let hasCalled = false;
      if (cacheKey) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            onData(parsed.data || parsed);
            hasCalled = true;
          } catch (e) {}
        }
      }
      
      if (!hasCalled) {
        // Ensure the loading state is resolved even if there's no cache
        onData([]);
      }
      console.debug('Firestore hits issue, maintaining offline state.');
    });
  }
};
