import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate, Link } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { GeofenceProvider, useGeofence } from './context/GeofenceContext';
import { LockedGeofenceScreen } from './components/LockedGeofenceScreen';
import { MenuProvider } from './context/MenuContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import { useAppConfig } from './hooks/useAppConfig';
import { BootProvider, useBoot, BootState } from './context/BootContext';
import { VersionProvider } from './context/VersionContext';
import { CustomToaster } from './components/CustomToaster';
import { toast } from 'react-hot-toast';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingScreen } from './components/LoadingScreen';
import { LocalErrorBoundary } from './components/LocalErrorBoundary';
import { IntroSplash } from './components/IntroSplash';
import { OnboardingScreen } from './components/OnboardingScreen';
import { AppUpdateScreen } from './components/AppUpdateScreen';
import { FlyingCartOverlay } from './components/FlyingCartOverlay';
import { RESTAURANT_WHATSAPP } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Instagram, ShieldAlert } from 'lucide-react';

import { Logo } from './components/Logo';
import { PerformanceTierProvider } from './context/PerformanceTierContext';
import { NotificationPermissionBanner } from './components/NotificationPermissionBanner';
import { isSupabaseConfigured } from './supabase';

import { useAuth } from './context/AuthContext';
import { useCart, useCartActions } from './context/CartContext';
import { useMenu } from './context/MenuContext';
import { requestForToken, subscribeToMessages } from './utils/messaging';
import { lazyWithRetry } from './utils/lazyWithRetry';

import Home from './pages/HomePage';
import CategoriesPage from './pages/CategoriesPage';
import Offers from './pages/Offers';
import Checkout from './pages/Checkout';
import Profile from './pages/Profile';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import FinishSignIn from './pages/FinishSignIn';
import ProductDetail from './pages/ProductDetail';
import Orders from './pages/Orders';
import Notifications from './pages/Notifications';
import FAQ from './pages/FAQ';
import NotFound from './pages/NotFound';
import CartSidebar from './components/CartSidebar';

const UPICheckout = lazyWithRetry(() => import('./pages/UPICheckout'));
const OrderTracking = lazyWithRetry(() => import('./pages/OrderTracking'));
const AdminLayout = lazyWithRetry(() => import('./pages/AdminLayout'));
const SearchOverlay = lazyWithRetry(() => import('./components/Search/SearchOverlay'));
const FeedbackPage = lazyWithRetry(() => import('./pages/FeedbackPage'));

const PageLoader = () => (
  <div className="fixed top-0 left-0 right-0 z-[110] pointer-events-none">
    <div className="h-[3px] w-full bg-white/5 relative overflow-hidden">
      <motion.div 
        animate={{ 
          x: ["-100%", "200%"] 
        }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
      />
    </div>
  </div>
);

const CartPageRoute: React.FC = () => {
  const { setIsCartOpen } = useCartActions();
  useEffect(() => {
    setIsCartOpen(true);
  }, [setIsCartOpen]);

  return <Home />;
};

const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, loading, authStatus } = useAuth();
  if (loading || authStatus === 'loading') {
    return <LoadingScreen fullScreen={true} />;
  }
  if (user) {
    return <Navigate to={isAdmin ? "/admin" : "/"} replace />;
  }
  return <>{children}</>;
};

