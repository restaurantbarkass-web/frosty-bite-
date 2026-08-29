import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, User, ShoppingBag, LayoutDashboard, Gift } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCartState } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { LottieOfferButton } from './LottieOfferButton';
import { preloadRoute } from '../utils/preload';

export const BottomNav: React.FC<{ onCartClick: () => void }> = React.memo(({ onCartClick }) => {
  const { user, isAdmin } = useAuth();
  const { totalItems } = useCartState();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleCartBounce = () => {
      setRefreshKey(prev => prev + 1);
    };
    window.addEventListener('cart-bounce', handleCartBounce);
    return () => window.removeEventListener('cart-bounce', handleCartBounce);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setRefreshKey((prev) => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let stopTimer: NodeJS.Timeout | null = null;
    const threshold = 15; // Filter minor natural shakes or micro-adjustments
    let ticking = false;

    const updateVisibility = () => {
      const currentScrollY = window.scrollY;

      // Keep entirely visible if close to the absolute top of the page
      if (currentScrollY < 40) {
        setIsVisible(true);
        if (stopTimer) clearTimeout(stopTimer);
        ticking = false;
        return;
      }

      // Check threshold distance to avoid jittering
      if (Math.abs(currentScrollY - lastScrollY) < threshold) {
        ticking = false;
        return;
      }

      // Hide representation on scrolling down, reappear instantly on scroll up
      if (currentScrollY > lastScrollY) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      lastScrollY = currentScrollY;

      // Premium Detail: Instantly reveal after 1 second of total inactivity/stop scrolling
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (stopTimer) clearTimeout(stopTimer);
    };
  }, []);

  const navLinks = React.useMemo(() => {
    const links = [
      { name: 'Home', path: '/', icon: Home },
      { name: 'Offers', path: '/offers', icon: Gift },
      { name: 'Orders', path: '/orders', icon: ClipboardList, protected: true },
      { name: 'Cart', path: '#cart', icon: ShoppingBag, action: onCartClick, badge: totalItems },
      { name: 'Profile', path: '/profile', icon: User, protected: true, badge: unreadCount },
      { name: 'Login', path: '/login', icon: User, publicOnly: true },
    ];

    if (isAdmin) {
      links.splice(2, 0, { name: 'Admin', path: '/admin', icon: LayoutDashboard, protected: true });
    }
    return links;
  }, [isAdmin, onCartClick, totalItems, unreadCount]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full z-[100] h-20 pointer-events-none">
      <motion.div 
        initial={{ y: 0, opacity: 1 }}
        animate={{ 
          y: isVisible ? 0 : 88,
          opacity: isVisible ? 1 : 0
        }}
        transition={{
          type: 'tween',
          ease: [0.16, 1, 0.3, 1],
          duration: 0.25
        }}
        className="pointer-events-auto bg-black/65 backdrop-blur-2xl p-2 pb-[calc(1.1rem+env(safe-area-inset-bottom,4px))] pt-3 flex items-center justify-around rounded-t-[30px] border-t border-white/15 shadow-[0_-10px_40px_rgba(0,0,0,0.65)]"
      >
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path.split('#')[0];
          
          if (link.protected && !user) return null;
          if (link.publicOnly && user) return null;

          if (link.name === 'Offers') {
            return (
              <LottieOfferButton
                key={`bottom-nav-${link.name}`}
                active={isActive}
                onClick={() => {
                  if (isActive) {
                    window.dispatchEvent(new CustomEvent('scroll-to-top'));
                  } else {
                    navigate(link.path);
                  }
                }}
                className="scale-90"
              />
            );
          }

          const content = (
            <motion.div
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
              onMouseEnter={() => {
                if (link.path && !link.path.startsWith('#')) {
                  preloadRoute(link.path);
                }
              }}
              onTouchStart={() => {
                if (link.path && !link.path.startsWith('#')) {
                  preloadRoute(link.path);
                }
              }}
              onClick={() => {
                try {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(10);
                  }
                } catch (e) {}
                
                if (link.action) {
                  link.action();
                }
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
            return (
              <div 
                key={`bottom-nav-${link.name}`}
                id={link.name === 'Cart' ? 'cart-btn-mobile' : undefined}
              >
                {content}
              </div>
            );
          }

          return (
            <Link 
              key={`bottom-nav-${link.name}`} 
              to={link.path}
              onMouseEnter={() => preloadRoute(link.path)}
              onTouchStart={() => preloadRoute(link.path)}
              onClick={(e) => {
                if (isActive) {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('scroll-to-top'));
                }
              }}
            >
              {content}
            </Link>
          );
        })}
      </motion.div>
    </div>
  );
});

BottomNav.displayName = 'BottomNav';
