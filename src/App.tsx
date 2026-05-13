import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { MenuProvider } from './context/MenuContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { CartSidebar } from './components/CartSidebar';
import { SearchOverlay } from './components/Search/SearchOverlay';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingScreen } from './components/LoadingScreen';
import { IntroSplash } from './components/IntroSplash';
import { RESTAURANT_WHATSAPP } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Instagram, MessageCircle, ShieldAlert } from 'lucide-react';

import { Logo } from './components/Logo';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import Lenis from '@studio-freight/lenis';

import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';

// Lazy load pages for performance
import Home from './pages/HomePage';
const Checkout = lazy(() => import('./pages/Checkout'));
const UPICheckout = lazy(() => import('./pages/UPICheckout'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const AdminLayout = lazy(() => import('./pages/AdminLayout'));
const Profile = lazy(() => import('./pages/Profile'));
const RiderPanel = lazy(() => import('./pages/RiderPanel'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const FinishSignIn = lazy(() => import('./pages/FinishSignIn'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Orders = lazy(() => import('./pages/Orders'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Offers = lazy(() => import('./pages/Offers'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoader = () => <LoadingScreen fullScreen={false} />;

import { useCart } from './context/CartContext';
import { useMenu } from './context/MenuContext';

// Forced rebuild for artifact detection
function AppContent() {
  const { user, isVerified, isAdmin } = useAuth();
  const { isCartOpen, setIsCartOpen } = useCart();
  const { items, loading: menuLoading } = useMenu();
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [showVerificationBanner, setShowVerificationBanner] = useState(true);
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash only once per session
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return !sessionStorage.getItem('splash_seen');
      }
    } catch (e) {
      console.warn('sessionStorage access failed:', e);
    }
    return false; // Default to false if we can't check, to avoid stuck splash
  });

  const location = useLocation();

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.1,
      touchMultiplier: 2,
      infinite: false,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    const handleScrollToTop = () => {
      lenis.scrollTo(0, { 
        duration: 1.5,
        easing: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t) 
      });
    };
    
    const handleScrollToElement = (e: any) => {
      const target = e.detail?.target;
      if (!target) return;
      
      lenis.scrollTo(target, {
        offset: e.detail?.offset || 0,
        duration: e.detail?.duration || 1.5,
        easing: e.detail?.easing || ((t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t))
      });
    };

    window.addEventListener('scroll-to-top', handleScrollToTop);
    window.addEventListener('scroll-to-element', handleScrollToElement);
    
    // Export globally
    (window as any).lenis = lenis;

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll-to-top', handleScrollToTop);
      window.removeEventListener('scroll-to-element', handleScrollToElement);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    // Automatically transition from splash when menu is loaded
    if (showSplash && !menuLoading && items.length > 0) {
      // Small delay for visual polish
      const timer = setTimeout(() => {
        handleSplashComplete();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showSplash, menuLoading, items.length]);

  useEffect(() => {
    // Failsafe to unstick splash after 6 seconds
    if (showSplash) {
      const timer = setTimeout(() => {
        if (showSplash) {
          setShowSplash(false);
        }
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

  const [isSearchOverlayScan, setIsSearchOverlayScan] = useState(false);

  useEffect(() => {
    const handleSearchState = (e: any) => {
      const newState = !!e.detail;
      setIsSearching(prev => prev !== newState ? newState : prev);
    };
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOverlayScan(false);
        setIsSearchOverlayOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOverlayOpen(false);
      }
    };

    const handleGlobalSearch = (e: any) => {
        setIsSearchOverlayScan(!!e.detail?.scan);
        setIsSearchOverlayOpen(true);
    };

    window.addEventListener('is-searching', handleSearchState);
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-search', handleGlobalSearch);

    return () => {
      window.removeEventListener('is-searching', handleSearchState);
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-search', handleGlobalSearch);
    };
  }, []);


  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0);
    // If lenis is active, also tell it to reset
    if ((window as any).lenis) {
      (window as any).lenis.scrollTo(0, { immediate: true });
    }
  }, [location.pathname]);

  const isAdminPage = location.pathname.startsWith('/admin');
  const isProductPage = location.pathname.startsWith('/product/');
  const isUPICheckoutPage = location.pathname.startsWith('/upi-checkout');
  const isCheckoutPage = location.pathname === '/checkout';
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/finish-sign-in'].includes(location.pathname);
  const navigate = useNavigate();
  
  // Sidebar should be available on almost all pages
  const showCartSidebar = !isAdminPage && !isAuthPage && !isUPICheckoutPage && !isCheckoutPage;
  // Navbar should be available on home and others, but maybe not auth/admin
  const showNavbar = !isAdminPage && !isAuthPage && !isProductPage && !isUPICheckoutPage;
  // Bottom nav and footer have their own hiding rules
  const hideNavFooter = isAdminPage || isProductPage || isSearching || isAuthPage || isUPICheckoutPage || isCheckoutPage;

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem('splash_seen', 'true');
    setShowSplash(false);
  }, []);

  const handleSwipeBack = (e: any, info: any) => {
    // Swipe from left to right (offset.x > 80)
    if (info.offset.x > 80 && info.velocity.x > 0) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Toaster position="top-right" />
      
      {user && !isVerified && !isAdmin && showVerificationBanner && (
        <div className="bg-primary text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-between relative z-[100]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} />
            <span>Protect your account: Please verify your email address</span>
          </div>
          <button 
            onClick={() => setShowVerificationBanner(false)}
            className="p-1 hover:bg-white/10 rounded-full"
          >
            <span className="sr-only">Close</span>
            ×
          </button>
        </div>
      )}

      {quotaExceeded && (
        <div className="bg-amber-500 text-black px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest relative z-[100]">
          ⚠️ Database limit reached! Showing cached menu. New orders may be limited.
          <button onClick={() => setQuotaExceeded(false)} className="ml-4 underline">Close</button>
        </div>
      )}

      {showNavbar && <Navbar onCartClick={() => setIsCartOpen(true)} onSearchClick={() => setIsSearchOverlayOpen(true)} />}
      {showCartSidebar && <CartSidebar />}
      {!hideNavFooter && !isCartOpen && <BottomNav onCartClick={() => setIsCartOpen(true)} />}
      
      <SearchOverlay 
        isOpen={isSearchOverlayOpen} 
        onClose={() => setIsSearchOverlayOpen(false)} 
        allItems={items}
        initialScan={isSearchOverlayScan}
      />
      
      <main className={cn(
        "transition-all flex-1 flex flex-col min-h-svh relative",
        showNavbar && "pt-24 md:pt-28",
        !hideNavFooter && "pb-40 md:pb-0"
      )}>
        <AnimatePresence>
          {showSplash && location.pathname === '/' && (
            <IntroSplash onComplete={handleSplashComplete} />
          )}
        </AnimatePresence>

        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ 
                duration: 0.3,
                ease: "easeOut"
              }}
              className="flex-1 flex flex-col w-full h-full"
            >
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/finish-sign-in" element={<FinishSignIn />} />
                <Route path="/checkout" element={
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                } />
                <Route path="/upi-checkout/:orderId" element={
                  <ProtectedRoute>
                    <UPICheckout />
                  </ProtectedRoute>
                } />
                <Route path="/order-tracking/:orderId" element={<OrderTracking />} />
                <Route path="/admin/*" element={
                  <ProtectedRoute allowedRoles={['admin']} autoLogout={true} requireVerification={true}>
                    <AdminLayout />
                  </ProtectedRoute>
                } />
                <Route path="/rider/*" element={
                  <ProtectedRoute allowedRoles={['rider']} requireVerification={true}>
                    <RiderPanel />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/orders" element={
                  <ProtectedRoute>
                    <Orders />
                  </ProtectedRoute>
                } />
                <Route path="/notifications" element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                } />
                <Route path="/offers" element={<Offers />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </main>

      {!hideNavFooter && (
        <footer className={cn(
          "border-t border-border bg-secondary/10",
          "pb-44 md:pb-0" // Extra padding for BottomNav on mobile
        )}>
          <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
              <div className="space-y-6 text-center md:text-left">
                <Logo size="sm" />
                <p className="text-muted-foreground text-sm max-w-xs mx-auto md:mx-0 leading-relaxed">
                  Artisan bakery and frosty treats crafted with love. Experience the perfect blend of warmth and chill.
                </p>
              </div>

              <div className="flex flex-wrap justify-center md:justify-end gap-x-8 gap-y-4">
                <a 
                  href="https://www.instagram.com/frosty_bite07?igsh=dXpqZXE0Y2pvOWt0" 
                  target="_blank" 
                  rel="noreferrer"
                  className="group flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all underline-offset-4 hover:underline"
                >
                  <Instagram size={14} className="group-hover:scale-110 transition-transform" />
                  Instagram
                </a>
                <a 
                  href={`https://wa.me/${RESTAURANT_WHATSAPP}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="group flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all underline-offset-4 hover:underline"
                >
                  <MessageCircle size={14} className="group-hover:scale-110 transition-transform" />
                  Support
                </a>
                <a href="#" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all underline-offset-4 hover:underline">
                  Privacy
                </a>
                <a href="#" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all underline-offset-4 hover:underline">
                  Terms
                </a>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-muted-foreground/60 text-[10px] font-medium uppercase tracking-widest">
                © 2026 Frosty Bite. Crafted for excellence.
              </p>
              <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                <span>Safe & Secure Payments</span>
                <span className="w-1 h-1 bg-border rounded-full" />
                <span>Fast Delivery</span>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Floating WhatsApp Support Button */}
      {!hideNavFooter && (
        <a
          href={`https://wa.me/${RESTAURANT_WHATSAPP}`}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "fixed z-50 bg-emerald-500 text-white p-4 rounded-full shadow-2xl hover:bg-emerald-600 transition-all hover:scale-110 active:scale-95 flex items-center justify-center group",
            "bottom-32 right-8 md:bottom-8 md:right-8" // Positioned above BottomNav on mobile
          )}
          title="Chat with Frosty Bite Support"
        >
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:mr-2 transition-all duration-500 whitespace-nowrap font-bold text-sm">
            Chat with Support
          </span>
          <svg 
            viewBox="0 0 24 24" 
            width="24" 
            height="24" 
            stroke="currentColor" 
            strokeWidth="2" 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </a>
      )}

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <MenuProvider>
              <NotificationProvider>
                <CartProvider>
                  <AppContent />
                </CartProvider>
              </NotificationProvider>
            </MenuProvider>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </ErrorBoundary>
  );
}
