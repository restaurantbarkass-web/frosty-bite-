import React from 'react';

/**
 * Wraps dynamic component imports with retry capability to handle
 * transient network issues, dev server restarts, or bundle cache updates.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | { [key: string]: any }>,
  namedExport?: string,
  maxRetries = 2,
  interval = 300
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = (retriesLeft: number) => {
        componentImport()
          .then((module: any) => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem('chunk_reload_timestamp');
            }

            if (namedExport && module[namedExport]) {
              resolve({ default: module[namedExport] });
            } else if (module && module.default) {
              resolve({ default: module.default });
            } else if (module && typeof module === 'function') {
              resolve({ default: module });
            } else {
              const keys = Object.keys(module || {});
              const compKey = keys.find((k) => typeof module[k] === 'function');
              if (compKey) {
                resolve({ default: module[compKey] });
              } else {
                resolve({ default: module as T });
              }
            }
          })
          .catch((error) => {
            const errStr = String(error?.message || error || '');
            const isChunkError =
              errStr.includes('Failed to fetch dynamically imported module') ||
              errStr.includes('Importing a module script failed') ||
              errStr.includes('dynamically imported') ||
              errStr.includes('Failed to fetch') ||
              error?.name === 'ChunkLoadError';

            if (isChunkError && typeof window !== 'undefined') {
              const lastReloadTime = Number(window.sessionStorage.getItem('chunk_reload_timestamp') || '0');
              const now = Date.now();
              if (now - lastReloadTime > 5000) {
                console.warn('[lazyWithRetry] Dynamically imported module failed to fetch. Auto-syncing bundle...', errStr);
                window.sessionStorage.setItem('chunk_reload_timestamp', String(now));
                window.location.reload();
                return;
              }
            }

            if (retriesLeft > 0) {
              setTimeout(() => {
                attemptImport(retriesLeft - 1);
              }, interval);
            } else {
              reject(error);
            }
          });
      };

      attemptImport(maxRetries);
    })
  );
}

export default lazyWithRetry;

