import { 
  getDoc, 
  getDocs, 
  DocumentReference, 
  Query, 
  DocumentData,
  onSnapshot,
  FirestoreError,
  getDocsFromCache,
  getDocFromCache,
} from 'firebase/firestore';
import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export let isQuotaExceeded = false;
let quotaExceededTime = 0;
const QUOTA_COOLDOWN = 1000 * 60 * 15; // 15 minute cooldown before trying network again

function checkQuotaState() {
  if (isQuotaExceeded && Date.now() - quotaExceededTime > QUOTA_COOLDOWN) {
    isQuotaExceeded = false;
  }
  return isQuotaExceeded;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isQuotaError = (error as any)?.code === 'resource-exhausted' || 
                       (error as any)?.message?.includes('Quota limit exceeded');
  
  if (isQuotaError) {
    isQuotaExceeded = true;
    quotaExceededTime = Date.now();
    window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
  }

  const errorMessage = isQuotaError 
    ? 'Firestore Quota Exceeded: The free tier limit (50k reads/day) has been reached. Please wait for reset at midnight or enable billing.'
    : (error instanceof Error ? error.message : String(error));

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  
  // Follow the mandate to throw the JSON string for permission errors
  // for quota errors, we log but don't throw to allow fallback logic to proceed
  if (!isQuotaError) {
    throw new Error(errorJson);
  }
}

/**
 * Enhanced Firestore helper that handles Quota Exceeded errors gracefully
 * by falling back to localStorage cache.
 */
export const safeFirestore = {
  /**
   * Fetches a collection/query with caching
   */
  getCollection: async <T>(q: Query<DocumentData>, cacheKey: string, path: string | null = null): Promise<T[]> => {
    // Fast path: if quota was recently hit, don't even try network
    if (checkQuotaState()) {
      console.warn(`Firestore quota exceeded. Skipping network and using cache for ${cacheKey}`);
      try {
        const cachedSnapshot = await getDocsFromCache(q);
        if (!cachedSnapshot.empty) {
          return cachedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as T[];
        }
      } catch (e) {
        console.warn('Firestore internal cache check failed, falling back to manual cache');
      }

      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return (parsed.data || parsed) as T[];
        } catch (e) {}
      }
      return [];
    }

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
      const isQuotaError = error.code === 'resource-exhausted' || error.message?.includes('Quota');
      
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, path || cacheKey);
      } else if (isQuotaError) {
        isQuotaExceeded = true;
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
        console.error('Firestore Quota Exceeded for Collection. Falling back to cache.');
      }
      
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
  getDocument: async <T>(docRef: DocumentReference<DocumentData>, cacheKey: string, path: string | null = null): Promise<T | null> => {
    // Fast path: if quota was recently hit, don't even try network
    if (checkQuotaState()) {
      console.warn(`Firestore quota exceeded. Skipping network and using cache for doc ${cacheKey}`);
      try {
        const cachedDoc = await getDocFromCache(docRef);
        if (cachedDoc.exists()) {
          return { id: cachedDoc.id, ...cachedDoc.data() } as T;
        }
      } catch (e) {
        console.warn('Firestore internal cache check failed, falling back to manual cache');
      }

      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          return (parsed.data || parsed) as T;
        } catch (e) {}
      }
      return null;
    }

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
      const isQuotaError = error.code === 'resource-exhausted' || error.message?.includes('Quota');

      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, path || cacheKey);
      } else if (isQuotaError) {
        isQuotaExceeded = true;
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
        console.error('Firestore Quota Exceeded for Document. Falling back to cache.');
      }

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
    cacheKey?: string,
    path: string | null = null
  ) => {
    // If quota is exceeded, don't even start the snapshot listener to prevent SDK crashes
    if (checkQuotaState()) {
      console.warn(`Firestore quota exceeded. Skipping listener for ${cacheKey || 'unknown'}`);
      if (cacheKey) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            onData(parsed.data || parsed);
          } catch (e) {}
        }
      }
      return () => {}; // Return dummy unsubscribe
    }

    try {
      return onSnapshot(ref, (snapshot: any) => {
        const isCollection = !!snapshot.docs;
        let data: any;
        
        if (isCollection) {
          data = snapshot.docs.map((d: any) => {
            const docData = d.data();
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
        const isQuotaError = error.code === 'resource-exhausted' || error.message?.includes('Quota');

        if (error.code === 'permission-denied') {
          try {
            handleFirestoreError(error, OperationType.GET, path || cacheKey || 'unknown');
          } catch (e) {}
        } else if (isQuotaError) {
          isQuotaExceeded = true;
          quotaExceededTime = Date.now();
          window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
          console.error('Firestore Quota Exceeded for Listener. Falling back to cache.');
        }

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
          onData(ref.docs ? [] : null);
        }
      });
    } catch (err: any) {
      console.error('Failed to establish Firestore listener:', err);
      if (cacheKey) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            onData(parsed.data || parsed);
          } catch (e) {}
        }
      }
      return () => {};
    }
  }
};

