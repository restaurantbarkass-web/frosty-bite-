import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingBag, BadgePercent, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCartState } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
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
      if (scrollStopTimeoutRef.current) {
        clearTimeout(scrollStopTimeoutRef.current);
      }

      scrollStopTimeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 600);

      if (ticking) return;

      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const prevScrollY = lastScrollYRef.current;
        const scrollDelta = currentScrollY - prevScrollY;

        if (currentScrollY < 60) {
          setIsVisible(true);
        } else if (scrollDelta > scrollThreshold && currentScrollY > 100) {
          setIsVisible(false);
        } else if (scrollDelta < -scrollThreshold) {
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

  // Track active item index and previous index for liquid morphing / melting meniscus transition
  const activeIndex = useMemo(() => {
    const idx = navItems.findIndex(item => item.isActive);
    return idx >= 0 ? idx : 0;
  }, [navItems]);

  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [isMorphing, setIsMorphing] = useState(false);
  const morphTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (prevIndex !== null && prevIndex !== activeIndex) {
      setIsMorphing(true);
      if (morphTimeoutRef.current) clearTimeout(morphTimeoutRef.current);
      morphTimeoutRef.current = setTimeout(() => {
        setIsMorphing(false);
      }, 450);
    }
  }, [activeIndex, prevIndex]);

  const handleItemClick = (item: typeof navItems[0], index: number) => {
    try {
      playClickSound(580);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(8);
      }
    } catch {}

    if (index !== activeIndex) {
      setPrevIndex(activeIndex);
    }

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
    <>
      {/* SVG Gooey Filter for Liquid Meniscus Bubble Morphing */}
      <svg className="fixed w-0 h-0 pointer-events-none -z-50 opacity-0" aria-hidden="true">
        <defs>
          <filter id="meniscus-liquid-goo" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  
                      0 1 0 0 0  
                      0 0 1 0 0  
                      0 0 0 19 -8"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <motion.nav 
        aria-label="Bottom Navigation"
        initial={{ y: 0, opacity: 1 }}
        animate={{ 
          y: isVisible ? 0 : 110,
          opacity: isVisible ? 1 : 0
        }}
        transition={{ 
          duration: 0.32, 
          ease: [0.16, 1, 0.3, 1] 
        }}
        className="md:hidden fixed inset-x-3 max-w-md mx-auto z-50 rounded-full bg-white/90 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/85 border border-[#EFE8DD]/90 shadow-[0_16px_40px_-6px_rgba(44,24,16,0.13),0_6px_16px_-2px_rgba(44,24,16,0.06),inset_0_1px_2px_rgba(255,255,255,1),inset_0_-1px_1px_rgba(0,0,0,0.04)] p-1.5"
        style={{
          bottom: 'max(12px, calc(env(safe-area-inset-bottom, 0px) + 8px))'
        }}
      >
        {/* Subtle specular reflection on the upper curved rim of the dock */}
        <div className="absolute top-0 inset-x-10 h-[1.5px] bg-gradient-to-r from-transparent via-[#E76A54]/30 to-transparent pointer-events-none rounded-full" />

        {/* Liquid Meniscus Background Container with SVG Goo filter */}
        <div 
          className="absolute inset-1.5 pointer-events-none rounded-full overflow-hidden"
          style={{ filter: 'url(#meniscus-liquid-goo)' }}
        >
          {/* Active Liquid Bubble with Meniscus Morphing & Spring Physics */}
          <div className="relative w-full h-full flex items-center justify-around gap-1">
            {navItems.map((item, index) => {
              const isActive = index === activeIndex;
              const isPrev = index === prevIndex && isMorphing;

              return (
                <div key={`liquid-${item.id}`} className="relative flex-1 h-full min-w-0">
                  {/* The Active Meniscus Bubble */}
                  {isActive && (
                    <motion.div
                      layoutId="meniscus-liquid-bubble"
                      className="absolute inset-0 rounded-full bg-gradient-to-b from-[#FFF2ED] via-[#FFEBE4] to-[#FFE2D9] border border-[#E76A54]/35 shadow-[0_4px_16px_rgba(231,106,84,0.22),inset_0_1.5px_2px_rgba(255,255,255,1),inset_0_-1px_2px_rgba(231,106,84,0.22)]"
                      initial={false}
                      animate={{
                        scaleX: [1, 1.2, 0.94, 1],
                        scaleY: [1, 0.86, 1.08, 1],
                      }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 380, 
                        damping: 26,
                        mass: 0.65 
                      }}
                    >
                      {/* Glossy specular curved meniscus refraction highlight */}
                      <div className="absolute inset-x-3 top-0.5 h-2 rounded-full bg-gradient-to-b from-white/90 to-transparent pointer-events-none" />
                    </motion.div>
                  )}

                  {/* Trailing droplet from previous tab that stretches and melts away */}
                  {isPrev && (
                    <motion.div
                      key={`droplet-${prevIndex}`}
                      className="absolute inset-1 rounded-full bg-[#FFEBE4] border border-[#E76A54]/20"
                      initial={{ scale: 1, opacity: 0.85 }}
                      animate={{ scale: 0.15, opacity: 0 }}
                      transition={{ duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Foreground Sharp Interactive Nav Buttons */}
        <div className="relative z-10 flex items-center justify-around gap-1">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === activeIndex;

            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item, index)}
                onMouseEnter={() => preloadRoute(item.path)}
                onTouchStart={() => preloadRoute(item.path)}
                whileTap={{ scale: 0.9 }}
                className="relative flex flex-col items-center justify-center min-w-0 flex-1 pt-1.5 pb-2 px-1 rounded-full focus:outline-none cursor-pointer group select-none transition-transform"
                aria-label={item.name}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Icon Container with fluid upward float */}
                <div className="relative">
                  <motion.div
                    animate={{
                      scale: isActive ? 1.15 : 1,
                      y: isActive ? -2 : 0,
                    }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 440, 
                      damping: 24,
                      mass: 0.6 
                    }}
                  >
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.35 : 1.9}
                      className={cn(
                        "transition-colors duration-200",
                        isActive
                          ? "text-[#E76A54] fill-[#E76A54]/20"
                          : "text-stone-500 group-hover:text-stone-800"
                      )}
                    />
                  </motion.div>

                  {/* Notification/Cart Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] rounded-full bg-[#E76A54] text-white text-[9px] font-black flex items-center justify-center px-1 ring-2 ring-white shadow-sm shadow-[#E76A54]/40"
                    >
                      {item.badge > 9 ? '9+' : item.badge}
                    </motion.span>
                  )}
                </div>

                {/* Tab Label */}
                <span
                  className={cn(
                    "text-[10px] sm:text-[10.5px] tracking-tight mt-0.5 transition-all duration-200 truncate max-w-full",
                    isActive
                      ? "text-[#E76A54] font-bold"
                      : "text-stone-500 font-medium group-hover:text-stone-800"
                  )}
                >
                  {item.name}
                </span>

                {/* Glowing Meniscus Jewel Bead */}
                {isActive && (
                  <motion.div
                    layoutId="meniscus-active-bead"
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#E76A54] shadow-[0_0_8px_rgba(231,106,84,0.85)]"
                    transition={{ 
                      type: 'spring', 
                      stiffness: 480, 
                      damping: 28,
                      mass: 0.5 
                    }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.nav>
    </>
  );
});

BottomNav.displayName = 'BottomNav';

export default BottomNav;
