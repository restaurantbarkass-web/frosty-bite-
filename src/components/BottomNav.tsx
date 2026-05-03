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
        className="bg-black/70 backdrop-blur-2xl border border-white/10 rounded-[28px] p-2 flex items-center justify-around shadow-2xl relative overflow-hidden"
      >
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          
          if (link.protected && !user) return null;
          if (link.publicOnly && user) return null;

          const content = (
            <motion.div
              key={link.name}
              whileTap={{ scale: 0.85 }}
              animate={{
                y: isActive ? -6 : 0,
                scale: isActive ? 1.1 : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 25,
              }}
              className="relative flex flex-col items-center justify-center py-2 px-3 cursor-pointer group"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(10);
                if (link.action) link.action();
              }}
            >
              {/* Glow Active Background */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-glow"
                  className="absolute inset-0 bg-primary/20 blur-xl rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              {/* Icon */}
              <div className="relative">
                <Icon 
                  size={22} 
                  className={cn(
                    "transition-colors duration-200",
                    isActive ? "text-primary" : (link.badge && link.badge > 0 ? "text-primary/70" : "text-gray-400 group-hover:text-white")
                  )} 
                />
                
                {/* Badge for Cart */}
                {link.badge !== undefined && link.badge > 0 && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-primary text-white text-[9px] font-black px-1 py-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center border border-black shadow-lg"
                  >
                    {link.badge}
                  </motion.span>
                )}
              </div>

              {/* Label */}
              <span className={cn(
                "text-[8px] font-black uppercase tracking-wider mt-1 transition-colors",
                isActive ? "text-primary" : "text-gray-500"
              )}>
                {link.name}
              </span>

              {/* Active Dot */}
              {isActive && (
                <motion.div 
                  layoutId="bottom-nav-dot"
                  className="absolute -bottom-1 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(255,107,38,0.8)]"
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                />
              )}
            </motion.div>
          );

          if (link.action) {
            return content;
          }

          return (
            <Link key={link.path} to={link.path}>
              {content}
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
};
