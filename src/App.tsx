import React, { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

import { ErrorBoundary } from './components/ErrorBoundary';

/* ---------------- LOADER ---------------- */

function Loader() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      Loading Frosty Bite...
    </div>
  );
}

/* ---------------- GLOBAL ERROR HANDLING ---------------- */

window.addEventListener('error', (event) => {
  console.error('Global Error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise:', event.reason);
});

/* ---------------- PREVENT REFRESH LOOPS ---------------- */

const lastReload = sessionStorage.getItem('lastReload');

function safeReload() {
  const now = Date.now();

  if (!lastReload || now - Number(lastReload) > 10000) {
    sessionStorage.setItem('lastReload', now.toString());

    window.location.reload();
  } else {
    console.warn('Refresh loop prevented');
  }
}

/* ---------------- CLEAR OLD CACHES ---------------- */

if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (!key.includes('frosty-v4')) {
        caches.delete(key);
      }
    });
  });
}

/* ---------------- SERVICE WORKER ---------------- */

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      console.log('SW registered');

      /* CHECK FOR UPDATES */

      reg.update().catch(err => console.warn('SW Update failed:', err));

      setInterval(() => {
        reg.update().catch(err => console.warn('SW Update failed:', err));
      }, 60000);

      /* HANDLE NEW VERSION */

      reg.onupdatefound = () => {
        const newWorker = reg.installing;

        if (!newWorker) return;

        newWorker.onstatechange = () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            console.log('New version available');

            setTimeout(() => {
              safeReload();
            }, 1500);
          }
        };
      };

      /* ANDROID CUSTOM TAB FIX */

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update();
        }
      });

    } catch (err) {
      console.error('SW failed:', err);
    }
  });
}

/* ---------------- ROOT ---------------- */

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <Suspense fallback={<Loader />}>
          <App />
        </Suspense>
      </ErrorBoundary>
    </StrictMode>,
  );
}