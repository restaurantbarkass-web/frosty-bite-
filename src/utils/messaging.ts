import { messaging, auth, db } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '../supabase';
import { doc, getDoc } from 'firebase/firestore';
import { safeFirestore } from '../services/firestoreService';

export const requestForToken = async () => {
  if (typeof window === 'undefined') return null;

  // 1. Check browser support for notification API
  if (!('Notification' in window)) {
    console.info('[FCM] Notifications are not supported in this browser environment.');
    return null;
  }

  // 2. Check if we are inside an iframe where browser security rules block notification registration
  const isInIframe = window.self !== window.top;
  if (isInIframe) {
    console.info('[FCM] Notification setup skipped: App is running inside a preview iframe.');
    return null;
  }

  // 3. Check if user has already denied notifications
  if (Notification.permission === 'denied') {
    console.info('[FCM] Push notifications are disabled (permission denied/blocked by settings).');
    return null;
  }

  if (!messaging) return null;
  
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: 'H-nMK36Y6wNVZIQpFGNKpYYt0cmqcEZ-tqbeIT9djHU'
    });
    
    if (currentToken) {
      console.log('Current token for client: ', currentToken);
      
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;

        // A. Save token to Firestore user document (Reliable primary)
        try {
          const userRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userRef);
          let currentFirestoreTokens: string[] = [];
          if (userSnap.exists()) {
            currentFirestoreTokens = userSnap.data()?.fcm_tokens || [];
          }
          if (!currentFirestoreTokens.includes(currentToken)) {
            const updatedTokens = [...currentFirestoreTokens, currentToken];
            await safeFirestore.set(userRef, {
              fcm_tokens: updatedTokens
            });
            console.log('[FCM] Successfully synced FCM token to Firestore users');
          }
        } catch (fsErr) {
          console.error('[FCM] Failed to sync FCM token to Firestore:', fsErr);
        }

        // B. Save token to user document in Supabase (Graceful fallback)
        try {
          const { data: user, error: selErr } = await supabase
            .from('users')
            .select('fcm_tokens')
            .eq('firebase_uid', uid)
            .maybeSingle();

          if (!selErr) {
            const tokens = user?.fcm_tokens || [];
            if (!tokens.includes(currentToken)) {
              await supabase
                .from('users')
                .update({
                  fcm_tokens: [...tokens, currentToken],
                  updated_at: new Date().toISOString()
                })
                .eq('firebase_uid', uid);
              console.log('[FCM] Successfully synced FCM token to Supabase users');
            }
          } else {
            console.warn('[FCM] Supabase select failed (expected if fcm_tokens column does not exist):', selErr.message);
          }
        } catch (err) {
          console.warn('[FCM] Failed to sync FCM token to Supabase (non-fatal):', err);
        }
      }
      
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('permission-blocked') || errMsg.includes('permission_blocked') || errMsg.includes('permission was not granted')) {
      console.info('[FCM] Notification permission was blocked or denied (expected in development preview iframes).');
    } else {
      console.warn('[FCM] An error occurred while retrieving token:', errMsg);
    }
    return null;
  }
};

export const subscribeToMessages = (callback: (payload: any) => void): (() => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    console.log("Payload received: ", payload);
    callback(payload);
  });
};
