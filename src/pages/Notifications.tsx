import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Bell, ShoppingBag, Truck, Info, Check, ArrowLeft, MessageCircle, 
  Smartphone, Sparkles, ExternalLink, ShieldAlert, CheckCircle, BellRing 
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { requestForToken, showDeviceNotification } from '../utils/messaging';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { sendWhatsAppMessage } from '../utils/whatsapp';
import { RESTAURANT_WHATSAPP } from '../constants';
import { toast } from 'react-hot-toast';

export const Notifications: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' ? (window.Notification?.permission || 'default') : 'default'
  );
  const [isInIframe, setIsInIframe] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsInIframe(window.self !== window.top);
      // Periodically check permission state in case user changes it
      const interval = setInterval(() => {
        setPermission(window.Notification?.permission || 'default');
      }, 3000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Device notifications are not standardly supported in this browser.');
      return;
    }

    try {
      const res = await window.Notification.requestPermission();
      setPermission(res);
      
      if (res === 'granted') {
        toast.success('System notification permission authorized!');
        const token = await requestForToken();
        if (token) {
          toast.success('Successfully connected device to the Frosty Bite push network!');
        }
      } else if (res === 'denied') {
        toast.error('Permission blocked. Access settings next to the URL to unlock.');
      }
    } catch (err: any) {
      console.warn('Error seeking push permissions:', err);
      toast.error('Failed to request permission.');
    }
  };

  const handleTestPush = async () => {
    setIsTesting(true);
    try {
      // 1. Show a physical native push popup via Service Worker / safe device notification helper
      await showDeviceNotification('Frosty Bite Butler', {
        body: '🧁 Fresh out of the oven! Your premium gourmet simulated cake selection has been carefully detailed and decorated.',
        icon: '/logo_192.png',
        badge: '/logo_192.png',
        tag: 'test-push-notification',
      } as any);
      toast.success('Live preview alert triggered on your device!');

      // 2. Loop with cloud endpoint FCM proxy
      if (user) {
        const response = await fetch('/api/notifications/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            title: '🔥 Live FCM Cloud Alert',
            body: 'Special custom pastry batches safely verified and ready to be delivered!',
            data: { link: '/notifications' }
          })
        });
        const data = await response.json();
        if (data.success && data.sentCount > 0) {
          toast.success('FCM cloud dispatch complete!');
        } else {
          console.log('[FCM Cloud Test] Service response:', data);
        }
      }
    } catch (err) {
      console.warn('FCM Test Error:', err);
    } finally {
      setIsTesting(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={20} className="text-primary" />;
      default: return <Info size={20} className="text-zinc-500" />;
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Activity Log</h1>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">
                {unreadCount} Unread Notifications
              </p>
            </div>
          </div>
          <button 
            onClick={markAllAsRead}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
          >
            Mark all read
          </button>
        </div>

        {/* Device Push Notifications Hub Card */}
        <div id="push-notifications-hub" className="mb-8 p-6 bg-white/5 border border-white/10 rounded-[2rem] relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                <BellRing size={22} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Device Push Notifications
                  {permission === 'granted' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500">
                      Active
                    </span>
                  )}
                  {permission === 'denied' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-500">
                      Blocked
                    </span>
                  )}
                  {permission === 'default' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500">
                      Pending
                    </span>
                  )}
                </h2>
                <p className="text-xs text-zinc-400 mt-1 max-w-lg leading-relaxed">
                  Stay updated with instant real-time alerts for your gourmet order tracking, custom chef decorations, and bakery flash status updates.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 shrink-0">
              {permission === 'default' && (
                <button
                  onClick={handleEnablePush}
                  className="px-5 py-2.5 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-wider hover:bg-primary/95 transition-all flex items-center gap-2"
                >
                  <Smartphone size={14} />
                  Authorize Device
                </button>
              )}
              {permission === 'granted' && (
                <button
                  disabled={isTesting}
                  onClick={handleTestPush}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider border border-white/5 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {isTesting ? 'Simulating...' : 'Test Device Push'}
                </button>
              )}
              {permission === 'denied' && (
                <div className="text-[10px] text-rose-500 font-bold bg-rose-500/5 px-4 py-2 border border-rose-500/10 rounded-xl max-w-xs flex gap-2">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <span>Please tap the padlock icon next to your URL in the browser address bar to reset & allow notifications.</span>
                </div>
              )}
            </div>
          </div>

          {/* Sandbox Warning Banner */}
          {isInIframe && (
            <div className="mt-5 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex gap-3">
                <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-white uppercase tracking-wider">Browser Sandbox Detected</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">
                    Browsers block service workers & push notification requests inside iframe previews for security. Open Frosty Bite in a new, direct tab to run full real-time push scenarios.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  window.open(window.location.origin, '_blank', 'noopener,noreferrer');
                }}
                className="shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Launch App Tab
                <ExternalLink size={10} />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((notif, index) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={notif.id}
                onClick={() => {
                  markAsRead(notif.id);
                  if (notif.link) navigate(notif.link);
                }}
                className={`p-6 rounded-3xl border transition-all cursor-pointer group relative overflow-hidden ${
                  !notif.read 
                    ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                {!notif.read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                )}
                
                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className={`text-lg font-bold tracking-tight ${!notif.read ? 'text-white' : 'text-zinc-400'}`}>
                        {notif.title}
                      </h3>
                      <div className="flex items-center gap-2">
                         {notif.type === 'order' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              sendWhatsAppMessage(RESTAURANT_WHATSAPP, `Order Update: ${notif.title}\n${notif.message}`);
                            }}
                            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
                          >
                            <MessageCircle size={14} />
                          </button>
                        )}
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                    </div>
                    <p className={`text-sm leading-relaxed mb-4 ${!notif.read ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                        {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : 'Just now'}
                      </p>
                      {notif.read && (
                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-700">
                          <Check size={10} />
                          Read
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 px-6 bg-white/5 border border-white/10 rounded-[2rem]">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6 text-zinc-700">
                <Bell size={40} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No activity yet</h2>
              <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                Notifications about your orders and profile updates will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;
