import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingBag, BadgePercent, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCartState } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { motion } from 'motion/react';
import { preloadRoute } from '../utils/preload';
import { cn } from '../lib/utils';
import { playClickSound } from '../utils/soundEffects';

interface BottomNavProps {
  onCartClick?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(({ onCartClick }) => {
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
      playClickSound(580);
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200/90 rounded-t-[24px] shadow-[0_-10px_30px_rgba(0,0,0,0.06),0_-1px_3px_rgba(0,0,0,0.03)]"
      style={{
        backgroundColor: '#ffffff',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))'
      }}
    >
      {/* Delicate accent gradient highlight on the top rim */}
      <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-[#E76A54]/35 to-transparent pointer-events-none rounded-full" />

      <div className="relative max-w-lg mx-auto px-2 pt-1.5 pb-1 flex items-center justify-around">
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
              whileTap={{ scale: 0.9 }}
              className="relative flex flex-col items-center justify-center min-w-0 flex-1 py-1.5 px-1 rounded-2xl focus:outline-none cursor-pointer group select-none transition-transform"
              aria-label={item.name}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active Ambient Pill Indicator */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active-pill"
                  className="absolute inset-0 bg-gradient-to-b from-[#FFF5F2] via-[#FFEFEA] to-[#FFE8E1] rounded-2xl border border-[#E76A54]/30 shadow-[0_2px_8px_rgba(231,106,84,0.12)]"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              {/* Icon Container with subtle spring scale */}
              <div className="relative z-10">
                <motion.div
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    y: isActive ? -1 : 0
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.4 : 1.9}
                    className={cn(
                      "transition-colors duration-200",
                      isActive
                        ? "text-[#E76A54] fill-[#E76A54]/20"
                        : "text-stone-500 group-hover:text-stone-800"
                    )}
                  />
                </motion.div>

                {/* Badge (e.g. Unread notifications or Orders) */}
                {item.badge !== undefined && item.badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] rounded-full bg-[#E76A54] text-white text-[9px] font-black flex items-center justify-center px-1 ring-2 ring-white shadow-sm shadow-[#E76A54]/40"
                  >
                    {item.badge > 9 ? '9+' : item.badge}
                  </motion.span>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "relative z-10 text-[10px] tracking-tight mt-1 transition-all duration-200 truncate max-w-full",
                  isActive
                    ? "text-[#E76A54] font-bold"
                    : "text-stone-600 font-medium group-hover:text-stone-900"
                )}
              >
                {item.name}
              </span>

              {/* Active Glowing Dot Accent */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active-dot"
                  className="relative z-10 w-1 h-1 rounded-full bg-[#E76A54] mt-0.5 shadow-[0_0_6px_rgba(231,106,84,0.8)]"
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
