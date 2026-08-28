import React from 'react';

/**
 * Wraps dynamic component imports with retry capability to handle
 * transient network issues, dev server restarts, or bundle cache updates.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T } | { [key: string]: any }>,
  namedExport?: string,
  retriesLeft = 2,
  interval = 500
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = () => {
        componentImport()
          .then((module: any) => {
            if (namedExport && module[namedExport]) {
              resolve({ default: module[namedExport] });
            } else if (module && module.default) {
              resolve({ default: module.default });
            } else if (module && typeof module === 'function') {
              resolve({ default: module });
            } else {
              // Try finding the first function component export
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
            const isChunkError =
              error?.message?.includes('Failed to fetch dynamically imported module') ||
              error?.message?.includes('Importing a module script failed') ||
              error?.name === 'ChunkLoadError';

            if (retriesLeft > 0) {
              setTimeout(() => {
                lazyWithRetry(componentImport, namedExport, retriesLeft - 1, interval * 1.5);
                attemptImport();
              }, interval);
            } else if (isChunkError && typeof window !== 'undefined') {
              // Check if we already reloaded recently
              const hasReloaded = window.sessionStorage.getItem('chunk_reload_retry');
              if (!hasReloaded) {
                window.sessionStorage.setItem('chunk_reload_retry', 'true');
                window.location.reload();
              } else {
                window.sessionStorage.removeItem('chunk_reload_retry');
                reject(error);
              }
            } else {
              reject(error);
            }
          });
      };

      attemptImport();
    })
  );
}

export default lazyWithRetry;
