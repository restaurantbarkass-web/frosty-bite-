import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { GeofenceProvider, useGeofence } from './context/GeofenceContext';
import { LockedGeofenceScreen } from './components/LockedGeofenceScreen';
import { MenuProvider } from './context/MenuContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import { BootProvider, useBoot, BootState } from './context/BootContext';
import { Toaster, toast } from 'react-hot-toast';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { SearchOverlay } from './components/Search/SearchOverlay';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingScreen } from './components/LoadingScreen';
import { LocalErrorBoundary } from './components/LocalErrorBoundary';
import { IntroSplash } from './components/IntroSplash';
import { OnboardingScreen } from './components/OnboardingScreen';
import { FlyingCartOverlay } from './components/FlyingCartOverlay';
import { RESTAURANT_WHATSAPP } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Instagram, MessageCircle, ShieldAlert } from 'lucide-react';

import { Logo } from './components/Logo';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import Lenis from '@studio-freight/lenis';

import { useAuth } from './context/AuthContext';
import { useCart } from './context/CartContext';
import { useMenu } from './context/MenuContext';
import { requestForToken, subscribeToMessages } from './utils/messaging';

// Resilient wrapper to retry dynamic lazy imports with progressive backoff and infinite reload protection
function lazyWithRetry<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(() => {
    const maxRetries = 3;
    const retryDelays = [1000, 2500, 5000];

    const executeImport = (attempt: number): Promise<{ default: T }> => {
      return importFunc().catch((error) => {
        if (attempt >= maxRetries) {
          console.error(`[LazyLoader] Dynamic import failed after ${maxRetries} attempts:`, error);
          
          // Only trigger a page reload in production (where chunk load errors can occur due to asset hash invalidations)
          // and safeguard against infinite reload cycles using sessionStorage.
          const isProd = import.meta.env.PROD;
          if (isProd) {
            const now = Date.now();
            let lastReload: string | null = null;
            try {
              lastReload = sessionStorage.getItem('last_asset_reload');
            } catch (e) {
              console.warn('[LazyLoader] failed to read from sessionStorage:', e);
            }
            const parsedLastReload = lastReload ? parseInt(lastReload, 10) : 0;
            
            // Limit reload to at most once every 20 seconds to prevent aggressive reload loops
            if (now - parsedLastReload > 20000) {
              try {
                sessionStorage.setItem('last_asset_reload', String(now));
              } catch (e) {
                console.warn('[LazyLoader] failed to write to sessionStorage:', e);
              }
              console.warn('[LazyLoader] Potential stale production asset hash. Forcing app reload to fetch latest bundle...');
              window.location.reload();
            } else {
              console.error('[LazyLoader] Asset load failed. Safe reload cooldown active, skipping reload to prevent infinite loops.');
            }
          }
          throw error;
        }

        const delay = retryDelays[attempt - 1] || 2000;
        console.warn(`[LazyLoader] Dynamic import failed (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`, error);

        return new Promise<{ default: T }>((resolve) => setTimeout(resolve, delay))
          .then(() => executeImport(attempt + 1));
      });
    };

    return executeImport(1);
  });
}

