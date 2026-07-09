import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'system';
  read: boolean;
  created_at: string;
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

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, isAdmin } = useAuth() as any;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const lastOrderIdRef = useRef<string | null>(null);

  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Load notifications from local storage on auth state change
  useEffect(() => {
    const currentUser = userRef.current;
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const cacheKey = `user_notifications_${currentUser.id || currentUser.uid}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setNotifications(Array.isArray(parsed) ? parsed : (parsed.data || []));
      } catch (e) {
        setNotifications([]);
      }
    } else {
      // Default initial welcome notification if none exist
      const welcomeNotif: Notification = {
        id: `welcome-${Date.now()}`,
        title: 'Welcome to Frosty Bite! ✨',
        message: 'Explore our curated premium menu and start earning loyalty points today.',
        type: 'system',
        read: false,
        created_at: new Date().toISOString(),
        user_id: currentUser.id || currentUser.uid
      };
      setNotifications([welcomeNotif]);
      localStorage.setItem(cacheKey, JSON.stringify([welcomeNotif]));
    }

    // Admin new order monitor using Supabase Realtime
    let unsubAdminOrders: (() => void) | null = null;
    if (isAdmin || role === 'admin') {
      const stableUid = currentUser.id || currentUser.uid;
      const channel = supabase
        .channel('admin_order_monitor_notifications')
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

            // Also save a notification locally for the admin
            const newNotif: Notification = {
              id: `order-notif-${latestOrder.id}`,
              title: 'New Order Received! 🍕',
              message: `${latestOrder.customer_name} placed order #${latestOrder.id.slice(-6).toUpperCase()} for ₹${latestOrder.total}`,
              type: 'order',
              read: false,
              created_at: new Date().toISOString(),
              user_id: stableUid,
              link: `/admin/orders?id=${latestOrder.id}`
            };

            setNotifications(prev => {
              const updated = [newNotif, ...prev];
              localStorage.setItem(cacheKey, JSON.stringify(updated));
              return updated;
            });
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
      if (unsubAdminOrders) unsubAdminOrders();
    };
  }, [user?.id, user?.uid, role, isAdmin]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = React.useCallback(async (id: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      const cacheKey = `user_notifications_${currentUser.id || currentUser.uid}`;
      localStorage.setItem(cacheKey, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const markAllAsRead = React.useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      const cacheKey = `user_notifications_${currentUser.id || currentUser.uid}`;
      localStorage.setItem(cacheKey, JSON.stringify(updated));
      return updated;
    });
    toast.success('All notifications marked as read');
  }, []);

  const addNotification = React.useCallback(async (notif: Omit<Notification, 'id' | 'created_at' | 'read'>) => {
    const currentUser = userRef.current;
    const targetUserId = notif.user_id || currentUser?.id || currentUser?.uid || '';
    if (!targetUserId) return;

    const newNotif: Notification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      created_at: new Date().toISOString(),
      user_id: targetUserId
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      const cacheKey = `user_notifications_${targetUserId}`;
      localStorage.setItem(cacheKey, JSON.stringify(updated));
      return updated;
    });

    // Trigger FCM push notification via backend API proxy if supported
    try {
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
      }).catch((err) => {
        console.warn('[FCM Push] Network warning posting to FCM push service:', err);
      });
    } catch (err) {
      console.warn('[FCM Push] Failed to trigger push notification:', err);
    }
  }, []);

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
