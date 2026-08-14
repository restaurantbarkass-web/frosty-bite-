import { CacheNamespace, CacheKeys } from './CacheKeys';

export enum CacheStrategy {
  CACHE_FIRST = 'CACHE_FIRST',
  STALE_WHILE_REVALIDATE = 'STALE_WHILE_REVALIDATE',
  NETWORK_FIRST = 'NETWORK_FIRST',
  LOCAL_FIRST = 'LOCAL_FIRST',
  SERVER_AUTHORITATIVE = 'SERVER_AUTHORITATIVE',
  CACHE_ONLY = 'CACHE_ONLY',
  NETWORK_ONLY = 'NETWORK_ONLY',
}

export type CachePriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface CachePolicy {
  resource: string;
  strategy: CacheStrategy;
  ttlMs: number;
  staleGraceMs?: number;
  priority: CachePriority;
  realtimeSupported: boolean;
  offlineSupported: boolean;
  userIsolated: boolean;
  mutationSynced?: boolean;
}

export const POLICIES: Record<string, CachePolicy> = {
  // Store items: 1 hour freshness with background revalidation & realtime updates
  [CacheKeys.PRODUCTS]: {
    resource: CacheKeys.PRODUCTS,
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttlMs: 60 * 60 * 1000, // 1 hour
    staleGraceMs: 24 * 60 * 60 * 1000,
    priority: 'HIGH',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.CATEGORIES]: {
    resource: CacheKeys.CATEGORIES,
    strategy: CacheStrategy.CACHE_FIRST,
    ttlMs: 2 * 60 * 60 * 1000, // 2 hours
    priority: 'NORMAL',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.BANNERS]: {
    resource: CacheKeys.BANNERS,
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttlMs: 30 * 60 * 1000, // 30 mins
    priority: 'HIGH',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.OFFERS]: {
    resource: CacheKeys.OFFERS,
    strategy: CacheStrategy.CACHE_FIRST,
    ttlMs: 30 * 60 * 1000,
    priority: 'NORMAL',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.COUPONS]: {
    resource: CacheKeys.COUPONS,
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttlMs: 15 * 60 * 1000, // 15 mins
    priority: 'NORMAL',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.REVIEWS]: {
    resource: CacheKeys.REVIEWS,
    strategy: CacheStrategy.CACHE_FIRST,
    ttlMs: 60 * 60 * 1000,
    priority: 'NORMAL',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.REWARDS_BADGES]: {
    resource: CacheKeys.REWARDS_BADGES,
    strategy: CacheStrategy.CACHE_FIRST,
    ttlMs: 2 * 60 * 60 * 1000,
    priority: 'NORMAL',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.REWARDS_GIFTS]: {
    resource: CacheKeys.REWARDS_GIFTS,
    strategy: CacheStrategy.CACHE_FIRST,
    ttlMs: 60 * 60 * 1000,
    priority: 'NORMAL',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: false,
  },

  // App settings & zones: 15 mins
  [CacheKeys.APP_CONFIG]: {
    resource: CacheKeys.APP_CONFIG,
    strategy: CacheStrategy.CACHE_FIRST,
    ttlMs: 15 * 60 * 1000,
    priority: 'CRITICAL',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.STORE_STATUS]: {
    resource: CacheKeys.STORE_STATUS,
    strategy: CacheStrategy.CACHE_FIRST,
    ttlMs: 5 * 60 * 1000,
    priority: 'CRITICAL',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: false,
  },
  [CacheKeys.SERVICE_ZONES]: {
    resource: CacheKeys.SERVICE_ZONES,
    strategy: CacheStrategy.CACHE_FIRST,
    ttlMs: 30 * 60 * 1000,
    priority: 'HIGH',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: false,
  },

  // User Profile & Activity: 10 mins
  [CacheKeys.USER_PROFILE]: {
    resource: CacheKeys.USER_PROFILE,
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttlMs: 10 * 60 * 1000,
    priority: 'CRITICAL',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: true,
  },
  [CacheKeys.NOTIFICATIONS]: {
    resource: CacheKeys.NOTIFICATIONS,
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttlMs: 10 * 60 * 1000,
    priority: 'NORMAL',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: true,
  },
  [CacheKeys.WISHLIST]: {
    resource: CacheKeys.WISHLIST,
    strategy: CacheStrategy.LOCAL_FIRST,
    ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    priority: 'NORMAL',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: true,
    mutationSynced: true,
  },

  // User Orders: 5 mins SWR
  [CacheKeys.RECENT_ORDERS]: {
    resource: CacheKeys.RECENT_ORDERS,
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttlMs: 5 * 60 * 1000,
    priority: 'HIGH',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: true,
  },
  [CacheKeys.ORDER_HISTORY]: {
    resource: CacheKeys.ORDER_HISTORY,
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttlMs: 10 * 60 * 1000,
    priority: 'NORMAL',
    realtimeSupported: true,
    offlineSupported: true,
    userIsolated: true,
  },

  // Cart & Local state: 30 days (Local-First + Sync)
  [CacheKeys.CART_ITEMS]: {
    resource: CacheKeys.CART_ITEMS,
    strategy: CacheStrategy.LOCAL_FIRST,
    ttlMs: 30 * 24 * 60 * 60 * 1000,
    priority: 'CRITICAL',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: true,
    mutationSynced: true,
  },
  [CacheKeys.APPLIED_COUPON]: {
    resource: CacheKeys.APPLIED_COUPON,
    strategy: CacheStrategy.LOCAL_FIRST,
    ttlMs: 24 * 60 * 60 * 1000,
    priority: 'HIGH',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: true,
  },
  [CacheKeys.RECENT_LOCATIONS]: {
    resource: CacheKeys.RECENT_LOCATIONS,
    strategy: CacheStrategy.LOCAL_FIRST,
    ttlMs: 30 * 24 * 60 * 60 * 1000,
    priority: 'NORMAL',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: true,
  },

  // Server-Authoritative (Checkout & Payment - No Stale Cache Allowed)
  [CacheKeys.CHECKOUT_TOTALS]: {
    resource: CacheKeys.CHECKOUT_TOTALS,
    strategy: CacheStrategy.SERVER_AUTHORITATIVE,
    ttlMs: 0,
    priority: 'CRITICAL',
    realtimeSupported: false,
    offlineSupported: false,
    userIsolated: true,
  },
  [CacheKeys.PAYMENT_INTENT]: {
    resource: CacheKeys.PAYMENT_INTENT,
    strategy: CacheStrategy.SERVER_AUTHORITATIVE,
    ttlMs: 0,
    priority: 'CRITICAL',
    realtimeSupported: false,
    offlineSupported: false,
    userIsolated: true,
  },
};

export const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes default

export function getPolicy(resource: string): CachePolicy {
  if (POLICIES[resource]) {
    return POLICIES[resource];
  }

  return {
    resource,
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttlMs: DEFAULT_TTL,
    priority: 'NORMAL',
    realtimeSupported: false,
    offlineSupported: true,
    userIsolated: resource.startsWith('user_') || resource.includes('order') || resource.includes('cart'),
  };
}

export function getTtlForResource(namespace: CacheNamespace | string, key: string): number {
  const policy = getPolicy(key);
  return policy.ttlMs || DEFAULT_TTL;
}

