import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, ShoppingBag, Truck, Info, X, MessageCircle } from 'lucide-react';
import { useNotifications, Notification } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { sendWhatsAppMessage } from '../utils/whatsapp';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={14} className="text-primary" />;
      case 'rider': return <Truck size={14} className="text-blue-500" />;
      default: return <Info size={14} className="text-zinc-500" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed sm:absolute top-24 sm:top-full left-4 right-4 sm:left-auto sm:right-0 sm:mt-4 sm:w-80 bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden backdrop-blur-2xl"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-primary text-white text-[8px] font-black rounded-full">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
              {notifications.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {notifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      className={`p-5 hover:bg-white/5 transition-colors cursor-pointer relative group ${!notif.read ? 'bg-primary/5' : ''}`}
                    >
                      {!notif.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0`}>
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className={`text-xs font-bold ${!notif.read ? 'text-white' : 'text-zinc-400'}`}>
                              {notif.title}
                            </p>
                            {notif.type === 'order' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendWhatsAppMessage('9999999999', `Order: ${notif.title}\nDetails: ${notif.message}`);
                                }}
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
                                title="Share to WhatsApp"
                              >
                                <MessageCircle size={10} />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 line-clamp-2 mb-2">
                            {notif.message}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                            {notif.createdAt ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-zinc-700">
                    <Bell size={32} />
                  </div>
                  <p className="text-xs font-bold text-zinc-500">No notifications yet</p>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-4 bg-white/5 text-center">
                <button className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
                  View all activity
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
