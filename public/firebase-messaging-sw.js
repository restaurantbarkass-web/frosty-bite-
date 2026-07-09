// Give the service worker access to Firebase Messaging safely.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Failed to load Firebase scripts via importScripts:', err);
}

// Initialize the Firebase app in the service worker if successfully loaded.
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

    // Retrieve an instance of Firebase Messaging to handle background messages.
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      const notificationTitle = payload.notification?.title || 'Frosty Bite Update';
      const notificationOptions = {
        body: payload.notification?.body || 'Your order status has been updated.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: payload.data,
        tag: payload.data?.orderId || 'frosty_bite_order_update',
        renotify: true
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (err) {
    console.warn('[firebase-messaging-sw.js] Failed to initialize Firebase Messaging:', err);
  }
} else {
  console.info('[firebase-messaging-sw.js] Firebase library not available in global scope.');
}

