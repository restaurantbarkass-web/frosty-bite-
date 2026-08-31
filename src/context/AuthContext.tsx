import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ADMIN_EMAILS, getRoleFromEmail } from '../constants';
import { supabase } from '../supabase';
import { auth as fbAuth, logout as fbLogout } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut } from 'lucide-react';
import { safeTrimLowerCase } from '../utils/string';
import { CacheManager } from '../core/cache/CacheManager';
import { CacheNamespace, CacheKeys } from '../core/cache/CacheKeys';
import { AuthManager } from '../core/auth/AuthManager';
import { SlideToLogout } from '../components/ui/SlideToLogout';
import { GuestSessionManager } from '../core/guest/GuestSessionManager';
import { AuthModal } from '../components/AuthModal';
import { haptic } from '../lib/utils';

export type UserRole = 'customer' | 'admin';
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface UnifiedUser {
  uid: string; // Unified stable ID (maps to the database public.users.id UUID)
  id: string;  // Also available as .id
  firebase_uid: string | null;
  supabase_uid: string | null;
  email: string;
  name: string;
  displayName: string;
  photoURL: string | null;
  avatar: string | null;
  avatar_url: string | null;
  avatarSvg?: string | null;
  avatarConfig?: any;
  phone?: string | null;
  address?: string | null;
  role: UserRole;
  badge_tier?: string;
  total_orders?: number;
  reward_points?: number;
  lifetime_spend?: number;
  points?: number;
  vibe?: string | null;
  title?: string;
  emailVerified?: boolean;
  getIdToken?: () => Promise<string | null>;
}

export interface AuthContextType {
  authStatus: AuthStatus;
  user: UnifiedUser | null;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  isVerified: boolean;
  isGuest: boolean;
  guestState: any | null;
  authModalOpen: boolean;
  authModalConfig: { title?: string; subtitle?: string };
  logout: (bypassConfirmation?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
  resolveAndSyncUser: (sbUserParam?: any, fbUserParam?: any) => Promise<void>;
  loginAsGuest: () => void;
  exitGuestMode: () => void;
  openAuthModal: (title?: string, subtitle?: string) => void;
  closeAuthModal: () => void;
  requireAuthentication: (action?: () => void, title?: string, subtitle?: string) => boolean;
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous cache hydration on application bootstrap for smooth rendering
  const initialCachedUser: UnifiedUser | null = (() => {
    try {
      const cached = localStorage.getItem('frostybite_cached_user');
      const hasSession = localStorage.getItem('frostybite_has_active_session') === 'true';
      if (cached && hasSession) {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.id || parsed.uid) && parsed.email) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[UnifiedAuth] Failed parsing initial cached user:', e);
    }
    return null;
  })();

  const [user, setUser] = useState<UnifiedUser | null>(initialCachedUser);
  const [role, setRole] = useState<UserRole | null>(initialCachedUser?.role || null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(initialCachedUser ? 'authenticated' : 'loading');
  const [loading, setLoading] = useState<boolean>(!initialCachedUser);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [pendingLogout, setPendingLogout] = useState<{ resolve: () => void; reject: (err: any) => void } | null>(null);

  const [guestState, setGuestState] = useState<any>(() => GuestSessionManager.get());
  const isGuest = useMemo(() => !user && GuestSessionManager.isActive(), [user]);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalConfig, setAuthModalConfig] = useState<{ title?: string; subtitle?: string }>({});

  const lastSupabaseUserRef = useRef<any>(undefined);
  const lastFirebaseUserRef = useRef<any>(undefined);
  const syncVersionRef = useRef<number>(0);
  const initialBootstrapDoneRef = useRef<boolean>(false);

  const isVerified = useMemo(() => {
    return !!user;
  }, [user]);

  const loginAsGuest = useCallback(() => {
    const gs = GuestSessionManager.create();
    setGuestState(gs);
    setUser(null);
    setRole('customer');
  }, []);

