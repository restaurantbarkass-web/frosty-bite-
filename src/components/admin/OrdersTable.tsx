import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, ExternalLink, User, Clock, CheckCircle2, Truck, Package, MessageCircle, X, Trash2, Edit2, Volume2, VolumeX, Printer, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import { sendWhatsAppMessage } from '../../utils/whatsapp';
import { KOTPrint } from './KOTPrint';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useNotifications } from '../../context/NotificationContext';

import { Order, Rider } from '../../types';
import { ImageZoom } from '../ImageZoom';

const StatusBadge = ({ order }: { order: Order }) => {
  const { status, paymentStatus, paymentMethod } = order;
  
  if ((paymentMethod === 'upi' || paymentMethod === 'online') && order.utr && paymentStatus !== 'paid') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold bg-amber-500/10 text-amber-500 border-amber-500/20">
        <Clock size={14} />
        {paymentStatus === 'pending_verification' ? 'Awaiting Verification' : 'Awaiting Payment'}
      </div>
    );
  }

  const styles = {
    'pending': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'confirmed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'assigned': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'preparing': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'out_for_delivery': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'delivered': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'cancelled': 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const icons = {
    'pending': <Clock size={14} />,
    'confirmed': <CheckCircle2 size={14} />,
    'preparing': <Package size={14} />,
    'out_for_delivery': <Truck size={14} />,
    'delivered': <CheckCircle2 size={14} />,
    'cancelled': <X size={14} />,
  };

  const labels = {
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

export const OrdersTable: React.FC<OrdersTableProps> = ({ orders, loading: externalLoading }) => {
  const [riders, setRiders] = useState<Rider[]>([]);
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

  const [editFormData, setEditFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    notes: '',
    estimatedDeliveryTime: 30
  });

  useEffect(() => {
    // Check permission on mount
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    const unsubscribeRiders = onSnapshot(collection(db, 'riders'), (snapshot) => {
      const ridersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Rider[];
      setRiders(ridersData);
      setInternalLoading(false);
    }, (error) => {
      const isQuota = error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('limit exceeded');
      if (!isQuota) {
        handleFirestoreError(error, OperationType.GET, 'riders');
      } else {
        console.warn('Firestore Quota Exceeded for riders in OrdersTable');
        setInternalLoading(false);
      }
    });

    return () => {
      unsubscribeRiders();
    };
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
      newOrders.forEach(order => {
        // Save to notifications collection
        addNotification({
          title: 'New Order Received',
          message: `${order.customerName} placed an order for ₹${order.total}`,
          type: 'order',
          userId: auth.currentUser?.uid || '',
          link: '/admin'
        });

        // Show Toast
        toast.success(`New Order #${order.id.slice(-6).toUpperCase()} from ${order.customerName}!`, {
          duration: 10000,
          icon: '🍕',
        });

        // Show Browser Notification
        if (Notification.permission === 'granted') {
          new Notification('New Order Received!', {
            body: `${order.customerName} placed an order for ₹${order.total}`,
            icon: '/logo.png' 
          });
        }

        // Add to known IDs
        knownOrderIdsRef.current.add(order.id);
      });

      // Auto-print newest if enabled
      if (autoPrint) {
        handlePrintKOT(newOrders[0], true);
      }
    }

    lastOrderCountRef.current = orders.length;
  }, [orders, autoPrint, loading]);

  // Alarm logic
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

  const verifyPayment = async (orderId: string) => {
    console.log(`[OrderAction] Attempting to VERIFY payment for ${orderId}`);
    const loadingToast = toast.loading('Verifying payment...');
    try {
      const updateData = {
        paymentStatus: 'paid',
        status: 'confirmed', // Auto-confirm after admin verifies payment
        updatedAt: serverTimestamp()
      };
      
      console.log(`[OrderAction] Sending verify updateData:`, updateData);
      await updateDoc(doc(db, 'orders', orderId), updateData);
      console.log(`[OrderAction] Verify SUCCESS for ${orderId}`);

      const order = orders.find(o => o.id === orderId);
      if (order && order.userId !== 'guest') {
        addNotification({
          title: 'Payment Verified',
          message: `Your payment for order #${orderId.slice(-6).toUpperCase()} has been verified.`,
          type: 'order',
          userId: order.userId,
          link: `/order-tracking/${orderId}`
        });
      }

      toast.success('Payment verified & Order confirmed!', { id: loadingToast });
    } catch (error: any) {
      console.error('[OrderAction] Verify payment ERROR:', error);
      let errorMessage = 'Verification failed';
      try {
        if (error.message && error.message.startsWith('{')) {
          const errInfo = JSON.parse(error.message);
          errorMessage = errInfo.error === 'DATABASE_QUOTA_EXCEEDED' ? 'Quota Exceeded' : (errInfo.error.toLowerCase().includes('permission') ? 'Permission Denied' : errInfo.error);
        } else {
          errorMessage = error.message || 'Permission Denied';
        }
      } catch (e) {
        errorMessage = 'Permission Denied';
      }
      toast.error(errorMessage, { id: loadingToast });
    }
  };

  const rejectPayment = async (orderId: string) => {
    console.log(`[OrderAction] Attempting to REJECT payment for ${orderId}`);
    const loadingToast = toast.loading('Rejecting payment proof...');
    try {
      const updateData = {
        paymentStatus: 'pending', // Reset payment status
        status: 'cancelled', // Cancel the order as proof was invalid
        utr: null, // Clear UTR so they can resubmit if needed
        notes: "Admin rejected payment proof (UTR). Please contact support or re-order.",
        updatedAt: serverTimestamp()
      };
      
      console.log(`[OrderAction] Sending reject updateData:`, updateData);
      await updateDoc(doc(db, 'orders', orderId), updateData);
      console.log(`[OrderAction] Reject SUCCESS for ${orderId}`);

      const order = orders.find(o => o.id === orderId);
      if (order && order.userId !== 'guest') {
        addNotification({
          title: 'Payment Rejected',
          message: `Payment proof for order #${orderId.slice(-6).toUpperCase()} was rejected.`,
          type: 'order',
          userId: order.userId,
          link: `/order-tracking/${orderId}`
        });
      }

      toast.success('Payment rejected & Order cancelled', { id: loadingToast });
    } catch (error: any) {
      console.error('[OrderAction] Reject payment ERROR:', error);
      let errorMessage = 'Rejection failed';
      try {
        if (error.message && error.message.startsWith('{')) {
          const errInfo = JSON.parse(error.message);
          errorMessage = errInfo.error === 'DATABASE_QUOTA_EXCEEDED' ? 'Quota Exceeded' : (errInfo.error.toLowerCase().includes('permission') ? 'Permission Denied' : errInfo.error);
        } else {
          errorMessage = error.message || 'Permission Denied';
        }
      } catch (e) {
        errorMessage = 'Permission Denied';
      }
      toast.error(errorMessage, { id: loadingToast });
    }
  };

  const updateStatus = async (id: string, newStatus: Order['status']) => {
    console.log(`[OrderAction] Attempting update to ${newStatus} for order ${id}`);
    console.log(`[OrderAction] Current User:`, auth.currentUser?.email, auth.currentUser?.uid);
    const loadingToast = toast.loading(`Updating order to ${newStatus}...`);
    try {
      const order = orders.find(o => o.id === id);
      const updateData: any = { 
        status: newStatus,
        updatedAt: serverTimestamp() 
      };
      
      // Auto-set payment status to paid if admin accepts a pending order
      if (newStatus === 'confirmed') {
        updateData.paymentStatus = 'paid';
      }
      
      // Add default estimate if not present
      if (order && !order.estimatedDeliveryTime) {
        updateData.estimatedDeliveryTime = 30; // Default 30 mins
      }

      console.log(`[OrderAction] Sending updateData:`, updateData);
      await updateDoc(doc(db, 'orders', id), updateData);
      console.log(`[OrderAction] Update SUCCESS for ${id}`);

      if (order && order.userId !== 'guest') {
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
          userId: order.userId,
          link: `/order-tracking/${id}`
        });
      }

      toast.success(`Order ${newStatus === 'confirmed' ? 'Accepted' : newStatus}`, { id: loadingToast });
    } catch (error: any) {
      console.error('[OrderAction] Update status ERROR:', error);
      let errorMessage = 'Update failed';
      try {
        if (error.message && error.message.startsWith('{')) {
          const errInfo = JSON.parse(error.message);
          errorMessage = errInfo.error === 'DATABASE_QUOTA_EXCEEDED' ? 'Quota Exceeded' : (errInfo.error.toLowerCase().includes('permission') ? 'Permission Denied' : errInfo.error);
        } else {
          errorMessage = error.message || 'Permission Denied';
        }
      } catch (e) {
        errorMessage = 'Permission Denied';
      }
      toast.error(errorMessage, { id: loadingToast });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const loadingToast = toast.loading('Saving changes...');

    try {
      await updateDoc(doc(db, 'orders', editingOrder.id), {
        ...editFormData,
        estimatedDeliveryTime: Number(editFormData.estimatedDeliveryTime)
      });
      setEditingOrder(null);
      toast.success('Changes saved!', { id: loadingToast });
    } catch (error: any) {
      console.error('Edit submit error:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `orders/${editingOrder.id}`);
      } catch (e: any) {
        toast.error(`Failed to save: ${e.message.includes('QUOTA') ? 'Quota Exceeded' : 'Permission Denied'}`, { id: loadingToast });
      }
    }
  };

  const deleteOrder = async (id: string) => {
    const loadingToast = toast.loading('Deleting order...');
    try {
      await deleteDoc(doc(db, 'orders', id));
      setDeletingId(null);
      toast.success('Order deleted', { id: loadingToast });
    } catch (error: any) {
      console.error('Delete error:', error);
      try {
        handleFirestoreError(error, OperationType.DELETE, `orders/${id}`);
      } catch (e: any) {
        toast.error(`Failed to delete: ${e.message.includes('QUOTA') ? 'Quota Exceeded' : 'Permission Denied'}`, { id: loadingToast });
      }
    }
  };

  const assignRider = async (orderId: string, riderId: string) => {
    const rider = riders.find(r => r.id === riderId);
    if (!rider) return;
    const loadingToast = toast.loading(`Assigning ${rider.name}...`);

    try {
      const order = orders.find(o => o.id === orderId);
      const updateData: any = { 
        riderId: rider.id,
        riderName: rider.name,
        status: 'preparing'
      };

      // Add default estimate if not present
      if (order && !order.estimatedDeliveryTime) {
        updateData.estimatedDeliveryTime = 30;
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);

      if (order && order.userId !== 'guest') {
        addNotification({
          title: 'Rider Assigned',
          message: `${rider.name} has been assigned to your order.`,
          type: 'rider',
          userId: order.userId,
          link: `/order-tracking/${orderId}`
        });
      }

      toast.success(`Assigned to ${rider.name}`, { id: loadingToast });
    } catch (error: any) {
      console.error('Assign rider error:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
      } catch (e: any) {
        toast.error(`Assignment failed: ${e.message.includes('QUOTA') ? 'Quota Exceeded' : 'Permission Denied'}`, { id: loadingToast });
      }
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
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 text-left">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Delete Order?</h3>
                <p className="text-gray-500 text-sm">This will permanently remove the order record. This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => deleteOrder(deletingId)}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Order ID</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Customer</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Items</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Total</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Rider</th>
              <th className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.map((order) => (
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
                      <span className="text-sm font-semibold text-gray-200">{order.customerName}</span>
                      {order.phone && (
                        <button 
                          onClick={() => sendWhatsAppMessage(order.phone, `Hello ${order.customerName}, this is Frosty Bite regarding your order #${order.id.slice(-6).toUpperCase()}.`)}
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
                    {order.discount && order.discount > 0 && (
                      <span className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">
                        -₹{order.discount} ({order.couponCode})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <StatusBadge order={order} />
                </td>
                <td className="px-8 py-6">
                  <select 
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-gray-300 focus:outline-none focus:border-primary/50 transition-all cursor-pointer"
                    value={order.riderId || ""}
                    onChange={(e) => assignRider(order.id, e.target.value)}
                  >
                    <option value="" disabled>Assign Rider</option>
                    {riders.map(r => (
                      <option key={r.id} value={r.id} className="bg-[#111]">{r.name} ({r.status})</option>
                    ))}
                  </select>
                </td>
                <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      {order.status === 'pending' ? (
                        <div className="flex flex-col gap-4 mr-2">
                          {(order.paymentMethod === 'upi' || order.paymentMethod === 'online' || order.utr) ? (
                            <div className="flex flex-col gap-3">
                              {order.paymentScreenshot && (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Proof:</p>
                                  <ImageZoom 
                                    src={order.paymentScreenshot} 
                                    alt={`Ref: ${order.utr || order.id}`} 
                                    className="w-24 h-24 object-cover rounded-xl border border-white/10 shadow-lg"
                                    triggerClassName="w-24 h-24"
                                  />
                                </div>
                              )}
                              {order.utr ? (
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => verifyPayment(order.id)}
                                    className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 whitespace-nowrap"
                                  >
                                    <CheckCircle2 size={12} />
                                    Accept (UTR: {order.utr})
                                  </button>
                                  <button 
                                    onClick={() => rejectPayment(order.id)}
                                    className="px-4 py-2 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center gap-2"
                                  >
                                    <X size={12} />
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => updateStatus(order.id, 'confirmed')}
                                    className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                                  >
                                    Accept Manually
                                  </button>
                                  <button 
                                    onClick={() => updateStatus(order.id, 'cancelled')}
                                    className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => updateStatus(order.id, 'confirmed')}
                                className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                              >
                                Accept Order
                              </button>
                              <button 
                                onClick={() => updateStatus(order.id, 'cancelled')}
                                className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                      
                      {order.status === 'confirmed' && (
                        <div className="flex items-center gap-2 mr-2">
                          <button 
                            onClick={() => updateStatus(order.id, 'preparing')}
                            className="px-3 py-1.5 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                          >
                            Start Cooking
                          </button>
                        </div>
                      )}
                      <button 
                      onClick={() => handlePrintKOT(order)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-emerald-500 hover:bg-white/10 transition-all"
                      title="Print KOT"
                    >
                      <Printer size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setEditingOrder(order);
                        setEditFormData({
                          customerName: order.customerName,
                          phone: order.phone || '',
                          address: order.address || '',
                          notes: order.notes || '',
                          estimatedDeliveryTime: order.estimatedDeliveryTime || 30
                        });
                      }}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-primary hover:bg-white/10 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setDeletingId(order.id)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-500 hover:bg-white/10 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                        className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
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
                                  className="w-full text-left px-4 py-3 text-xs font-semibold transition-all text-gray-400 hover:text-white hover:bg-white/5"
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
                </td>
              </motion.tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-20 text-center text-zinc-500 font-bold">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden p-4 space-y-4">
        {orders.map((order) => (
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
                <span className="text-sm font-black text-white">{order.customerName}</span>
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

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="flex flex-col">
                <span className="text-lg font-black text-white">₹{order.total}</span>
                {order.discount && order.discount > 0 && (
                  <span className="text-[10px] text-primary font-black uppercase tracking-widest">
                    -₹{order.discount} ({order.couponCode})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handlePrintKOT(order)}
                  className="p-3 rounded-xl bg-white/10 text-white"
                  title="Print"
                >
                  <Printer size={18} />
                </button>
                    <button 
                      onClick={() => {
                        setEditingOrder(order);
                        setEditFormData({
                          customerName: order.customerName,
                          phone: order.phone || '',
                          address: order.address || '',
                          notes: order.notes || '',
                          estimatedDeliveryTime: order.estimatedDeliveryTime || 30
                        });
                      }}
                  className="p-3 rounded-xl bg-white/10 text-white"
                  title="Edit Info"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => setDeletingId(order.id)}
                  className="p-3 rounded-xl bg-red-500/10 text-red-500"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={() => {
                    setSelectedOrder(selectedOrder === order.id ? null : order.id);
                  }}
                  className={`p-3 rounded-xl transition-all ${selectedOrder === order.id ? 'bg-primary text-white' : 'bg-white/10 text-white'}`}
                  title="Update Status"
                >
                  <MoreVertical size={18} />
                </button>
              </div>
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

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Assign Rider</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 focus:outline-none focus:border-primary/50 transition-all font-bold"
                      value={order.riderId || ""}
                      onChange={(e) => assignRider(order.id, e.target.value)}
                    >
                      <option value="" disabled>Choose Rider</option>
                      {riders.map(r => (
                        <option key={r.id} value={r.id} className="bg-[#111]">{r.name} ({r.status})</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {order.status === 'pending' && (
              <div className="pt-2 space-y-4">
                {(order.paymentMethod === 'upi' || order.paymentMethod === 'online' || order.utr) ? (
                  <div className="space-y-4">
                    {order.paymentScreenshot && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Proof:</p>
                        <ImageZoom 
                          src={order.paymentScreenshot} 
                          alt={`Proof: ${order.utr || order.id}`} 
                          className="w-full h-40 object-cover rounded-2xl border border-white/10"
                          triggerClassName="w-full h-40"
                        />
                      </div>
                    )}
                    {order.utr ? (
                      <div className="space-y-2">
                        <button 
                          onClick={() => verifyPayment(order.id)}
                          className="w-full py-4 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={16} />
                          Accept Order (UTR: {order.utr})
                        </button>
                        <button 
                          onClick={() => rejectPayment(order.id)}
                          className="w-full py-4 bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center justify-center gap-2"
                        >
                          <X size={16} />
                          Reject Order
                        </button>
                      </div>
                    ) : (
                      <div className="flex grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => updateStatus(order.id, 'confirmed')}
                          className="py-3 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg"
                        >
                          Accept Manual
                        </button>
                        <button 
                          onClick={() => updateStatus(order.id, 'cancelled')}
                          className="py-3 bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg"
                        >
                          Reject Order
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={() => updateStatus(order.id, 'confirmed')}
                      className="py-3 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg"
                    >
                      Accept Order
                    </button>
                    <button 
                      onClick={() => updateStatus(order.id, 'cancelled')}
                      className="py-3 bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {order.status === 'confirmed' && selectedOrder !== order.id && (
              <div className="pt-2">
                <button 
                  onClick={() => updateStatus(order.id, 'preparing')}
                  className="w-full py-3 bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg"
                >
                  Start Cooking
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
              className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-[32px] p-10 shadow-2xl overflow-hidden"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-white">Edit Order Details</h3>
                  <button onClick={() => setEditingOrder(null)} className="p-2 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-all">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleEditSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Customer Name</label>
                    <input 
                      type="text" 
                      required
                      value={editFormData.customerName}
                      onChange={(e) => setEditFormData({...editFormData, customerName: e.target.value})}
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
                        value={editFormData.estimatedDeliveryTime}
                        onChange={(e) => setEditFormData({...editFormData, estimatedDeliveryTime: Number(e.target.value)})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary/50 transition-all" 
                      />
                      <Clock size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setEditingOrder(null)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all">
                      Cancel
                    </button>
                    <button type="submit" className="flex-1 py-4 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-black transition-all">
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
