import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, User, ShoppingBag, LayoutDashboard, Gift } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { LottieOfferButton } from './LottieOfferButton';

export const BottomNav: React.FC<{ onCartClick: () => void }> = ({ onCartClick }) => {
  const { user, isAdmin } = useAuth();
  const { totalItems } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setRefreshKey((prev) => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Offers', path: '/offers', icon: Gift },
    { name: 'Orders', path: '/orders', icon: ClipboardList, protected: true },
    { name: 'Cart', path: '#cart', icon: ShoppingBag, action: onCartClick, badge: totalItems },
    { name: 'Profile', path: '/profile', icon: User, protected: true },
    { name: 'Login', path: '/login', icon: User, publicOnly: true },
  ];

  if (isAdmin) {
    navLinks.splice(2, 0, { name: 'Admin', path: '/admin', icon: LayoutDashboard, protected: true });
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full z-[100]">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-black/90 backdrop-blur-xl p-3 flex items-center justify-around rounded-t-2xl border-t border-white/10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
      >
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          
          if (link.protected && !user) return null;
          if (link.publicOnly && user) return null;

          if (link.name === 'Offers') {
            return (
              <LottieOfferButton
                key={link.path}
                active={isActive}
                onClick={() => navigate(link.path)}
                className="scale-90"
              />
            );
          }

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
                <AnimatePresence>
                  {link.badge !== undefined && link.badge > 0 && (
                    <motion.span 
                      key={`${link.name}-${link.badge}-${refreshKey}`}
                      initial={{ scale: 0, y: -5 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 15,
                      }}
                      className="absolute -top-2 -right-2 bg-primary text-white text-[9px] font-black px-1 py-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center border border-black shadow-lg z-20"
                    >
                      {link.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
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
                  className="absolute -bottom-1.5 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_12px_rgba(255,107,38,1)]"
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
