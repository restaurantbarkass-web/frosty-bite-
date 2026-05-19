import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import { ADMIN_EMAILS, getRoleFromEmail } from '../constants';
import { supabase } from '../supabase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { safeFirestore } from '../services/firestoreService';

type UserRole = 'customer' | 'admin';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
  isVerified: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const isVerified = !!user?.emailVerified;

  useEffect(() => {
    // 8-second safety timeout
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 8000);

    const syncUserWithSupabase = async (firebaseUser: User) => {
      try {
        const determinedRole = getRoleFromEmail(firebaseUser.email);
        
        // Firestore Sync
        const userRef = doc(db, 'users', firebaseUser.uid);
        await safeFirestore.set(userRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          full_name: firebaseUser.displayName || '',
          role: determinedRole,
          updated_at: serverTimestamp()
        });

        // Supabase Sync
        const { error } = await supabase
          .from('users')
          .upsert({
            id: firebaseUser.uid,
            email: firebaseUser.email,
            full_name: firebaseUser.displayName || '',
            role: determinedRole,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        
        if (error) console.warn('Supabase sync warning:', error);
      } catch (err) {
        console.warn('Failed to sync user:', err);
      }
    };

    const fetchRole = async (currentUser: User) => {
      // First try Supabase
      try {
        const { data, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', currentUser.uid)
          .single();
        
        if (data && data.role) {
          setRole(data.role as UserRole);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Supabase role fetch failed:', err);
      }

      // Fallback to Email Whitelist
      setRole(getRoleFromEmail(currentUser.email) as UserRole);
      setLoading(false);
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Parallel sync
        syncUserWithSupabase(currentUser);
        fetchRole(currentUser);
      } else {
        setRole('customer');
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const value = React.useMemo(() => ({
    user,
    role,
    loading,
    isVerified,
    isAdmin: role === 'admin' || (!!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())),
    isCustomer: role === 'customer',
    logout: async () => {
      await auth.signOut();
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
