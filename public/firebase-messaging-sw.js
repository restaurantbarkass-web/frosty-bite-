importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

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
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const data = payload.data || {};
  const notificationTitle = data.title || payload.notification?.title || 'New Order 🍰';
  const notificationOptions = {
    body: data.body || payload.notification?.body || 'A new order has been received.',
    icon: '/logo.png',
    data: {
      order_id: data.order_id
    },
    actions: [
      {
        action: 'accept',
        title: '✅ Accept',
      },
      {
        action: 'reject',
        title: '❌ Reject',
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  const orderId = event.notification.data.order_id;
  const action = event.action;

  event.notification.close();

  if (action === 'accept' || action === 'reject') {
    const status = action === 'accept' ? 'confirmed' : 'cancelled';
    
    // Supabase credentials (must match your config)
    const supabaseUrl = 'https://wilsmmashfpgrxkknmle.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM';

    event.waitUntil(
      fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ status: status })
      }).then(response => {
        if (!response.ok) throw new Error('Failed to update order');
        console.log(`Order ${orderId} updated to ${status}`);
      }).catch(err => {
        console.error('Error updating order from background:', err);
      })
    );
  } else {
    // Default click - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/admin');
        }
      })
    );
  }
});