// Lazy load pages for performance with automatic reload retry fallback
const Home = lazyWithRetry(() => import('./pages/HomePage'));
const Offers = lazyWithRetry(() => import('./pages/Offers'));
const Checkout = lazyWithRetry(() => import('./pages/Checkout'));
const UPICheckout = lazyWithRetry(() => import('./pages/UPICheckout'));
const OrderTracking = lazyWithRetry(() => import('./pages/OrderTracking'));
const AdminLayout = lazyWithRetry(() => import('./pages/AdminLayout'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const FinishSignIn = lazyWithRetry(() => import('./pages/FinishSignIn'));
const ProductDetail = lazyWithRetry(() => import('./pages/ProductDetail'));
const Orders = lazyWithRetry(() => import('./pages/Orders'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));
const CartSidebar = lazyWithRetry(() => import('./components/CartSidebar').then(module => ({ default: module.CartSidebar })));

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
  const { setIsCartOpen } = useCart();
  useEffect(() => {
    setIsCartOpen(true);
  }, [setIsCartOpen]);

  return <Home />;
};

function AppContent() {
  const { user, isVerified, isAdmin, loading } = useAuth();
  const { isCheckingPosition, isAllowed } = useGeofence();
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
  }, [user]);

  useEffect(() => {
    // Disable smooth-scroll libraries on touch devices to prioritize native momentum scrolling
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
      return;
    }

    let LenisConstructor = Lenis as any;
    if (LenisConstructor && LenisConstructor.default) {
      LenisConstructor = LenisConstructor.default;
    }
    if (typeof LenisConstructor !== 'function') {
      console.warn('[Lenis] Lenis import is not a valid constructor, skipping smooth scroll.');
      return;
    }

    const lenis = new LenisConstructor({
      duration: 2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
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
    if (showSplash) {
      const timer = setTimeout(() => {
        handleSplashComplete();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showSplash, handleSplashComplete]);

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

  const isAdminPage = location.pathname.startsWith('/admin');
  const isProductPage = location.pathname.startsWith('/product/');
  const isUPICheckoutPage = location.pathname.startsWith('/upi-checkout');
  const isCheckoutPage = location.pathname === '/checkout';
  
  const PROTECTED_PATHS = ['/checkout', '/upi-checkout', '/admin', '/profile', '/orders', '/notifications'];
  const isCurrentPathProtected = PROTECTED_PATHS.some(path => location.pathname.startsWith(path));
  const bypassLocks = !user && isCurrentPathProtected;
  
  const showCartSidebar = !isAdminPage && !isAuthPage && !isUPICheckoutPage && !isCheckoutPage && !!user;
  const showNavbar = !isAdminPage && !isAuthPage && !isProductPage && !isUPICheckoutPage && !!user;
  const hideNavFooter = isAdminPage || isProductPage || isSearching || isAuthPage || isUPICheckoutPage || isCheckoutPage || !user;

  const { bootState } = useBoot();

  // 1. Central Boot Manager Initialization Guard
  if (bootState !== BootState.READY) {
    return <IntroSplash onComplete={handleSplashComplete} />;
  }

  // 1.5. Show Onboarding Tour if the guest user hasn't seen it yet and is not on an auth page
  if (!user && showOnboarding && !isAuthPage && !bypassLocks) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  // 2. If we are actively checking location, show full screen loading loader
  if (isCheckingPosition && !isAdmin && !isAuthPage && !bypassLocks) {
    return <LoadingScreen message="Sensing your delivery coordinates..." />;
  }

  // 3. If there is no confirmed/manual active zone, show user city selector lock screen
  if (!isAllowed && !isAdmin && !isAuthPage && !bypassLocks) {
    return <LockedGeofenceScreen />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Toaster position="top-right" />
      
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
        {/* IntroSplash is rendered full-screen on initial page mount */}

        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex-1 flex flex-col w-full h-full"
            >
              <Routes location={location}>
                {!user ? (
                  <>
                    <Route path="/forgot-password" element={<LocalErrorBoundary fallbackName="Forgot Password Page"><ForgotPassword /></LocalErrorBoundary>} />
                    <Route path="/finish-sign-in" element={<LocalErrorBoundary fallbackName="Finish Sign In Page"><FinishSignIn /></LocalErrorBoundary>} />
                    <Route path="*" element={<LocalErrorBoundary fallbackName="Login Page"><Login /></LocalErrorBoundary>} />
                  </>
                ) : (
                  <>
                    <Route path="/" element={<LocalErrorBoundary fallbackName="Home Page"><Home /></LocalErrorBoundary>} />
                    <Route path="/index.html" element={<LocalErrorBoundary fallbackName="Home Page"><Home /></LocalErrorBoundary>} />
                    <Route path="/cart" element={
                      <LocalErrorBoundary fallbackName="Cart Page">
                        <CartPageRoute />
                      </LocalErrorBoundary>
                    } />
                    {/* Logged-in users are forwarded instantly without page flashing or redirections */}
                    <Route path="/login" element={<Navigate to={isAdmin ? "/admin" : "/"} replace />} />
                    <Route path="/signup" element={<Navigate to={isAdmin ? "/admin" : "/"} replace />} />
                    <Route path="/forgot-password" element={<Navigate to={isAdmin ? "/admin" : "/"} replace />} />
                    <Route path="/finish-sign-in" element={<LocalErrorBoundary fallbackName="Finish Sign In Page"><FinishSignIn /></LocalErrorBoundary>} />
                    <Route path="/checkout" element={
                      <ProtectedRoute>
                        <LocalErrorBoundary fallbackName="Checkout Page">
                          <Checkout />
                        </LocalErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/upi-checkout/:orderId" element={
                      <ProtectedRoute>
                        <LocalErrorBoundary fallbackName="UPI Checkout Page">
                          <UPICheckout />
                        </LocalErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/order-tracking/:orderId" element={<LocalErrorBoundary fallbackName="Order Tracking Page"><OrderTracking /></LocalErrorBoundary>} />
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
                    <Route path="/product/:id" element={<LocalErrorBoundary fallbackName="Product Detail Page"><ProductDetail /></LocalErrorBoundary>} />
                    <Route path="*" element={<LocalErrorBoundary fallbackName="Not Found Page"><NotFound /></LocalErrorBoundary>} />
                  </>
                )}
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
          <ConfigProvider>
            <BootProvider>
              <GeofenceProvider>
                <MenuProvider>
                  <NotificationProvider>
                    <CartProvider>
                      <AppContent />
                    </CartProvider>
                  </NotificationProvider>
                </MenuProvider>
              </GeofenceProvider>
            </BootProvider>
          </ConfigProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
