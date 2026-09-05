import React, { useState } from 'react';
import { Bell, Search, User, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationDropdown } from '../NotificationDropdown';

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      // User cancelled logout
      console.log('Logout action cancelled by user');
    }
  };

  return (
    <header className="h-16 sm:h-20 bg-white/90 backdrop-blur-xl border-b border-stone-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2.5 rounded-2xl bg-stone-100 border border-stone-200 text-stone-700 hover:bg-stone-200 transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>

        <div className="hidden md:block flex-1 max-w-md">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-[#E76A54] transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search orders, menu..." 
              className="w-full bg-stone-100/80 border border-stone-200 rounded-2xl py-2.5 pl-11 pr-4 text-stone-900 text-sm focus:outline-none focus:bg-white focus:border-[#E76A54] focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-stone-400"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative">
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`relative p-2.5 sm:p-3 rounded-2xl border transition-all group ${isNotifOpen ? 'bg-orange-50 border-orange-200 text-[#E76A54]' : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#E76A54] rounded-full border-2 border-white group-hover:scale-125 transition-transform" />
            )}
          </button>
          <NotificationDropdown isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
        </div>

        <button 
          onClick={handleLogout}
          className="p-2.5 sm:p-3 rounded-2xl bg-stone-100 border border-stone-200 text-stone-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
          title="Logout"
        >
          <LogOut size={18} />
        </button>

        <div className="h-8 w-[1px] bg-stone-200 mx-1" />

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs sm:text-sm font-bold text-stone-900">Admin User</p>
            <p className="text-[10px] text-stone-500 font-medium">Super Admin</p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-orange-400 to-[#E76A54] p-[2px] cursor-pointer shadow-xs"
          >
            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center overflow-hidden border border-white">
              <img 
                src="https://picsum.photos/seed/admin/100/100" 
                alt="Admin Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
};
