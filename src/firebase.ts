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
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import { supabase } from './supabase';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Force long-polling and local persistent cache to prevent WebSocket connection degradation and timeout blocks in sandbox proxies.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true
}, (firebaseConfig as any).firestoreDatabaseId);

// Core connection test required by firebase-integration skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const isOffline = error instanceof Error && (
      error.message.includes('offline') ||
      error.message.includes('unavailable') ||
      error.message.includes('could not be completed') ||
      error.message.includes('Could not reach Cloud Firestore')
    );
    if (isOffline) {
      console.log('[Firebase Init] Connection check: Client is offline or sandbox proxy blocks direct network. Standard resilient offline cache is active.');
    } else {
      console.warn('[Firebase Init] Connection test trace: ', error instanceof Error ? error.message : error);
    }
  }
}
testConnection();

export const messaging = typeof window !== 'undefined' ? (() => {
  try {
    return getMessaging(app);
  } catch (e) {
    console.warn('Firebase Messaging not supported in this environment');
    return null;
  }
})() : null;

export const googleProvider = new GoogleAuthProvider();

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('[UnifiedAuth] Firebase signOut warning:', err);
  }
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[UnifiedAuth] Supabase signOut warning:', err);
  }
};
