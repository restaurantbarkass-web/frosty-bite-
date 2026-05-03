import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { CartSidebar } from './components/CartSidebar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingScreen } from './components/LoadingScreen';
import { IntroSplash } from './components/IntroSplash';
import { RESTAURANT_WHATSAPP } from './constants';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Instagram, MessageCircle } from 'lucide-react';

import { Logo } from './components/Logo';

import { ErrorBoundary } from './components/ErrorBoundary';

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
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoader = () => <LoadingScreen fullScreen={false} />;

import { useCart } from './context/CartContext';

// Forced rebuild for artifact detection
function AppContent() {
  const { isCartOpen, setIsCartOpen } = useCart();
  const [isSearching, setIsSearching] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
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

  useEffect(() => {
    const handleSearchState = (e: any) => {
      setIsSearching(e.detail);
    };
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('is-searching', handleSearchState);
    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('is-searching', handleSearchState);
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  const isAdminPage = location.pathname.startsWith('/admin');
  const isProductPage = location.pathname.startsWith('/product/');
  const isUPICheckoutPage = location.pathname.startsWith('/upi-checkout');
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/finish-sign-in'].includes(location.pathname);
  
  // Sidebar should be available on almost all pages
  const showCartSidebar = !isAdminPage && !isAuthPage && !isUPICheckoutPage;
  // Navbar should be available on home and others, but maybe not auth/admin
  const showNavbar = !isAdminPage && !isAuthPage && !isProductPage && !isUPICheckoutPage;
  // Bottom nav and footer have their own hiding rules
  const hideNavFooter = isAdminPage || isProductPage || isSearching || isAuthPage || isUPICheckoutPage;

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem('splash_seen', 'true');
    setShowSplash(false);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Toaster position="top-right" />
      <AnimatePresence>
        {quotaExceeded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-amber-500 text-black px-4 py-2 text-center text-[10px] font-black uppercase tracking-widest relative z-[100]"
          >
            ⚠️ Database limit reached! Showing cached menu. New orders may be limited.
            <button onClick={() => setQuotaExceeded(false)} className="ml-4 underline">Close</button>
          </motion.div>
        )}
        {showSplash && location.pathname === '/' && (
          <IntroSplash onComplete={handleSplashComplete} />
        )}
      </AnimatePresence>

      {showNavbar && <Navbar onCartClick={() => setIsCartOpen(true)} />}
      {showCartSidebar && <CartSidebar />}
      {!hideNavFooter && !isCartOpen && <BottomNav onCartClick={() => setIsCartOpen(true)} />}
      
      <main className={cn(
        "transition-all flex-1 flex flex-col min-h-svh",
        showNavbar && "pt-24 md:pt-28", // Add padding for fixed Navbar
        !hideNavFooter && "pb-40 md:pb-0"
      )}>
        <Suspense fallback={<PageLoader />}>
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
              <ProtectedRoute allowedRoles={['admin']} autoLogout={true}>
                <AdminLayout />
              </ProtectedRoute>
            } />
            <Route path="/rider/*" element={
              <ProtectedRoute allowedRoles={['rider']}>
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
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
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
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <CartProvider>
              <AppContent />
            </CartProvider>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
