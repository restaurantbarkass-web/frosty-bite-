import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { GeofenceProvider, useGeofence } from './context/GeofenceContext';
import { LockedGeofenceScreen } from './components/LockedGeofenceScreen';
import { MenuProvider } from './context/MenuContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster, toast } from 'react-hot-toast';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { CartSidebar } from './components/CartSidebar';
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

import Offers from './pages/Offers';

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
            const lastReload = sessionStorage.getItem('last_asset_reload');
            const parsedLastReload = lastReload ? parseInt(lastReload, 10) : 0;
            
            // Limit reload to at most once every 20 seconds to prevent aggressive reload loops
            if (now - parsedLastReload > 20000) {
              sessionStorage.setItem('last_asset_reload', String(now));
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

const PageLoader = () => <LoadingScreen fullScreen={false} />;

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
    sessionStorage.setItem('splash_seen', 'true');
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
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    if (!loading && !showSplash && !showOnboarding && !user && !isAuthPage) {
      navigate('/login', { replace: true });
    }
  }, [loading, showSplash, showOnboarding, user, isAuthPage, navigate]);

  useEffect(() => {
    if (!loading && user && isAuthPage) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [loading, user, isAuthPage, isAdmin, navigate]);

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
  
  const showCartSidebar = !isAdminPage && !isAuthPage && !isUPICheckoutPage && !isCheckoutPage;
  const showNavbar = !isAdminPage && !isAuthPage && !isProductPage && !isUPICheckoutPage;
  const hideNavFooter = isAdminPage || isProductPage || isSearching || isAuthPage || isUPICheckoutPage || isCheckoutPage;

  // 0. If we are actively restoring or synchronizing user identity, show a pristine cinematic loader
  if (loading) {
    return <LoadingScreen message="Restoring session..." />;
  }

  // 0.5. If the user is already authenticated but lands on an auth page, show a splash transition during redirection
  if (user && isAuthPage) {
    return <LoadingScreen message="Accessing your gourmet kitchen..." />;
  }

  // 1. Show the Intro Splash first if it hasn't been dismissed yet
  if (showSplash && !isAdmin && !isAuthPage && !bypassLocks) {
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
      {showCartSidebar && <CartSidebar />}
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
              initial={typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? { opacity: 0, y: 8 } : { opacity: 0, filter: "blur(4px)" }}
              animate={typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? { opacity: 1, y: 0 } : { opacity: 1, filter: "blur(0px)" }}
              exit={typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? { opacity: 0, y: -8 } : { opacity: 0, filter: "blur(4px)" }}
              transition={typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? { duration: 0.2, ease: "easeOut" } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col w-full h-full"
            >
              <Routes>
                <Route path="/" element={<LocalErrorBoundary fallbackName="Home Page"><Home /></LocalErrorBoundary>} />
                <Route path="/index.html" element={<LocalErrorBoundary fallbackName="Home Page"><Home /></LocalErrorBoundary>} />
                <Route path="/login" element={<LocalErrorBoundary fallbackName="Login Page"><Login /></LocalErrorBoundary>} />
                <Route path="/signup" element={<LocalErrorBoundary fallbackName="Signup Page"><Login /></LocalErrorBoundary>} />
                <Route path="/forgot-password" element={<LocalErrorBoundary fallbackName="Forgot Password Page"><ForgotPassword /></LocalErrorBoundary>} />
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
          <GeofenceProvider>
            <MenuProvider>
              <NotificationProvider>
                <CartProvider>
                  <AppContent />
                </CartProvider>
              </NotificationProvider>
            </MenuProvider>
          </GeofenceProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
