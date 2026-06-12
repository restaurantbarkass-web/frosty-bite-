import { messaging, auth } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '../supabase';

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
      
      // Save token to user document in Supabase
      if (auth.currentUser) {
        try {
          const { data: user } = await supabase
            .from('users')
            .select('fcm_tokens')
            .eq('firebase_uid', auth.currentUser.uid)
            .single();

          const tokens = user?.fcm_tokens || [];
          if (!tokens.includes(currentToken)) {
            await supabase
              .from('users')
              .update({
                fcm_tokens: [...tokens, currentToken],
                updated_at: new Date().toISOString()
              })
              .eq('firebase_uid', auth.currentUser.uid);
          }
        } catch (err) {
          console.error('Failed to sync FCM token to Supabase:', err);
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
