import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance, auth } from '../firebase';
import { supabase } from '../supabase';
import firebaseConfig from '../../firebase-applet-config.json';

export const requestForToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !('Notification' in window) || typeof window.Notification?.requestPermission !== 'function') {
    console.info('[Push Notifications] Device notifications or permissions are not supported.');
    return null;
  }

  try {
    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[Push Notifications] Notification permission was not authorized.');
      return null;
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn('[Push Notifications] FCM Messaging is not initialized or supported.');
      return null;
    }

    // FCM Web SDK requires a public VAPID key to identify push servers
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
    const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);

    if (token) {
      console.log('[Push Notifications] Successfully retrieved FCM Token:', token);

      // Determine active user email to save the push token
      const firebaseUser = auth.currentUser;
      let activeEmail = firebaseUser?.email || null;

      try {
        const { data: sbSession } = await supabase.auth.getSession();
        if (sbSession?.session?.user?.email) {
          activeEmail = sbSession.session.user.email;
        }
      } catch (sbErr) {
        console.warn('[Push Notifications] Error getting Supabase session:', sbErr);
      }

      const fallbackEmail = localStorage.getItem('frostybite_active_session_email');
      const email = activeEmail || fallbackEmail;

      if (email) {
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Sync token with Supabase users table (Postgres database)
        try {
          const { data: dbUser } = await supabase
            .from('users')
            .select('id, fcm_tokens')
            .eq('email', normalizedEmail)
            .maybeSingle();

          if (dbUser) {
            const existingTokens = Array.isArray(dbUser.fcm_tokens) ? dbUser.fcm_tokens : [];
            if (!existingTokens.includes(token)) {
              const updatedTokens = [...existingTokens, token];
              await supabase
                .from('users')
                .update({ fcm_tokens: updatedTokens })
                .eq('id', dbUser.id);
              console.log('[Push Notifications] Saved token to Supabase users profile.');
            }
          }
        } catch (sbDbErr) {
          console.warn('[Push Notifications] Failed to synchronize token with Supabase DB:', sbDbErr);
        }

        // 2. Sync token with Firebase Firestore users collection (if Firebase UID exists)
        const firebaseUid = firebaseUser?.uid;
        if (firebaseUid) {
          try {
            const { getFirestore, doc, setDoc, arrayUnion } = await import('firebase/firestore');
            const db = getFirestore(messaging.app, firebaseConfig.firestoreDatabaseId);

            await setDoc(doc(db, 'users', firebaseUid), {
              fcm_tokens: arrayUnion(token)
            }, { merge: true });
            console.log('[Push Notifications] Saved token to Firestore user document.');
          } catch (fsErr) {
            console.warn('[Push Notifications] Failed to synchronize token with Firestore:', fsErr);
          }
        }
      }
    }

    return token;
  } catch (err: any) {
    console.warn('[Push Notifications] Error requesting token:', err);
    return null;
  }
};

export const subscribeToMessages = (callback: (payload: any) => void): (() => void) => {
  let unsubscribe = () => {};

  getMessagingInstance().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[Push Notifications] Foreground FCM Message received:', payload);
        callback(payload);
      });
    }
  }).catch((err) => {
    console.warn('[Push Notifications] Foreground listener subscription failed:', err);
  });

  return () => {
    unsubscribe();
  };
};
