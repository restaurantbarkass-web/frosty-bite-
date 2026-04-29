import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ClipboardList, User, ShoppingBag, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export const BottomNav: React.FC<{ onCartClick: () => void }> = ({ onCartClick }) => {
  const { user, isAdmin } = useAuth();
  const { totalItems } = useCart();
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Orders', path: '/orders', icon: ClipboardList, protected: true },
    { name: 'Cart', path: '#cart', icon: ShoppingBag, action: onCartClick, badge: totalItems },
    { name: 'Profile', path: '/profile', icon: User, protected: true },
    { name: 'Login', path: '/login', icon: User, publicOnly: true },
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
          if (link.publicOnly && user) return null;

          if (link.action) {
            return (
              <button
                key={link.name}
                onClick={link.action}
                className="relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all active:scale-90"
              >
                <div className={cn(
                  "p-2 rounded-lg transition-all",
                  "text-gray-400 group-hover:text-white"
                )}>
                  <Icon size={20} />
                </div>
                {link.badge && link.badge > 0 && (
                  <span className="absolute top-1 right-1 bg-primary text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-black shadow-lg">
                    {link.badge}
                  </span>
                )}
                <span className="text-[7px] font-black uppercase text-gray-500 tracking-tighter">{link.name}</span>
              </button>
            );
          }

          return (
            <Link
              key={link.path}
              to={link.path}
              className="relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all active:scale-90"
            >
              <div className={cn(
                "p-2 rounded-lg transition-all shadow-sm",
                isActive ? "bg-primary text-white shadow-primary/20" : "text-gray-400 hover:text-white"
              )}>
                <Icon size={20} />
              </div>
              <span className={cn(
                "text-[7px] font-black uppercase tracking-tighter mt-0.5",
                isActive ? "text-primary" : "text-gray-500 font-bold"
              )}>
                {link.name}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="bottom-nav-active"
                  className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(255,107,38,0.6)]"
                />
              )}
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
};
