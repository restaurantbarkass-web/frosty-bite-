export enum CacheNamespace {
  STORE = 'store',
  USER = 'user',
  CART = 'cart',
  ORDERS = 'orders',
  CONFIG = 'config',
  GEOFENCE = 'geofence',
  REWARDS = 'rewards',
  SYNC_QUEUE = 'sync_queue',
  METADATA = 'metadata',
}

export const CacheKeys = {
  // Store (Public)
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  FEATURED_PRODUCTS: 'featured_products',
  POPULAR_PRODUCTS: 'popular_products',
  OFFERS: 'offers',
  COUPONS: 'coupons',
  BANNERS: 'banners',
  REVIEWS: 'reviews',
  REWARDS_BADGES: 'rewards_badges',
  REWARDS_GIFTS: 'rewards_gifts',

  // User (Private / Isolated)
  USER_PROFILE: 'user_profile',
  ACTIVE_SESSION: 'active_session',
  WISHLIST: 'wishlist',
  LOYALTY_POINTS: 'loyalty_points',
  SAVED_ADDRESSES: 'saved_addresses',
  NOTIFICATIONS: 'notifications',

  // Cart & Orders (Private / Isolated)
  CART_ITEMS: 'cart_items',
  APPLIED_COUPON: 'applied_coupon',
  RECENT_ORDERS: 'recent_orders',
  ORDER_HISTORY: 'order_history',

  // Config & Geofence
  APP_CONFIG: 'app_config',
  STORE_STATUS: 'store_status',
  SERVICE_ZONES: 'service_zones',
  VALIDATED_LOCATION: 'validated_location',
  RECENT_LOCATIONS: 'recent_locations',

  // Ephemeral & Authoritative
  CHECKOUT_TOTALS: 'checkout_totals',
  PAYMENT_INTENT: 'payment_intent',

  // Sync & Telemetry
  LAST_SYNC_PRODUCTS: 'last_sync_products',
  LAST_SYNC_BANNERS: 'last_sync_banners',
  LAST_SYNC_CONFIG: 'last_sync_config',
  BOOT_METRICS: 'boot_metrics',
} as const;

export type CacheKeyType = typeof CacheKeys[keyof typeof CacheKeys] | string;

/**
 * Generates user-isolated cache namespace
 */
export function getUserNamespace(userId?: string | null): string {
  if (!userId || userId === 'guest') return `${CacheNamespace.USER}:guest`;
  return `${CacheNamespace.USER}:${userId}`;
}

/**
 * Checks if a namespace is user-isolated
 */
export function isUserIsolatedNamespace(namespace: string): boolean {
  return (
    namespace.startsWith(`${CacheNamespace.USER}:`) ||
    namespace === CacheNamespace.USER ||
    namespace === CacheNamespace.CART ||
    namespace === CacheNamespace.ORDERS
  );
}

/**
 * Generates a standard composite storage key
 */
export function buildStorageKey(namespace: string, key: string, userId?: string | null): string {
  if (userId && isUserIsolatedNamespace(namespace)) {
    return `user:${userId}:${key}`;
  }
  return `${namespace}:${key}`;
}

