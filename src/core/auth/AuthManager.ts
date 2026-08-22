import { supabase } from '../../supabase';
import { auth as fbAuth } from '../../firebase';
import { signOut as fbSignOut } from 'firebase/auth';
import { CacheManager } from '../cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../cache/CacheKeys';
import { CacheOrchestrator } from '../orchestrator/CacheOrchestrator';

export interface PersistentSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

class MasterAuthManager {
  private static instance: MasterAuthManager;
  private sessionRestored = false;

  private constructor() {}

  public static getInstance(): MasterAuthManager {
    if (!MasterAuthManager.instance) {
      MasterAuthManager.instance = new MasterAuthManager();
    }
    return MasterAuthManager.instance;
  }

  /**
   * Fast startup check: restores session from Supabase Client / persistent cache
   */
  async restoreSession(): Promise<{ user: any | null; isRestored: boolean }> {
    try {
      // 1. First check Supabase client's internal session cache
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session?.user) {
        this.sessionRestored = true;
        CacheOrchestrator.setCurrentUser(data.session.user);
        return { user: data.session.user, isRestored: true };
      }

      // 2. Fallback check local cached user profile for instant UI bootstrapping
      const cachedProfile = await CacheManager.get(CacheKeys.USER_PROFILE, CacheNamespace.USER);
      if (cachedProfile) {
        CacheOrchestrator.setCurrentUser(cachedProfile);
        return { user: cachedProfile, isRestored: false };
      }
    } catch (err) {
      console.warn('[AuthManager] Session restoration check error:', err);
    }
    CacheOrchestrator.setCurrentUser(null);
    return { user: null, isRestored: false };
  }

  /**
   * Refresh session securely
   */
  async refreshSession(): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        console.warn('[AuthManager] Session refresh failed:', error?.message);
        return false;
      }
      CacheOrchestrator.setCurrentUser(data.session.user);
      return true;
    } catch (err) {
      console.warn('[AuthManager] Session refresh exception:', err);
      return false;
    }
  }

  /**
   * Secure logout: Clears all private user caches while keeping public store cache
   */
  async secureLogout(userId?: string): Promise<void> {
    console.log('[AuthManager] Executing secure logout & clearing private caches...');

    try {
      if (fbAuth) {
        await fbSignOut(fbAuth);
      }
    } catch (e) {
      console.warn('[AuthManager] Firebase signOut warning:', e);
    }

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthManager] Supabase signOut warning:', e);
    }

    // Purge via orchestrator
    await CacheOrchestrator.purgeUserCache(userId);
    CacheOrchestrator.setCurrentUser(null);

    // Clear legacy localStorage user keys
    try {
      localStorage.removeItem('frostybite_active_session_email');
      localStorage.removeItem('frostybite_has_active_session');
      localStorage.removeItem('frostybite_cached_user');
      localStorage.removeItem('latest_admin_auth_token');
      localStorage.removeItem('claimed_coupon_code');

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('orders_cache_') ||
            key.startsWith('profile_cache_') ||
            key.startsWith('wishlist_cache_') ||
            key.startsWith('user_notifications_') ||
            key.startsWith('verified_'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }
}

export const AuthManager = MasterAuthManager.getInstance();

