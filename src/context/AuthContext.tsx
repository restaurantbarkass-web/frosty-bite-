import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { LoadingScreen } from '../components/LoadingScreen';
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

type UserRole = 'customer' | 'admin';
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
  // Synchronous cache hydration on application bootstrap
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
    } catch (e) {}
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

  const requireAuthentication = useCallback((action?: () => void, title?: string, subtitle?: string) => {
    if (user) {
      if (action) action();
      return true;
    }
    openAuthModal(title, subtitle);
    return false;
  }, [user, openAuthModal]);

  const lastSupabaseUserRef = useRef<any>(undefined);
  const lastFirebaseUserRef = useRef<any>(undefined);
  const syncVersionRef = useRef<number>(0);

  const isVerified = useMemo(() => {
    if (!user) return false;
    return true;
  }, [user]);

  // Handle resolving user identity from database by email
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
        fallbackEmail = localStorage.getItem('frostybite_active_session_email');
      } catch (e) {
        console.warn('[UnifiedAuth] Failed to read fallbackEmail from localStorage:', e);
      }
      
      const hasResolvedUser = !!sbUser || !!fbUser;
      if (!hasResolvedUser) {
        const isSupabaseInitializing = lastSupabaseUserRef.current === undefined;
        const isFirebaseInitializing = lastFirebaseUserRef.current === undefined;
        if (isSupabaseInitializing || isFirebaseInitializing) {
          return;
        }
      }

      const email = fbUser?.email || sbUser?.email || fallbackEmail;
      if (!email) {
        if (currentVersion !== syncVersionRef.current) return;
        setUser(null);
        setRole('customer');
        setAuthStatus('unauthenticated');
        setLoading(false);
        try {
          localStorage.removeItem('frostybite_cached_user');
          localStorage.removeItem('frostybite_has_active_session');
        } catch (e) {}
        return;
      }

      const normalizedEmail = safeTrimLowerCase(email);
      console.log(`[UnifiedAuth] Resolving identity for: ${normalizedEmail}`);

      const defaultName = normalizedEmail.split('@')[0];
      const displayName = fbUser?.displayName || sbUser?.user_metadata?.full_name || sbUser?.user_metadata?.name || defaultName;
      const photoURL = fbUser?.photoURL || sbUser?.user_metadata?.avatar_url || null;
      const determinedRole = getRoleFromEmail(normalizedEmail);

      let dbUser = null;

      // Fetch user profile from Supabase Postgres
      let { data: localUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      dbUser = localUser;

      if (!dbUser && fbUser?.uid) {
        const { data: fbLoc } = await supabase
          .from('users')
          .select('*')
          .eq('firebase_uid', fbUser.uid)
          .maybeSingle();
        if (fbLoc) dbUser = fbLoc;
      }

      if (!dbUser && sbUser?.id) {
        const { data: sbLoc } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_uid', sbUser.id)
          .maybeSingle();
        if (sbLoc) dbUser = sbLoc;
      }

      if (!dbUser) {
        console.log(`[UnifiedAuth] Creating master database record for ${normalizedEmail}...`);
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
          console.error('[UnifiedAuth] fallback insert error:', insertError);
        } else {
          dbUser = insertedUser;
        }
      } else {
        // Keep properties synchronized or merge them
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
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updates)
            .eq('id', dbUser.id)
            .select()
            .single();
          
          if (updateError) {
            console.error('[Auth] Failed to update user profile:', updateError);
          } else if (updatedUser) {
            dbUser = updatedUser;
          }
        }
      }

      if (dbUser) {
        if (GuestSessionManager.isActive()) {
          GuestSessionManager.mergeWithUser(dbUser.id);
          setGuestState(null);
        }

        const unifiedUser: UnifiedUser = {
          uid: dbUser.id,
          id: dbUser.id,
          firebase_uid: dbUser.firebase_uid || fbUser?.uid || null,
          supabase_uid: dbUser.supabase_uid || sbUser?.id || null,
          email: dbUser.email,
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
        };
 
        if (currentVersion !== syncVersionRef.current) return;
        setUser((prev) => {
          if (
            prev &&
            typeof prev.getIdToken === 'function' &&
            prev.id === unifiedUser.id &&
            prev.uid === unifiedUser.uid &&
            prev.email === unifiedUser.email &&
            prev.name === unifiedUser.name &&
            prev.role === unifiedUser.role &&
            prev.photoURL === unifiedUser.photoURL &&
            prev.points === unifiedUser.points &&
            prev.reward_points === unifiedUser.reward_points &&
            prev.badge_tier === unifiedUser.badge_tier &&
            prev.phone === unifiedUser.phone &&
            prev.address === unifiedUser.address
          ) {
            return prev;
          }
          return unifiedUser;
        });
        setRole((prev) => (prev === unifiedUser.role ? prev : unifiedUser.role));
        setAuthStatus('authenticated');
        setLoading(false);
        try {
          localStorage.setItem('frostybite_has_active_session', 'true');
          localStorage.setItem('frostybite_active_session_email', unifiedUser.email);
          localStorage.setItem('frostybite_cached_user', JSON.stringify(unifiedUser));
          CacheManager.set(CacheKeys.USER_PROFILE, unifiedUser, CacheNamespace.USER).catch(() => {});
        } catch (e) {}
      } else {
        if (currentVersion !== syncVersionRef.current) return;
        setUser(null);
        setRole('customer');
        setAuthStatus('unauthenticated');
        setLoading(false);
      }
    } catch (error) {
      console.error('[UnifiedAuth] Error in resolveAndSyncUser:', error);
      if (currentVersion === syncVersionRef.current) {
        setAuthStatus((prev) => (prev === 'loading' ? (user ? 'authenticated' : 'unauthenticated') : prev));
        setLoading(false);
      }
    } finally {
      if (currentVersion === syncVersionRef.current) {
        setLoading(false);
      }
    }
  }, [getAuthToken, user]);

  useEffect(() => {
    let isMounted = true;

    const initAuthLifecycle = async () => {
      try {
        // 1. Check if Firebase auth state is ready (asynchronously reads indexedDB)
        let fbUser: any = fbAuth.currentUser;
        if (!fbUser) {
          if (typeof (fbAuth as any).authStateReady === 'function') {
            try {
              await (fbAuth as any).authStateReady();
              fbUser = fbAuth.currentUser;
            } catch (e) {
              console.warn('[UnifiedAuth] authStateReady error:', e);
            }
          } else {
            fbUser = await new Promise((resolve) => {
              const unsub = fbAuth.onAuthStateChanged((u) => {
                unsub();
                resolve(u);
              }, () => resolve(null));
              setTimeout(() => resolve(null), 1500);
            });
          }
        }

        // 2. Check Supabase session
        let sbUser: any = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          sbUser = sessionData?.session?.user || null;
        } catch (e) {
          console.warn('[UnifiedAuth] Supabase getSession error:', e);
        }

        lastFirebaseUserRef.current = fbUser;
        lastSupabaseUserRef.current = sbUser;

        if (fbUser || sbUser) {
          await resolveAndSyncUser(sbUser, fbUser);
          return;
        }

        // 3. Fallback check cached session
        const cachedUserStr = localStorage.getItem('frostybite_cached_user');
        const hasSessionFlag = localStorage.getItem('frostybite_has_active_session') === 'true';
        const fallbackEmail = localStorage.getItem('frostybite_active_session_email');

        if (hasSessionFlag && (cachedUserStr || fallbackEmail)) {
          let emailToSync = fallbackEmail;
          if (!emailToSync && cachedUserStr) {
            try {
              emailToSync = JSON.parse(cachedUserStr)?.email;
            } catch (_) {}
          }
          if (emailToSync) {
            await resolveAndSyncUser(null, null);
            return;
          }
        }

        // 4. Truly unauthenticated session
        if (isMounted) {
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
        }
      } catch (err) {
        console.warn('[UnifiedAuth] Initialization error:', err);
        if (isMounted) {
          setAuthStatus(prev => (user ? 'authenticated' : 'unauthenticated'));
          setLoading(false);
        }
      }
    };

    initAuthLifecycle();

    // Live listener for Supabase login events
    let unsubscribeSupabase: { unsubscribe: () => void } | null = null;
    try {
      const authRes = supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[UnifiedAuth] Supabase auth event: ${event}`, session?.user?.email || 'null');
        if (event === 'SIGNED_OUT') {
          lastSupabaseUserRef.current = null;
          setUser(null);
          setRole('customer');
          setAuthStatus('unauthenticated');
          setLoading(false);
          return;
        }
        if (session?.user) {
          resolveAndSyncUser(session.user, undefined);
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
        if (fbUser) {
          resolveAndSyncUser(undefined, fbUser);
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

  useEffect(() => {
    if (!user?.id) return;

    // Real-time synchronization for current user profile changes (such as role modifications, points, status updates)
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
  }, [user?.id]);

  const performLogoutCleanup = useCallback(async () => {
    haptic.medium();
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
  }), [authStatus, user, role, loading, isVerified, isGuest, guestState, authModalOpen, authModalConfig, logout, refreshProfile, resolveAndSyncUser, loginAsGuest, exitGuestMode, openAuthModal, closeAuthModal, requireAuthentication, getAuthToken]);

  const handleConfirmLogout = async () => {
    setShowLogoutModal((prev) => (prev ? false : prev));
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
    setShowLogoutModal((prev) => (prev ? false : prev));
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
                    setShowLogoutModal((prev) => (prev ? false : prev));
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
