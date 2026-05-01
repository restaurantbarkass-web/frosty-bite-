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

import { initializeFirestore } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with settings to improve connectivity in AIS environment
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
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

export const logout = () => signOut(auth);
