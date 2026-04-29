import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'system' | 'rider';
  read: boolean;
  createdAt: any;
  userId: string;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    // NEW: For admins, listen to all NEW orders to show global toasts/notifications
    let unsubscribeOrders: (() => void) | null = null;
    
    if (isAdmin || role === 'admin' || user.email === 'restaurantbarkass@gmail.com') {
      const ordersQuery = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      const knownOrderIds = new Set<string>();
      let isInitialLoad = true;

      unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
        if (isInitialLoad) {
          snapshot.docs.forEach(doc => knownOrderIds.add(doc.id));
          isInitialLoad = false;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const order = { id: change.doc.id, ...change.doc.data() } as any;
            if (!knownOrderIds.has(order.id)) {
              knownOrderIds.add(order.id);
              
              // Show toast
              toast.success(`New Order #${order.id.slice(-6).toUpperCase()} received!`, {
                duration: 8000,
                icon: '🍕'
              });

              // Play sound (if not on orders page which has its own alarm)
              if (!window.location.pathname.includes('/admin')) {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(() => {});
              }

              // Browser notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('New Order Received!', {
                  body: `${order.customerName} placed an order for ₹${order.total}`,
                  icon: '/logo.png'
                });
              }
            }
          }
        });
      }, (error) => {
        console.warn('Admin orders listener error:', error.message);
      });
    }

    // Existing notification listener
    const cacheKey = `notifications_cache_${user.uid}`;
    // ... rest of existing listener
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setNotifications(JSON.parse(cached));
      } catch (e) {}
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      // Client-side sort and limit
      const sortedNotifs = notifs.sort((a, b) => {
        const getTime = (notif: Notification) => {
          if (!notif.createdAt) return Date.now();
          if (typeof notif.createdAt.toDate === 'function') return notif.createdAt.toDate().getTime();
          if (notif.createdAt.seconds) return notif.createdAt.seconds * 1000;
          if (typeof notif.createdAt === 'string') return new Date(notif.createdAt).getTime();
          return Date.now();
        };
        return getTime(b) - getTime(a);
      }).slice(0, 50); // Show more notifications

      setNotifications(sortedNotifs);
      localStorage.setItem(cacheKey, JSON.stringify(sortedNotifs));
    }, (error) => {
      const isQuota = error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('limit exceeded');
      if (!isQuota) {
        console.error('Error fetching notifications:', error);
      } else {
        console.warn('Firestore Quota Exceeded for notifications. Using cache if available.');
        // If we have nothing in state, double check cache
        if (notifications.length === 0) {
          const lastResort = localStorage.getItem(cacheKey);
          if (lastResort) {
            try { setNotifications(JSON.parse(lastResort)); } catch (e) {}
          }
        }
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [user, role, isAdmin]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = async (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notif,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead,
      addNotification 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