  const exitGuestMode = useCallback(() => {
    GuestSessionManager.clear();
    setGuestState(null);
  }, []);

  const openAuthModal = useCallback((title?: string, subtitle?: string) => {
    setAuthModalConfig({ title, subtitle });
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  // Auto-close login modal if user becomes authenticated
  useEffect(() => {
    if (authStatus === 'authenticated' && authModalOpen) {
      console.log('[Auth] User is authenticated; auto-closing auth modal');
      setAuthModalOpen(false);
    }
  }, [authStatus, authModalOpen]);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    let token: string | null = null;
    try {
      const fbUser = fbAuth.currentUser;
      if (fbUser) {
        token = await fbUser.getIdToken();
      }
    } catch (fbErr) {
      console.warn('[UnifiedAuth] getAuthToken: Firebase token retrieval failed:', fbErr);
    }
    if (!token) {
      try {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token || null;
      } catch (sbErr) {
        console.warn('[UnifiedAuth] getAuthToken: Supabase token retrieval failed:', sbErr);
      }
    }
    if (token) {
      try {
        localStorage.setItem('latest_admin_auth_token', token);
      } catch (e) {}
    } else {
      try {
        token = localStorage.getItem('latest_admin_auth_token');
      } catch (e) {}
    }
    return token;
  }, []);

  // Strict check: Never show login modal if authStatus is loading
  const requireAuthentication = useCallback((action?: () => void, title?: string, subtitle?: string): boolean => {
    if (authStatus === 'loading') {
      console.log('[Auth] requireAuthentication called while loading; modal suppressed.');
      return false;
    }

    if (authStatus === 'authenticated' && user) {
      if (action) {
        try {
          action();
        } catch (actErr) {
          console.error('[Auth] Error executing requireAuthentication action:', actErr);
        }
      }
      return true;
    }

    // Truly unauthenticated -> trigger modal
    openAuthModal(title, subtitle);
    return false;
  }, [authStatus, user, openAuthModal]);

