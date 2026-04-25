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
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
