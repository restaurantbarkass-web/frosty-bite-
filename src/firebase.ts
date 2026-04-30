import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  setDoc, 
  serverTimestamp, 
  getDocFromServer,
  memoryLocalCache
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

import { getRoleFromEmail } from './constants';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with memory cache to resolve "future timestamp" sync issues
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: memoryLocalCache({})
}, firebaseConfig.firestoreDatabaseId);

export const messaging = typeof window !== 'undefined' ? (() => {
  try {
    return getMessaging(app);
  } catch (e) {
    console.warn('Firebase Messaging not supported in this environment');
    return null;
  }
})() : null;

export const googleProvider = new GoogleAuthProvider();

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

/**
 * Synchronizes the authenticated user's data with Firestore.
 * Ensures the user document exists and has the correct role.
 */
export const syncUserWithFirestore = async (user: any) => {
  if (!user) return;
  
  const role = getRoleFromEmail(user.email);
  const userRef = doc(db, 'users', user.uid);
  
  try {
    // Use setDoc with merge: true directly to avoid a preliminary getDoc
    // which might fail due to permission issues if the user document is missing
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || 'Anonymous',
      email: user.email,
      role: role,
      photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=f97316&color=fff`,
      // Only set createdAt if it doesn't exist (using merge: true)
      // Note: serverTimestamp() will always update if not guarded, 
      // but for users it's fine to have a lastSync or similar.
      lastSync: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error in syncUserWithFirestore:', error);
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`, user);
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    await syncUserWithFirestore(user);
    return user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return null;
    }
    if (error.code === 'auth/popup-blocked') {
      alert('The sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      return null;
    }
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const logout = () => signOut(auth);

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, currentUser?: any) {
  const activeUser = currentUser || auth.currentUser;
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Check for Quota Exceeded specifically
  const isQuotaError = errorMessage.toLowerCase().includes('quota') || 
                      errorMessage.toLowerCase().includes('limit exceeded') ||
                      errorMessage.toLowerCase().includes('resource-exhausted');

  const errInfo: FirestoreErrorInfo = {
    error: isQuotaError ? "DATABASE_QUOTA_EXCEEDED" : errorMessage,
    authInfo: {
      userId: activeUser?.uid,
      email: activeUser?.email,
      emailVerified: activeUser?.emailVerified,
      isAnonymous: activeUser?.isAnonymous,
      tenantId: activeUser?.tenantId,
      providerInfo: activeUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }

  // Log a structured warning for quota errors but don't crash
  if (isQuotaError) {
    console.warn(`[Firestore Quota] Operation: ${operationType}, Path: ${path || 'unknown'}`);
    const isWrite = [OperationType.CREATE, OperationType.UPDATE, OperationType.DELETE, OperationType.WRITE].includes(operationType);
    if (!isWrite) {
      // For read/list operations, we silently fail to allow the app to use cached data or show generic UI
      return; 
    }
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }

  // Only throw if it's NOT a read quota error
  throw new Error(JSON.stringify(errInfo));
}