function AppContent() {
  const { user, isVerified, isAdmin, loading } = useAuth();
  const { isCheckingPosition, isAllowed } = useGeofence();
  const { geofencingEnabled } = useAppConfig();
  const { isCartOpen, setIsCartOpen } = useCart();
  const { items, loading: menuLoading } = useMenu();
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [showVerificationBanner, setShowVerificationBanner] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Welcome back online! Keep ordering your favorite treats.", { id: 'online-toast', duration: 4500 });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("You are operating offline. Browsing cached menu is available.", { id: 'offline-toast', duration: 6000 });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
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

  const handleSplashComplete = useCallback(() => {
    try {
      sessionStorage.setItem('splash_seen', 'true');
    } catch (e) {
      console.warn('Failed to write splash_seen to sessionStorage:', e);
    }
    setShowSplash(false);
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/finish-sign-in'].includes(location.pathname);

  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return !localStorage.getItem('onboarding_completed');
      }
    } catch (e) {
      console.warn('localStorage access failed:', e);
    }
    return true;
  });

  const handleOnboardingComplete = useCallback(() => {
    try {
      localStorage.setItem('onboarding_completed', 'true');
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
    setShowOnboarding(false);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Request customer notification permission and register token
    const setupCustomerNotifications = async () => {
      try {
        const token = await requestForToken();
        if (token) {
          console.log('[FCM] Customer notifications initialized successfully');
        }
      } catch (err) {
        console.warn('[FCM] Customer notification initialization failed:', err);
      }
    };

    setupCustomerNotifications();

    // Set up foreground message listener
    let active = true;
    const unsubscribeFCM = subscribeToMessages((payload) => {
      if (active && payload?.notification) {
        toast.success(`${payload.notification.title}: ${payload.notification.body}`, {
          duration: 8000,
          icon: '📣'
        });
      }
    });

    return () => {
      active = false;
      unsubscribeFCM();
    };
  }, [user?.uid || user?.id]);

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
  }, [location.pathname]);

  const isAdminPage = location.pathname.startsWith('/admin');
  const isProductPage = location.pathname.startsWith('/product/');
  const isUPICheckoutPage = location.pathname.startsWith('/upi-checkout');
  const isCheckoutPage = location.pathname === '/checkout';
  const isFeedbackPage = location.pathname.startsWith('/feedback');
  
  const isHomePage = location.pathname === '/' || location.pathname === '/index.html' || location.pathname === '/categories';
  const showCartSidebar = !isAdminPage && !isAuthPage && !isUPICheckoutPage && !isCheckoutPage && !isFeedbackPage;
  const showNavbar = !isHomePage && !isAdminPage && !isAuthPage && !isUPICheckoutPage && !isProductPage && !isFeedbackPage;
  const hideNavFooter = isAdminPage || isProductPage || isSearching || isAuthPage || isUPICheckoutPage || isCheckoutPage || isFeedbackPage;

  const { bootState } = useBoot();

  // 1. Instant App Render (No blocking splash video)
  // Non-blocking background sync handles boot, profile, and geofence updates.

  // 3. STRICT Geofence Location Lock: Temporarily disabled (geofencing service deactivated, ready for reactivation)
  // if (geofencingEnabled !== false && !isAllowed && !isAdmin && !isAuthPage) {
  //   return <LockedGeofenceScreen />;
  // }

  return (
    <div 
      className={cn(
        "min-h-screen font-sans overflow-x-hidden transition-colors",
        isHomePage ? "bg-[#FAF8F5] text-stone-900" : "bg-background text-foreground"
      )}
      style={isHomePage ? { backgroundColor: '#FAF8F5' } : undefined}
    >
      <CustomToaster />
      
      {isOffline && (
        <div className="bg-amber-600 text-white font-sans px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 relative z-[100] shadow-md transition-all">
          <span>📡 Operating in Offline Mode. Browsing local cached treats. Placed orders will sync upon active connection.</span>
        </div>
      )}
      
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

      {!isSupabaseConfigured && (
        <div className="bg-red-600 text-white px-4 py-3 text-center text-xs font-bold uppercase tracking-wider relative z-[110] flex items-center justify-center gap-2">
          <ShieldAlert size={16} />
          <span>[Supabase Warning] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured. Please set them in Vercel environment variables and redeploy.</span>
        </div>
      )}

      {quotaExceeded && (
        <div className="bg-amber-500 text-black px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest relative z-[100]">
          ⚠️ Database limit reached! Showing cached menu. New orders may be limited.
          <button onClick={() => setQuotaExceeded(false)} className="ml-4 underline">Close</button>
        </div>
      )}

      {showNavbar && <Navbar onCartClick={() => setIsCartOpen(true)} onSearchClick={() => setIsSearchOverlayOpen(true)} />}
      {showCartSidebar && (
        <Suspense fallback={null}>
          <CartSidebar />
        </Suspense>
      )}
      {!hideNavFooter && !isCartOpen && <BottomNav onCartClick={() => setIsCartOpen(true)} />}
      <FlyingCartOverlay />
      
      {isSearchOverlayOpen && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
      
      <main className={cn(
        "transition-all flex-1 flex flex-col min-h-svh relative",
        showNavbar && "pt-24 md:pt-28",
        !hideNavFooter && "pb-40 md:pb-0"
      )}>
        {/* IntroSplash is rendered full-screen on initial page mount */}

        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 flex flex-col w-full h-full"
            >
              <Routes location={location}>
                <Route path="/" element={<LocalErrorBoundary fallbackName="Home Page"><Home /></LocalErrorBoundary>} />
                <Route path="/index.html" element={<LocalErrorBoundary fallbackName="Home Page"><Home /></LocalErrorBoundary>} />
                <Route path="/categories" element={<LocalErrorBoundary fallbackName="Categories Page"><CategoriesPage /></LocalErrorBoundary>} />
                <Route path="/cart" element={
                  <LocalErrorBoundary fallbackName="Cart Page">
                    <CartPageRoute />
                  </LocalErrorBoundary>
                } />
                <Route path="/login" element={
                  <PublicOnlyRoute>
                    <LocalErrorBoundary fallbackName="Login Page"><Login /></LocalErrorBoundary>
                  </PublicOnlyRoute>
                } />
                <Route path="/signup" element={
                  <PublicOnlyRoute>
                    <LocalErrorBoundary fallbackName="Login Page"><Login /></LocalErrorBoundary>
                  </PublicOnlyRoute>
                } />
                <Route path="/forgot-password" element={
                  <PublicOnlyRoute>
                    <LocalErrorBoundary fallbackName="Forgot Password Page"><ForgotPassword /></LocalErrorBoundary>
                  </PublicOnlyRoute>
                } />
                <Route path="/finish-sign-in" element={<LocalErrorBoundary fallbackName="Finish Sign In Page"><FinishSignIn /></LocalErrorBoundary>} />
                <Route path="/checkout" element={
                  <LocalErrorBoundary fallbackName="Checkout Page">
                    <Checkout />
                  </LocalErrorBoundary>
                } />
                <Route path="/upi-checkout/:orderId" element={
                  <LocalErrorBoundary fallbackName="UPI Checkout Page">
                    <UPICheckout />
                  </LocalErrorBoundary>
                } />
                <Route path="/order-tracking" element={<LocalErrorBoundary fallbackName="Order Tracking Page"><OrderTracking /></LocalErrorBoundary>} />
                <Route path="/order-tracking/:orderId" element={<LocalErrorBoundary fallbackName="Order Tracking Page"><OrderTracking /></LocalErrorBoundary>} />
                <Route path="/track" element={<LocalErrorBoundary fallbackName="Order Tracking Page"><OrderTracking /></LocalErrorBoundary>} />
                <Route path="/track/:orderId" element={<LocalErrorBoundary fallbackName="Order Tracking Page"><OrderTracking /></LocalErrorBoundary>} />
                <Route path="/feedback" element={<LocalErrorBoundary fallbackName="Feedback Page"><FeedbackPage /></LocalErrorBoundary>} />
                <Route path="/feedback/:orderId" element={<LocalErrorBoundary fallbackName="Feedback Page"><FeedbackPage /></LocalErrorBoundary>} />
                <Route path="/admin/*" element={
                  <ProtectedRoute allowedRoles={['admin']} autoLogout={true} requireVerification={true}>
                    <LocalErrorBoundary fallbackName="Admin Control Panel">
                      <AdminLayout />
                    </LocalErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <LocalErrorBoundary fallbackName="User Profile Page">
                      <Profile />
                    </LocalErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/orders" element={
                  <ProtectedRoute>
                    <LocalErrorBoundary fallbackName="Your Orders Page">
                      <Orders />
                    </LocalErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/notifications" element={
                  <ProtectedRoute>
                    <LocalErrorBoundary fallbackName="Notifications Page">
                      <Notifications />
                    </LocalErrorBoundary>
                  </ProtectedRoute>
                } />
                <Route path="/offers" element={<LocalErrorBoundary fallbackName="Offers Page"><Offers /></LocalErrorBoundary>} />
                <Route path="/faq" element={<LocalErrorBoundary fallbackName="FAQ Page"><FAQ /></LocalErrorBoundary>} />
                <Route path="/product/:id" element={<LocalErrorBoundary fallbackName="Product Detail Page"><ProductDetail /></LocalErrorBoundary>} />
                <Route path="*" element={<LocalErrorBoundary fallbackName="Not Found Page"><NotFound /></LocalErrorBoundary>} />
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
                <Link to="/faq" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
                  FAQ
                </Link>
                <a href="https://www.instagram.com/frosty_bite07?igsh=dXpqZXE0Y2pvOWt0" target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
                  Instagram
                </a>
                <a href={`https://wa.me/${RESTAURANT_WHATSAPP}`} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
                  Support
                </a>
                <a href="https://frosty-bite-privacy-and-policy.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">Privacy</a>
                <a href="https://frosty-bite-privacy-and-policy.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">Terms</a>
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


      <NotificationPermissionBanner />
      <AppUpdateScreen />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ThemeProvider>
        <PerformanceTierProvider>
          <AuthProvider>
            <ConfigProvider>
              <BootProvider>
                <VersionProvider>
                  <GeofenceProvider>
                    <MenuProvider>
                      <NotificationProvider>
                        <CartProvider>
                          <AppContent />
                        </CartProvider>
                      </NotificationProvider>
                    </MenuProvider>
                  </GeofenceProvider>
                </VersionProvider>
              </BootProvider>
            </ConfigProvider>
          </AuthProvider>
        </PerformanceTierProvider>
      </ThemeProvider>
    </Router>
  );
}
