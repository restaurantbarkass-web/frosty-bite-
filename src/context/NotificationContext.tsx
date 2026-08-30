import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';
import { showDeviceNotification } from '../utils/messaging';
import { formatOrderId } from '../utils/orderUtils';

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

  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Load notifications from local storage on user state change or mount
  useEffect(() => {
    const uid = user ? (user.id || user.uid || 'guest') : 'guest';
    const cacheKey = `user_notifications_${uid}`;
    
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(cacheKey);
    } catch (e) {
      console.warn('Failed to read notifications from localStorage:', e);
    }

    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached);
        const list: Notification[] = Array.isArray(parsed) ? parsed : (parsed.data || []);
        setNotifications(list);
      } catch (e) {
        setNotifications([]);
      }
    } else {
      // First-time visit: Start with clean empty list so no false unread notifications pop up on refresh
      setNotifications([]);
    }

    // Admin new order monitor using Supabase Realtime
    let unsubAdminOrders: (() => void) | null = null;
    if (isAdmin || role === 'admin') {
      const stableUid = user ? (user.id || user.uid || 'admin') : 'admin';
      const sessionStartTime = Date.now();
      const seenOrderIds = new Set<string>();

      const channel = supabase
        .channel(`admin_order_monitor_${Date.now()}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'orders' 
        }, (payload) => {
          const latestOrder = payload.new as any;
          if (!latestOrder || !latestOrder.id) return;
          
          // Avoid duplicate triggers
          if (seenOrderIds.has(latestOrder.id)) return;
          seenOrderIds.add(latestOrder.id);

          // Discard older existing orders if sent during initial channel subscription
          const orderTime = latestOrder.created_at ? new Date(latestOrder.created_at).getTime() : Date.now();
          if (orderTime < sessionStartTime - 5000) {
            return;
          }

          // Genuine live incoming order
          if (latestOrder.status === 'pending') {
            setIncomingOrder(latestOrder);
          }
          
          toast.success(`New Order #${formatOrderId(latestOrder.id)} received!`, {
            duration: 8000,
            icon: '🍕'
          });

          if (!window.location.pathname.includes('/admin')) {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
          }

          showDeviceNotification('New Order Received!', {
            body: `${latestOrder.customer_name} placed an order for ₹${latestOrder.total}`,
            icon: 'https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg'
          });

          // Save notification locally for admin
          const newNotif: Notification = {
            id: `order-notif-${latestOrder.id}`,
            title: 'New Order Received! 🍕',
            message: `${latestOrder.customer_name} placed order #${formatOrderId(latestOrder.id)} for ₹${latestOrder.total}`,
            type: 'order',
            read: false,
            created_at: new Date().toISOString(),
            user_id: stableUid,
            link: `/admin/orders?id=${latestOrder.id}`
          };

          setNotifications(prev => {
            if (prev.some(n => n.id === newNotif.id)) return prev;
            const updated = [newNotif, ...prev];
            try {
              localStorage.setItem(cacheKey, JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to write notifications to localStorage:', e);
            }
            return updated;
          });
        })
        .subscribe();

      unsubAdminOrders = () => {
        supabase.removeChannel(channel);
      };
    }

    return () => {
      if (unsubAdminOrders) unsubAdminOrders();
    };
  }, [user?.id, user?.uid, role, isAdmin]);

  // Compute strictly unread items
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = React.useCallback(async (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      const currentUser = userRef.current;
      const uid = currentUser ? (currentUser.id || currentUser.uid || 'guest') : 'guest';
      const cacheKey = `user_notifications_${uid}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to write notifications to localStorage:', e);
      }
      return updated;
    });
  }, []);

  const markAllAsRead = React.useCallback(async () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      const currentUser = userRef.current;
      const uid = currentUser ? (currentUser.id || currentUser.uid || 'guest') : 'guest';
      const cacheKey = `user_notifications_${uid}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to write notifications to localStorage:', e);
      }
      return updated;
    });
    toast.success('All notifications marked as read');
  }, []);

  const addNotification = React.useCallback(async (notif: Omit<Notification, 'id' | 'created_at' | 'read'>) => {
    const currentUser = userRef.current;
    const targetUserId = notif.user_id || (currentUser ? (currentUser.id || currentUser.uid) : 'guest') || 'guest';

    const newNotif: Notification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      created_at: new Date().toISOString(),
      user_id: targetUserId
    };

    setNotifications(prev => {
      // Prevent exact duplicate notifications within short time window
      if (prev.some(p => p.id === newNotif.id || (p.title === newNotif.title && p.message === newNotif.message && Math.abs(new Date(p.created_at).getTime() - new Date(newNotif.created_at).getTime()) < 3000))) {
        return prev;
      }
      const updated = [newNotif, ...prev];
      const cacheKey = `user_notifications_${targetUserId}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to write notifications to localStorage:', e);
      }
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
