import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Sidebar } from '../components/admin/Sidebar';
import { Navbar } from '../components/admin/Navbar';
import { OrderActionPopup } from '../components/admin/OrderActionPopup';
import { motion, AnimatePresence } from 'motion/react';
import { requestForToken, subscribeToMessages } from '../utils/messaging';
import { useNotifications } from '../context/NotificationContext';
import toast from 'react-hot-toast';

const Dashboard = lazy(() => import('./admin/Dashboard').then(m => ({ default: m.Dashboard })));
const Orders = lazy(() => import('./admin/Orders').then(m => ({ default: m.Orders })));
const Menu = lazy(() => import('./admin/Menu').then(m => ({ default: m.Menu })));
const Analytics = lazy(() => import('./admin/Analytics').then(m => ({ default: m.Analytics })));
const Coupons = lazy(() => import('./admin/Coupons').then(m => ({ default: m.Coupons })));
const Customers = lazy(() => import('./admin/Customers').then(m => ({ default: m.Customers })));
const FeedbackManagement = lazy(() => import('./admin/FeedbackManagement').then(m => ({ default: m.FeedbackManagement })));
const Admins = lazy(() => import('./admin/Admins').then(m => ({ default: m.Admins })));
const Pricing = lazy(() => import('./admin/Pricing').then(m => ({ default: m.Pricing })));
const SearchAnalytics = lazy(() => import('./admin/SearchAnalytics').then(m => ({ default: m.SearchAnalytics })));
const Rewards = lazy(() => import('./admin/Rewards').then(m => ({ default: m.RewardsManager })));
const ServiceZones = lazy(() => import('./admin/ServiceZones').then(m => ({ default: m.ServiceZones })));
const RlsDiagnostics = lazy(() => import('./admin/RlsDiagnostics').then(m => ({ default: m.RlsDiagnostics })));
const BannerManager = lazy(() => import('../components/admin/BannerManager').then(m => ({ default: m.BannerManager })));
const NotificationCenter = lazy(() => import('./admin/NotificationCenter').then(m => ({ default: m.NotificationCenter })));

export const AdminLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { incomingOrder, setIncomingOrder } = useNotifications();

  useEffect(() => {
    // Request permission and register token
    const setupNotifications = async () => {
      try {
        const token = await requestForToken();
        if (token) {
          console.log('Push notifications enabled');
        }
      } catch (err) {
        console.warn('Notification setup failed:', err);
      }
    };

    setupNotifications();

    // Listen for foreground messages
    const unsubscribe = subscribeToMessages((payload: any) => {
      if (payload?.notification) {
        toast.success(`${payload.notification.title || 'Notification'}: ${payload.notification.body || ''}`, {
          duration: 10000,
          icon: '📢'
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'orders': return <Orders />;
      case 'notifications': return <NotificationCenter />;
      case 'customers': return <Customers />;
      case 'feedback': return <FeedbackManagement />;
      case 'admins': return <Admins />;
      case 'pricing': return <Pricing />;
      case 'menu': return <Menu />;
      case 'rewards': return <Rewards />;
      case 'coupons': return <Coupons />;
      case 'banners': return <BannerManager />;
      case 'analytics': return <Analytics />;
      case 'search-analytics': return <SearchAnalytics />;
      case 'service-zones': return <ServiceZones />;
      case 'rls-diagnostics': return <RlsDiagnostics />;
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
      <div className="flex-1 flex flex-col min-w-0 min-h-svh h-screen overflow-hidden">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main 
          className="flex-1 p-4 sm:p-8 overflow-y-auto custom-scrollbar pb-[calc(2rem+env(safe-area-inset-bottom))]"
          data-lenis-prevent
        >
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
