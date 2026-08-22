export interface GuestProfile {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  avatar: string;
  badge_tier: string;
  isRegisteredAtCheckout?: boolean;
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
    const guestState: GuestState = {
      isGuest: true,
      guestSessionId: `guest_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`,
      guestProfile: {
        name: 'Guest User',
        email: 'guest@frostybite.app',
        phone: '',
        address: '',
        avatar: 'G',
        badge_tier: 'Guest Explorer',
        isRegisteredAtCheckout: false
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
        return JSON.parse(data);
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
        isRegisteredAtCheckout: true
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
