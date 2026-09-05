import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingBag, BadgePercent, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCartState } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { motion } from 'motion/react';
import { preloadRoute } from '../utils/preload';
import { cn } from '../lib/utils';

interface BottomNavProps {
  onCartClick?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(() => {
  const { user, isAdmin } = useAuth();
  const { totalItems } = useCartState();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const scrollStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollThreshold = 10; // Minimum scroll delta before triggering

  const pathname = location.pathname;

  // Scroll listener: hides on downward scroll, shows on upward scroll,
  // and automatically reappears when the user stops scrolling.
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      // 1. Reset the scroll-stop timer on every scroll movement
      if (scrollStopTimeoutRef.current) {
        clearTimeout(scrollStopTimeoutRef.current);
      }

      // 2. When the user stops scrolling for 600ms, automatically reveal the bottom navigation
      scrollStopTimeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 600);

      if (ticking) return;

      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const prevScrollY = lastScrollYRef.current;
        const scrollDelta = currentScrollY - prevScrollY;

        // Always show when near the very top of the page
        if (currentScrollY < 60) {
          setIsVisible(true);
        }
        // Hide when scrolling down significantly
        else if (scrollDelta > scrollThreshold && currentScrollY > 100) {
          setIsVisible(false);
        }
        // Show when scrolling up significantly
        else if (scrollDelta < -scrollThreshold) {
          setIsVisible(true);
        }

        lastScrollYRef.current = currentScrollY;
        ticking = false;
      });

      ticking = true;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollStopTimeoutRef.current) {
        clearTimeout(scrollStopTimeoutRef.current);
      }
    };
  }, []);

  // Ensure bottom nav is always visible upon route change
  useEffect(() => {
    setIsVisible(true);
    if (scrollStopTimeoutRef.current) {
      clearTimeout(scrollStopTimeoutRef.current);
    }
    lastScrollYRef.current = window.scrollY;
  }, [pathname]);

  const navItems = useMemo(() => {
    const items = [
      {
        id: 'home',
        name: 'Home',
        path: '/',
        icon: Home,
        isActive: pathname === '/' || pathname === '/index.html',
      },
      {
        id: 'categories',
        name: 'Categories',
        path: '/categories',
        icon: LayoutGrid,
        isActive: pathname === '/categories',
        customAction: () => {
          if (pathname === '/categories') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          navigate('/categories');
        },
      },
      {
        id: 'orders',
        name: 'Orders',
        path: '/orders',
        icon: ShoppingBag,
        isActive: pathname.startsWith('/orders') || pathname.startsWith('/order-tracking') || pathname.startsWith('/track'),
      },
      {
        id: 'offers',
        name: 'Offers',
        path: '/offers',
        icon: BadgePercent,
        isActive: pathname === '/offers',
      },
      {
        id: 'account',
        name: 'Account',
        path: user ? '/profile' : '/login',
        icon: User,
        isActive: pathname === '/profile' || pathname === '/login' || pathname === '/signup',
        badge: unreadCount,
      },
    ];

    // When admin is logged in, append the Admin management button
    if (isAdmin) {
      items.push({
        id: 'admin',
        name: 'Admin',
        path: '/admin',
        icon: ShieldCheck,
        isActive: pathname.startsWith('/admin'),
      });
    }

    return items;
  }, [pathname, user, isAdmin, unreadCount, navigate]);

  const handleItemClick = (item: typeof navItems[0]) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch {}

    if (item.customAction) {
      item.customAction();
      return;
    }

    if (item.isActive && item.path === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    navigate(item.path);
  };

  return (
    <motion.nav 
      aria-label="Bottom Navigation"
      initial={{ y: 0, opacity: 1 }}
      animate={{ 
        y: isVisible ? 0 : 90,
        opacity: isVisible ? 1 : 0
      }}
      transition={{ 
        duration: 0.35, 
        ease: [0.22, 1, 0.36, 1] 
      }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FAF8F5]/95 backdrop-blur-lg border-t border-stone-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))'
      }}
    >
      <div className="max-w-md mx-auto px-2 pt-2 pb-1 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive;

          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => preloadRoute(item.path)}
              onTouchStart={() => preloadRoute(item.path)}
              whileTap={{ scale: 0.88 }}
              className="relative flex flex-col items-center justify-center min-w-0 flex-1 py-1 px-1 rounded-2xl focus:outline-none cursor-pointer group"
              aria-label={item.name}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Icon Container */}
              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={cn(
                    "transition-colors duration-200",
                    isActive ? "text-[#E76A54]" : "text-stone-400 group-hover:text-stone-700"
                  )}
                />

                {/* Badge (e.g. Unread notifications or Orders) */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-[#E76A54] text-white text-[9px] font-black flex items-center justify-center px-0.5 shadow-xs">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-[10px] sm:text-[11px] tracking-tight mt-1 transition-colors duration-200 truncate max-w-full",
                  isActive ? "text-[#E76A54] font-bold" : "text-stone-500 group-hover:text-stone-700 font-medium"
                )}
              >
                {item.name}
              </span>

              {/* Active Dot Indicator */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active-dot"
                  className="w-1.5 h-1.5 rounded-full bg-[#E76A54] mt-0.5"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;
