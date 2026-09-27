/**
 * Performance Optimization Module
 * Speeds up page routing and image assets to provide near-instant load times,
 * similar to Instagram's proactive asset-caching strategy.
 */

// Track already loaded images to prevent overhead
const preloadedImages = new Set<string>();

/**
 * Preloads a page chunk dynamically in the background.
 * By calling this on hover or touch, the browser resolves the JS bundle ahead of the click.
 */
export const preloadRoute = (path: string) => {
  const cleanPath = path.split('#')[0].split('?')[0];
  if (cleanPath.startsWith('/product/')) {
    import('../pages/ProductDetail').catch(() => {});
    return;
  }
  if (cleanPath.startsWith('/campaign/') || cleanPath.startsWith('/promotions/')) {
    import('../pages/CampaignPage').catch(() => {});
    return;
  }
  if (cleanPath.startsWith('/feedback')) {
    import('../pages/FeedbackPage').catch(() => {});
    return;
  }
  if (cleanPath.startsWith('/upi-checkout/')) {
    import('../pages/UPICheckout').catch(() => {});
    return;
  }
  if (cleanPath.startsWith('/order-tracking') || cleanPath.startsWith('/track')) {
    import('../pages/OrderTracking').catch(() => {});
    return;
  }

  switch (cleanPath) {
    case '/':
      import('../pages/HomePage').catch(() => {});
      break;
    case '/categories':
      import('../pages/CategoriesPage').catch(() => {});
      break;
    case '/offers':
      import('../pages/Offers').catch(() => {});
      break;
    case '/faq':
      import('../pages/FAQ').catch(() => {});
      break;
    case '/checkout':
      import('../pages/Checkout').catch(() => {});
      break;
    case '/orders':
      import('../pages/Orders').catch(() => {});
      break;
    case '/notifications':
      import('../pages/Notifications').catch(() => {});
      break;
    case '/profile':
      import('../pages/Profile').catch(() => {});
      break;
    case '/admin':
      import('../pages/AdminLayout').catch(() => {});
      break;
    case '/login':
    case '/signup':
      import('../pages/Login').catch(() => {});
      break;
    case '/forgot-password':
      import('../pages/ForgotPassword').catch(() => {});
      break;
    case '/finish-sign-in':
      import('../pages/FinishSignIn').catch(() => {});
      break;
    default:
      break;
  }
};

/**
 * Optimistically pre-loads an image URL in the background.
 */
export const preloadImage = (src: string) => {
  if (!src || preloadedImages.has(src)) return;
  preloadedImages.add(src);
  
  const img = new Image();
  // Set decoding to async to prevent main-thread layout thrashing
  img.decoding = 'async';
  img.src = src;
};

/**
 * Prefetches crucial core images on app startup.
 */
export const prefetchCoreAssets = (urls: string[]) => {
  if (typeof window === 'undefined') return;
  // Use idle callback if supported, else fallback to timeout to prevent thread blocking
  const scheduleJob = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));
  
  scheduleJob(() => {
    urls.forEach((url) => {
      if (url) preloadImage(url);
    });
  });
};
