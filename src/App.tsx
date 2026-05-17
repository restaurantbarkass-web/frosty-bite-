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
import { useCart } from './context/CartContext';
import { useMenu } from './context/MenuContext';

// Lazy load pages for performance
const Home = lazy(() => import('./pages/HomePage'));
const Checkout = lazy(() => import('./pages/Checkout'));
const UPICheckout = lazy(() => import('./pages/UPICheckout'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const AdminLayout = lazy(() => import('./pages/AdminLayout'));
const Profile = lazy(() => import('./pages/Profile'));
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

function AppContent() {
  const { user, isVerified, isAdmin } = useAuth();
  const { isCartOpen, setIsCartOpen } = useCart();
  const { items, loading: menuLoading } = useMenu();
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [showVerificationBanner, setShowVerificationBanner] = useState(true);
  const [showSplash, setShowSplash] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return !sessionStorage.getItem('splash_seen');
      }
    } catch (e) {
      console.warn('sessionStorage access failed:', e);
    }
    return false;
  });

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const lenis = new Lenis({
      duration: 2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      infinite: false,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    (window as any).lenis = lenis;

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    if (showSplash && !menuLoading && items.length > 0) {
      const timer = setTimeout(() => {
        handleSplashComplete();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showSplash, menuLoading, items.length]);

  useEffect(() => {
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
  const [initialSearchQuery, setInitialSearchQuery] = useState('');

  useEffect(() => {
    const handleSearchState = (e: any) => {
      setIsSearching(!!e.detail);
    };
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOverlayScan(false);
        setInitialSearchQuery('');
        setIsSearchOverlayOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOverlayOpen(false);
      }
    };

    const handleGlobalSearch = (e: any) => {
        setIsSearchOverlayScan(!!e.detail?.scan);
        setInitialSearchQuery(e.detail?.query || '');
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
    window.scrollTo(0, 0);
    if ((window as any).lenis) {
      (window as any).lenis.scrollTo(0, { immediate: true });
    }
  }, [location.pathname]);

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem('splash_seen', 'true');
    setShowSplash(false);
  }, []);

  const isAdminPage = location.pathname.startsWith('/admin');
  const isProductPage = location.pathname.startsWith('/product/');
  const isUPICheckoutPage = location.pathname.startsWith('/upi-checkout');
  const isCheckoutPage = location.pathname === '/checkout';
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/finish-sign-in'].includes(location.pathname);
  
  const showCartSidebar = !isAdminPage && !isAuthPage && !isUPICheckoutPage && !isCheckoutPage;
  const showNavbar = !isAdminPage && !isAuthPage && !isProductPage && !isUPICheckoutPage;
  const hideNavFooter = isAdminPage || isProductPage || isSearching || isAuthPage || isUPICheckoutPage || isCheckoutPage;

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
        onClose={() => {
            setIsSearchOverlayOpen(false);
            setInitialSearchQuery('');
        }} 
        allItems={items}
        initialScan={isSearchOverlayScan}
        initialQuery={initialSearchQuery}
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
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 flex flex-col w-full h-full"
            >
              <Routes>
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
        <footer className={cn("border-t border-border bg-secondary/10", "pb-44 md:pb-0")}>
          <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
              <div className="space-y-6 text-center md:text-left">
                <Logo size="sm" />
                <p className="text-muted-foreground text-sm max-w-xs mx-auto md:mx-0 leading-relaxed">
                  Artisan bakery and frosty treats crafted with love. Experience the perfect blend of warmth and chill.
                </p>
              </div>

              <div className="flex flex-wrap justify-center md:justify-end gap-x-8 gap-y-4">
                <a href="https://www.instagram.com/frosty_bite07?igsh=dXpqZXE0Y2pvOWt0" target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
                  Instagram
                </a>
                <a href={`https://wa.me/${RESTAURANT_WHATSAPP}`} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
                  Support
                </a>
                <a href="#" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">Privacy</a>
                <a href="#" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">Terms</a>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-muted-foreground/60 text-[10px] font-medium uppercase tracking-widest">
                © 2026 Frosty Bite. Crafted for excellence.
              </p>
            </div>
          </div>
        </footer>
      )}

      {!hideNavFooter && (
        <a
          href={`https://wa.me/${RESTAURANT_WHATSAPP}`}
          target="_blank"
          rel="noreferrer"
          className="fixed z-50 bg-emerald-500 text-white p-4 rounded-full shadow-2xl hover:bg-emerald-600 transition-all hover:scale-110 active:scale-95 flex items-center justify-center bottom-32 right-8 md:bottom-8 md:right-8"
        >
          <MessageCircle size={24} />
        </a>
      )}

      <PWAInstallPrompt />
    </div>
  );
}

export default function App() {
  return (
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
  );
}
