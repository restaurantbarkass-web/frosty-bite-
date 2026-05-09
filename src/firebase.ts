import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

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
