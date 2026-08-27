export interface UpdateHighlight {
  id: string;
  icon: 'zap' | 'sparkles' | 'shopping-bag' | 'bell' | 'shield' | 'flame' | 'cake';
  title: string;
  description: string;
}

export interface AppReleaseInfo {
  version: string;
  buildTime: string;
  environment: string;
  badge: string;
  heading: string;
  description: string;
  highlights: UpdateHighlight[];
}

/**
 * Storage key to persist the last acknowledged deployment version.
 */
export const VERSION_STORAGE_KEY = 'frosty_bite_seen_version';

/**
 * Global broadcast channel identifier for cross-tab synchronization.
 */
export const VERSION_BROADCAST_CHANNEL = 'frosty_bite_version_sync';

/**
 * Safely retrieve the current build version.
 */
export const getAppVersion = (): string => {
  try {
    if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) {
      return __APP_VERSION__;
    }
  } catch {
    // fallback if variable is undefined
  }
  return import.meta.env.VITE_APP_VERSION || 'v-2026.08.27';
};

/**
 * Safely retrieve the current build timestamp.
 */
export const getAppBuildTime = (): string => {
  try {
    if (typeof __APP_BUILD_TIME__ !== 'undefined' && __APP_BUILD_TIME__) {
      return __APP_BUILD_TIME__;
    }
  } catch {
    // fallback if variable is undefined
  }
  return new Date().toISOString();
};

/**
 * Safely retrieve the deployment environment name.
 */
export const getAppEnvironment = (): string => {
  try {
    if (typeof __APP_ENV__ !== 'undefined' && __APP_ENV__) {
      return __APP_ENV__;
    }
  } catch {
    // fallback
  }
  return import.meta.env.MODE || 'production';
};

/**
 * Default configurable release metadata and "What's New" highlights.
 * Update this list whenever a new major release or set of improvements is deployed!
 */
export const CURRENT_RELEASE_CONFIG: AppReleaseInfo = {
  version: getAppVersion(),
  buildTime: getAppBuildTime(),
  environment: getAppEnvironment(),
  badge: 'Fresh Bakery Update',
  heading: 'Freshly Baked. Now Even Better.',
  description: 'Frosty Bite just got a little sweeter. We’ve added improvements to make your experience faster, smoother, and more delightful.',
  highlights: [
    {
      id: 'perf',
      icon: 'zap',
      title: 'Zero-Lag Smooth Scroll',
      description: 'Buttery-smooth 60–144Hz responsive scrolling across mobile, desktop, and touchscreens.'
    },
    {
      id: 'notif',
      icon: 'bell',
      title: 'Universal Notifications',
      description: 'Seamless real-time push alerts and live order updates across Android, iPhone, and desktop.'
    },
    {
      id: 'speed',
      icon: 'sparkles',
      title: 'Smart Instant Cache',
      description: 'Pre-warmed pastry caches and instant page transitions for effortless browsing.'
    },
    {
      id: 'checkout',
      icon: 'shopping-bag',
      title: 'Frictionless Fast Checkout',
      description: 'Streamlined one-tap ordering with saved delivery details and direct UPI support.'
    }
  ]
};
