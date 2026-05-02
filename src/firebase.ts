import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

import { initializeFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with settings to improve stability
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
}, firebaseConfig.firestoreDatabaseId);

// Enable persistence synchronously to ensure it runs before any other Firestore operations
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

// Add listener to check connection
const testConnection = async () => {
  if (typeof window !== 'undefined') {
    const quotaStatus = localStorage.getItem('firestore_quota_status');
    if (quotaStatus) {
      try {
        const { exceeded, time } = JSON.parse(quotaStatus);
        if (exceeded && Date.now() - time < 1000 * 60 * 15) {
          console.warn('Skipping connection test: Database quota exceeded.');
          return;
        }
      } catch (e) {}
    }
  }

  try {
    // Only check if not already known to be in quota exceeded state
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
  } catch (error: any) {
    if (error.code === 'resource-exhausted' || error.message?.includes('Quota')) {
      console.warn('Connection test failed: Quota reached.');
    } else if (error.message?.includes('offline')) {
      console.warn('Firestore is operating in offline mode.');
    }
  }
};
// Delay connection test slightly to let persistence settle
setTimeout(testConnection, 1000);

export const messaging = typeof window !== 'undefined' ? (() => {
  try {
    return getMessaging(app);
  } catch (e) {
    console.warn('Firebase Messaging not supported in this environment');
    return null;
  }
})() : null;

export const googleProvider = new GoogleAuthProvider();

export const logout = () => signOut(auth);
