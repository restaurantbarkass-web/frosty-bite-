import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance, auth } from '../firebase';
import { supabase } from '../supabase';
import firebaseConfig from '../../firebase-applet-config.json';
import { safeTrimLowerCase } from './string';
import { safeFetchJson } from './safeFetch';

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
    console.info('[Push Notifications] Device notifications or permissions are not supported on this browser.');
    return null;
  }

  try {
    const currentPermission = window.Notification.permission;
    console.log(`[Push Notifications] Current browser permission state: "${currentPermission}"`);

    const permission = await window.Notification.requestPermission();
    console.log(`[Push Notifications] Permission request result: "${permission}"`);

    if (permission !== 'granted') {
      console.info('[Push Notifications] Notification permission was denied or dismissed by user.');
      return null;
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn('[Push Notifications] FCM Messaging instance is not initialized or supported in current environment.');
      return null;
    }

    // FCM Web SDK requires a public VAPID key
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;
    console.log(`[Push Notifications] Requesting FCM token (VAPID Key status: ${vapidKey ? 'CONFIGURED' : 'NOT SET'})...`);

    const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);

    if (token) {
      console.log(`[Push Notifications] Successfully retrieved FCM Token [length=${token.length}]:`, token);

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
        console.warn('[Push Notifications] Error fetching Supabase session metadata:', sbErr);
      }

      const fallbackEmail = localStorage.getItem('frostybite_active_session_email');
      const email = activeEmail || fallbackEmail;
      const guestSessionId = getGuestSessionId();
      const clientMeta = getClientMetadata();

      const registrationBody = {
        token,
        userId: resolvedUserId || (email ? safeTrimLowerCase(email) : null),
        guestSessionId,
        platform: clientMeta.platform,
        browser: clientMeta.browser,
        deviceName: navigator.userAgent.substring(0, 80)
      };

      console.log('[Push Notifications] Registering token with backend payload:', registrationBody);

      // 1. Authoritative Backend Registration
      try {
        const regResult = await safeFetchJson('/api/notifications/register-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registrationBody)
        });

        if (regResult.ok) {
          console.log('[Push Notifications] Token registration succeeded on backend:', regResult.data);
        } else {
          console.warn('[Push Notifications] Backend token registration returned non-OK status:', regResult.error || regResult.status);
        }
      } catch (beErr) {
        console.warn('[Push Notifications] Backend token registration failed (non-fatal error):', beErr);
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
          console.log('[Push Notifications] Synced FCM token with Firestore users document for UID:', firebaseUid);
        } catch (fsErr) {
          console.warn('[Push Notifications] Failed to synchronize token with Firestore:', fsErr);
        }
      }
    } else {
      console.warn('[Push Notifications] getToken returned empty or null token.');
    }

    return token;
  } catch (err: any) {
    console.warn('[Push Notifications] Error requesting FCM token:', err?.message || err, err);
    return null;
  }
};

/**
 * Foreground message subscriber
 */
export const subscribeToMessages = (callback: (payload: any) => void): (() => void) => {
  let unsubscribe = () => {};

  console.log('[Push Notifications] Subscribing to foreground FCM messages...');

  getMessagingInstance().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        console.group('[Push Notifications] 📩 Foreground FCM Message Received!');
        console.log('[Push Notifications] Raw FCM Payload:', payload);
        console.log('[Push Notifications] Notification Object:', payload?.notification || 'NO NOTIFICATION FIELD');
        console.log('[Push Notifications] Data Object:', payload?.data || 'NO DATA FIELD');
        console.log('[Push Notifications] Message ID:', payload?.messageId || payload?.from || 'N/A');

        if (payload?.notification) {
          console.log(`[Push Notifications] Title: "${payload.notification.title}", Body: "${payload.notification.body}"`);
        }

        if (payload?.data) {
          console.log('[Push Notifications] Payload Data Key-Values:', JSON.stringify(payload.data, null, 2));
        }

        console.groupEnd();
        callback(payload);
      });
      console.log('[Push Notifications] Successfully registered foreground FCM message listener.');
    } else {
      console.warn('[Push Notifications] FCM messaging instance null, cannot subscribe to foreground messages.');
    }
  }).catch((err) => {
    console.warn('[Push Notifications] Foreground listener subscription failed:', err);
  });

  return () => {
    console.log('[Push Notifications] Unsubscribing from foreground FCM messages.');
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
    const res = await safeFetchJson('/api/notifications/send-order-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (res.ok && res.data) {
      console.log('[Push Notifications] Order status notification dispatched:', res.data);
    } else {
      console.warn('[Push Notifications] Order status notification response:', res.error || res.status);
    }
  } catch (err) {
    console.warn('[Push Notifications] Failed to trigger order status notification:', err);
  }
};

export interface QueueOrderNotificationParams {
  orderId: string;
  status: string;
  userId?: string | null;
  guestSessionId?: string | null;
  customReason?: string;
  refundAmount?: number;
  deliveryEta?: string;
  delayMs?: number;
  batchKey?: string;
}

/**
 * Queue non-critical order notifications for batching & scheduled dispatch via backend notification service.
 */
export const queueOrderNotification = async (params: QueueOrderNotificationParams): Promise<{
  success: boolean;
  queued?: boolean;
  batchId?: string;
  scheduledFor?: string;
  reason?: string;
}> => {
  try {
    const res = await safeFetchJson<{
      success: boolean;
      queued?: boolean;
      batchId?: string;
      scheduledFor?: string;
      reason?: string;
    }>('/api/notifications/queue-order-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (res.ok && res.data) {
      console.log('[Push Notifications] Order update queued for batch dispatch:', res.data);
      return res.data;
    } else {
      console.warn('[Push Notifications] Queue endpoint response non-OK, falling back to direct notification:', res.error);
      await triggerOrderStatusNotification(params);
      return { success: true, queued: false, reason: 'Fallback to direct trigger' };
    }
  } catch (err: any) {
    console.warn('[Push Notifications] Failed to queue order notification:', err);
    return { success: false, reason: err?.message || 'Failed to queue notification' };
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
