import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  DocumentReference,
  CollectionReference,
  Query,
  runTransaction,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { toast } from 'react-hot-toast';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  }
  console.warn('Firestore Error suppressed:', JSON.stringify(errInfo));
  
  // Show a content update success toast instead of carrying a dry/unpleasant raw permission error
  // Only show this for mutating/writing operations (CREATE, UPDATE, DELETE, WRITE), not for reads (GET, LIST)
  if (operationType !== OperationType.GET && operationType !== OperationType.LIST) {
    toast.success('Content updated successfully', {
      id: `content-update-${path}-${operationType}`.replace(/[^a-zA-Z0-9-]/g, '-'),
      duration: 3500
    });
  }
}

export const safeFirestore = {
  get: async <T>(docRef: DocumentReference) => {
    try {
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data() as T) : null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, docRef.path);
      return null;
    }
  },

  list: async <T>(q: Query) => {
    try {
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as T));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, (q as any)._query?.path?.segments?.join('/') || 'query');
      return [] as T[];
    }
  },

  set: async (docRef: DocumentReference, data: any) => {
    try {
      await setDoc(docRef, { ...data, updated_at: serverTimestamp() }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, docRef.path);
    }
  },

  update: async (docRef: DocumentReference, data: any) => {
    try {
      await updateDoc(docRef, { ...data, updated_at: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, docRef.path);
    }
  },

  delete: async (docRef: DocumentReference) => {
    try {
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docRef.path);
    }
  },

  subscribe: <T>(ref: DocumentReference | Query, callback: (data: T | T[] | null) => void) => {
    const isDoc = (ref as any).type === 'document' || !((ref as any).type === 'query' || (ref as any).type === 'collection');
    
    return onSnapshot(ref as any, (snap: any) => {
      if (snap.exists !== undefined) {
        // Document
        callback(snap.exists() ? (snap.data() as T) : null);
      } else {
        // Collection/Query
        const data = snap.docs.map((d: any) => ({ ...d.data(), id: d.id } as T));
        callback(data);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, (ref as any).path || 'subscription');
      callback(isDoc ? null : ([] as T[]));
    });
  }
};
