// Give the service worker access to Firebase Messaging safely.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Failed to load Firebase scripts via importScripts:', err);
}

const BRAND_ICON = 'https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg';

// Initialize Firebase App in SW
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp({
      apiKey: "AIzaSyBmfCBuc_UzCKfS1DN6OKnZPsri3MFkcdU",
      authDomain: "frostybite07.firebaseapp.com",
      projectId: "frostybite07",
      storageBucket: "frostybite07.firebasestorage.app",
      messagingSenderId: "192721758806",
      appId: "1:192721758806:web:0651fb1516434cbaaf69f7"
    });

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message:', payload);
      const notificationTitle = payload.notification?.title || payload.data?.title || 'Frosty Bite 🍰';
      const notificationBody = payload.notification?.body || payload.data?.body || 'Your sweet moment awaits.';
      const targetLink = payload.data?.link || payload.data?.url || (payload.data?.orderId ? `/order-tracking/${payload.data.orderId}` : '/');

      const notificationOptions = {
        body: notificationBody,
        icon: BRAND_ICON,
        badge: BRAND_ICON,
        data: {
          ...payload.data,
          link: targetLink,
          eventId: payload.data?.eventId,
          orderId: payload.data?.orderId
        },
        tag: payload.data?.tag || (payload.data?.orderId ? `order_${payload.data.orderId}` : 'frosty_bite_notification'),
        renotify: true,
        vibrate: [200, 100, 200],
        actions: [
          {
            action: 'track_order',
            title: payload.data?.orderId ? 'Track Order 🛵' : 'View Now ✨',
            icon: BRAND_ICON
          },
          {
            action: 'close',
            title: 'Dismiss'
          }
        ]
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (err) {
    console.warn('[firebase-messaging-sw.js] Failed to initialize Firebase Messaging:', err);
  }
}

// Global Notification Click Handler in SW
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received tag:', event.notification.tag);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const notificationData = event.notification.data || {};
  const targetPath = notificationData.link || notificationData.url || (notificationData.orderId ? `/order-tracking/${notificationData.orderId}` : '/');
  const targetUrl = new URL(targetPath, self.location.origin).href;

  // Track click event asynchronously
  if (notificationData.eventId) {
    try {
      fetch('/api/notifications/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: notificationData.eventId })
      }).catch(() => {});
    } catch (_) {}
  }

  // Focus open tab or navigate/open new tab
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          if (client.url === targetUrl || client.url.includes(targetPath)) {
            return client.focus();
          } else {
            return client.navigate(targetUrl).then(c => c ? c.focus() : null);
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
