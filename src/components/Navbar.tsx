import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Home, ClipboardList, Menu, X, LogOut, LayoutDashboard, AlertCircle, CheckCircle2, Search, Gift, Command, Sparkles } from 'lucide-react';
import { useCartState } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn, smoothScroll } from '../lib/utils';
import { appConfigService, AppConfig } from '../services/appConfigService';
import { Logo } from './Logo';
import { LottieOfferButton } from './LottieOfferButton';
import { preloadRoute } from '../utils/preload';

export const Navbar: React.FC<{ onCartClick: () => void, onSearchClick: () => void }> = ({ onCartClick, onSearchClick }) => {
  const { totalItems } = useCartState();
  const { user, role, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setLastScrollY((prev) => {
        if (Math.abs(currentScrollY - prev) < 10) return prev;
        
        if (currentScrollY > prev && currentScrollY > 100) {
          setShowHeader(false);
        } else {
          setShowHeader(true);
        }
        return currentScrollY;
      });
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const unsubscribe = appConfigService.subscribeToConfig((data) => {
      setConfig(data);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const getNavLinks = React.useMemo(() => {
    const links = [
      { name: 'Home', path: '/', icon: Home },
      { name: 'Butler', path: '#search', icon: Sparkles, onClick: onSearchClick },
      { 
        name: 'Offers', 
        path: '/offers', 
        component: (isActive: boolean) => (
          <div className="relative group">
            <LottieOfferButton 
              active={isActive} 
              className="scale-[0.5] sm:scale-[0.6] origin-center -my-6" 
            />
            {isActive && (
              <motion.div 
                layoutId="nav-underline-desktop"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(255,107,38,0.5)]"
              />
            )}
          </div>
        )
      }
    ];
    
    if (user) {
      links.push({ name: 'Orders', path: '/orders', icon: ClipboardList });
      if (isAdmin) links.push({ name: 'Admin', path: '/admin', icon: LayoutDashboard });
      links.push({ name: 'Profile', path: '/profile', icon: User });
    }
    
    return links;
  }, [user, isAdmin]);

  const navLinks = getNavLinks;

  return (
    <nav className={cn(
      "fixed top-0 left-0 w-full z-50 transition-transform duration-300 glass-dark border-b border-white/5",
      showHeader ? "translate-y-0" : "-translate-y-full"
    )}>
      {/* Status Banner */}
      <AnimatePresence mode="wait">
        {config && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(
              "w-full py-1.5 px-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
              config.isOrderingOpen 
                ? "bg-emerald-500/10 text-emerald-500 border-b border-emerald-500/10" 
                : "bg-red-500/10 text-red-500 border-b border-red-500/10"
            )}
          >
            {config.isOrderingOpen ? (
              <>
                <CheckCircle2 size={12} className="animate-pulse" />
                <span>🟢 Orders Open - Fast Delivery Active</span>
              </>
            ) : (
              <>
                <AlertCircle size={12} className="animate-bounce" />
                <span>🔴 Orders Closed - We'll be back soon!</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20 sm:h-24 gap-4">
          <Link 
            to="/" 
            className="flex items-center shrink-0 group relative"
            onClick={(e) => {
              if (location.pathname === '/') {
                e.preventDefault();
                smoothScroll.toTop();
              }
            }}
          >
            <Logo size="md" className="scale-90 sm:scale-100" />
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden lg:flex flex-1 max-w-sm mx-8">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSearchClick}
              className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl py-2.5 px-4 group hover:border-primary/50 transition-all text-gray-500"
            >
              <div className="flex items-center gap-3">
                <Search size={18} className="group-hover:text-primary transition-colors group-hover:scale-110 duration-200" />
                <span className="text-sm font-medium animate-pulse">Search for premium treats...</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold">
                <Command size={10} />
                <span>K</span>
              </div>
            </motion.button>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path.split('#')[0];
              
              if ('component' in link && link.component) {
                return (
                  <Link 
                    key={link.path} 
                    to={link.path} 
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
                    onClick={(e) => {
                      if (location.pathname === link.path) {
                        e.preventDefault();
                        smoothScroll.toTop();
                      }
                    }}
                    className="flex items-center"
                  >
                    {link.component(isActive)}
                  </Link>
                );
              }

              return (
                <Link
                  key={link.path}
                  to={link.path}
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
                  onClick={(e) => {
                    if ('onClick' in link && link.onClick) {
                      e.preventDefault();
                      link.onClick();
                      return;
                    }
                    if (location.pathname === link.path) {
                      e.preventDefault();
                      smoothScroll.toTop();
                    }
                  }}
                  className={cn(
                    "text-sm font-medium transition-colors relative py-1 px-2 rounded-lg",
                    isActive ? "text-primary z-10" : "text-muted hover:text-white"
                  )}
                >
                  <motion.span
                    whileHover={{ scale: 1.05, y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="inline-block"
                  >
                    {link.name}
                  </motion.span>
                  {isActive ? (
                    <motion.div
                      layoutId="active-nav-dot"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(255,107,38,0.8)]"
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    />
                  ) : (
                    <motion.div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary/40 rounded-full opacity-0"
                      whileHover={{ opacity: 1, scale: 1.2 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </Link>
              );
            })}
            
            {user ? (
              <div className="flex items-center space-x-4">
                <button
                  id="cart-btn-desktop"
                  onClick={onCartClick}
                  className="relative p-2 text-muted hover:text-primary transition-colors focus:outline-none"
                >
                  <motion.div
                    key={totalItems}
                    animate={{ scale: [1, 1.25, 0.95, 1.05, 1], rotate: [0, -8, 8, -4, 0] }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="flex items-center justify-center"
                  >
                    <ShoppingCart size={24} />
                  </motion.div>
                  {totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </button>
                <motion.button
                  whileHover={{ scale: 1.15, rotate: 8 }}
                  whileTap={{ scale: 0.85 }}
                  onClick={handleLogout}
                  className="p-2 text-muted hover:text-red-500 transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </motion.button>
              </div>
            ) : (
              <motion.div
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <Link
                  to="/login"
                  className="bg-primary hover:bg-orange-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all block"
                >
                  Login
                </Link>
              </motion.div>
            )}
          </div>

          {/* Mobile Menu Button - Optimized spacing */}
          <div className="md:hidden flex items-center gap-1 sm:gap-2 shrink-0">
            {!user && (
              <Link
                to="/login"
                className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-primary text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-full active:scale-95 transition-all shadow-lg shadow-primary/20 shrink-0"
              >
                Login
              </Link>
            )}
            <button
              onClick={onSearchClick}
              className="p-1.5 sm:p-2 text-muted hover:text-primary active:scale-95 transition-all shrink-0"
            >
              <Search size={20} />
            </button>
            <button
              id="cart-btn-mobile"
              onClick={onCartClick}
              className="relative p-1.5 sm:p-2 text-muted hover:text-primary active:scale-95 transition-all shrink-0 focus:outline-none block"
            >
              <motion.div
                key={totalItems}
                animate={{ scale: [1, 1.25, 0.95, 1.05, 1], rotate: [0, -8, 8, -4, 0] }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="flex items-center justify-center"
              >
                <ShoppingCart size={22} />
              </motion.div>
              {totalItems > 0 && (
                <span className="absolute top-0 sm:-top-1 right-0 sm:-right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border border-black/50">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-b border-white/5"
          >
            <div className="px-4 pt-2 pb-6 space-y-4">
              {/* Mobile Search */}
              <div className="relative group px-3">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Search Bakery..." 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-primary/50"
                  onChange={(e) => {
                    const query = e.target.value;
                    if (location.pathname !== '/') {
                      navigate(`/?search=${encodeURIComponent(query)}`);
                    } else {
                      window.dispatchEvent(new CustomEvent('navbar-search', { detail: query }));
                    }
                  }}
                />
              </div>

              <div className="space-y-1">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.path.split('#')[0];
                  
                  if ('component' in link && link.component) {
                    return (
                      <Link
                        key={link.path}
                        to={link.path}
                        onClick={(e) => {
                          setIsMobileMenuOpen(false);
                          if (location.pathname === link.path) {
                            e.preventDefault();
                            window.dispatchEvent(new CustomEvent('scroll-to-top'));
                          }
                        }}
                        className={cn(
                          "flex items-center px-3 py-1 rounded-lg",
                          isActive ? "bg-primary/10" : "hover:bg-white/5"
                        )}
                      >
                        <div className="scale-75 -ml-8">
                          {link.component(isActive)}
                        </div>
                        <span className={cn(
                          "text-base font-medium -ml-4",
                          isActive ? "text-primary" : "text-muted"
                        )}>
                          {link.name}
                        </span>
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={(e) => {
                        setIsMobileMenuOpen(false);
                        if ('onClick' in link && link.onClick) {
                          e.preventDefault();
                          link.onClick();
                          return;
                        }
                        if (location.pathname === link.path) {
                          e.preventDefault();
                          window.dispatchEvent(new CustomEvent('scroll-to-top'));
                        }
                      }}
                      className={cn(
                        "flex items-center space-x-3 px-3 py-3 rounded-lg text-base font-medium",
                        isActive ? "bg-primary/10 text-primary" : "text-muted hover:bg-white/5"
                      )}
                    >
                      {link.icon && <link.icon size={20} />}
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
