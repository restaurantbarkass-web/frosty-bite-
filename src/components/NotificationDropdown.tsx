import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, ShoppingBag, Info, X, MessageCircle } from 'lucide-react';
import { useNotifications, Notification } from '../context/NotificationContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { sendWhatsAppMessage } from '../utils/whatsapp';

import { RESTAURANT_WHATSAPP } from '../constants';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={14} className="text-primary" />;
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
            className="fixed sm:absolute inset-x-2 top-24 sm:top-full sm:inset-auto sm:right-0 sm:mt-4 w-auto sm:w-80 bg-white border border-stone-200/90 rounded-3xl shadow-2xl z-[100] overflow-hidden mx-auto sm:mx-0 max-w-[calc(100vw-1rem)]"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-stone-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-primary text-white text-[8px] font-black rounded-full">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <button 
                onClick={markAllAsRead}
                className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-700 transition-colors"
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
              {notifications.length > 0 ? (
                <div className="divide-y divide-stone-100">
                  {notifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      onClick={() => {
                        markAsRead(notif.id);
                        if (notif.link) {
                          onClose();
                          navigate(notif.link);
                        }
                      }}
                      className={`p-5 hover:bg-stone-50 transition-colors cursor-pointer relative group ${!notif.read ? 'bg-orange-50/50' : ''}`}
                    >
                      {!notif.read && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 text-stone-700`}>
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className={`text-xs font-bold ${!notif.read ? 'text-stone-900' : 'text-stone-600'}`}>
                              {notif.title}
                            </p>
                            {notif.type === 'order' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendWhatsAppMessage(RESTAURANT_WHATSAPP, `Order: ${notif.title}\nDetails: ${notif.message}`);
                                }}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all"
                                title="Share to WhatsApp"
                              >
                                <MessageCircle size={10} />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-500 line-clamp-2 mb-2">
                            {notif.message}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">
                            {notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : 'Just now'}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4 text-stone-400">
                    <Bell size={32} />
                  </div>
                  <p className="text-xs font-bold text-stone-500">No notifications yet</p>
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-4 bg-stone-50 border-t border-stone-100 text-center">
                <button 
                  onClick={() => {
                    onClose();
                    navigate('/notifications');
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-stone-600 hover:text-stone-900 transition-colors"
                >
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
