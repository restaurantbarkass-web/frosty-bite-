import React from 'react';
import { 
  Package, 
  MapPin, 
  Navigation, 
  CheckCircle, 
  Phone, 
  Truck, 
  User, 
  Clock, 
  DollarSign,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendWhatsAppMessage } from '../../utils/whatsapp';

interface OrderCardProps {
  order: any;
  onStatusUpdate: (orderId: string, status: string) => void;
  isLoading?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onStatusUpdate, isLoading }) => {
  if (!order) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'assigned':
        return { 
          label: 'Assigned', 
          nextStatus: 'preparing', 
          nextLabel: 'Accept Order', 
          icon: Package,
          color: 'bg-blue-500'
        };
      case 'preparing':
        return { 
          label: 'Preparing', 
          nextStatus: 'out_for_delivery', 
          nextLabel: 'Picked Up', 
          icon: Clock,
          color: 'bg-orange-500'
        };
      case 'out_for_delivery':
        return { 
          label: 'Out for Delivery', 
          nextStatus: 'delivered', 
          nextLabel: 'Mark Delivered', 
          icon: Truck,
          color: 'bg-emerald-500'
        };
      default:
        return { 
          label: 'Pending', 
          nextStatus: 'assigned', 
          nextLabel: 'Accept', 
          icon: Package,
          color: 'bg-zinc-500'
        };
    }
  };

  const config = getStatusConfig(order.status);

  const sendTracking = () => {
    if (!order.deliveryLocation || !order.phone) return;
    
    const message = `
🛵 Your order is on the way!

Track here:
https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLocation.lat},${order.deliveryLocation.lng}
    `;

    sendWhatsAppMessage(order.phone, message);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-dark p-8 rounded-[2.5rem] border-2 border-primary shadow-2xl relative overflow-hidden group"
    >
      {/* Status Badge */}
      <div className="absolute top-0 right-0 p-6">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white ${config.color}`}>
          <config.icon size={12} />
          {config.label}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <span className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-2 block">Active Order</span>
          <h2 className="text-3xl font-black text-white tracking-tight">#{order.id.slice(-6).toUpperCase()}</h2>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
              <User size={20} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Customer</p>
              <p className="text-lg font-bold text-white">{order.customerName || 'Anonymous'}</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
              <Navigation size={20} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Delivery Address</p>
              <p className="text-sm text-zinc-300 leading-relaxed">{order.address}</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <DollarSign size={18} />
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Total Amount</p>
                <p className="text-lg font-black text-white">₹{order.total}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Distance</p>
              <p className="text-lg font-black text-emerald-500">2.4 km</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button 
            onClick={() => window.open(`tel:${order.phone}`, '_self')}
            className="py-4 bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center justify-center gap-3"
          >
            <Phone size={18} />
            Call
          </button>
          
          <button 
            onClick={sendTracking}
            className="py-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-3"
          >
            <MessageCircle size={18} />
            Send Tracking 📲
          </button>

          <button
            disabled={isLoading}
            onClick={() => onStatusUpdate(order.id, config.nextStatus)}
            className="py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/20"
          >
            <CheckCircle size={18} />
            {config.nextLabel}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
