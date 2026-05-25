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
  const errorMsg = event.message || '';
  const errorStr = event.error ? String(event.error.message || event.error) : '';
  if (
    errorMsg.toLowerCase().includes('websocket') ||
    errorMsg.toLowerCase().includes('web socket') ||
    errorMsg.toLowerCase().includes('vite') ||
    errorMsg.toLowerCase().includes('closed without opened') ||
    errorStr.toLowerCase().includes('websocket') ||
    errorStr.toLowerCase().includes('web socket') ||
    errorStr.toLowerCase().includes('vite') ||
    errorStr.toLowerCase().includes('closed without opened')
  ) {
    try {
      event.preventDefault();
      event.stopImmediatePropagation();
    } catch (_) {}
    return;
  }
  console.error('Global Error:', event.error?.stack || event.error?.message || event.error || event);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const reasonStr = reason ? String(reason.message || reason) : '';
  if (
    reasonStr.toLowerCase().includes('websocket') ||
    reasonStr.toLowerCase().includes('web socket') ||
    reasonStr.toLowerCase().includes('vite') ||
    reasonStr.toLowerCase().includes('closed without opened')
  ) {
    try {
      event.preventDefault();
      event.stopImmediatePropagation();
    } catch (_) {}
    return;
  }
  console.error('Unhandled Promise:', reason?.stack || reason?.message || reason || event);
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

/* ---------------- SERVICE WORKER CLEANUP ---------------- */

// Aggressively unregister all service workers to fix cache/websocket issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) console.log('Successfully unregistered service worker');
      }).catch((err) => {
        console.warn('Could not unregister service worker:', err);
      });
    }
  }).catch((err) => {
    console.warn('Could not get service worker registrations:', err);
  });
}

/* ---------------- CLEAR ALL CACHES ---------------- */

if ('caches' in window) {
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      caches.delete(key).then(() => {
        console.log('Cleared cache:', key);
      }).catch((err) => {
        console.warn('Could not delete cache key:', key, err);
      });
    });
  }).catch((err) => {
    console.warn('Could not get cache keys:', err);
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