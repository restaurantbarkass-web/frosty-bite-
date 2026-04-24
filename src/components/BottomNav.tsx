import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, User, ShoppingBag, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export const BottomNav: React.FC<{ onCartClick: () => void }> = ({ onCartClick }) => {
  const { user, isAdmin } = useAuth();
  const { totalItems } = useCart();
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Orders', path: '/orders', icon: ClipboardList, protected: true },
    { name: 'Cart', path: '#cart', icon: ShoppingBag, action: onCartClick, badge: totalItems },
    { name: 'Profile', path: '/profile', icon: User, protected: true },
  ];

  if (isAdmin) {
    navLinks.splice(2, 0, { name: 'Admin', path: '/admin', icon: LayoutDashboard, protected: true });
  }

  return (
    <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[100]">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-2 flex items-center justify-around shadow-2xl relative overflow-hidden"
      >
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          
          if (link.protected && !user) return null;

          if (link.action) {
            return (
              <button
                key={link.name}
                onClick={link.action}
                className="relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all active:scale-90"
              >
                <div className={cn(
                  "p-2.5 rounded-xl transition-all",
                  isActive ? "bg-primary text-white" : "text-gray-400"
                )}>
                  <Icon size={24} />
                </div>
                {link.badge && link.badge > 0 && (
                  <span className="absolute top-2 right-2 bg-primary text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-black">
                    {link.badge}
                  </span>
                )}
                <span className="text-[8px] font-black uppercase text-gray-500 mt-1">{link.name}</span>
              </button>
            );
          }

          return (
            <Link
              key={link.path}
              to={link.path}
              className="relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all active:scale-90"
            >
              <div className={cn(
                "p-2.5 rounded-xl transition-all",
                isActive ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-gray-400 hover:text-white"
              )}>
                <Icon size={24} />
              </div>
              <span className={cn(
                "text-[8px] font-black uppercase mt-1",
                isActive ? "text-primary" : "text-gray-500"
              )}>
                {link.name}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="bottom-nav-active"
                  className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_#f97316]"
                />
              )}
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
};
