export interface GuestProfile {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  avatar: string;
  badge_tier: string;
  isRegisteredAtCheckout?: boolean;
  avatar_config?: any;
  userId?: string;
  account_type?: string;
  phone_verified?: boolean;
  verification_status?: string;
}

export interface GuestState {
  isGuest: boolean;
  guestSessionId: string;
  guestProfile: GuestProfile;
  recentlyViewed: string[];
  favorites: string[];
  preferences: Record<string, any>;
  cart: any[];
  createdAt: string;
}

const GUEST_STORAGE_KEY = 'frostybite_guest_session_v1';

export class GuestSessionManager {
  static create(): GuestState {
    const existing = GuestSessionManager.get();
    if (existing && existing.isGuest) {
      return existing;
    }
    const uniqueUserId = `guest_uid_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    const guestState: GuestState = {
      isGuest: true,
      guestSessionId: uniqueUserId,
      guestProfile: {
        name: 'Guest User',
        email: 'guest@frostybite.local',
        phone: '',
        address: '',
        avatar: 'G',
        badge_tier: 'Guest Explorer',
        isRegisteredAtCheckout: false,
        userId: uniqueUserId,
        account_type: 'guest',
        phone_verified: false,
        verification_status: 'unverified'
      },
      recentlyViewed: [],
      favorites: [],
      preferences: { theme: 'light', notifications: true },
      cart: [],
      createdAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestState));
      localStorage.setItem('frostybite_has_active_session', 'true');
    } catch (e) {}
    return guestState;
  }

  static get(): GuestState | null {
    try {
      const data = localStorage.getItem(GUEST_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && !parsed.guestProfile?.userId) {
          parsed.guestProfile.userId = `guest_uid_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
          parsed.guestProfile.account_type = 'guest';
          parsed.guestProfile.phone_verified = false;
          parsed.guestProfile.verification_status = 'unverified';
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  static isActive(): boolean {
    const state = GuestSessionManager.get();
    return !!(state && state.isGuest);
  }

  static clear(): void {
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } catch (e) {}
  }

  static update(updates: Partial<GuestState>): GuestState {
    const current = GuestSessionManager.get() || GuestSessionManager.create();
    const updated = { ...current, ...updates };
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    return updated;
  }

  static registerFromCheckout(checkoutData: { name: string; phone: string; address: string; email?: string }): GuestState {
    const current = GuestSessionManager.get() || GuestSessionManager.create();
    const uniqueUserId = current.guestProfile.userId || `guest_uid_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    const updated: GuestState = {
      ...current,
      guestProfile: {
        ...current.guestProfile,
        name: checkoutData.name,
        phone: checkoutData.phone,
        address: checkoutData.address,
        email: checkoutData.email || current.guestProfile.email,
        avatar: checkoutData.name ? checkoutData.name.charAt(0).toUpperCase() : 'G',
        badge_tier: 'Valued Customer',
        isRegisteredAtCheckout: true,
        userId: uniqueUserId,
        account_type: 'guest',
        phone_verified: false,
        verification_status: 'unverified'
      }
    };
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    return updated;
  }

  static mergeWithUser(userId: string): void {
    const guestState = GuestSessionManager.get();
    if (!guestState) return;

    try {
      const existingUserCart = localStorage.getItem(`user_cart_${userId}`);
      if (!existingUserCart && guestState.cart && guestState.cart.length > 0) {
        localStorage.setItem(`user_cart_${userId}`, JSON.stringify(guestState.cart));
      }

      if (guestState.favorites && guestState.favorites.length > 0) {
        const userFavKey = `user_favorites_${userId}`;
        const existingFavs = JSON.parse(localStorage.getItem(userFavKey) || '[]');
        const combinedFavs = Array.from(new Set([...existingFavs, ...guestState.favorites]));
        localStorage.setItem(userFavKey, JSON.stringify(combinedFavs));
      }
    } catch (e) {
      console.warn('[GuestSessionManager] Failed to merge guest data:', e);
    }

    GuestSessionManager.clear();
  }

  static convertToUser(): void {
    const current = GuestSessionManager.get();
    if (current) {
      GuestSessionManager.clear();
    }
  }
}

export const GuestSession = {
  create: GuestSessionManager.create,
  get: GuestSessionManager.get,
  isActive: GuestSessionManager.isActive,
  clear: GuestSessionManager.clear,
  update: GuestSessionManager.update,
  convertToUser: GuestSessionManager.convertToUser,
  mergeWithUser: GuestSessionManager.mergeWithUser,
  registerFromCheckout: GuestSessionManager.registerFromCheckout
};
