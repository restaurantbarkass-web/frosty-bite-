import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, ShoppingBag, Truck, Info, Check, ArrowLeft, MessageCircle, 
  Smartphone, Sparkles, ExternalLink, ShieldAlert, CheckCircle2, BellRing,
  Tag, Flame, Trash2, CheckCheck, RefreshCw, Copy, CheckCircle, ChevronRight,
  Clock, Coffee, Gift
} from 'lucide-react';
import { useNotifications, Notification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { requestForToken, showDeviceNotification, getGuestSessionId, getClientMetadata } from '../utils/messaging';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, Link } from 'react-router-dom';
import { sendWhatsAppMessage } from '../utils/whatsapp';
import { RESTAURANT_WHATSAPP } from '../constants';
import { toast } from 'react-hot-toast';
import { safeFetchJson } from '../utils/safeFetch';
import { cn } from '../lib/utils';

export const Notifications: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    clearAllNotifications,
    addNotification,
    requestPushPermission,
    pushPermission 
  } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<'all' | 'orders' | 'offers' | 'freshness'>('all');
  const [permission, setPermission] = useState<NotificationPermission | 'default'>(
    typeof window !== 'undefined' ? (window.Notification?.permission || 'default') : 'default'
  );
  const [isTesting, setIsTesting] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const clientInfo = useMemo(() => getClientMetadata(), []);
  const guestSession = useMemo(() => getGuestSessionId(), []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkPermission = () => {
        if ('Notification' in window) {
          setPermission(window.Notification.permission);
        }
      };
      checkPermission();
      const interval = setInterval(checkPermission, 3000);
      return () => clearInterval(interval);
    }
  }, []);

  // Fetch or retrieve cached FCM token
  useEffect(() => {
    const cachedToken = localStorage.getItem('frostybite_fcm_token');
    if (cachedToken) {
      setFcmToken(cachedToken);
    }
  }, []);

  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Device push notifications are not supported in this browser.');
      return;
    }

    try {
      const res = await window.Notification.requestPermission();
      setPermission(res);
      
      if (res === 'granted') {
        toast.success('System notification permission granted!', { icon: '🔔' });
        const token = await requestForToken();
        if (token) {
          setFcmToken(token);
          toast.success('Connected device to Firebase Cloud Messaging (FCM)!', { icon: '✨' });
        }
      } else if (res === 'denied') {
        toast.error('Permission blocked. Please allow notifications in browser site settings.');
      }
    } catch (err) {
      console.warn('Error requesting push notification permission:', err);
      toast.error('Failed to request notification permission.');
    }
  };

  const handleTestPush = async () => {
    setIsTesting(true);
    try {
      // 1. Show local device notification via Web Notification API / Service Worker
      await showDeviceNotification('Frosty Bite Bakery 🧁', {
        body: 'Fresh morning cinnamon rolls & Belgian chocolate croissants just came out of the oven!',
        icon: '/logo_192.png',
        badge: '/logo_192.png',
        tag: 'frostybite_test_alert',
        data: { link: '/categories' }
      } as any);

      // 2. Add in-app notification record
      await addNotification({
        title: '🔥 Live FCM Cloud Alert',
        message: 'Your device is verified and linked to real-time order tracking & exclusive bakery offers.',
        type: 'promo',
        link: '/offers',
        user_id: user?.uid || user?.id || 'guest'
      });

      // 3. Trigger server push endpoint if logged in or token is registered
      if (user || fcmToken) {
        await safeFetchJson('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.uid || user?.id || 'guest',
            token: fcmToken || undefined,
            title: '🎉 Frosty Bite Push Alert',
            body: 'Your device is successfully connected to the Firebase FCM notification network!',
            data: { link: '/notifications' }
          })
        });
      }

      toast.success('Test notification dispatched successfully!', { icon: '🚀' });
    } catch (err: any) {
      console.warn('Test Push Error:', err);
      toast.error('Test notification completed with local dispatch.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyToken = () => {
    if (fcmToken) {
      navigator.clipboard.writeText(fcmToken);
      setCopiedToken(true);
      toast.success('FCM Device Token copied to clipboard!');
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  const handleAddDemoAlert = async (type: 'order' | 'promo' | 'freshness') => {
    const demos = {
      order: {
        title: '🛵 Order #FB-7842 Out for Delivery',
        message: 'Your gourmet strawberry cheesecake is on its way with our express courier.',
        type: 'order' as const,
        link: '/orders'
      },
      promo: {
        title: '🏷️ 20% OFF Weekend Treat Coupon',
        message: 'Use code "WEEKEND20" at checkout for 20% off all artisan cakes and pastries.',
        type: 'promo' as const,
        link: '/offers'
      },
      freshness: {
        title: '🥐 Morning Batch Ready in Kitchen',
        message: 'Our head pastry chef just pulled warm blueberry danishes & sourdough loaves from the oven.',
        type: 'freshness' as const,
        link: '/categories'
      }
    };

    const item = demos[type];
    await addNotification(item);
    toast.success(`Added sample ${type} notification!`);
  };

  // Filter notifications by category tab
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    if (activeCategory === 'orders') return notifications.filter(n => n.type === 'order' || n.type === 'delivery');
    if (activeCategory === 'offers') return notifications.filter(n => n.type === 'promo' || n.type === 'system');
    if (activeCategory === 'freshness') return notifications.filter(n => n.type === 'freshness');
    return notifications;
  }, [notifications, activeCategory]);

  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'order':
      case 'delivery':
        return {
          icon: <ShoppingBag size={13} className="text-[#E76A54]" />,
          label: 'Order Update',
          bg: 'bg-[#E76A54]/10 text-[#E76A54] border-[#E76A54]/20'
        };
      case 'promo':
        return {
          icon: <Tag size={13} className="text-amber-600" />,
          label: 'Special Offer',
          bg: 'bg-amber-500/10 text-amber-700 border-amber-500/20'
        };
      case 'freshness':
        return {
          icon: <Coffee size={13} className="text-emerald-600" />,
          label: 'Bakery Fresh',
          bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
        };
      default:
        return {
          icon: <Info size={13} className="text-stone-600" />,
          label: 'Notice',
          bg: 'bg-stone-500/10 text-stone-700 border-stone-500/20'
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 pt-6 pb-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button 
              type="button"
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-900">
                  Notifications & Alerts
                </h1>
                {unreadCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E76A54] text-white animate-pulse shadow-xs">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Real-time updates managed by Firebase Cloud Messaging (FCM)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {unreadCount > 0 && (
              <button 
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <CheckCheck size={14} className="text-[#E76A54]" />
                <span>Mark all read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button 
                type="button"
                onClick={clearAllNotifications}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-rose-50 text-stone-500 hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Firebase FCM Device Push Notification Control Hub */}
        <div className="bg-gradient-to-br from-stone-900 via-[#1C1816] to-[#2B1E1A] rounded-3xl p-5 sm:p-6 text-white shadow-lg border border-stone-800 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#E76A54]/15 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/15 text-[#E5A970]">
                <BellRing size={20} className={permission === 'granted' ? 'text-emerald-400' : 'animate-pulse'} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Device Push Notifications
                  </h2>
                  {permission === 'granted' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 size={11} /> Connected
                    </span>
                  ) : permission === 'denied' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <ShieldAlert size={11} /> Blocked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Action Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-300 mt-1 max-w-md leading-relaxed">
                  {permission === 'granted'
                    ? 'Your browser is linked to Firebase FCM. You will receive instant alerts for baking progress and courier delivery.'
                    : 'Enable push alerts to get real-time order updates, live courier tracking, and exclusive bakery discounts.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {permission !== 'granted' ? (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E76A54] to-[#D55943] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-transform active:scale-95 cursor-pointer"
                >
                  Enable Push Alerts
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTestPush}
                  disabled={isTesting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={13} className="text-[#E5A970]" />
                  <span>{isTesting ? 'Dispatching...' : 'Test FCM Push'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowTokenDetails(!showTokenDetails)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {showTokenDetails ? 'Hide FCM Info' : 'FCM Info'}
              </button>
            </div>
          </div>

          {/* Collapsible Device & FCM Token Details */}
          <AnimatePresence>
            {showTokenDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 pt-4 border-t border-white/10 text-xs text-stone-300 space-y-2.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block mb-0.5">Platform</span>
                    <span className="font-semibold text-white">{clientInfo.platform} ({clientInfo.browser})</span>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block mb-0.5">Customer / Session ID</span>
                    <span className="font-semibold text-white font-mono truncate block">
                      {user?.uid ? `UID: ${user.uid.slice(0, 10)}...` : guestSession.slice(0, 14)}
                    </span>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-white/10">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block mb-0.5">FCM Service State</span>
                    <span className="font-semibold text-emerald-400">Firebase Cloud Messaging Active</span>
                  </div>
                </div>

                {fcmToken && (
                  <div className="bg-black/40 p-3 rounded-xl border border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-stone-400 uppercase font-bold block mb-0.5">FCM Registration Token</span>
                      <p className="font-mono text-[11px] text-stone-300 truncate">{fcmToken}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 transition-colors cursor-pointer"
                      title="Copy FCM Token"
                    >
                      {copiedToken ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { id: 'all', label: 'All Alerts', count: notifications.length },
            { id: 'orders', label: 'Orders & Delivery 🛵', count: notifications.filter(n => n.type === 'order' || n.type === 'delivery').length },
            { id: 'offers', label: 'Offers & Perks 🏷️', count: notifications.filter(n => n.type === 'promo' || n.type === 'system').length },
            { id: 'freshness', label: 'Kitchen Freshness 🥐', count: notifications.filter(n => n.type === 'freshness').length },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id as any)}
              className={cn(
                "px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                activeCategory === tab.id
                  ? "bg-[#E76A54] text-white shadow-sm shadow-[#E76A54]/20"
                  : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80"
              )}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  activeCategory === tab.id ? "bg-white/25 text-white" : "bg-stone-100 text-stone-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications Feed */}
        {filteredNotifications.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredNotifications.map((notif) => {
                const badge = getCategoryBadge(notif.type);
                return (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => {
                      if (!notif.read) markAsRead(notif.id);
                    }}
                    className={cn(
                      "bg-white rounded-2xl p-4 sm:p-5 border transition-all relative group shadow-xs hover:shadow-md cursor-pointer",
                      !notif.read ? "border-stone-300 ring-1 ring-[#E76A54]/20 bg-amber-50/20" : "border-stone-200/80"
                    )}
                  >
                    {!notif.read && (
                      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#E76A54] animate-pulse" />
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border", badge.bg)}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        <span className="text-[11px] text-stone-400 flex items-center gap-1">
                          <Clock size={11} />
                          {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : 'Just now'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Delete notification"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h3 className={cn("text-sm sm:text-base font-bold text-stone-900 leading-snug", !notif.read && "text-stone-950")}>
                      {notif.title}
                    </h3>
                    
                    <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                      {notif.message}
                    </p>

                    {/* Action Buttons */}
                    <div className="mt-3.5 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {notif.link && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notif.id);
                              navigate(notif.link!);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            <span>View Details</span>
                            <ChevronRight size={12} />
                          </button>
                        )}

                        {notif.type === 'order' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendWhatsAppMessage(RESTAURANT_WHATSAPP, `Inquiry about: ${notif.title} - ${notif.message}`);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-colors cursor-pointer"
                          >
                            <MessageCircle size={12} />
                            <span>WhatsApp Support</span>
                          </button>
                        )}
                      </div>

                      {!notif.read && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notif.id);
                          }}
                          className="text-[11px] text-[#E76A54] hover:underline font-semibold cursor-pointer"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* Clean Empty State */
          <div className="bg-white rounded-3xl p-10 sm:p-12 border border-stone-200/80 text-center shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <Bell size={28} />
            </div>
            <div className="max-w-sm mx-auto">
              <h3 className="text-base font-serif font-bold text-stone-900">
                You're all caught up!
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                No new notifications in this category. We'll send push notifications when your order status updates or new fresh batches are ready.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/categories')}
                className="px-4 py-2 rounded-xl bg-[#E76A54] hover:bg-[#D55943] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Explore Menu
              </button>
              <button
                type="button"
                onClick={() => handleAddDemoAlert('order')}
                className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                + Demo Order Alert
              </button>
              <button
                type="button"
                onClick={() => handleAddDemoAlert('promo')}
                className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                + Demo Offer
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Notifications;
