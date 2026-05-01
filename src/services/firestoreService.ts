import { 
  getDoc, 
  getDocs, 
  DocumentReference, 
  Query, 
  DocumentData,
  onSnapshot,
  FirestoreError
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  
  // Follow the mandate to throw the JSON string
  throw new Error(errorJson);
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
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, path || cacheKey);
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
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, path || cacheKey);
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
      if (error.code === 'permission-denied') {
        try {
          handleFirestoreError(error, OperationType.GET, path || cacheKey || 'unknown');
        } catch (e) {
          // In listener, we might not want to throw or it might be caught by onSnapshot internals
          // but we follow the mandate to at least JSON stringify the error
        }
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
        onData([]);
      }
    });
  }
};

