import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance, auth } from '../firebase';
import { supabase } from '../supabase';
import firebaseConfig from '../../firebase-applet-config.json';
import { safeTrimLowerCase } from './string';

/**
 * Get or create a persistent guest session ID
 */
export const getGuestSessionId = (): string => {
  if (typeof window === 'undefined') return 'guest_server';
  let guestId = localStorage.getItem('frostybite_guest_session_id');
  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('frostybite_guest_session_id', guestId);
  }
  return guestId;
};

/**
 * Detect client platform and browser
 */
export const getClientMetadata = () => {
  if (typeof window === 'undefined') return { platform: 'web', browser: 'unknown' };

  const ua = navigator.userAgent;
  let browser = 'Chrome';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  let platform = 'web';
  if (/Android/i.test(ua)) platform = isPWA ? 'android_pwa' : 'android_web';
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = isPWA ? 'ios_pwa' : 'ios_web';

  return { platform, browser };
};

/**
 * Request device push notification permission and register token with backend
 */
export const requestForToken = async (customUserId?: string): Promise<string | null> => {
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

    // FCM Web SDK requires a public VAPID key
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
    const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);

    if (token) {
      console.log('[Push Notifications] Successfully retrieved FCM Token:', token);

      // Determine active user ID / email
      const firebaseUser = auth.currentUser;
      let activeEmail = firebaseUser?.email || null;
      let resolvedUserId = customUserId || firebaseUser?.uid || null;

      try {
        const { data: sbSession } = await supabase.auth.getSession();
        if (sbSession?.session?.user?.email) {
          activeEmail = sbSession.session.user.email;
          if (!resolvedUserId) resolvedUserId = sbSession.session.user.id;
        }
      } catch (sbErr) {
        console.warn('[Push Notifications] Error getting Supabase session:', sbErr);
      }

      const fallbackEmail = localStorage.getItem('frostybite_active_session_email');
      const email = activeEmail || fallbackEmail;
      const guestSessionId = getGuestSessionId();
      const clientMeta = getClientMetadata();

      // 1. Authoritative Backend Registration
      try {
        await fetch('/api/notifications/register-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            userId: resolvedUserId || (email ? safeTrimLowerCase(email) : null),
            guestSessionId,
            platform: clientMeta.platform,
            browser: clientMeta.browser,
            deviceName: navigator.userAgent.substring(0, 80)
          })
        });
        console.log('[Push Notifications] Token successfully registered with backend notification service');
      } catch (beErr) {
        console.warn('[Push Notifications] Backend token registration failed (non-fatal):', beErr);
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
        } catch (fsErr) {
          console.warn('[Push Notifications] Failed to synchronize token with Firestore:', fsErr);
        }
      }
    }

    return token;
  } catch (err: any) {
    console.warn('[Push Notifications] Error requesting token:', err);
    return null;
  }
};

/**
 * Foreground message subscriber
 */
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

/**
 * Trigger backend order status notification
 */
export const triggerOrderStatusNotification = async (params: {
  orderId: string;
  status: string;
  customReason?: string;
  refundAmount?: number;
  deliveryEta?: string;
}): Promise<void> => {
  try {
    const res = await fetch('/api/notifications/send-order-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    console.log('[Push Notifications] Order status notification dispatched:', data);
  } catch (err) {
    console.warn('[Push Notifications] Failed to trigger order status notification:', err);
  }
};

/**
 * Safely displays a system/device notification across all platforms (Desktop, Android, iOS PWA)
 */
export const showDeviceNotification = async (title: string, options?: NotificationOptions): Promise<void> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (window.Notification.permission !== 'granted') {
    return;
  }

  // 1. Try Service Worker showNotification first (Required on Mobile Chrome / Android / iOS PWA)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return;
      }
    } catch (swErr) {
      console.warn('[Push Notifications] ServiceWorker showNotification failed, trying fallback:', swErr);
    }
  }

  // 2. Fallback to window.Notification constructor for Desktop browsers that support it
  try {
    new window.Notification(title, options);
  } catch (notifErr) {
    console.warn('[Push Notifications] Direct Notification constructor failed:', notifErr);
  }
};
