import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Sidebar } from '../components/admin/Sidebar';
import { Navbar } from '../components/admin/Navbar';
import { OrderActionPopup } from '../components/admin/OrderActionPopup';
import { motion, AnimatePresence } from 'framer-motion';
import { requestForToken, onMessageListener } from '../utils/messaging';
import { useNotifications } from '../context/NotificationContext';
import toast from 'react-hot-toast';

const Dashboard = lazy(() => import('./admin/Dashboard').then(m => ({ default: m.Dashboard })));
const Orders = lazy(() => import('./admin/Orders').then(m => ({ default: m.Orders })));
const Menu = lazy(() => import('./admin/Menu').then(m => ({ default: m.Menu })));
const Analytics = lazy(() => import('./admin/Analytics').then(m => ({ default: m.Analytics })));
const Coupons = lazy(() => import('./admin/Coupons').then(m => ({ default: m.Coupons })));
const Customers = lazy(() => import('./admin/Customers').then(m => ({ default: m.Customers })));
const Admins = lazy(() => import('./admin/Admins').then(m => ({ default: m.Admins })));
const Pricing = lazy(() => import('./admin/Pricing').then(m => ({ default: m.Pricing })));
import { BannerManager } from '../components/admin/BannerManager';

export const AdminLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { incomingOrder, setIncomingOrder } = useNotifications();

  useEffect(() => {
    // Request permission and register token
    const setupNotifications = async () => {
      const token = await requestForToken();
      if (token) {
        console.log('Push notifications enabled');
      }
    };

    setupNotifications();

    // Listen for foreground messages
    onMessageListener().then((payload: any) => {
      if (payload) {
        toast.success(`${payload.notification.title}: ${payload.notification.body}`, {
          duration: 10000,
          icon: '📢'
        });
      }
    });
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'orders': return <Orders />;
      case 'customers': return <Customers />;
      case 'admins': return <Admins />;
      case 'pricing': return <Pricing />;
      case 'menu': return <Menu />;
      case 'coupons': return <Coupons />;
      case 'banners': return <BannerManager />;
      case 'riders': return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500">
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Rider Management</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              The rider management module is currently under development. 
              We are building a powerful system to track and manage your delivery fleet in real-time.
            </p>
          </div>
          <div className="px-6 py-2 bg-orange-500/20 text-orange-500 rounded-full text-sm font-bold uppercase tracking-widest animate-pulse">
            Coming Soon
          </div>
        </div>
      );
      case 'analytics': return <Analytics />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 selection:text-orange-500 overflow-x-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-svh">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <AnimatePresence mode="wait">
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            }>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {renderContent()}
              </motion.div>
            </Suspense>
          </AnimatePresence>
        </main>
      </div>
      
      {/* Global Order Notification Popup */}
      <OrderActionPopup 
        order={incomingOrder} 
        onClose={() => setIncomingOrder(null)}
        onAction={() => setIncomingOrder(null)}
      />
    </div>
  );
};

export default AdminLayout;
