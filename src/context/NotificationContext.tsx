import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, addDoc, updateDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { safeFirestore } from '../services/firestoreService';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../supabase';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'system' | 'rider';
  read: boolean;
  created_at: string;
  user_id: string;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const lastOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
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

    // Notifications listener
    const qNotif = query(
      collection(db, 'notifications'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc'),
      limit(50)
    );

    const unsubNotif = safeFirestore.listen(qNotif, (data: Notification[]) => {
      setNotifications(data);
    }, cacheKey);

    // Admin new order monitor
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
      
      // Seed the initial lastOrderIdRef
      supabase
        .from('orders')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            lastOrderIdRef.current = data[0].id;
          }
        });
    }

    return () => {
      unsubNotif();
      if (unsubAdminOrders) unsubAdminOrders();
    };
  }, [user, role, isAdmin]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('user_id', '==', user.uid),
        where('read', '==', false)
      );
      
      const unreadDocs = await safeFirestore.getCollection<Notification>(q, `unread_notifs_${user.uid}`, 'notifications');
      
      if (unreadDocs.length === 0) return;
      
      const batch = writeBatch(db);
      unreadDocs.forEach((d) => {
        batch.update(doc(db, 'notifications', d.id), { read: true });
      });
      await batch.commit();
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = async (notif: Omit<Notification, 'id' | 'created_at' | 'read'>) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notif,
        read: false,
        created_at: new Date().toISOString()
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