  // Core user identity and profile resolver
  const resolveAndSyncUser = useCallback(async (sbUserParam?: any, fbUserParam?: any) => {
    const currentVersion = ++syncVersionRef.current;

    if (sbUserParam !== undefined) {
      lastSupabaseUserRef.current = sbUserParam;
    }
    if (fbUserParam !== undefined) {
      lastFirebaseUserRef.current = fbUserParam;
    }

    try {
      let sbUser = lastSupabaseUserRef.current;
      if (sbUser === undefined) {
        try {
          const { data: sbData } = await supabase.auth.getUser();
          if (sbData?.user) {
            lastSupabaseUserRef.current = sbData.user;
            sbUser = sbData.user;
          } else {
            lastSupabaseUserRef.current = null;
            sbUser = null;
          }
        } catch (e) {
          console.warn('[UnifiedAuth] Error fetching Supabase user:', e);
          lastSupabaseUserRef.current = null;
          sbUser = null;
        }
      }

      let fbUser = lastFirebaseUserRef.current;
      if (fbUser === undefined) {
        try {
          fbUser = fbAuth.currentUser;
          lastFirebaseUserRef.current = fbUser;
        } catch (e) {
          console.warn('[UnifiedAuth] Error fetching Firebase user:', e);
          lastFirebaseUserRef.current = null;
          fbUser = null;
        }
      }

      let fallbackEmail: string | null = null;
      try {
        const hasSession = localStorage.getItem('frostybite_has_active_session') === 'true';
        if (hasSession) {
          fallbackEmail = localStorage.getItem('frostybite_active_session_email');
          if (!fallbackEmail) {
            const cachedStr = localStorage.getItem('frostybite_cached_user');
            if (cachedStr) {
              const parsed = JSON.parse(cachedStr);
              fallbackEmail = parsed?.email || null;
            }
          }
        }
      } catch (e) {
        console.warn('[UnifiedAuth] Failed to read fallbackEmail from localStorage:', e);
      }

      const email = fbUser?.email || sbUser?.email || fallbackEmail;

      // If no valid user or email is found anywhere
      if (!email) {
        if (currentVersion !== syncVersionRef.current) return;
        setUser(null);
        setRole('customer');
        setAuthStatus('unauthenticated');
        setLoading(false);
        try {
          localStorage.removeItem('frostybite_cached_user');
          localStorage.removeItem('frostybite_has_active_session');
          localStorage.removeItem('frostybite_active_session_email');
        } catch (e) {}
        console.log('[Auth] Status: unauthenticated, Supabase: missing, Firebase: missing, User: null');
        return;
      }

      const normalizedEmail = safeTrimLowerCase(email);
      console.log(`[UnifiedAuth] Resolving identity for: ${normalizedEmail} (version ${currentVersion})`);

      const defaultName = normalizedEmail.split('@')[0];
      const displayName = fbUser?.displayName || sbUser?.user_metadata?.full_name || sbUser?.user_metadata?.name || defaultName;
      const photoURL = fbUser?.photoURL || sbUser?.user_metadata?.avatar_url || null;
      const determinedRole = getRoleFromEmail(normalizedEmail);

      let dbUser: any = null;

      // 1. Fetch user profile from Supabase Postgres database
      try {
        const { data: localUser, error: selErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (!selErr && localUser) {
          dbUser = localUser;
        }
      } catch (err) {
        console.warn('[UnifiedAuth] Error querying user by email:', err);
      }

      if (!dbUser && fbUser?.uid) {
        try {
          const { data: fbLoc } = await supabase
            .from('users')
            .select('*')
            .eq('firebase_uid', fbUser.uid)
            .maybeSingle();
          if (fbLoc) dbUser = fbLoc;
        } catch (err) {
          console.warn('[UnifiedAuth] Error querying user by firebase_uid:', err);
        }
      }

      if (!dbUser && sbUser?.id) {
        try {
          const { data: sbLoc } = await supabase
            .from('users')
            .select('*')
            .eq('supabase_uid', sbUser.id)
            .maybeSingle();
          if (sbLoc) dbUser = sbLoc;
        } catch (err) {
          console.warn('[UnifiedAuth] Error querying user by supabase_uid:', err);
        }
      }

      // 2. Insert master profile if not existing
      if (!dbUser) {
        try {
          console.log(`[UnifiedAuth] Creating database profile record for ${normalizedEmail}...`);
          const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert({
              email: normalizedEmail,
              name: displayName,
              full_name: displayName,
              avatar_url: photoURL,
              avatar: photoURL,
              supabase_uid: sbUser?.id || null,
              firebase_uid: fbUser?.uid || null,
              auth_methods: fbUser ? ['google'] : ['otp'],
              last_login: new Date().toISOString(),
              last_login_at: new Date().toISOString(),
              role: determinedRole
            })
            .select()
            .single();

          if (insertError) {
            console.warn('[UnifiedAuth] User insert warning:', insertError.message);
          } else if (insertedUser) {
            dbUser = insertedUser;
          }
        } catch (insErr) {
          console.warn('[UnifiedAuth] Error inserting user record:', insErr);
        }
      } else {
        // Sync metadata updates in background
        try {
          const updates: any = {};
          const methods = Array.isArray(dbUser.auth_methods) ? dbUser.auth_methods : [];
          let updatedMethods = [...methods];

          if (normalizedEmail && dbUser.email !== normalizedEmail) {
            updates.email = normalizedEmail;
          }

          if (sbUser?.id && dbUser.supabase_uid !== sbUser.id) {
            updates.supabase_uid = sbUser.id;
            if (!updatedMethods.includes('otp')) updatedMethods.push('otp');
          }

          if (fbUser?.uid && dbUser.firebase_uid !== fbUser.uid) {
            updates.firebase_uid = fbUser.uid;
            if (!updatedMethods.includes('google')) updatedMethods.push('google');
          }

          const methodsChanged = updatedMethods.length !== methods.length || 
                                !updatedMethods.every(m => methods.includes(m));
          
          if (methodsChanged) {
            updates.auth_methods = updatedMethods;
          }

          if (Object.keys(updates).length > 0) {
            try {
              const { data: updatedUser } = await supabase
                .from('users')
                .update(updates)
                .eq('id', dbUser.id)
                .select()
                .single();
              if (updatedUser) {
                dbUser = updatedUser;
              }
            } catch (updErr) {
              console.warn('[UnifiedAuth] Profile sync update error:', updErr);
            }
          }
        } catch (e) {
          console.warn('[UnifiedAuth] Error preparing profile updates:', e);
        }
      }

      if (GuestSessionManager.isActive()) {
        GuestSessionManager.mergeWithUser(dbUser?.id || sbUser?.id || fbUser?.uid || 'user');
        setGuestState(null);
      }

      // 3. Construct Unified User Object (with safe fallback if DB fetch encountered transient error)
      const unifiedUser: UnifiedUser = dbUser ? {
        uid: dbUser.id,
        id: dbUser.id,
        firebase_uid: dbUser.firebase_uid || fbUser?.uid || null,
        supabase_uid: dbUser.supabase_uid || sbUser?.id || null,
        email: dbUser.email || normalizedEmail,
        name: dbUser.name || dbUser.full_name || displayName,
        displayName: dbUser.name || dbUser.full_name || displayName,
        photoURL: dbUser.avatar_url || dbUser.avatar || photoURL,
        avatar: dbUser.avatar || dbUser.avatar_url || photoURL,
        avatar_url: dbUser.avatar_url || dbUser.avatar || photoURL,
        avatarSvg: dbUser.avatarSvg || null,
        avatarConfig: dbUser.avatar_config || null,
        phone: dbUser.phone || null,
        address: dbUser.address || null,
        role: (dbUser.role || determinedRole) as UserRole,
        badge_tier: dbUser.badge_tier || 'Foodie Starter',
        total_orders: dbUser.total_orders || 0,
        reward_points: dbUser.reward_points || 0,
        lifetime_spend: dbUser.lifetime_spend || 0,
        points: dbUser.points || 0,
        vibe: dbUser.vibe || null,
        title: dbUser.title || null,
        emailVerified: true,
        getIdToken: getAuthToken
      } : {
        uid: sbUser?.id || fbUser?.uid || `usr_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        id: sbUser?.id || fbUser?.uid || `usr_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        firebase_uid: fbUser?.uid || null,
        supabase_uid: sbUser?.id || null,
        email: normalizedEmail,
        name: displayName,
        displayName: displayName,
        photoURL: photoURL,
        avatar: photoURL,
        avatar_url: photoURL,
        avatarSvg: null,
        avatarConfig: null,
        phone: null,
        address: null,
        role: determinedRole as UserRole,
        badge_tier: 'Foodie Starter',
        total_orders: 0,
        reward_points: 0,
        lifetime_spend: 0,
        points: 0,
        vibe: null,
        title: null,
        emailVerified: true,
        getIdToken: getAuthToken
      };

      // Ensure this async response is still the latest resolution version
      if (currentVersion !== syncVersionRef.current) {
        console.log(`[UnifiedAuth] Stale resolution version (${currentVersion} < ${syncVersionRef.current}), skipping state update.`);
        return;
      }

      setUser(unifiedUser);
      setRole(unifiedUser.role);
      setAuthStatus('authenticated');
      setLoading(false);

      try {
        localStorage.setItem('frostybite_has_active_session', 'true');
        localStorage.setItem('frostybite_active_session_email', unifiedUser.email);
        localStorage.setItem('frostybite_cached_user', JSON.stringify(unifiedUser));
        CacheManager.set(CacheKeys.USER_PROFILE, unifiedUser, CacheNamespace.USER).catch(() => {});
      } catch (e) {}

      console.log(`[Auth] Status: authenticated, Supabase: ${sbUser ? 'present' : 'missing'}, Firebase: ${fbUser ? 'present' : 'missing'}, User: ${unifiedUser.email}`);
    } catch (error) {
      console.error('[UnifiedAuth] Error in resolveAndSyncUser:', error);
      if (currentVersion === syncVersionRef.current) {
        setAuthStatus((prev) => (user ? 'authenticated' : (prev === 'loading' ? 'unauthenticated' : prev)));
        setLoading(false);
      }
    } finally {
      if (currentVersion === syncVersionRef.current) {
        setLoading(false);
      }
    }
  }, [getAuthToken, user]);

  // Auth lifecycle initialization and provider listeners
  useEffect(() => {
    let isMounted = true;

    const initAuthLifecycle = async () => {
      try {
        // 1. Check Supabase session
        let sbUser: any = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          sbUser = sessionData?.session?.user || null;
        } catch (e) {
          console.warn('[UnifiedAuth] Supabase getSession error:', e);
        }

        // 2. Check Firebase session
        let fbUser: any = fbAuth.currentUser;
        if (!fbUser) {
          if (typeof (fbAuth as any).authStateReady === 'function') {
            try {
              await (fbAuth as any).authStateReady();
              fbUser = fbAuth.currentUser;
            } catch (e) {
              console.warn('[UnifiedAuth] Firebase authStateReady error:', e);
            }
          } else {
            fbUser = await new Promise((resolve) => {
              const unsub = fbAuth.onAuthStateChanged((u) => {
                unsub();
                resolve(u);
              }, () => resolve(null));
              setTimeout(() => resolve(null), 1000);
            });
          }
        }

        lastSupabaseUserRef.current = sbUser;
        lastFirebaseUserRef.current = fbUser;

        console.log(`[Auth] Bootstrap check - Supabase: ${sbUser ? 'present' : 'missing'}, Firebase: ${fbUser ? 'present' : 'missing'}`);

        if (sbUser || fbUser) {
          await resolveAndSyncUser(sbUser, fbUser);
          if (isMounted) initialBootstrapDoneRef.current = true;
          return;
        }

        // 3. Check for active session fallback in storage
        const hasSessionFlag = localStorage.getItem('frostybite_has_active_session') === 'true';
        const fallbackEmail = localStorage.getItem('frostybite_active_session_email');
        const cachedUserStr = localStorage.getItem('frostybite_cached_user');

        if (hasSessionFlag && (fallbackEmail || cachedUserStr)) {
          let emailToSync = fallbackEmail;
          if (!emailToSync && cachedUserStr) {
            try {
              emailToSync = JSON.parse(cachedUserStr)?.email;
            } catch (_) {}
          }
          if (emailToSync) {
            console.log(`[Auth] Bootstrap found fallback session for: ${emailToSync}`);
            await resolveAndSyncUser(null, null);
            if (isMounted) initialBootstrapDoneRef.current = true;
            return;
          }
        }

        // 4. No active session -> Mark unauthenticated
        if (isMounted) {
          initialBootstrapDoneRef.current = true;
          lastSupabaseUserRef.current = null;
          lastFirebaseUserRef.current = null;
          setUser(null);
          setRole('customer');
          setAuthStatus('unauthenticated');
          setLoading(false);
          try {
            localStorage.removeItem('frostybite_cached_user');
            localStorage.removeItem('frostybite_has_active_session');
            localStorage.removeItem('frostybite_active_session_email');
          } catch (e) {}
          console.log('[Auth] Auth status: unauthenticated');
        }
      } catch (err) {
        console.warn('[UnifiedAuth] Initialization error:', err);
        if (isMounted) {
          initialBootstrapDoneRef.current = true;
          setAuthStatus(user ? 'authenticated' : 'unauthenticated');
          setLoading(false);
        }
      }
    };

    initAuthLifecycle();

    // Live listener for Supabase auth events
    let unsubscribeSupabase: { unsubscribe: () => void } | null = null;
    try {
      const authRes = supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[UnifiedAuth] Supabase auth event: ${event}`, session?.user?.email || 'null');
        if (event === 'SIGNED_OUT') {
          lastSupabaseUserRef.current = null;
          if (lastFirebaseUserRef.current) {
            resolveAndSyncUser(null, lastFirebaseUserRef.current);
          } else if (initialBootstrapDoneRef.current) {
            const hasSession = localStorage.getItem('frostybite_has_active_session') === 'true';
            if (!hasSession) {
              setUser(null);
              setRole('customer');
              setAuthStatus('unauthenticated');
              setLoading(false);
            }
          }
          return;
        }
        if (session?.user) {
          lastSupabaseUserRef.current = session.user;
          resolveAndSyncUser(session.user, lastFirebaseUserRef.current);
        }
      });
      if (authRes && authRes.data && authRes.data.subscription) {
        unsubscribeSupabase = authRes.data.subscription;
      }
    } catch (err) {
      console.warn('[UnifiedAuth] Failed to subscribe to Supabase auth events:', err);
    }

    // Live listener for Firebase auth events
    let unsubscribeFirebase: (() => void) | null = null;
    try {
      unsubscribeFirebase = fbAuth.onAuthStateChanged((fbUser) => {
        console.log(`[UnifiedAuth] Firebase auth event:`, fbUser?.email || 'null');
        lastFirebaseUserRef.current = fbUser;
        if (fbUser) {
          resolveAndSyncUser(lastSupabaseUserRef.current, fbUser);
        } else {
          if (lastSupabaseUserRef.current) {
            resolveAndSyncUser(lastSupabaseUserRef.current, null);
          } else if (initialBootstrapDoneRef.current) {
            const hasSession = localStorage.getItem('frostybite_has_active_session') === 'true';
            if (!hasSession) {
              setUser(null);
              setRole('customer');
              setAuthStatus('unauthenticated');
              setLoading(false);
            }
          }
        }
      });
    } catch (err) {
      console.warn('[UnifiedAuth] Failed to subscribe to Firebase auth events:', err);
    }

    return () => {
      isMounted = false;
      if (unsubscribeSupabase) {
        try {
          unsubscribeSupabase.unsubscribe();
        } catch (_) {}
      }
      if (unsubscribeFirebase) {
        try {
          unsubscribeFirebase();
        } catch (_) {}
      }
    };
  }, []);

  // Real-time synchronization for current user profile changes in Supabase
  useEffect(() => {
    if (!user?.id) return;

    const userChannel = supabase
      .channel(`user_profile_realtime_sync_${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'users', 
          filter: `id=eq.${user.id}` 
        },
        (payload) => {
          console.log('[Realtime] Current user database profile changed:', payload.new);
          resolveAndSyncUser();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [user?.id, resolveAndSyncUser]);

  const performLogoutCleanup = useCallback(async () => {
    haptic.medium();
    syncVersionRef.current++;
    lastSupabaseUserRef.current = null;
    lastFirebaseUserRef.current = null;

    try {
      await AuthManager.secureLogout();
    } catch (e) {
      console.warn('[UnifiedAuth] Error in secureLogout:', e);
    }

    setUser(null);
    setRole('customer');
    setAuthStatus('unauthenticated');
    setLoading(false);

    try {
      localStorage.removeItem('frostybite_active_session_email');
      localStorage.removeItem('frostybite_has_active_session');
      localStorage.removeItem('frostybite_cached_user');
      localStorage.removeItem('latest_admin_auth_token');
      localStorage.removeItem('claimed_coupon');
      CacheManager.clearNamespace(CacheNamespace.USER).catch(() => {});
    } catch (e) {}

    console.log('[Auth] Logged out successfully. Auth status: unauthenticated');
  }, []);

  const logout = useCallback(async (bypassConfirmation = false) => {
    if (!bypassConfirmation) {
      return new Promise<void>((resolve, reject) => {
        setPendingLogout((prev) => {
          if (prev) {
            try { prev.reject(new Error('superseded')); } catch (e) {}
          }
          return { resolve, reject };
        });
        setShowLogoutModal((prev) => (prev ? prev : true));
      });
    }

    await performLogoutCleanup();

    setTimeout(() => {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }, 50);
  }, [performLogoutCleanup]);

  const refreshProfile = useCallback(async () => {
    await resolveAndSyncUser();
  }, [resolveAndSyncUser]);

  const value = useMemo(() => ({
    authStatus,
    user,
    role,
    loading,
    isVerified,
    isAdmin: role === 'admin' || (!!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())),
    isCustomer: role === 'customer',
    isGuest,
    guestState,
    authModalOpen,
    authModalConfig,
    logout,
    refreshProfile,
    resolveAndSyncUser,
    loginAsGuest,
    exitGuestMode,
    openAuthModal,
    closeAuthModal,
    requireAuthentication,
    getAuthToken
  }), [
    authStatus, 
    user, 
    role, 
    loading, 
    isVerified, 
    isGuest, 
    guestState, 
    authModalOpen, 
    authModalConfig, 
    logout, 
    refreshProfile, 
    resolveAndSyncUser, 
    loginAsGuest, 
    exitGuestMode, 
    openAuthModal, 
    closeAuthModal, 
    requireAuthentication, 
    getAuthToken
  ]);

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    setPendingLogout((prev) => {
      if (prev) {
        performLogoutCleanup()
          .then(() => {
            prev.resolve();
            setTimeout(() => {
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
            }, 50);
          })
          .catch((err) => {
            prev.reject(err);
          });
      }
      return null;
    });
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
    setPendingLogout((prev) => {
      if (prev) {
        try { prev.reject(new Error('cancelled')); } catch (e) {}
      }
      return null;
    });
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} title={authModalConfig.title} subtitle={authModalConfig.subtitle} />
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelLogout}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden text-center z-10"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-orange-500/10 to-transparent blur-3xl rounded-full pointer-events-none" />

