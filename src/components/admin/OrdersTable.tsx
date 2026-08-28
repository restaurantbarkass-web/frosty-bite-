import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, ExternalLink, User, Clock, CheckCircle2, Truck, Package, MessageCircle, MessageSquare, X, Trash2, Edit2, Volume2, VolumeX, Printer, Bell, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../../firebase';
import { supabase } from '../../supabase';
import { supabaseService } from '../../services/supabaseService';
import { sendWhatsAppMessage } from '../../utils/whatsapp';
import { KOTPrint } from './KOTPrint';
import { OrderEditPage } from '../../pages/admin/OrderEditPage';
import toast from 'react-hot-toast';
import { useNotifications } from '../../context/NotificationContext';
import { rewardsService } from '../../services/rewardsService';
import { emailService } from '../../services/emailService';

import { Order } from '../../types';
import { ImageZoom } from '../ImageZoom';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { SlideConfirmModal } from '../ui/SlideConfirmModal';
import { SlideToConfirm } from '../ui/SlideToConfirm';
import { showDeviceNotification } from '../../utils/messaging';
import { AdminCancellationSuccessModal } from './AdminCancellationSuccessModal';
import { AdminDeliverySuccessModal } from './AdminDeliverySuccessModal';

const StatusBadge = ({ order }: { order: Order }) => {
  const { status, payment_status, payment_method } = order;
  
  if ((payment_method === 'upi' || payment_method === 'online') && order.utr && payment_status !== 'paid') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold bg-amber-500/10 text-amber-500 border-amber-500/20">
        <Clock size={14} />
        {payment_status === 'pending_verification' ? 'Awaiting Verification' : 'Awaiting Payment'}
      </div>
    );
  }

  const styles = {
    'awaiting_payment': 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20 shadow-sm',
    'pending': 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-sm',
    'confirmed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-sm',
    'assigned': 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm',
    'preparing': 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-sm',
    'out_for_delivery': 'bg-purple-500/10 text-purple-500 border-purple-500/20 shadow-sm',
    'delivered': 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30 shadow-sm',
    'cancelled': 'bg-red-500/10 text-red-500 border-red-500/20 shadow-sm',
  };

  const icons = {
    'awaiting_payment': <Clock size={14} />,
    'pending': <Clock size={14} />,
    'confirmed': <CheckCircle2 size={14} />,
    'preparing': <Package size={14} />,
    'out_for_delivery': <Truck size={14} />,
    'delivered': <CheckCircle2 size={14} />,
    'cancelled': <X size={14} />,
  };

  const labels = {
    'awaiting_payment': 'Awaiting Payment',
    'pending': 'Pending',
    'confirmed': 'Confirmed (Paid)',
    'preparing': 'Preparing',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${styles[status as keyof typeof styles] || styles.pending}`}>
      {icons[status as keyof typeof icons] || icons.pending}
      {labels[status as keyof typeof labels] || labels.pending}
    </div>
  );
};

interface OrdersTableProps {
  orders: Order[];
  loading?: boolean;
  onOptimisticUpdate?: (orderId: string, updates: Partial<Order>) => void;
  onOptimisticDelete?: (orderId: string) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ 
  orders: rawOrders, 
  loading: externalLoading,
  onOptimisticUpdate,
  onOptimisticDelete
}) => {
  const [localOrders, setLocalOrders] = useState<Order[]>(() => Array.isArray(rawOrders) ? rawOrders : []);

  useEffect(() => {
    if (Array.isArray(rawOrders)) {
      setLocalOrders(rawOrders);
    }
  }, [rawOrders]);

  const orders = localOrders;
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancellingReason, setCancellingReason] = useState<string>('Out of Stock');
  const [cancelledOrderForWhatsApp, setCancelledOrderForWhatsApp] = useState<{ order: Order; reason?: string } | null>(null);
  const [deliveredOrderForWhatsApp, setDeliveredOrderForWhatsApp] = useState<Order | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const lastOrderCountRef = useRef<number>(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitializedRef = useRef(false);

  const { addNotification } = useNotifications();
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [editFormData, setEditFormData] = useState<{
    customer_name: string;
    phone: string;
    address: string;
    notes: string;
    estimated_delivery_time: number | string;
  }>({
    customer_name: '',
    phone: '',
    address: '',
    notes: '',
    estimated_delivery_time: 30
  });

  useEffect(() => {
    // Check permission on mount
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    
    setInternalLoading(false);
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        toast.success('Notifications enabled!');
      }
    }
  };

  // Real-time tracking for auto-print only when genuinely new incoming orders arrive
  useEffect(() => {
    if (loading || orders.length === 0) return;

    // On initial load or first data arrival, populate known IDs without printing/alerting
    if (!hasInitializedRef.current) {
      orders.forEach(o => knownOrderIdsRef.current.add(o.id));
      lastOrderCountRef.current = orders.length;
      hasInitializedRef.current = true;
      return;
    }

    // Identify newly added orders since initial load
    const newOrders = orders.filter(o => !knownOrderIdsRef.current.has(o.id));
    
    if (newOrders.length > 0) {
      newOrders.forEach(o => knownOrderIdsRef.current.add(o.id));

      // Auto-print newest order if merchant explicitly enabled auto-print
      if (autoPrint && newOrders[0]) {
        handlePrintKOT(newOrders[0], true);
      }
    }

    lastOrderCountRef.current = orders.length;
  }, [orders, autoPrint, loading]);

  const sortedOrders = React.useMemo(() => {
    let sortableOrders = [...orders];
    if (sortConfig !== null) {
      sortableOrders.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Order];
        let bValue: any = b[sortConfig.key as keyof Order];

        if (sortConfig.key === 'customer_name') {
          aValue = aValue || '';
          bValue = bValue || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableOrders;
  }, [orders, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />;
  };

  const alarmRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const hasPending = orders.some(o => o.status === 'pending');
    
    if (hasPending && !isMuted) {
      if (!audioRef.current) {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audioRef.current.loop = true;
        audioRef.current.volume = 1.0;
      }
      audioRef.current.play().catch(err => {
        console.log('Audio play blocked by browser. User interaction required.', err);
      });
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [orders, isMuted]);

  const stopAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const verifyPayment = async (orderId: string) => {
    stopAlarm();
    const prevOrder = orders.find(o => o.id === orderId);
    const optimisticUpdates: Partial<Order> = {
      payment_status: 'paid',
      status: 'confirmed',
      updated_at: new Date().toISOString()
    };

    // Apply Optimistic Update Immediately
    setLocalOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...optimisticUpdates } : o));
    onOptimisticUpdate?.(orderId, optimisticUpdates);

    const loadingToast = toast.loading('Verifying payment...');
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      const order = prevOrder;
      if (order && order.user_id !== 'guest' && order.user_id) {
        addNotification({
          title: 'Payment Verified',
          message: `Your payment for order #${orderId.slice(-6).toUpperCase()} has been verified.`,
          type: 'order',
          user_id: order.user_id,
          link: `/order-tracking/${orderId}`
        });

        // Send Order Confirmation Email via Resend
        if (order.email) {
          emailService.sendOrderConfirmation(order.email, orderId, order.total)
            .catch(err => console.error('Failed to send confirmation email on verification:', err));
        }
      }

      toast.success('Payment verified & Order confirmed!', { id: loadingToast });
    } catch (error: any) {
      console.error('Verify payment error:', error);
      // Rollback on failure
      if (prevOrder) {
        setLocalOrders(prev => prev.map(o => o.id === orderId ? prevOrder : o));
        onOptimisticUpdate?.(orderId, prevOrder);
      }
      toast.error(error.message || 'Verification failed', { id: loadingToast });
    }
  };

  const rejectPayment = async (orderId: string, bypassSlideBar = false) => {
    const orderToCancel = orders.find(o => o.id === orderId);
    if (!bypassSlideBar && orderToCancel) {
      setCancellingOrder(orderToCancel);
      return;
    }
    stopAlarm();

    const prevOrder = orders.find(o => o.id === orderId);
    const optimisticUpdates: Partial<Order> = {
      payment_status: 'pending',
      status: 'cancelled',
      utr: null,
      notes: "Admin rejected payment proof (UTR). If you already paid, your money will be refunded according to our policy within 24 hours. Please contact support.",
      updated_at: new Date().toISOString()
    };

    // Apply Optimistic Update Immediately
    setLocalOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...optimisticUpdates } : o));
    onOptimisticUpdate?.(orderId, optimisticUpdates);

    const loadingToast = toast.loading('Rejecting order...');
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'pending',
          status: 'cancelled',
          utr: null,
          notes: "Admin rejected payment proof (UTR). If you already paid, your money will be refunded according to our policy within 24 hours. Please contact support.",
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      const order = prevOrder;
      if (order && order.user_id !== 'guest' && order.user_id) {
        addNotification({
          title: 'Order Rejected & Refund Initiated',
          message: `Order #${orderId.slice(-6).toUpperCase()} rejected. If paid, refund will be processed within 24 hrs as per policy.`,
          type: 'order',
          user_id: order.user_id,
          link: `/order-tracking/${orderId}`
        });
      }

      toast.success('Order rejected & cancelled. Refund notice sent.', { id: loadingToast });
    } catch (error: any) {
      console.error('Reject payment error:', error);
      // Rollback on failure
      if (prevOrder) {
        setLocalOrders(prev => prev.map(o => o.id === orderId ? prevOrder : o));
        onOptimisticUpdate?.(orderId, prevOrder);
      }
      toast.error(error.message || 'Rejection failed', { id: loadingToast });
    }
  };

  const updateStatus = async (id: string, newStatus: Order['status'], bypassSlideBar = false, customReason?: string) => {
    const reasonToUse = (customReason || cancellingReason || 'Cancelled by Administrator').trim() || 'Cancelled by Administrator';

    if (newStatus === 'cancelled' && !bypassSlideBar) {
      const orderToCancel = orders.find(o => o.id === id);
      if (orderToCancel) {
        setCancellingReason(orderToCancel.cancellation_reason || 'Out of Stock');
        setCancellingOrder(orderToCancel);
        return;
      }
    }
    if (newStatus === 'confirmed' || newStatus === 'cancelled') {
      stopAlarm();
    }

    const prevOrder = orders.find(o => o.id === id);
    const optimisticUpdates: Partial<Order> = { 
      status: newStatus,
      cancellation_reason: newStatus === 'cancelled' ? reasonToUse : prevOrder?.cancellation_reason,
      updated_at: new Date().toISOString() 
    };
    
    if (newStatus === 'confirmed') {
      optimisticUpdates.payment_status = 'paid';
    }

    // Apply Optimistic Update Immediately
    setLocalOrders(prev => prev.map(o => o.id === id ? { ...o, ...optimisticUpdates } : o));
    onOptimisticUpdate?.(id, optimisticUpdates);

    const loadingToast = toast.loading(`Updating order to ${newStatus}...`);
    try {
      const order = prevOrder;
      
      if (newStatus === 'cancelled') {
        // Intercept and use safe cancelOrder routine with persisted mandatory reason
        const cancelledResult = await supabaseService.cancelOrder(id, reasonToUse, 'admin', 'admin');
        
        if (order && order.user_id !== 'guest' && order.user_id) {
          addNotification({
            title: 'Order Cancelled by Admin',
            message: `Order #${id.slice(-6).toUpperCase()} was cancelled. Reason: ${reasonToUse}`,
            type: 'order',
            user_id: order.user_id,
            link: `/order-tracking/${id}`
          });
        }
        
        toast.success('Order cancelled. Stock restored & logs created.', { id: loadingToast });
        const finalCancelledOrder = (order ? { ...order, status: 'cancelled' as const, cancellation_reason: reasonToUse } : { ...cancelledResult, cancellation_reason: reasonToUse }) as Order;
        setCancelledOrderForWhatsApp({ order: finalCancelledOrder, reason: reasonToUse });
        return;
      }

      const updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString() 
      };
      
      if (newStatus === 'confirmed') {
        updateData.payment_status = 'paid';
      }
      
      if (order && !order.estimated_delivery_time) {
        updateData.estimated_delivery_time = 30;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      if (order && order.user_id !== 'guest' && order.user_id) {
        const statusMessages: Record<string, string> = {
          'confirmed': 'Your order has been accepted and is being processed.',
          'preparing': 'Your meal is being prepared by our chefs.',
          'out_for_delivery': 'Your order is out for delivery!',
          'delivered': 'Enjoy your meal! Your order has been delivered.',
          'cancelled': 'Your order has been cancelled.'
        };

        addNotification({
          title: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
          message: statusMessages[newStatus] || `Your order status is now: ${newStatus}`,
          type: 'order',
          user_id: order.user_id,
          link: `/order-tracking/${id}`
        });
        
        // Send Delivery Status Email via Resend
        if (order.email) {
          if (newStatus === 'confirmed') {
             emailService.sendOrderConfirmation(order.email, id, order.total)
               .catch(err => console.error('Failed to send status update confirmation:', err));
          } else {
              emailService.sendDeliveryUpdate(order.email, id, newStatus.replace(/_/g, ' ').toUpperCase())
               .catch(err => console.error('Failed to send status update delivery notification:', err));
          }
        }

        // Trigger Rewards Engine & WhatsApp Notification on Delivery
        if (newStatus === 'delivered') {
          rewardsService.processOrderForRewards(order.user_id, order.total)
            .then(() => console.log('Rewards processed for order:', id))
            .catch(err => console.error('Rewards processing failed:', err));
        }
      }

      if (newStatus === 'delivered' && prevOrder?.status !== 'delivered') {
        const finalDeliveredOrder = (prevOrder ? { ...prevOrder, status: 'delivered' as const } : { id, status: 'delivered' as const }) as Order;
        setDeliveredOrderForWhatsApp(finalDeliveredOrder);
      }

      toast.success(`Order ${newStatus === 'confirmed' ? 'Accepted' : newStatus}`, { id: loadingToast });
    } catch (error: any) {
      console.error('Update status error:', error);
      // Rollback on failure
      if (prevOrder) {
        setLocalOrders(prev => prev.map(o => o.id === id ? prevOrder : o));
        onOptimisticUpdate?.(id, prevOrder);
      }
      toast.error(error.message || 'Update failed', { id: loadingToast });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const prevOrder = editingOrder;
    const optimisticUpdates: Partial<Order> = {
      customer_name: editFormData.customer_name,
      phone: editFormData.phone,
      address: editFormData.address,
      notes: editFormData.notes,
      estimated_delivery_time: editFormData.estimated_delivery_time,
      updated_at: new Date().toISOString()
    };

    // Apply Optimistic Update Immediately
    setLocalOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, ...optimisticUpdates } : o));
    onOptimisticUpdate?.(editingOrder.id, optimisticUpdates);
    setEditingOrder(null);

    const loadingToast = toast.loading('Saving changes...');
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          customer_name: editFormData.customer_name,
          phone: editFormData.phone,
          address: editFormData.address,
          notes: editFormData.notes,
          estimated_delivery_time: editFormData.estimated_delivery_time,
          updated_at: new Date().toISOString()
        })
        .eq('id', prevOrder.id);

      if (error) throw error;
      
      toast.success('Changes saved!', { id: loadingToast });
    } catch (error: any) {
      console.error('Edit submit error:', error);
      // Rollback on failure
      setLocalOrders(prev => prev.map(o => o.id === prevOrder.id ? prevOrder : o));
      onOptimisticUpdate?.(prevOrder.id, prevOrder);
      toast.error(error.message || 'Failed to save', { id: loadingToast });
    }
  };

  const deleteOrder = async (id: string) => {
    const prevOrder = orders.find(o => o.id === id);
    setDeletingId(null);

    // Apply Optimistic Delete Immediately
    setLocalOrders(prev => prev.filter(o => o.id !== id));
    onOptimisticDelete?.(id);

    const loadingToast = toast.loading('Deleting order...');
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Order deleted', { id: loadingToast });
    } catch (error: any) {
      console.error('Delete error:', error);
      // Rollback on failure
      if (prevOrder) {
        setLocalOrders(prev => [prevOrder, ...prev]);
      }
      toast.error(error.message || 'Failed to delete', { id: loadingToast });
    }
  };

  const handlePrintKOT = (order: Order, isAuto: boolean = false) => {
    setPrintingOrder(order);
    if (isAuto) {
      // Give time for the KOT component to render before printing
      setTimeout(() => {
        window.print();
        setPrintingOrder(null);
      }, 800);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-zinc-500 font-bold animate-pulse">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111111]/80 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-6 sm:p-8 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.01]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Recent Orders</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-bold">
              {orders.length} orders
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-medium">Manage and process active customer orders in real-time</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {orders.some(o => o.status === 'pending') && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">New Orders Pending</span>
            </div>
          )}
          {notificationPermission !== 'granted' && (
            <button 
              onClick={requestNotificationPermission}
              className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all hover:scale-105"
              title="Enable Browser Notifications"
            >
              <Bell size={18} />
            </button>
          )}
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3 rounded-2xl border transition-all hover:scale-105 ${isMuted ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}
            title={isMuted ? "Unmute Alarm" : "Mute Alarm"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button 
            onClick={() => setAutoPrint(!autoPrint)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all hover:scale-105 ${autoPrint ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}
            title={autoPrint ? "Disable Auto-print" : "Enable Auto-print"}
          >
            <Printer size={18} />
            <span className="text-xs font-bold uppercase tracking-widest">{autoPrint ? "Auto-print ON" : "Auto-print OFF"}</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              <th 
                className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer group"
                onClick={() => requestSort('id')}
              >
                <div className="flex items-center gap-2">
                  Order ID
                  {getSortIcon('id')}
                </div>
              </th>
              <th 
                className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer group"
                onClick={() => requestSort('customer_name')}
              >
                <div className="flex items-center gap-2">
                  Customer
                  {getSortIcon('customer_name')}
                </div>
              </th>
              <th 
                className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer group"
                onClick={() => requestSort('created_at')}
              >
                <div className="flex items-center gap-2">
                  Date
                  {getSortIcon('created_at')}
                </div>
              </th>
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Items</th>
              <th 
                className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer group"
                onClick={() => requestSort('total')}
              >
                <div className="flex items-center gap-2">
                  Total
                  {getSortIcon('total')}
                </div>
              </th>
              <th 
                className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer group"
                onClick={() => requestSort('status')}
              >
                <div className="flex items-center gap-2">
                  Status
                  {getSortIcon('status')}
                </div>
              </th>
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedOrders.map((order) => {
              if (cancellingOrder?.id === order.id) {
                return (
                  <tr key={order.id} className="bg-rose-950/20 border-y-2 border-rose-500/40">
                    <td colSpan={8} className="p-4 sm:p-5">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -4 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col gap-4 bg-[#16141a] border border-rose-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full relative z-10">
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setCancellingOrder(null)}
                              className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all border border-white/10 hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
                            >
                              <ArrowLeft size={14} />
                              <span>Back</span>
                            </button>

                            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                              <AlertCircle size={22} />
                            </div>

                            <div className="flex flex-col text-left">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-rose-400 uppercase tracking-widest">Cancel Order</span>
                                <span className="text-xs font-mono font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-md">
                                  #{order.id.slice(-6).toUpperCase()}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 font-medium mt-0.5">
                                Cancel order for <strong className="text-white">{order.customer_name || order.customerName || 'Customer'}</strong> (₹{order.total}) &amp; restore inventory
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Mandatory Input Field for Cancellation Reason */}
                        <div className="bg-black/50 border border-rose-500/30 rounded-2xl p-4 space-y-3 relative z-10">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                              <span>Cancellation Reason</span>
                              <span className="text-rose-400 font-extrabold text-sm">*</span>
                            </label>
                            <span className="text-[10px] text-zinc-400 font-medium">Mandatory for audit &amp; WhatsApp dispatch</span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              type="text"
                              value={cancellingReason}
                              onChange={(e) => setCancellingReason(e.target.value)}
                              placeholder="Enter cancellation reason (e.g. Out of stock, Kitchen overload)..."
                              className="flex-1 bg-[#0f0f13] text-white text-xs px-4 py-2.5 rounded-xl border border-white/15 focus:border-rose-500 focus:outline-none placeholder:text-zinc-500 font-medium transition-colors"
                            />
                            
                            <div className="w-full sm:w-72 shrink-0">
                              <SlideToConfirm
                                disabled={!cancellingReason.trim()}
                                onConfirm={async () => {
                                  if (!cancellingReason.trim()) {
                                    toast.error('Cancellation reason is required');
                                    return;
                                  }
                                  await updateStatus(order.id, 'cancelled', true, cancellingReason.trim());
                                  setCancellingOrder(null);
                                }}
                                label="Slide to Cancel Order"
                                releaseLabel="Release to Cancel"
                                processingLabel="Cancelling Order..."
                                successLabel="Order Cancelled!"
                                variant="danger"
                              />
                            </div>
                          </div>

                          {/* Quick Preset Reason Pills */}
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Quick Presets:</span>
                            {['Out of Stock', 'Kitchen Busy', 'Store Closed', 'Customer Request', 'Invalid Address'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setCancellingReason(preset)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                  cancellingReason === preset
                                    ? 'bg-rose-500 text-white shadow-md shadow-rose-950 border border-rose-400'
                                    : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>

                          {!cancellingReason.trim() && (
                            <p className="text-[11px] font-bold text-rose-400 animate-pulse">
                              ⚠️ Cancellation reason is required to slide &amp; cancel this order.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                );
              }

              if (deletingId === order.id) {
                return (
                  <tr key={order.id} className="bg-red-950/20 border-y-2 border-red-500/40">
                    <td colSpan={8} className="p-4 sm:p-5">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -4 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-[#16141a] border border-red-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

                        <div className="flex items-center gap-4 w-full lg:w-auto relative z-10">
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all border border-white/10 hover:scale-105 active:scale-95 shrink-0"
                          >
                            <ArrowLeft size={14} />
                            <span>Back</span>
                          </button>

                          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
                            <Trash2 size={22} />
                          </div>

                          <div className="flex flex-col text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-red-400 uppercase tracking-widest">Delete Order</span>
                              <span className="text-xs font-mono font-bold text-white bg-white/10 px-2.5 py-0.5 rounded-md">
                                #{order.id.slice(-6).toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 font-medium mt-0.5">
                              Permanently remove <strong className="text-white">{order.customer_name || order.customerName || 'Customer'}</strong>'s order (₹{order.total})
                            </p>
                          </div>
                        </div>

                        <div className="w-full lg:w-80 shrink-0 relative z-10">
                          <SlideToConfirm
                            onConfirm={async () => {
                              await deleteOrder(order.id);
                            }}
                            label="Slide to Delete Order"
                            releaseLabel="Release to Delete"
                            processingLabel="Deleting Order..."
                            successLabel="Order Deleted!"
                            variant="danger"
                          />
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                );
              }

              return (
                <motion.tr 
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                  className="group transition-colors"
                >
                <td className="px-8 py-6">
                  <span className="text-sm font-bold text-white font-mono tracking-tight">{order.id.slice(-6).toUpperCase()}</span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-200">
                        {order.customer_name || order.customerName || 'Guest Customer'}
                      </span>
                      {order.phone && (
                        <button 
                          onClick={() => sendWhatsAppMessage(order.phone, `Hello ${order.customer_name || order.customerName}, this is Frosty Bite regarding your order #${order.id.slice(-6).toUpperCase()}.`)}
                          className="flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-400 font-bold"
                        >
                          <MessageCircle size={10} />
                          {order.phone}
                        </button>
                      )}
                      {order.utr && (
                        <div className="mt-1 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md w-fit">
                            <CheckCircle2 size={10} className="text-primary" />
                            <span className="text-[9px] text-primary font-black uppercase tracking-widest leading-none">
                              UTR: {order.utr}
                            </span>
                          </div>
                          {orders.some(o => o.id !== order.id && o.utr === order.utr) && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md w-fit animate-pulse">
                              <X size={10} className="text-red-500" />
                              <span className="text-[9px] text-red-500 font-black uppercase tracking-widest leading-none">
                                DUPLICATE UTR DETECTED
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {order.notes && (
                        <div className="mt-1 max-w-[200px]">
                          <p className="text-[10px] text-amber-500 font-bold bg-amber-500/5 px-2 py-1 rounded-md border border-amber-500/10 italic">
                            NB: {order.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="text-xs text-white">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {order.items.map((item, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded-md border border-white/5">
                        {typeof item === 'string' ? item : item.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">₹{order.total}</span>
                    {order.delivery_charge !== undefined && order.delivery_charge > 0 && (
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                        Delivery: ₹{order.delivery_charge}
                      </span>
                    )}
                    {order.discount && order.discount > 0 && (
                      <span className="text-[9px] text-primary font-black uppercase tracking-widest mt-0.5">
                        -₹{order.discount} ({order.coupon_code})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <StatusBadge order={order} />
                </td>
                <td className="px-8 py-6">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Self Delivery</span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      {order.status === 'pending' && (
                        <div className="flex flex-col gap-2">
                          {(order.payment_method === 'upi' || order.payment_method === 'online') ? (
                            <div className="flex flex-col gap-2">
                              {(order.utr || order.payment_screenshot) ? (
                                <>
                                  {order.payment_screenshot && (
                                    <div className="flex items-center gap-2 mb-1">
                                      <ImageZoom 
                                        src={order.payment_screenshot} 
                                        alt={`Proof: ${order.utr || order.id}`} 
                                        className="w-12 h-12 object-cover rounded-lg border border-white/10 shadow-lg cursor-zoom-in"
                                        triggerClassName="w-12 h-12"
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Payment Proof</span>
                                        <span className="text-[10px] text-primary font-bold">Ref: {order.utr || 'Pending'}</span>
                                      </div>
                                    </div>
                                  )}
                                    <div className="flex flex-col gap-2">
                                      <p className="text-[8px] text-red-500 font-bold uppercase leading-none italic">
                                        If cancelled, paid money will refund in 24 hrs
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={() => verifyPayment(order.id)}
                                          className="flex-1 px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                        >
                                          <CheckCircle2 size={12} />
                                          Approve Payment
                                        </button>
                                        <button 
                                          onClick={() => rejectPayment(order.id)}
                                          className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                          title="Reject Payment"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    </div>
                                </>
                              ) : (
                                <div className="px-4 py-2 bg-white/5 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2">
                                  <Clock size={12} className="text-amber-500 animate-pulse" />
                                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest italic">Awaiting Payment...</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => updateStatus(order.id, 'confirmed')}
                                className="flex-1 px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 size={12} />
                                Accept Order
                              </button>
                              <button 
                                onClick={() => updateStatus(order.id, 'cancelled')}
                                className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                title="Reject Order"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {order.status === 'confirmed' && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest ml-1">Next Step:</span>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => updateStatus(order.id, 'preparing')}
                              className="flex-1 px-4 py-2 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                            >
                              <Package size={12} />
                              Start Preparing
                            </button>
                          </div>
                        </div>
                      )}

                      {order.status === 'preparing' && (
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => updateStatus(order.id, 'out_for_delivery')}
                            className="flex-1 px-4 py-2 bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-purple-600 transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                          >
                            <Truck size={12} />
                            Dispatch Order
                          </button>
                        </div>
                      )}

                      {order.status === 'out_for_delivery' && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => updateStatus(order.id, 'delivered')}
                            className="w-full px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                        </div>
                      )}

                      {order.status === 'delivered' && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setDeliveredOrderForWhatsApp(order)}
                            className="w-full px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <MessageSquare size={12} />
                            <span>📱 WhatsApp Confirmation</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <button 
                        onClick={() => handlePrintKOT(order)}
                        className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-emerald-500 hover:bg-white/10 transition-all"
                        title="Print KOT"
                      >
                        <Printer size={16} />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingOrder(order);
                          setEditFormData({
                            customer_name: order.customer_name || order.customerName || '',
                            phone: order.phone || '',
                            address: order.address || '',
                            notes: order.notes || '',
                            estimated_delivery_time: order.estimated_delivery_time || 30
                          });
                        }}
                        className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-primary hover:bg-white/10 transition-all"
                        title="Edit Order"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setDeletingId(order.id)}
                        className="p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-red-500 hover:bg-white/10 transition-all"
                        title="Delete Order"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="relative">
                        <button 
                          onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                          className={`p-2.5 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all ${selectedOrder === order.id ? 'bg-primary/10 text-primary' : ''}`}
                        >
                          <MoreVertical size={16} />
                        </button>
                        <AnimatePresence>
                          {selectedOrder === order.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              className="absolute right-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
                            >
                              {[
                                { id: 'pending', label: 'Pending' },
                                { id: 'confirmed', label: 'Confirmed' },
                                { id: 'preparing', label: 'Preparing' },
                                { id: 'out_for_delivery', label: 'Out for Delivery' },
                                { id: 'delivered', label: 'Delivered' },
                                { id: 'cancelled', label: 'Cancelled' }
                              ].map((s) => {
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => {
                                      updateStatus(order.id, s.id as Order['status']);
                                      setSelectedOrder(null);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${order.status === s.id ? 'text-primary bg-primary/5' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                  >
                                    Mark as {s.label}
                                  </button>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </td>
              </motion.tr>
            );
          })}
            {sortedOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-8 py-20 text-center text-zinc-500 font-bold">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden p-4 space-y-4">
        {sortedOrders.map((order) => (
          <div key={order.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 relative overflow-hidden">
            {/* Inline Overlapping Delete / Cancel Card Overlay */}
            <AnimatePresence>
              {cancellingOrder?.id === order.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 bg-[#141218] border-2 border-rose-500/50 rounded-2xl p-3.5 sm:p-4 z-40 flex flex-col justify-between backdrop-blur-2xl shadow-2xl shadow-rose-950/80 overflow-y-auto custom-scrollbar space-y-2.5"
                >
                  <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                        <AlertCircle size={15} />
                      </div>
                      <h4 className="text-xs font-black text-white uppercase italic tracking-tight">
                        Cancel Order #{order.id.slice(-6).toUpperCase()}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCancellingOrder(null)}
                      className="p-1.5 text-zinc-400 hover:text-white bg-white/5 rounded-full shrink-0"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-300 font-medium px-1 shrink-0">
                    Cancel for <strong className="text-white">{order.customer_name || order.customerName || 'Customer'}</strong> (₹{order.total})
                  </p>

                  {/* Mandatory Cancellation Reason Input */}
                  <div className="space-y-1.5 bg-black/40 p-2.5 rounded-xl border border-rose-500/30 shrink-0">
                    <div className="flex items-center justify-between text-left">
                      <label className="text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1">
                        <span>Reason</span>
                        <span className="text-rose-400 font-extrabold">*</span>
                      </label>
                      {!cancellingReason.trim() && (
                        <span className="text-[9px] font-bold text-rose-400">
                          Required
                        </span>
                      )}
                    </div>

                    <input
                      type="text"
                      value={cancellingReason}
                      onChange={(e) => setCancellingReason(e.target.value)}
                      placeholder="Enter reason..."
                      className="w-full bg-[#1c1a24] text-white text-xs px-2.5 py-1.5 rounded-lg border border-white/15 focus:border-rose-500 focus:outline-none placeholder:text-zinc-500 font-medium"
                    />

                    <div className="flex flex-wrap gap-1">
                      {['Out of Stock', 'Kitchen Busy', 'Store Closed', 'Customer Request'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCancellingReason(preset)}
                          className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                            cancellingReason === preset
                              ? 'bg-rose-500 text-white'
                              : 'bg-white/5 text-zinc-300 border border-white/10'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 shrink-0 pt-1">
                    <SlideToConfirm
                      disabled={!cancellingReason.trim()}
                      onConfirm={async () => {
                        if (!cancellingReason.trim()) {
                          toast.error('Cancellation reason is required');
                          return;
                        }
                        await updateStatus(order.id, 'cancelled', true, cancellingReason.trim());
                        setCancellingOrder(null);
                      }}
                      label="Slide to Cancel Order"
                      releaseLabel="Release to Cancel"
                      processingLabel="Cancelling Order..."
                      successLabel="Order Cancelled!"
                      variant="danger"
                    />
                    <button
                      type="button"
                      onClick={() => setCancellingOrder(null)}
                      className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-full text-[10px] font-extrabold uppercase tracking-widest border border-white/10 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ArrowLeft size={12} />
                      <span>Back to Order</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {deletingId === order.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 bg-[#141218] border-2 border-red-500/50 rounded-2xl p-4 z-40 flex flex-col justify-between backdrop-blur-2xl shadow-2xl shadow-red-950/80 overflow-y-auto custom-scrollbar space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all border border-white/10 hover:scale-105 active:scale-95"
                    >
                      <ArrowLeft size={14} />
                      <span>Back</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="p-1.5 text-zinc-400 hover:text-white bg-white/5 rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex flex-col items-center text-center space-y-2 my-2">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                      <Trash2 size={22} />
                    </div>
                    <h4 className="text-sm font-black text-white uppercase italic tracking-tight">
                      Delete Order #{order.id.slice(-6).toUpperCase()}?
                    </h4>
                    <p className="text-xs text-zinc-300 font-medium px-2">
                      Permanently remove order for <strong className="text-white">{order.customer_name || order.customerName || 'Customer'}</strong> (₹{order.total})
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <SlideToConfirm
                      onConfirm={async () => {
                        await deleteOrder(order.id);
                      }}
                      label="Slide to Delete Order"
                      releaseLabel="Release to Delete"
                      processingLabel="Deleting Order..."
                      successLabel="Order Deleted!"
                      variant="danger"
                    />
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-full text-[10px] font-extrabold uppercase tracking-widest border border-white/10 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ArrowLeft size={12} />
                      <span>Back to Order</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-primary uppercase font-mono">#{order.id.slice(-6)}</span>
              <StatusBadge order={order} />
            </div>
            
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-white">
                  {order.customer_name || order.customerName || 'Guest Customer'}
                </span>
                <span className="text-xs text-gray-500">{order.phone}</span>
                {order.utr && (
                  <div className="mt-1 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md w-fit">
                      <span className="text-[9px] text-primary font-black uppercase tracking-widest leading-none">
                        UTR: {order.utr}
                      </span>
                    </div>
                    {orders.some(o => o.id !== order.id && o.utr === order.utr) && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md w-fit animate-pulse">
                        <X size={8} className="text-red-500" />
                        <span className="text-[8px] text-red-500 font-black uppercase tracking-widest leading-none">
                          DUPLICATE UTR
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {order.notes && (
                  <p className="mt-2 text-[10px] text-amber-500 font-bold bg-amber-500/5 px-2 py-1 rounded-md border border-amber-500/10 italic">
                    Note: {order.notes}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {order.items.map((item, i) => (
                <span key={i} className="text-[10px] px-2 py-1 bg-white/5 text-gray-400 rounded-md border border-white/5">
                  {typeof item === 'string' ? item : item.name}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-lg font-black text-white">₹{order.total}</span>
                  {order.discount && order.discount > 0 && (
                    <span className="text-[10px] text-primary font-black uppercase tracking-widest">
                      -₹{order.discount} ({order.coupon_code})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handlePrintKOT(order)}
                    className="p-3.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center min-w-[44px] min-h-[44px]"
                    title="Print"
                  >
                    <Printer size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setEditingOrder(order);
                      setEditFormData({
                        customer_name: order.customer_name || order.customerName || '',
                        phone: order.phone || '',
                        address: order.address || '',
                        notes: order.notes || '',
                        estimated_delivery_time: order.estimated_delivery_time || 30
                      });
                    }}
                    className="p-3.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center min-w-[44px] min-h-[44px]"
                    title="Edit Info"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedOrder(selectedOrder === order.id ? null : order.id);
                    }}
                    className={`p-3.5 rounded-xl transition-all flex items-center justify-center min-w-[44px] min-h-[44px] ${selectedOrder === order.id ? 'bg-primary text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    title="Update Status"
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>

              {/* Direct Labeled Delete Button for Touch Accessibility */}
              <button 
                onClick={() => setDeletingId(order.id)}
                className="w-full py-3.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-500 font-bold text-xs uppercase tracking-widest border border-red-500/20 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                title="Delete Order"
              >
                <Trash2 size={16} />
                Delete Order
              </button>
            </div>

            {/* Mobile Status & Rider Updates */}
            <AnimatePresence>
              {selectedOrder === order.id && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-4 border-t border-white/5 overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'preparing', label: 'Preparing', color: 'bg-blue-500' },
                      { id: 'out_for_delivery', label: 'Dispatch', color: 'bg-purple-500' },
                      { id: 'delivered', label: 'Delivered', color: 'bg-emerald-500' },
                      { id: 'cancelled', label: 'Cancel', color: 'bg-red-500' }
                    ].map((s) => {
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            updateStatus(order.id, s.id as Order['status']);
                            setSelectedOrder(null);
                          }}
                          className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all ${s.color} ${order.status === s.id ? 'ring-2 ring-white ring-inset' : 'opacity-80'}`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {order.status === 'pending' && (
              <div className="pt-2 space-y-3">
                {(order.payment_method === 'upi' || order.payment_method === 'online') ? (
                  <div className="space-y-3">
                    {(order.utr || order.payment_screenshot) ? (
                      <>
                        {order.payment_screenshot && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Proof:</p>
                              <span className="text-[10px] text-primary font-bold">Ref: {order.utr || 'N/A'}</span>
                            </div>
                            <ImageZoom 
                              src={order.payment_screenshot} 
                              alt={`Proof: ${order.utr || order.id}`} 
                              className="w-full h-48 object-cover rounded-2xl border border-white/10"
                              triggerClassName="w-full h-48"
                            />
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <p className="text-[8px] text-red-500 font-bold uppercase text-center italic">
                            If cancelled, paid money will refund in 24 hrs
                          </p>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => verifyPayment(order.id)}
                              className="flex-1 py-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={16} />
                              Approve Payment
                            </button>
                            <button 
                              onClick={() => rejectPayment(order.id)}
                              className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-center"
                            >
                              <X size={20} />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3">
                         <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 animate-pulse">
                           <Clock size={20} />
                         </div>
                         <div className="text-center">
                           <p className="text-xs font-black text-white uppercase tracking-widest">Awaiting Payment</p>
                           <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1 italic">Waiting for customer proof</p>
                         </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => updateStatus(order.id, 'confirmed')}
                      className="flex-1 py-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} />
                      Accept Order
                    </button>
                    <button 
                      onClick={() => updateStatus(order.id, 'cancelled')}
                      className="w-14 h-14 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-center"
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {order.status === 'confirmed' && (
              <div className="pt-2">
                <button 
                   onClick={() => updateStatus(order.id, 'preparing')}
                   className="w-full py-4 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                >
                  <Package size={16} />
                  Start Preparing
                </button>
              </div>
            )}

            {order.status === 'preparing' && (
              <div className="pt-2">
                <button 
                  onClick={() => updateStatus(order.id, 'out_for_delivery')}
                  className="w-full py-4 bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                >
                  <Truck size={16} />
                  Dispatch Order
                </button>
              </div>
            )}

            {order.status === 'out_for_delivery' && (
              <div className="pt-2">
                <button 
                  onClick={() => updateStatus(order.id, 'delivered')}
                  className="w-full py-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  Mark Delivered
                </button>
              </div>
            )}

            {order.status === 'delivered' && (
              <div className="pt-2">
                <button 
                  onClick={() => setDeliveredOrderForWhatsApp(order)}
                  className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <MessageSquare size={14} />
                  📱 Send Delivery Confirmation
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editingOrder && (
          <OrderEditPage
            order={editingOrder}
            onBack={() => setEditingOrder(null)}
            onOrderUpdated={(updatedOrder) => {
              setEditingOrder(null);
            }}
            onPrintKOT={(ord) => setPrintingOrder(ord)}
          />
        )}
      </AnimatePresence>

      {/* KOT / Bill Print Modal */}
      <AnimatePresence>
        {printingOrder && (
          <KOTPrint 
            order={printingOrder} 
            onClose={() => setPrintingOrder(null)} 
          />
        )}
      </AnimatePresence>

      {/* Admin WhatsApp Cancellation Success Modal */}
      <AdminCancellationSuccessModal
        isOpen={!!cancelledOrderForWhatsApp}
        onClose={() => setCancelledOrderForWhatsApp(null)}
        order={cancelledOrderForWhatsApp?.order || null}
        cancellationReason={cancelledOrderForWhatsApp?.reason}
      />

      {/* Admin WhatsApp Delivery Success Modal */}
      <AdminDeliverySuccessModal
        isOpen={!!deliveredOrderForWhatsApp}
        onClose={() => setDeliveredOrderForWhatsApp(null)}
        order={deliveredOrderForWhatsApp}
      />
    </div>
  );
};
