import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';
import { showDeviceNotification, requestForToken } from '../utils/messaging';
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
  requestPushPermission: () => Promise<boolean>;
  pushPermission: NotificationPermission | 'default';
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, isAdmin } = useAuth() as any;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [incomingOrder, setIncomingOrder] = useState<any | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'default'>(() => {
    return (typeof window !== 'undefined' && 'Notification' in window) ? window.Notification.permission : 'default';
  });

  const userRef = useRef(user);
  const orderStatusMapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const requestPushPermission = React.useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Device notifications are not supported by this browser.');
      return false;
    }

    try {
      const res = await window.Notification.requestPermission();
      setPushPermission(res);
      if (res === 'granted') {
        toast.success('Push notifications enabled for order alerts!', { icon: '🔔' });
        await requestForToken();
        return true;
      } else {
        toast.error('Push notification permission was denied.');
        return false;
      }
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return false;
    }
  }, []);

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
      setNotifications([]);
    }

    // 1. Admin new order monitor using Supabase Realtime
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
          
          if (seenOrderIds.has(latestOrder.id)) return;
          seenOrderIds.add(latestOrder.id);

          const orderTime = latestOrder.created_at ? new Date(latestOrder.created_at).getTime() : Date.now();
          if (orderTime < sessionStartTime - 5000) {
            return;
          }

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

          showDeviceNotification('New Order Received! 🍕', {
            body: `${latestOrder.customer_name} placed order #${formatOrderId(latestOrder.id)} for ₹${latestOrder.total}`,
            icon: 'https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg',
            tag: `admin_order_${latestOrder.id}`,
            data: {
              link: `/admin/orders?id=${latestOrder.id}`,
              url: `/admin/orders?id=${latestOrder.id}`
            }
          });

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

    // 2. Customer Order Lifecycle & Background Push Notifications (Preparing -> Out for Delivery -> Delivered)
    let unsubCustomerOrders: (() => void) | null = null;
    const currentUid = user ? (user.id || user.uid) : null;
    
    // Subscribe to customer order updates
    const customerChannel = supabase
      .channel(`customer_order_monitor_${currentUid || 'guest'}_${Date.now()}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        const updatedOrder = payload.new as any;
        if (!updatedOrder || !updatedOrder.id) return;

        // Check if this order belongs to current logged in user or guest session
        const isUserOrder = currentUid && (updatedOrder.user_id === currentUid || updatedOrder.user_id === user?.email);
        const lastGuestOrderId = localStorage.getItem('frostybite_last_order_id');
        const isGuestTracked = !currentUid && lastGuestOrderId === updatedOrder.id;

        if (!isUserOrder && !isGuestTracked && !isAdmin) {
          return;
        }

        const prevStatus = orderStatusMapRef.current[updatedOrder.id];
        const newStatus = updatedOrder.status;
        orderStatusMapRef.current[updatedOrder.id] = newStatus;

        // If status changed or not tracked yet
        if (prevStatus && prevStatus !== newStatus) {
          let title = '';
          let message = '';
          let icon = 'https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg';
          let toastIcon = '📦';

          const formattedId = formatOrderId(updatedOrder.id);

          switch (newStatus) {
            case 'preparing':
              title = '👩‍🍳 Order is in the Oven!';
              message = `Chef is preparing and baking your order #${formattedId}.`;
              toastIcon = '👩‍🍳';
              break;
            case 'out_for_delivery':
              title = '🚀 Out for Delivery!';
              message = `Your rider is on the way with order #${formattedId}!`;
              toastIcon = '🛵';
              break;
            case 'delivered':
              title = '🎉 Order Delivered!';
              message = `Order #${formattedId} was successfully delivered. Enjoy your delicious treats!`;
              toastIcon = '🍰';
              break;
            case 'confirmed':
              title = '✅ Order Confirmed!';
              message = `Payment confirmed & order #${formattedId} is queued in kitchen.`;
              toastIcon = '✅';
              break;
            case 'cancelled':
              title = '❌ Order Cancelled';
              message = `Order #${formattedId} was cancelled. ${updatedOrder.cancellation_reason || updatedOrder.notes || ''}`;
              toastIcon = '⚠️';
              break;
            default:
              title = `Order Status: ${newStatus.replace(/_/g, ' ')}`;
              message = `Order #${formattedId} updated to ${newStatus}.`;
              break;
          }

          if (title) {
            // In-app alert
            toast(message, {
              icon: toastIcon,
              duration: 7000,
              style: {
                borderRadius: '16px',
                background: '#18181b',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)'
              }
            });

            // Audio alert
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
              audio.play().catch(() => {});
            } catch (_) {}

            // OS/Web/PWA System Push Notification (works even if minimized or screen is locked)
            showDeviceNotification(title, {
              body: message,
              icon,
              badge: icon,
              tag: `order_${updatedOrder.id}_${newStatus}`,
              data: {
                link: `/order-tracking/${updatedOrder.id}`,
                url: `/order-tracking/${updatedOrder.id}`,
                orderId: updatedOrder.id
              }
            });

            // Save to notifications history
            const notifItem: Notification = {
              id: `status-${updatedOrder.id}-${newStatus}-${Date.now()}`,
              title,
              message,
              type: 'order',
              read: false,
              created_at: new Date().toISOString(),
              user_id: uid,
              link: `/order-tracking/${updatedOrder.id}`
            };

            setNotifications(prev => {
              if (prev.some(n => n.id === notifItem.id)) return prev;
              const updated = [notifItem, ...prev];
              try {
                localStorage.setItem(cacheKey, JSON.stringify(updated));
              } catch (e) {
                console.warn('Failed to write notifications to localStorage:', e);
              }
              return updated;
            });
          }
        }
      })
      .subscribe();

    unsubCustomerOrders = () => {
      supabase.removeChannel(customerChannel);
    };

    return () => {
      if (unsubAdminOrders) unsubAdminOrders();
      if (unsubCustomerOrders) unsubCustomerOrders();
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
    addNotification,
    requestPushPermission,
    pushPermission
  }), [notifications, unreadCount, incomingOrder, markAsRead, markAllAsRead, addNotification, requestPushPermission, pushPermission]);

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

