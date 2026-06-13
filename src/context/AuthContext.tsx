import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import { ADMIN_EMAILS, getRoleFromEmail } from '../constants';
import { supabase } from '../supabase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { safeFirestore } from '../services/firestoreService';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, HelpCircle } from 'lucide-react';

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
  user: any; // We type as any to support seamless integration in pages accessing either Firebase or database properties
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

  const lastFirebaseUserRef = React.useRef<any>(undefined);
  const lastSupabaseUserRef = React.useRef<any>(undefined);

  const isVerified = useMemo(() => {
    if (!user) return false;
    return !!user.emailVerified || localStorage.getItem(`verified_${user.firebase_uid || user.uid}`) === 'true';
  }, [user]);

  // Handle resolving user identity from database by email
  const resolveAndSyncUser = async (fbUserParam?: any, sbUserParam?: any) => {
    // 1. Maintain accurate streams in our synchronization refs
    if (fbUserParam !== undefined) {
      lastFirebaseUserRef.current = fbUserParam;
    }
    if (sbUserParam !== undefined) {
      lastSupabaseUserRef.current = sbUserParam;
    }

    try {
      const fbUser = lastFirebaseUserRef.current !== undefined && lastFirebaseUserRef.current !== null ? lastFirebaseUserRef.current : auth.currentUser;
      
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
          console.warn('[UnifiedAuth] Error fetching Supabase user directly:', e);
          lastSupabaseUserRef.current = null;
          sbUser = null;
        }
      }

      const fallbackEmail = localStorage.getItem('frostybite_active_session_email');

      // If we have an active user session in either system or a valid fallback session email, we can bypass postponing and let the user in immediately!
      const possessesSession = (fbUser !== null && fbUser !== undefined) || (sbUser !== null && sbUser !== undefined) || !!fallbackEmail;

      // Check initialization states to prevent premature evaluation of logged-out status
      if (!possessesSession && (lastFirebaseUserRef.current === undefined || lastSupabaseUserRef.current === undefined)) {
        console.log('[UnifiedAuth] Postponing sync: auth systems are not both initialized yet.', {
          fbInit: lastFirebaseUserRef.current !== undefined,
          sbInit: lastSupabaseUserRef.current !== undefined
        });
        return;
      }

      const email = fbUser?.email || sbUser?.email || fallbackEmail;
      if (!email) {
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

      // 1. Get user record from Supabase Postgres
      let dbUser = null;

      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          if (idToken) {
            localStorage.setItem('latest_admin_auth_token', idToken);
          }
          const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              idToken,
              markVerified: fbUser.emailVerified || localStorage.getItem(`verified_${fbUser.uid}`) === 'true',
            }),
          });
          
          if (response.ok) {
            const resData = await response.json();
            if (resData.success && resData.user) {
              dbUser = resData.user;
              console.log('[UnifiedAuth] User identity synced & obtained securely via server API:', dbUser.email);
            }
          }
        } catch (syncErr) {
          console.warn('[UnifiedAuth] Error performing server-side sync, trying client-side fallback:', syncErr);
        }
      }

      // 2. Client-side fallback if server-side sync didn't return a record
      if (!dbUser) {
        let { data: localUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();
        
        dbUser = localUser;

        // Try matching by firebase_uid if not found by email
        if (!dbUser && fbUser?.uid) {
          const { data: fbLoc } = await supabase
            .from('users')
            .select('*')
            .eq('firebase_uid', fbUser.uid)
            .maybeSingle();
          if (fbLoc) {
            console.log(`[UnifiedAuth] Fallback cross-match found via firebase_uid: ${fbUser.uid}`);
            dbUser = fbLoc;
          }
        }

        // Try matching by supabase_uid if not found yet
        if (!dbUser && sbUser?.id) {
          const { data: sbLoc } = await supabase
            .from('users')
            .select('*')
            .eq('supabase_uid', sbUser.id)
            .maybeSingle();
          if (sbLoc) {
            console.log(`[UnifiedAuth] Fallback cross-match found via supabase_uid: ${sbUser.id}`);
            dbUser = sbLoc;
          }
        }

        if (!dbUser) {
          console.log(`[UnifiedAuth] Creating master database record via client-side fallback for ${normalizedEmail}...`);
          const methods: string[] = [];
          if (fbUser) methods.push('firebase');
          if (sbUser) methods.push('otp');

          const { data: insertedUser, error: insertError } = await supabase
            .from('users')
            .insert({
              email: normalizedEmail,
              name: displayName,
              full_name: displayName,
              avatar_url: photoURL,
              avatar: photoURL,
              firebase_uid: fbUser?.uid || null,
              supabase_uid: sbUser?.id || null,
              auth_methods: methods,
              last_login: new Date().toISOString(),
              last_login_at: new Date().toISOString(),
              role: determinedRole
            })
            .select()
            .single();

          if (insertError) {
            console.error('[UnifiedAuth] Client fallback insert error:', insertError);
          } else {
            dbUser = insertedUser;
          }
        } else {
          // 3. Keep properties synchronized or merge them
          const updates: any = {};
          const methods = dbUser.auth_methods || [];
          let updatedMethods = [...methods];

          if (dbUser.email !== normalizedEmail) {
            updates.email = normalizedEmail;
          }

          if (fbUser && fbUser.uid && dbUser.firebase_uid !== fbUser.uid) {
            updates.firebase_uid = fbUser.uid;
            if (!updatedMethods.includes('firebase')) updatedMethods.push('firebase');
          }

          if (sbUser && sbUser.id && dbUser.supabase_uid !== sbUser.id) {
            updates.supabase_uid = sbUser.id;
            if (!updatedMethods.includes('otp')) updatedMethods.push('otp');
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
      }

      // 4. Construct UnifiedUser representation mapping to .uid and all fields
      if (dbUser) {
        const unifiedUser: UnifiedUser = {
          uid: dbUser.id, // THE STABLE DB UUID
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
          emailVerified: fbUser?.emailVerified || true,
          getIdToken: async () => {
            let token: string | null = null;
            if (fbUser) {
              try {
                token = await fbUser.getIdToken();
              } catch (e) {
                console.warn('[UnifiedAuth] getIdToken from Firebase failed:', e);
              }
            }
            if (!token) {
              try {
                const { data } = await supabase.auth.getSession();
                token = data.session?.access_token || null;
              } catch (sbErr) {
                console.warn('[UnifiedAuth] getIdToken from Supabase failed:', sbErr);
              }
            }
            if (token) {
              localStorage.setItem('latest_admin_auth_token', token);
            }
            return token;
          }
        };

        setUser(unifiedUser);
        setRole(unifiedUser.role);
        try {
          localStorage.setItem('frostybite_has_active_session', 'true');
        } catch (e) {}

        // 5. Background sync to Firestore for maximum compatibility with any leftover firestore hooks
        if (fbUser?.uid) {
          try {
            const userRef = doc(db, 'users', fbUser.uid);
            await safeFirestore.set(userRef, {
              uid: fbUser.uid,
              email: dbUser.email,
              full_name: dbUser.name || dbUser.full_name || displayName,
              role: dbUser.role || determinedRole,
              badge_tier: dbUser.badge_tier || 'Foodie Starter',
              total_orders: dbUser.total_orders || 0,
              reward_points: dbUser.reward_points || 0,
              lifetime_spend: dbUser.lifetime_spend || 0,
              points: dbUser.points || 0,
              updated_at: serverTimestamp(),
            });
          } catch (fsErr) {
            console.warn('[UnifiedAuth] Compat Firestore sync warning:', fsErr);
          }
        }
      }
    } catch (error) {
      console.error('[UnifiedAuth] Error in resolveAndSyncUser:', error);
    } finally {
      const hasFb = lastFirebaseUserRef.current !== null && lastFirebaseUserRef.current !== undefined;
      const hasSb = lastSupabaseUserRef.current !== null && lastSupabaseUserRef.current !== undefined;
      const hasSession = hasFb || hasSb || !!auth.currentUser;
      const bothInitialized = lastFirebaseUserRef.current !== undefined && lastSupabaseUserRef.current !== undefined;

      if (hasSession || bothInitialized) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Dynamic safety timeout: If we have a potential session, wait up to 4000ms.
    // Otherwise, 1000ms is more than enough for guests.
    let hasPotentialSession = false;
    try {
      hasPotentialSession = !!localStorage.getItem('frostybite_active_session_email') ||
                            localStorage.getItem('frostybite_has_active_session') === 'true';
      if (!hasPotentialSession) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            hasPotentialSession = true;
            break;
          }
        }
      }
    } catch (e) {}

    const delay = 4000;

    const timeoutId = setTimeout(() => {
      console.log(`[UnifiedAuth] Safety timeout reached (${delay}ms), forcing loading false`);
      if (lastFirebaseUserRef.current === undefined) lastFirebaseUserRef.current = null;
      if (lastSupabaseUserRef.current === undefined) lastSupabaseUserRef.current = null;
      resolveAndSyncUser();
    }, delay);

    // Live listener for Firebase
    const unsubscribeFirebase = onAuthStateChanged(auth, (fbUser) => {
      console.log('[UnifiedAuth] Firebase state changed:', fbUser?.email || 'null');
      resolveAndSyncUser(fbUser, undefined);
    });

    // Live listener for Supabase login events
    const { data: { subscription: unsubscribeSupabase } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[UnifiedAuth] Supabase auth event: ${event}`, session?.user?.email || 'null');
      resolveAndSyncUser(undefined, session?.user || null);
    });

    return () => {
      unsubscribeFirebase();
      unsubscribeSupabase.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

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

      // Clean up user cached items from localStorage while preserving onboarding configurations
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
        await signOut(auth);
      } catch (_) {}
      try {
        await supabase.auth.signOut();
      } catch (_) {}
      
      setUser(null);
      setRole('customer');

      // Native clean redirection guarantees pristine React memory state and prevents black screen animation locks
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
        // Clean up user cached items from localStorage while preserving onboarding configurations
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
          await signOut(auth);
        } catch (_) {}
        try {
          await supabase.auth.signOut();
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
            {/* Backdrop with elegant blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelLogout}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            
            {/* Beautiful, premium glass card dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden text-center z-10"
            >
              {/* Radial gradient background accent */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-orange-500/10 to-transparent blur-3xl rounded-full pointer-events-none" />

              {/* Pulsing, orange-accented icon wrap */}
              <div className="relative mx-auto w-16 h-16 bg-gradient-to-b from-orange-500/15 to-orange-600/5 border border-orange-500/20 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
                <LogOut className="text-orange-500" size={24} />
                <div className="absolute inset-0 rounded-2xl bg-orange-500/10 animate-ping opacity-10 pointer-events-none" />
              </div>

              {/* Text Area */}
              <h3 className="font-sans font-extrabold text-xl text-white tracking-tight mb-2">
                Departing so soon?
              </h3>
              <p className="font-sans text-xs text-zinc-400 leading-relaxed mb-6 max-w-sm mx-auto">
                Are you sure you want to log out of Frosty Bite? We will miss serving you delicious, fresh-baked gourmet treats!
              </p>

              {/* Interactive confirmation actions */}
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
