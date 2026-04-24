import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
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
    let unsubscribeRole: (() => void) | null = null;

    // Safety timeout to prevent infinite loading/black screen
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timed out. Proceeding with default state.');
        setLoading(false);
      }
    }, 8000);

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // Clear any existing role listener
      if (unsubscribeRole) {
        unsubscribeRole();
        unsubscribeRole = null;
      }

      setUser(currentUser);
      
      if (currentUser) {
        const startSnapshot = () => {
          unsubscribeRole = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data();
              setRole(userData.role as UserRole);
            } else {
              // Fallback to email whitelist if doc doesn't exist yet
              setRole(getRoleFromEmail(currentUser.email));
            }
            setLoading(false);
          }, (error) => {
            console.error('Error fetching user role:', error);
            try {
              handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`, currentUser);
            } catch (handledError) {
              // Fallback
              setRole(getRoleFromEmail(currentUser.email));
            }
            setLoading(false);
          });
        };

        startSnapshot();
      } else {
        setRole('customer');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeRole) unsubscribeRole();
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
