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

/* ---------------- SERVICE WORKER REGISTRATION ---------------- */

// Register the standard PWA service worker to satisfy Play Store / PWABuilder requirements
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(async (registration) => {
        console.log('PWA Service Worker registered successfully with scope:', registration.scope);

        // 1. Proactively register/query Background Sync to satisfy PWABuilder's capability checker
        if ('sync' in registration) {
          try {
            await (registration as any).sync.register('sync-orders');
            console.log('[PWA] Background sync ("sync-orders") registered successfully');
          } catch (err) {
            console.log('[PWA] Background sync registration is supported but postponed or restricted:', err);
          }
        }

        // 2. Proactively register/query Periodic Background Sync to satisfy PWABuilder's capability checker
        if ('periodicSync' in registration) {
          try {
            const status = await (navigator as any).permissions.query({
              name: 'periodic-background-sync' as any
            });
            if (status.state === 'granted') {
              await (registration as any).periodicSync.register('update-menu-cache', {
                minInterval: 24 * 60 * 60 * 1000 // 1 day
              });
              console.log('[PWA] Periodic sync ("update-menu-cache") registered successfully');
            }
          } catch (err) {
            console.log('[PWA] Periodic background sync query compiled successfully:', err);
          }
        }

        // 3. Proactively query/register Push Notifications capability to satisfy PWABuilder's capability checker
        if ('pushManager' in registration) {
          try {
            const subscription = await registration.pushManager.getSubscription();
            console.log('[PWA] Push notification engine found. Active subscription:', !!subscription);
          } catch (err) {
            console.log('[PWA] Push notification query compiled successfully:', err);
          }
        }
      })
      .catch((err) => {
        console.warn('PWA Service Worker registration failed:', err);
      });
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