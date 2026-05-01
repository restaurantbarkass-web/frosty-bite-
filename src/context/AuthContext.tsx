import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import { ADMIN_EMAILS, RIDER_EMAILS, getRoleFromEmail } from '../constants';

type UserRole = 'customer' | 'admin' | 'rider';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isRider: boolean;
  isCustomer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 15000);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Sync with Firestore (the primary data source)
        await syncUserWithFirestore(currentUser);
        await fetchRole(currentUser);
      } else {
        setRole('customer');
        setLoading(false);
      }
    });

    const syncUserWithFirestore = async (firebaseUser: User) => {
      try {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Determine role from email if not already set or needing update
        const determinedRole = getRoleFromEmail(firebaseUser.email);
        
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          full_name: firebaseUser.displayName || '',
          role: determinedRole,
          updated_at: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error('Failed to sync user with Firestore:', err);
      }
    };

    const fetchRole = async (currentUser: User) => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role) {
            setRole(userData.role as UserRole);
          } else {
            setRole(getRoleFromEmail(currentUser.email) as UserRole);
          }
        } else {
          setRole(getRoleFromEmail(currentUser.email) as UserRole);
        }
      } catch (error) {
        console.warn('Error fetching user role from Firestore, falling back to email whitelist:', error);
        setRole(getRoleFromEmail(currentUser.email) as UserRole);
      } finally {
        setLoading(false);
      }
    };

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const value = {
    user,
    role,
    loading,
    isAdmin: role === 'admin' || (!!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())),
    isRider: role === 'rider' || (!!user?.email && RIDER_EMAILS.includes(user.email.toLowerCase())),
    isCustomer: role === 'customer',
  };

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
