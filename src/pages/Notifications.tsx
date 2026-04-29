import React from 'react';
import { motion } from 'motion/react';
import { Bell, ShoppingBag, Truck, Info, Check, ArrowLeft, MessageCircle } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { sendWhatsAppMessage } from '../utils/whatsapp';
import { RESTAURANT_WHATSAPP } from '../constants';

export const Notifications: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={20} className="text-primary" />;
      case 'rider': return <Truck size={20} className="text-blue-500" />;
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
                        {notif.createdAt ? (
                          (() => {
                            const ca = notif.createdAt;
                            let date: Date;
                            if (typeof ca.toDate === 'function') date = ca.toDate();
                            else if (ca.seconds) date = new Date(ca.seconds * 1000);
                            else date = new Date(ca);
                            return formatDistanceToNow(date, { addSuffix: true });
                          })()
                        ) : 'Just now'}
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
