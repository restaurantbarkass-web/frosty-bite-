import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  UtensilsCrossed, 
  Bike, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Tag,
  Palette,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { logout } from '../../firebase';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed },
  { id: 'coupons', label: 'Coupons', icon: Tag },
  { id: 'riders', label: 'Riders', icon: Bike },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'theme', label: 'Theme Settings', icon: Palette },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarVariants = {
    open: { x: 0, width: '260px' },
    closed: { x: '-100%', width: '260px' },
    desktop: { x: 0, width: isCollapsed ? '80px' : '260px' }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.div 
        initial={false}
        animate={isOpen ? 'open' : (window.innerWidth < 1024 ? 'closed' : 'desktop')}
        variants={sidebarVariants}
        className={cn(
          "fixed inset-y-0 left-0 lg:relative z-[70] bg-[#0a0a0a] border-r border-white/10 flex flex-col transition-all duration-300 shadow-2xl lg:shadow-none",
          isCollapsed ? "lg:w-20" : "lg:w-[260px]"
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://www.image2url.com/r2/default/images/1777019214731-c0a6a9d6-c6fc-4e3b-bf96-479ff2919cbf.jpeg" 
              alt="Frosty Bite Logo" 
              className={cn("h-10 w-auto object-contain transition-all duration-300 rounded-lg", isCollapsed && "lg:h-8")}
              referrerPolicy="no-referrer"
            />
            {(!isCollapsed || isOpen) && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col"
              >
                <span className="text-[10px] font-black uppercase text-primary tracking-widest">Admin</span>
              </motion.div>
            )}
          </div>
          {isOpen && (
            <button onClick={onClose} className="lg:hidden text-gray-400 p-2">
              <LogOut className="rotate-180" size={20} />
            </button>
          )}
        </div>

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-20 bg-primary text-white p-1 rounded-full border-4 border-[#0a0a0a] hover:scale-110 transition-transform z-10"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <nav className="flex-1 px-4 mt-8 space-y-2 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose?.();
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "group-hover:text-primary")} />
                {(!isCollapsed || isOpen) && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            );
          })}
        </nav>

      <div className="p-4 border-t border-white/10">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 p-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="font-medium">Logout</span>}
        </button>
      </div>
    </motion.div>
    </>
  );
};
