import React, { useState, useEffect } from 'react';
import { MoreVertical, ExternalLink, User, Clock, CheckCircle2, Truck, Package, MessageCircle, X, Trash2, Edit2, Volume2, VolumeX, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { sendWhatsAppMessage } from '../../utils/whatsapp';
import { KOTPrint } from './KOTPrint';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

import { Order, Rider } from '../../types';

const StatusBadge = ({ status }: { status: Order['status'] }) => {
  const styles = {
    'pending': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'assigned': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'preparing': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'out_for_delivery': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'delivered': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'cancelled': 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const icons = {
    'pending': <Clock size={14} />,
    'preparing': <Package size={14} />,
    'out_for_delivery': <Truck size={14} />,
    'delivered': <CheckCircle2 size={14} />,
    'cancelled': <X size={14} />,
  };

  const labels = {
    'pending': 'Pending',
    'preparing': 'Preparing',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${styles[status]}`}>
      {icons[status]}
      {labels[status]}
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
  const lastOrderCountRef = React.useRef<number>(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const loading = externalLoading !== undefined ? externalLoading : internalLoading;

  const [editFormData, setEditFormData] = useState({
    customerName: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    const unsubscribeRiders = onSnapshot(collection(db, 'riders'), (snapshot) => {
      const ridersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Rider[];
      setRiders(ridersData);
      setInternalLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'riders');
    });

    return () => {
      unsubscribeRiders();
    };
  }, []);

  // Auto-print logic for new pending orders
  useEffect(() => {
    if (autoPrint && !loading && orders.length > lastOrderCountRef.current) {
      const newOrder = orders[0]; // Newest order is at index 0 due to orderBy createdAt desc
      if (newOrder && newOrder.status === 'pending') {
        handlePrintKOT(newOrder, true);
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

  const updateStatus = async (id: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    try {
      await updateDoc(doc(db, 'orders', editingOrder.id), editFormData);
      setEditingOrder(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${editingOrder.id}`);
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'orders', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${id}`);
    }
  };

  const assignRider = async (orderId: string, riderId: string) => {
    const rider = riders.find(r => r.id === riderId);
    if (!rider) return;

    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        riderId: rider.id,
        riderName: rider.name,
        status: 'preparing' // Auto-update to preparing when assigned
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
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
                          onClick={() => sendWhatsAppMessage(order.phone, `Hello ${order.customerName}, this is Frosty Bite Bakery regarding your order #${order.id.slice(-6).toUpperCase()}.`)}
                          className="flex items-center gap-1 text-[10px] text-emerald-500 hover:text-emerald-400 font-bold"
                        >
                          <MessageCircle size={10} />
                          {order.phone}
                        </button>
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
                  <span className="text-sm font-bold text-white">₹{order.total}</span>
                </td>
                <td className="px-8 py-6">
                  <StatusBadge status={order.status} />
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
                    {order.status === 'pending' && (
                      <div className="flex items-center gap-2 mr-2">
                        <button 
                          onClick={() => updateStatus(order.id, 'preparing')}
                          className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => updateStatus(order.id, 'cancelled')}
                          className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                        >
                          Reject
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
                          address: order.address || ''
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
                            ].map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  updateStatus(order.id, s.id as Order['status']);
                                  setSelectedOrder(null);
                                }}
                                className="w-full text-left px-4 py-3 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                              >
                                Mark as {s.label}
                              </button>
                            ))}
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
              <StatusBadge status={order.status} />
            </div>
            
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-white">{order.customerName}</span>
                <span className="text-xs text-gray-500">{order.phone}</span>
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
              <span className="text-lg font-black text-white">₹{order.total}</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handlePrintKOT(order)}
                  className="p-3 rounded-xl bg-white/10 text-white"
                >
                  <Printer size={18} />
                </button>
                <button 
                  onClick={() => setDeletingId(order.id)}
                  className="p-3 rounded-xl bg-red-500/10 text-red-500"
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={() => {
                    setSelectedOrder(selectedOrder === order.id ? null : order.id);
                  }}
                  className="p-3 rounded-xl bg-primary text-white"
                >
                  <Edit2 size={18} />
                </button>
              </div>
            </div>
            
            {order.status === 'pending' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={() => updateStatus(order.id, 'preparing')}
                  className="py-3 bg-emerald-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg"
                >
                  Accept
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
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-primary/50 transition-all h-24 resize-none" 
                    />
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
