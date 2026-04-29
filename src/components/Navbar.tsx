import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Home, ClipboardList, Menu, X, LogOut, LayoutDashboard, Truck, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { logout } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { appConfigService, AppConfig } from '../services/appConfigService';
import { useTheme } from '../context/ThemeContext';
import { Logo } from './Logo';

export const Navbar: React.FC<{ onCartClick: () => void }> = ({ onCartClick }) => {
  const { totalItems } = useCart();
  const { user, role, isAdmin, isRider } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    const unsubscribe = appConfigService.subscribeToConfig((data) => {
      setConfig(data);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    const links = [{ name: 'Home', path: '/', icon: Home }];
    
    if (user) {
      links.push({ name: 'Orders', path: '/orders', icon: ClipboardList });
      if (isAdmin) links.push({ name: 'Admin', path: '/admin', icon: LayoutDashboard });
      links.push({ name: 'Profile', path: '/profile', icon: User });
    }
    
    return links;
  };

  const navLinks = getNavLinks();

  return (
    <nav className="sticky top-0 z-50 w-full glass-dark border-b border-white/5">
      {/* Offer Banner */}
      <AnimatePresence>
        {theme.showOfferBanner && theme.offerText && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ backgroundColor: theme.offerColor }}
            className="w-full py-2.5 px-4 overflow-hidden shadow-lg relative z-[60]"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 text-center">
              <span className="text-sm font-black text-white tracking-wide">
                {theme.offerText}
              </span>
              {theme.offerLink && (
                <Link 
                  to={theme.offerLink}
                  className="px-4 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-[10px] font-black uppercase text-white transition-all whitespace-nowrap"
                >
                  View Offer
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <div className="flex justify-between items-center h-24">
          <Link to="/" className="flex items-center space-x-3 group relative">
            <Logo size="md" />
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search Bakery..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all"
                onChange={(e) => {
                  // This is a global search, we can use a custom event or just navigate to home with a query
                  const query = e.target.value;
                  if (location.pathname !== '/') {
                    navigate(`/?search=${encodeURIComponent(query)}`);
                  } else {
                    // If on home, we can dispatch a custom event
                    window.dispatchEvent(new CustomEvent('navbar-search', { detail: query }));
                  }
                }}
              />
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === link.path ? "text-primary" : "text-muted"
                )}
              >
                {link.name}
              </Link>
            ))}
            
            {user ? (
              <div className="flex items-center space-x-4">
                <button
                  onClick={onCartClick}
                  className="relative p-2 text-muted hover:text-primary transition-colors"
                >
                  <ShoppingCart size={24} />
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
                <button
                  onClick={handleLogout}
                  className="p-2 text-muted hover:text-red-500 transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-accent transition-colors"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile Menu Button - Hidden to prefer BottomNav */}
          <div className="md:hidden flex items-center space-x-2">
            {!user && (
              <Link
                to="/login"
                className="text-[10px] font-black uppercase tracking-widest bg-primary text-white px-5 py-2.5 rounded-full active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                Login
              </Link>
            )}
            <button
              onClick={onCartClick}
              className="relative p-2 text-muted hover:text-primary active:scale-95 transition-all"
            >
              <ShoppingCart size={24} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-black">
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
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-3 rounded-lg text-base font-medium",
                      location.pathname === link.path ? "bg-primary/10 text-primary" : "text-muted hover:bg-white/5"
                    )}
                  >
                    <link.icon size={20} />
                    <span>{link.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