              <div className="relative mx-auto w-16 h-16 bg-gradient-to-b from-orange-500/15 to-orange-600/5 border border-orange-500/20 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
                <LogOut className="text-orange-500" size={24} />
                <div className="absolute inset-0 rounded-2xl bg-orange-500/10 animate-ping opacity-10 pointer-events-none" />
              </div>

              <h3 className="font-sans font-extrabold text-xl text-white tracking-tight mb-2">
                Departing so soon?
              </h3>
              <p className="font-sans text-xs text-zinc-400 leading-relaxed mb-6 max-w-sm mx-auto">
                Are you sure you want to log out of Frosty Bite? We will miss serving you delicious, fresh-baked gourmet treats!
              </p>

              <div className="space-y-4">
                <SlideToLogout
                  onLogout={async () => {
                    await performLogoutCleanup();
                    setPendingLogout((prev) => {
                      if (prev) {
                        try { prev.resolve(); } catch (e) {}
                      }
                      return null;
                    });
                  }}
                  onSuccess={() => {
                    setShowLogoutModal(false);
                  }}
                  autoRedirect={true}
                  redirectPath="/login"
                />

                <button
                  type="button"
                  onClick={handleCancelLogout}
                  className="w-full py-3 px-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] active:scale-95 text-zinc-400 hover:text-white border border-white/10 text-xs font-bold tracking-widest uppercase transition-all duration-200 cursor-pointer"
                  id="btn_cancel_logout"
                >
                  Stay Logged In
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
