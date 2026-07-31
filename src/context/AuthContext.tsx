import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { LoadingScreen } from '../components/LoadingScreen';
import { ADMIN_EMAILS, getRoleFromEmail } from '../constants';
import { supabase } from '../supabase';
import { auth as fbAuth, logout as fbLogout } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut } from 'lucide-react';

type UserRole = 'customer' | 'admin';

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

interface AuthContextType {
  user: any;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  isVerified: boolean;
  logout: (bypassConfirmation?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [pendingLogout, setPendingLogout] = useState<{ resolve: () => void; reject: (err: any) => void } | null>(null);

  const lastSupabaseUserRef = React.useRef<any>(undefined);
  const lastFirebaseUserRef = React.useRef<any>(undefined);
  const syncVersionRef = React.useRef<number>(0);

  const isVerified = useMemo(() => {
    if (!user) return false;
    return true;
  }, [user]);

  // Handle resolving user identity from database by email
  const resolveAndSyncUser = async (sbUserParam?: any, fbUserParam?: any) => {
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
      const possessesSession = (sbUser !== null && sbUser !== undefined) || (fbUser !== null && fbUser !== undefined) || !!fallbackEmail;

      // If we don't have any logged-in user yet, and at least one of the auth systems is still initializing (is undefined),
      // we must postpone finalizing the signed-out state to prevent login page flickering on startup.
      const hasResolvedUser = !!sbUser || !!fbUser;
      if (!hasResolvedUser) {
        const isSupabaseInitializing = lastSupabaseUserRef.current === undefined;
        const isFirebaseInitializing = lastFirebaseUserRef.current === undefined;
        if (isSupabaseInitializing || isFirebaseInitializing) {
          console.log('[UnifiedAuth] Postponing sync: one of the auth systems is still initializing.', {
            supabaseInit: isSupabaseInitializing,
            firebaseInit: isFirebaseInitializing
          });
          return;
        }
      }

      const email = fbUser?.email || sbUser?.email || fallbackEmail;
      if (!email) {
        if (currentVersion !== syncVersionRef.current) return;
        setUser(null);
        setRole('customer');
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
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
        const methods = dbUser.auth_methods || [];
        let updatedMethods = [...methods];

        if (dbUser.email !== normalizedEmail) {
          updates.email = normalizedEmail;
        }

        if (sbUser && sbUser.id && dbUser.supabase_uid !== sbUser.id) {
          updates.supabase_uid = sbUser.id;
          if (!updatedMethods.includes('otp')) updatedMethods.push('otp');
        }

        if (fbUser && fbUser.uid && dbUser.firebase_uid !== fbUser.uid) {
          updates.firebase_uid = fbUser.uid;
          if (!updatedMethods.includes('google')) updatedMethods.push('google');
        }

        if (updatedMethods.length !== methods.length) {
          updates.auth_methods = updatedMethods;
        }

        if (Object.keys(updates).length > 0) {
          const { data: updatedUser } = await supabase
            .from('users')
            .update(updates)
            .eq('id', dbUser.id)
            .select()
            .single();
          if (updatedUser) dbUser = updatedUser;
        }
      }

      // Construct UnifiedUser representation mapping to .uid and all fields
      if (dbUser) {
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
          getIdToken: async () => {
            let token: string | null = null;
            if (fbUser) {
              try {
                token = await fbUser.getIdToken();
              } catch (fbErr) {
                console.warn('[UnifiedAuth] Firebase getIdToken failed:', fbErr);
              }
            }
            if (!token) {
              try {
                const { data } = await supabase.auth.getSession();
                token = data.session?.access_token || null;
              } catch (sbErr) {
                console.warn('[UnifiedAuth] getSession failed:', sbErr);
              }
            }
            if (token) {
              try {
                localStorage.setItem('latest_admin_auth_token', token);
              } catch (e) {
                console.warn('[UnifiedAuth] Failed to write latest_admin_auth_token to localStorage:', e);
              }
            }
            return token;
          }
        };

        if (currentVersion !== syncVersionRef.current) return;
        setUser(unifiedUser);
        setRole(unifiedUser.role);
        try {
          localStorage.setItem('frostybite_has_active_session', 'true');
        } catch (e) {}
      }
    } catch (error) {
      console.error('[UnifiedAuth] Error in resolveAndSyncUser:', error);
    } finally {
      if (currentVersion === syncVersionRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let hasPotentialSession = false;
    try {
      hasPotentialSession = !!localStorage.getItem('frostybite_active_session_email') ||
                            localStorage.getItem('frostybite_has_active_session') === 'true';
      if (!hasPotentialSession) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('firebase')) && key.endsWith('-auth-token')) {
            hasPotentialSession = true;
            break;
          }
        }
      }
    } catch (e) {}

    // Immediately resolve initial auth state on mount
    resolveAndSyncUser();

    // If there's no potential session stored, end loading state fast
    if (!hasPotentialSession) {
      if (lastSupabaseUserRef.current === undefined) lastSupabaseUserRef.current = null;
      if (lastFirebaseUserRef.current === undefined) lastFirebaseUserRef.current = null;
      setLoading(false);
    }

    const delay = hasPotentialSession ? 1200 : 400;

    const timeoutId = setTimeout(() => {
      console.log(`[UnifiedAuth] Safety timeout reached (${delay}ms), forcing loading false`);
      if (lastSupabaseUserRef.current === undefined) lastSupabaseUserRef.current = null;
      if (lastFirebaseUserRef.current === undefined) lastFirebaseUserRef.current = null;
      resolveAndSyncUser();
    }, delay);

    // Live listener for Supabase login events
    let unsubscribeSupabase: { unsubscribe: () => void } | null = null;
    try {
      const authRes = supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[UnifiedAuth] Supabase auth event: ${event}`, session?.user?.email || 'null');
        resolveAndSyncUser(session?.user || null, undefined);
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
        resolveAndSyncUser(undefined, fbUser || null);
      });
    } catch (err) {
      console.warn('[UnifiedAuth] Failed to subscribe to Firebase auth events:', err);
    }

    return () => {
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
      clearTimeout(timeoutId);
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

  const value = useMemo(() => ({
    user,
    role,
    loading,
    isVerified,
    isAdmin: role === 'admin' || (!!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())),
    isCustomer: role === 'customer',
    logout: async (bypassConfirmation = false) => {
      if (!bypassConfirmation) {
        return new Promise<void>((resolve, reject) => {
          setPendingLogout({ resolve, reject });
          setShowLogoutModal(true);
        });
      }

      try {
        localStorage.removeItem('frostybite_active_session_email');
        localStorage.removeItem('frostybite_has_active_session');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('orders_cache_') || key.startsWith('profile_cache_') || key.startsWith('wishlist_cache_') || key.startsWith('user_notifications_') || key.startsWith('verified_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {
        console.warn('[UnifiedAuth] Error clearing user caches on logout:', e);
      }

      try {
        await fbLogout();
      } catch (_) {}
      
      setUser(null);
      setRole('customer');

      setTimeout(() => {
        window.location.href = '/login';
      }, 50);
    },
    refreshProfile: async () => {
      await resolveAndSyncUser();
    }
  }), [user, role, loading, isVerified]);

  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    if (pendingLogout) {
      try {
        try {
          localStorage.removeItem('frostybite_active_session_email');
          localStorage.removeItem('frostybite_has_active_session');
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('orders_cache_') || key.startsWith('profile_cache_') || key.startsWith('wishlist_cache_') || key.startsWith('user_notifications_') || key.startsWith('verified_'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {
          console.warn('[UnifiedAuth] Error clearing caches:', e);
        }

        try {
          await fbLogout();
        } catch (_) {}
        
        setUser(null);
        setRole('customer');

        pendingLogout.resolve();
        setPendingLogout(null);

        setTimeout(() => {
          window.location.href = '/login';
        }, 50);
      } catch (err) {
        pendingLogout.reject(err);
        setPendingLogout(null);
      }
    }
  };

  const handleCancelLogout = () => {
    setShowLogoutModal(false);
    if (pendingLogout) {
      pendingLogout.reject(new Error('cancelled'));
      setPendingLogout(null);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingScreen /> : children}
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

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleCancelLogout}
                  className="flex-1 py-3 px-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] active:scale-95 text-zinc-350 hover:text-white border border-white/10 text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer"
                  id="btn_cancel_logout"
                >
                  No, Keep Me In
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 active:scale-95 text-white shadow-lg shadow-orange-600/20 text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer"
                  id="btn_confirm_logout"
                >
                  Yes, Log Me Out
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
