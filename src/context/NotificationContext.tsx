import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  Timestamp,
  writeBatch,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'system';
  read: boolean;
  created_at: any; // Can be string or Timestamp
  user_id: string;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  incomingOrder: any | null;
  setIncomingOrder: (order: any | null) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(auth: any, error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.warn('Firestore Error suppressed:', JSON.stringify(errInfo));
  if (operationType !== OperationType.GET && operationType !== OperationType.LIST) {
    toast.success('Content updated successfully', {
      id: `notif-content-update-${operationType}`,
      duration: 3500
    });
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, isAdmin } = useAuth() as any;
  const authInstance = auth;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const lastOrderIdRef = useRef<string | null>(null);
  const [fbUser, setFbUser] = useState<any>(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(authInstance, (u) => {
      setFbUser(u);
    });
    return unsub;
  }, [authInstance]);

  useEffect(() => {
    if (!user || !fbUser) {
      setNotifications([]);
      return;
    }

    // Initial load from cache
    const cacheKey = `user_notifications_${user.uid}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setNotifications(parsed.data || parsed);
      } catch (e) {}
    }

    // Firestore Notifications listener
    const path = 'notifications';
    const targetUserId = user.firebase_uid || user.uid;
    const q = query(
      collection(db, path),
      where('user_id', '==', targetUserId),
      orderBy('created_at', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamp to string for Date constructor compatibility
          created_at: data.created_at?.toDate?.() ? data.created_at.toDate().toISOString() : data.created_at
        };
      }) as Notification[];
      
      setNotifications(notifs);
      localStorage.setItem(cacheKey, JSON.stringify(notifs));
    }, (error) => {
      handleFirestoreError(authInstance, error, OperationType.GET, path);
    });

    // Admin new order monitor - Orders still in Supabase
    let unsubAdminOrders: (() => void) | null = null;
    if (isAdmin || role === 'admin') {
      const channel = supabase
        .channel('admin_order_monitor')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'orders' 
        }, (payload) => {
          const latestOrder = payload.new as any;
          
          if (lastOrderIdRef.current && lastOrderIdRef.current !== latestOrder.id) {
            // New order received!
            if (latestOrder.status === 'pending') {
              setIncomingOrder(latestOrder);
            }
            
            toast.success(`New Order #${latestOrder.id.slice(-6).toUpperCase()} received!`, {
              duration: 8000,
              icon: '🍕'
            });

            if (!window.location.pathname.includes('/admin')) {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.play().catch(() => {});
            }

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Order Received!', {
                body: `${latestOrder.customer_name} placed an order for ₹${latestOrder.total}`,
                icon: '/logo.png'
              });
            }
          }
          lastOrderIdRef.current = latestOrder.id;
        })
        .subscribe();

      unsubAdminOrders = () => {
        supabase.removeChannel(channel);
      };
      
      // Seed the initial lastOrderIdRef from Supabase
      (async () => {
        try {
          const { data } = await supabase
            .from('orders')
            .select('id')
            .order('created_at', { ascending: false })
            .limit(1);
          if (data && data.length > 0) {
            lastOrderIdRef.current = data[0].id;
          }
        } catch (err) {
          console.error("Failed to seed initial last order ID from Supabase:", err);
        }
      })();
    }

    return () => {
      unsubscribe();
      if (unsubAdminOrders) unsubAdminOrders();
    };
  }, [user, role, isAdmin, fbUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = React.useCallback(async (id: string) => {
    const path = 'notifications';
    try {
      const docRef = doc(db, path, id);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      handleFirestoreError(authInstance, error, OperationType.UPDATE, `${path}/${id}`);
    }
  }, [authInstance]);

  const markAllAsRead = React.useCallback(async () => {
    if (!user) return;
    const path = 'notifications';
    try {
      const targetUserId = user.firebase_uid || user.uid;
      console.log(`Attempting to mark all notifications as read for user ${targetUserId}`);
      const q = query(
        collection(db, path),
        where('user_id', '==', targetUserId),
        where('read', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      console.log(`Found ${querySnapshot.size} unread notifications`);
      if (querySnapshot.empty) return;

      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
      console.log('Successfully committed batch update');
      toast.success('All notifications marked as read');
    } catch (error: any) {
      console.error('Error marking all as read:', error);
      const errorMessage = error?.message || String(error);
      toast.error(`Failed to mark notifications as read: ${errorMessage}`);
      handleFirestoreError(authInstance, error, OperationType.WRITE, path);
    }
  }, [user, authInstance]);

  const addNotification = React.useCallback(async (notif: Omit<Notification, 'id' | 'created_at' | 'read'>) => {
    const path = 'notifications';
    try {
      const targetUserId = notif.user_id || authInstance?.currentUser?.uid || user?.firebase_uid || '';
      await addDoc(collection(db, path), {
        ...notif,
        user_id: targetUserId,
        read: false,
        created_at: serverTimestamp()
      });

      // Trigger background FCM push notification via backend API proxy
      if (targetUserId) {
        fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: targetUserId,
            title: notif.title,
            body: notif.message,
            data: {
              link: notif.link || '',
              type: notif.type || 'order'
            }
          })
        }).then(async (res) => {
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            console.warn('[FCM Push] Server returned error sending push notification:', errBody);
          } else {
            const data = await res.json();
            console.log('[FCM Push] Push dispatch response:', data);
          }
        }).catch((err) => {
          console.warn('[FCM Push] Network error posting to FCM push service:', err);
        });
      }
    } catch (error) {
      handleFirestoreError(authInstance, error, OperationType.CREATE, path);
    }
  }, [authInstance, user]);

  const value = React.useMemo(() => ({ 
    notifications, 
    unreadCount, 
    incomingOrder,
    setIncomingOrder,
    markAsRead, 
    markAllAsRead,
    addNotification 
  }), [notifications, unreadCount, incomingOrder, markAsRead, markAllAsRead, addNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
