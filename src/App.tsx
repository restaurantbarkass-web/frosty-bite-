import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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

import { Logo } from './components/Logo';

// Lazy load pages for performance
const Home = lazy(() => import('./pages/HomePage').then(m => ({ default: m.Home })));
const Checkout = lazy(() => import('./pages/Checkout').then(m => ({ default: m.Checkout })));
const OrderTracking = lazy(() => import('./pages/OrderTracking').then(m => ({ default: m.OrderTracking })));
const AdminLayout = lazy(() => import('./pages/AdminLayout').then(m => ({ default: m.AdminLayout })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const RiderPanel = lazy(() => import('./pages/RiderPanel').then(m => ({ default: m.RiderPanel })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/Signup').then(m => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ProductDetail = lazy(() => import('./pages/ProductDetail').then(m => ({ default: m.ProductDetail })));
const Orders = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));

const PageLoader = () => <LoadingScreen fullScreen={false} />;

function AppContent() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showSplash, setShowSplash] = useState(() => {
    // Show splash only once per session
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('splash_seen');
    }
    return true;
  });

  const location = useLocation();

  useEffect(() => {
    const handleSearchState = (e: any) => {
      setIsSearching(e.detail);
    };
    window.addEventListener('is-searching', handleSearchState);
    return () => window.removeEventListener('is-searching', handleSearchState);
  }, []);

  const isAdminPage = location.pathname.startsWith('/admin');
  const isProductPage = location.pathname.startsWith('/product/');
  const hideNavFooter = isAdminPage || isProductPage || isSearching;

  const handleSplashComplete = () => {
    sessionStorage.setItem('splash_seen', 'true');
    setShowSplash(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Toaster position="top-right" />
      <AnimatePresence>
        {showSplash && location.pathname === '/' && (
          <IntroSplash onComplete={handleSplashComplete} />
        )}
      </AnimatePresence>

      {!hideNavFooter && <Navbar onCartClick={() => setIsCartOpen(true)} />}
      {!hideNavFooter && <CartSidebar isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />}
      {!hideNavFooter && !isCartOpen && <BottomNav onCartClick={() => setIsCartOpen(true)} />}
      
      <main className={cn(
        "transition-all",
        !hideNavFooter && "pb-40 md:pb-0" // Add bottom padding on mobile to clear BottomNav
      )}>
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/checkout" element={
              <ProtectedRoute allowedRoles={['customer', 'admin']}>
                <Checkout />
              </ProtectedRoute>
            } />
            <Route path="/order-tracking/:orderId" element={
              <ProtectedRoute>
                <OrderTracking />
              </ProtectedRoute>
            } />
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
            <Route path="/product/:id" element={<ProductDetail />} />
          </Routes>
        </Suspense>
      </main>

      {!hideNavFooter && (
        <footer className={cn(
          "border-t border-border py-12 bg-secondary/20",
          "pb-40 md:py-12" // Extra padding for footer too on mobile
        )}>
          <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center mb-6">
              <Logo size="sm" />
            </div>
            <p className="text-muted text-sm">© 2026 Frosty Bite Bakery. All rights reserved.</p>
            <div className="flex justify-center space-x-6 mt-6 text-muted text-xs uppercase tracking-widest font-bold">
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a 
                href={`https://wa.me/${RESTAURANT_WHATSAPP}`} 
                target="_blank" 
                rel="noreferrer"
                className="hover:text-primary transition-colors flex items-center gap-1"
              >
                Support 💬
              </a>
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

import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <ThemeProvider>
              <CartProvider>
                <AppContent />
              </CartProvider>
            </ThemeProvider>
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
