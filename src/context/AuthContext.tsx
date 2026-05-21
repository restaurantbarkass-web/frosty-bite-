import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import { ADMIN_EMAILS, getRoleFromEmail } from '../constants';
import { supabase } from '../supabase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { safeFirestore } from '../services/firestoreService';

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
}

interface AuthContextType {
  user: any; // We type as any to support seamless integration in pages accessing either Firebase or database properties
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  isVerified: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const isVerified = useMemo(() => {
    if (!user) return false;
    return !!user.emailVerified || localStorage.getItem(`verified_${user.firebase_uid || user.uid}`) === 'true';
  }, [user]);

  // Handle resolving user identity from database by email
  const resolveAndSyncUser = async () => {
    try {
      const fbUser = auth.currentUser;
      const { data: sbData } = await supabase.auth.getUser();
      const sbUser = sbData?.user || null;

      const email = fbUser?.email || sbUser?.email;
      if (!email) {
        setUser(null);
        setRole('customer');
        setLoading(false);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      console.log(`[UnifiedAuth] Resolving identity for: ${normalizedEmail}`);

      // 1. Get user record from Supabase Postgres
      let { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      const defaultName = normalizedEmail.split('@')[0];
      const determinedRole = getRoleFromEmail(normalizedEmail);
      const displayName = fbUser?.displayName || sbUser?.user_metadata?.full_name || sbUser?.user_metadata?.name || defaultName;
      const photoURL = fbUser?.photoURL || sbUser?.user_metadata?.avatar_url || null;

      // 2. If it does not exist, insert a master profile
      if (!dbUser) {
        console.log(`[UnifiedAuth] Creating master database record for ${normalizedEmail}...`);
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
          console.error('[UnifiedAuth] Error inserting master profile:', insertError);
        } else {
          dbUser = insertedUser;
        }
      } else {
        // 3. Keep properties synchronized or merge them
        const updates: any = {};
        const methods = dbUser.auth_methods || [];
        let updatedMethods = [...methods];

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
            .eq('email', normalizedEmail)
            .select()
            .single();
          if (updatedUser) dbUser = updatedUser;
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
          emailVerified: fbUser?.emailVerified || true
        };

        setUser(unifiedUser);
        setRole(unifiedUser.role);

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
    } catch (err) {
      console.error('[UnifiedAuth] Error in status resolver:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 8-second safety timeout
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // Live listener for Firebase
    const unsubscribeFirebase = onAuthStateChanged(auth, () => {
      console.log('[UnifiedAuth] Firebase state changed');
      resolveAndSyncUser();
    });

    // Live listener for Supabase login events
    const { data: { subscription: unsubscribeSupabase } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[UnifiedAuth] Supabase auth event: ${event}`);
      resolveAndSyncUser();
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
    logout: async () => {
      try {
        await auth.signOut();
      } catch (_) {}
      try {
        await supabase.auth.signOut();
      } catch (_) {}
      setUser(null);
      setRole('customer');
    },
    refreshProfile: async () => {
      await resolveAndSyncUser();
    }
  }), [user, role, loading, isVerified]);

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingScreen /> : children}
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
