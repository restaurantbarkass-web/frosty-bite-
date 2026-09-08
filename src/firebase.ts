import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';
import { supabase } from './supabase';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Safe initialization of messaging since FCM might not be supported in all testing environments or iframes
let messagingInstance: any = null;
isSupported().then((supported) => {
  if (supported) {
    try {
      messagingInstance = getMessaging(app);
    } catch (err) {
      console.warn('[Firebase] Failed to initialize Messaging:', err);
    }
  } else {
    console.warn('[Firebase] Messaging is not supported in this browser environment.');
  }
}).catch((err) => {
  console.warn('[Firebase] Error checking Messaging support:', err);
});

export const getMessagingInstance = async () => {
  const supported = await isSupported();
  if (supported && !messagingInstance) {
    try {
      messagingInstance = getMessaging(app);
    } catch (err) {
      console.warn('[Firebase] Failed to initialize Messaging dynamically:', err);
    }
  }
  return messagingInstance;
};

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
