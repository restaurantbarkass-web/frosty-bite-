import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, ExternalLink, User, Clock, CheckCircle2, Truck, Package, MessageCircle, X, Trash2, Edit2, Volume2, VolumeX, Printer, Bell, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../../firebase';
import { supabase } from '../../supabase';
import { supabaseService } from '../../services/supabaseService';
import { sendWhatsAppMessage } from '../../utils/whatsapp';
import { KOTPrint } from './KOTPrint';
import toast from 'react-hot-toast';
import { useNotifications } from '../../context/NotificationContext';
import { rewardsService } from '../../services/rewardsService';
import { emailService } from '../../services/emailService';

import { Order } from '../../types';
import { ImageZoom } from '../ImageZoom';
import { ConfirmationModal } from '../ui/ConfirmationModal';

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
}

export const OrdersTable: React.FC<OrdersTableProps> = ({ orders: rawOrders, loading: externalLoading }) => {
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const lastOrderCountRef = useRef<number>(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitializedRef = useRef(false);

  const { addNotification } = useNotifications();
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [editFormData, setEditFormData] = useState({
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

  // Real-time notification logic for new orders
  useEffect(() => {
    if (loading) return;

    // On initial load, just populate the known IDs
    if (!hasInitializedRef.current) {
      orders.forEach(o => knownOrderIdsRef.current.add(o.id));
      lastOrderCountRef.current = orders.length;
      hasInitializedRef.current = true;
      return;
    }

    // Find new orders that weren't in our known set
    const newOrders = orders.filter(o => !knownOrderIdsRef.current.has(o.id));
    
    if (newOrders.length > 0) {
      // Mark as known immediately to avoid duplicate notifications during re-renders
      newOrders.forEach(o => knownOrderIdsRef.current.add(o.id));

      newOrders.forEach(async (order) => {
        // Save to notifications collection
        const user = auth.currentUser;
        addNotification({
          title: 'New Order Received',
          message: `${order.customer_name} placed an order for ₹${order.total}`,
          type: 'order',
          user_id: user?.uid || '',
          link: '/admin'
        });

        // Show Styled Toast
        toast((t) => (
          <div className="flex items-center gap-3 bg-[#18181b] p-2 pr-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <Bell size={18} />
            </div>
            <div className="flex flex-col">
              <p className="text-white text-xs font-bold leading-tight">
                New Order #{order.id.slice(-6).toUpperCase()}
              </p>
              <p className="text-zinc-500 text-[10px]">
                From {order.customer_name}
              </p>
            </div>
            <button 
              onClick={() => {
                toast.dismiss(t.id);
                const el = document.getElementById(`order-${order.id}`);
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="ml-2 px-3 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-accent transition-all active:scale-95"
            >
              VIEW
            </button>
            <button 
              onClick={() => toast.dismiss(t.id)}
              className="p-1 text-zinc-600 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ), { 
          duration: 10000,
          position: 'top-right'
        });

        // Show Browser Notification
        if (Notification.permission === 'granted') {
          new Notification('New Order Received!', {
            body: `${order.customer_name} placed an order for ₹${order.total}`,
            icon: '/logo.png' 
          });
        }
      });

      // Auto-print newest if enabled
      if (autoPrint) {
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

      const order = orders.find(o => o.id === orderId);
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
      toast.error(error.message || 'Verification failed', { id: loadingToast });
    }
  };

  const rejectPayment = async (orderId: string) => {
    stopAlarm();
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

      const order = orders.find(o => o.id === orderId);
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
      toast.error(error.message || 'Rejection failed', { id: loadingToast });
    }
  };

  const updateStatus = async (id: string, newStatus: Order['status']) => {
    if (newStatus === 'confirmed' || newStatus === 'cancelled') {
      stopAlarm();
    }
    const loadingToast = toast.loading(`Updating order to ${newStatus}...`);
    try {
      const order = orders.find(o => o.id === id);
      
      if (newStatus === 'cancelled') {
        // Intercept and use safe cancelOrder routine
        await supabaseService.cancelOrder(id, 'Cancelled by Administrator', 'admin', 'admin');
        
        if (order && order.user_id !== 'guest' && order.user_id) {
          addNotification({
            title: 'Order Cancelled by Admin',
            message: `Order #${id.slice(-6).toUpperCase()} was cancelled by management.`,
            type: 'order',
            user_id: order.user_id,
            link: `/order-tracking/${id}`
          });
        }
        
        toast.success('Order cancelled. Stock restored & logs created.', { id: loadingToast });
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

        // Trigger Rewards Engine on Delivery
        if (newStatus === 'delivered') {
          rewardsService.processOrderForRewards(order.user_id, order.total)
            .then(() => console.log('Rewards processed for order:', id))
            .catch(err => console.error('Rewards processing failed:', err));
        }
      }

      toast.success(`Order ${newStatus === 'confirmed' ? 'Accepted' : newStatus}`, { id: loadingToast });
    } catch (error: any) {
      console.error('Update status error:', error);
      toast.error(error.message || 'Update failed', { id: loadingToast });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const loadingToast = toast.loading('Saving changes...');

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          customer_name: editFormData.customer_name,
          phone: editFormData.phone,
          address: editFormData.address,
          notes: editFormData.notes,
          estimated_delivery_time: Number(editFormData.estimated_delivery_time),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingOrder.id);

      if (error) throw error;
      
      setEditingOrder(null);
      toast.success('Changes saved!', { id: loadingToast });
    } catch (error: any) {
      console.error('Edit submit error:', error);
      toast.error(error.message || 'Failed to save', { id: loadingToast });
    }
  };

  const deleteOrder = async (id: string) => {
    const loadingToast = toast.loading('Deleting order...');
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setDeletingId(null);
      toast.success('Order deleted', { id: loadingToast });
    } catch (error: any) {
      console.error('Delete error:', error);
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
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteOrder(deletingId)}
        title="Delete Order?"
        description="This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Recent Orders</h3>
          <p className="text-sm text-gray-500">Manage and track customer orders</p>
        </div>
        <div className="flex items-center gap-4">
          {orders.some(o => o.status === 'pending') && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">New Orders</span>
            </div>
          )}
          {notificationPermission !== 'granted' && (
            <button 
              onClick={requestNotificationPermission}
              className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
              title="Enable Browser Notifications"
            >
              <Bell size={20} />
            </button>
          )}
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3 rounded-2xl border transition-all ${isMuted ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
            title={isMuted ? "Unmute Alarm" : "Mute Alarm"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button 
            onClick={() => setAutoPrint(!autoPrint)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all ${autoPrint ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
            title={autoPrint ? "Disable Auto-print" : "Enable Auto-print"}
          >
            <Printer size={20} />
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
            {sortedOrders.map((order) => (
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
                            className="w-full px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                          >
                            Mark Delivered
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
            ))}
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
          <div key={order.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
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
                  className="w-full py-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Mark Delivered
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingOrder(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between p-8 md:p-10 pb-0 shrink-0">
                  <h3 className="text-2xl font-bold text-white">Edit Order Details</h3>
                  <button onClick={() => setEditingOrder(null)} className="p-2 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-all">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto p-8 md:p-10 space-y-6 pb-48 md:pb-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Customer Name</label>
                      <input 
                        type="text" 
                        required
                        value={editFormData.customer_name}
                        onChange={(e) => setEditFormData({...editFormData, customer_name: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary/50 transition-all" 
                      />
                    </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Phone Number</label>
                    <input 
                      type="text" 
                      required
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary/50 transition-all" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Delivery Address</label>
                    <textarea 
                      required
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary/50 transition-all h-20 resize-none" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Order Notes (Optional)</label>
                    <textarea 
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary/50 transition-all h-20 resize-none" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Estimated Delivery Time (minutes)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        required
                        min="1"
                        max="180"
                        value={editFormData.estimated_delivery_time}
                        onChange={(e) => setEditFormData({...editFormData, estimated_delivery_time: Number(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary/50 transition-all" 
                      />
                      <Clock size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </div>

                  </div>
 
                  <div className="sticky bottom-0 left-0 right-0 p-8 pt-4 bg-[#111]/95 backdrop-blur-xl border-t border-white/10 flex gap-4 shrink-0 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <button type="button" onClick={() => setEditingOrder(null)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all active:scale-95">
                      Cancel
                    </button>
                    <button type="submit" className="flex-1 py-4 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-zinc-800 transition-all active:scale-95">
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
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
    </div>
  );
};
