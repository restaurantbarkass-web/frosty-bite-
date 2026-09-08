import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  XCircle, 
  RotateCcw, 
  MessageCircle, 
  ShoppingBag, 
  HelpCircle, 
  Copy, 
  Check, 
  Receipt, 
  MapPin, 
  CreditCard, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Cake, 
  Sparkles,
  Info,
  CheckCircle2,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Order } from '../../types';
import { FrostyAnimation } from '../LottiePlayer';
import { LOTTIE_ANIMATIONS } from '../../constants/animations';
import { useCart } from '../../context/CartContext';
import { formatOrderId } from '../../utils/orderUtils';
import { cn, haptic } from '../../lib/utils';
import { RESTAURANT_WHATSAPP } from '../../constants';
import toast from 'react-hot-toast';

interface OrderCancelledViewProps {
  order: Order;
  onReorder?: () => void;
  className?: string;
}

export const OrderCancelledView: React.FC<OrderCancelledViewProps> = ({
  order,
  onReorder,
  className
}) => {
  const navigate = useNavigate();
  const { addToCart, reorderItems } = useCart();
  const [copiedRef, setCopiedRef] = useState(false);
  const [showItemsList, setShowItemsList] = useState(true);
  const [isReordering, setIsReordering] = useState(false);

  const formattedId = formatOrderId(order.id);
  const isOnlinePayment = order.payment_method === 'online' || order.payment_method === 'upi' || order.payment_status === 'paid';
  const refundId = `REF-${(order.id || 'FB').slice(-6).toUpperCase()}`;

  const cancelledDateFormatted = order.cancelled_at 
    ? new Date(order.cancelled_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : order.updated_at
    ? new Date(order.updated_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recent';

  const cancellationReason = order.cancellation_reason || order.notes || 'Order cancelled by customer request';

  const handleCopyOrderId = () => {
    haptic.light();
    navigator.clipboard.writeText(`#${formattedId}`);
    setCopiedRef(true);
    toast.success('Order ID copied to clipboard!', {
      icon: '📋',
      style: { borderRadius: '16px', background: '#1E1B18', color: '#fff' }
    });
    setTimeout(() => setCopiedRef(false), 2500);
  };

  const handleReorder = async () => {
    haptic.medium();
    setIsReordering(true);
    try {
      if (onReorder) {
        onReorder();
      } else if (order.items && Array.isArray(order.items)) {
        if (reorderItems) {
          reorderItems(order.items, { openCart: true });
        } else {
          order.items.forEach((item: any) => {
            addToCart({
              id: item.id || String(Math.random()),
              name: item.name,
              price: item.price,
              image: item.image,
              description: item.description || '',
              category: item.category || 'Cakes',
              rating: item.rating || 4.8
            } as any);
          });
        }
        toast.success('Items added to your bag! 🍰', {
          style: { borderRadius: '16px', background: '#1E1B18', color: '#fff' }
        });
        navigate('/');
      }
    } catch (err) {
      toast.error('Unable to reorder items at this moment');
    } finally {
      setIsReordering(false);
    }
  };

  const handleWhatsAppSupport = () => {
    haptic.light();
    const phone = RESTAURANT_WHATSAPP || '919876543210';
    const text = encodeURIComponent(
      `Hi Frosty Bite Team! 👋\n\nI have a query regarding my *Cancelled Order*:\n• *Order ID:* #${formattedId}\n• *Amount:* ₹${order.total || 0}\n• *Reason:* ${cancellationReason}\n\nCould you please assist me with the status / refund details? Thank you! 🍰`
    );
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${text}`, '_blank');
  };

  return (
    <div className={cn("w-full space-y-6 select-none", className)} id="order-cancelled-view">
      {/* Hero Cancelled Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1816] via-[#171412] to-[#251515] p-6 sm:p-8 text-white border border-rose-900/30 shadow-2xl"
      >
        {/* Ambient Warm Ambient Glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#E76A54]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Text Content */}
          <div className="space-y-3.5 text-center md:text-left flex-1">
            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 border border-rose-500/30 text-rose-300 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span>Order Cancelled</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                This Order Was Cancelled
              </h2>
              <p className="text-xs sm:text-sm text-stone-300 max-w-lg leading-relaxed">
                Your order was successfully cancelled on <span className="font-semibold text-rose-200">{cancelledDateFormatted}</span>. All ingredients and bakery stock have been safely restored.
              </p>
            </div>

            {/* Cancellation Reason Badge */}
            <div className="inline-flex items-start sm:items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/5 border border-white/10 text-xs text-stone-300 text-left">
              <AlertTriangle size={15} className="text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong className="text-white font-semibold">Reason:</strong> {cancellationReason}
              </span>
            </div>
          </div>

          {/* Animated Mascot / Character Graphic */}
          <div className="shrink-0 flex items-center justify-center">
            <div className="w-28 h-28 sm:w-36 sm:h-36 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-rose-500/15 rounded-full blur-xl animate-pulse" />
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <FrostyAnimation
                  type="cancelled"
                  animation={LOTTIE_ANIMATIONS.CANCELLED}
                  className="w-full h-full object-contain drop-shadow-xl"
                  loop={true}
                  autoplay={true}
                  fallback={
                    <div className="w-24 h-24 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex flex-col items-center justify-center text-rose-400 gap-1.5 shadow-lg">
                      <XCircle size={36} className="text-rose-400 stroke-[2]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-300">Cancelled</span>
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Order Meta Bar */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-stone-400">Order Reference:</span>
            <button
              type="button"
              onClick={handleCopyOrderId}
              className="inline-flex items-center gap-1.5 font-mono font-bold text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg border border-white/10 transition-colors cursor-pointer"
            >
              <span>#{formattedId}</span>
              {copiedRef ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-stone-400" />}
            </button>
          </div>

          <div className="flex items-center gap-4 text-stone-400 text-[11px]">
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-stone-400" />
              {cancelledDateFormatted}
            </span>
            <span className="text-stone-600">•</span>
            <span className="capitalize font-semibold text-stone-300">
              {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online / UPI Paid'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Financial & Refund Assurance Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/90 shadow-xs space-y-5"
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs",
              isOnlinePayment ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-stone-100 text-stone-700"
            )}>
              {isOnlinePayment ? <CreditCard size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-serif font-bold text-stone-900">
                {isOnlinePayment ? 'Payment & Refund Status' : 'Billing & Payment Details'}
              </h3>
              <p className="text-xs text-stone-500">
                {isOnlinePayment 
                  ? 'Official refund tracking for your prepaid transaction' 
                  : 'Cash on Delivery checkout verification'}
              </p>
            </div>
          </div>

          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider font-mono",
            isOnlinePayment 
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
              : "bg-stone-100 text-stone-700 border border-stone-200"
          )}>
            {isOnlinePayment ? 'Refund Initiated' : '₹0.00 Charged'}
          </span>
        </div>

        {isOnlinePayment ? (
          /* Online / UPI Refund Details */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Refund Amount</span>
                <p className="text-lg font-mono font-bold text-emerald-700 mt-0.5">
                  ₹{order.total || 0}
                </p>
                <span className="text-[10px] text-emerald-600 font-semibold">100% Full Refund</span>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Destination</span>
                <p className="text-xs font-bold text-stone-800 mt-1 flex items-center gap-1.5">
                  <CreditCard size={13} className="text-stone-500" />
                  Original UPI / Bank
                </p>
                <span className="text-[10px] text-stone-500">Source account</span>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Estimated Timeline</span>
                <p className="text-xs font-bold text-stone-800 mt-1 flex items-center gap-1.5">
                  <Clock size={13} className="text-[#E76A54]" />
                  2–4 Business Days
                </p>
                <span className="text-[10px] text-stone-500">Subject to bank clearing</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-900 flex items-start gap-2.5">
              <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-emerald-950">Refund Reference: {refundId}</p>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  Your refund has been registered with our banking gateway. Depending on your bank or UPI provider (GPay, PhonePe, Paytm), the funds will credit back to your account shortly.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* COD Notice */
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
            <div className="flex items-center gap-2 text-stone-800 font-bold text-xs">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>No payment was deducted</span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Because this order was placed with <strong className="text-stone-800">Cash on Delivery (COD)</strong>, no transaction occurred. You do not have to worry about pending charges or refund waiting times.
            </p>
          </div>
        )}

        {/* Bakery Restock Assurance */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-3 text-xs text-amber-950">
          <Cake size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-900">Artisan Bakery Assurance</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              All reserved bakery treats and handcrafted decorations for this order were released back into our kitchen system. We look forward to baking for you next time!
            </p>
          </div>
        </div>
      </motion.div>

      {/* Cancelled Order Item Summary Accordion */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/90 shadow-xs space-y-5"
      >
        <div 
          onClick={() => setShowItemsList(!showItemsList)}
          className="flex items-center justify-between cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Receipt size={18} className="text-[#E76A54]" />
            <h3 className="text-sm sm:text-base font-serif font-bold text-stone-900">
              Cancelled Items ({order.items?.length || 0})
            </h3>
          </div>

          <button 
            type="button"
            className="p-1.5 rounded-xl bg-stone-100 group-hover:bg-stone-200 text-stone-600 transition-colors"
          >
            {showItemsList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <AnimatePresence>
          {showItemsList && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-2 border-t border-stone-100"
            >
              {/* Item List */}
              <div className="divide-y divide-stone-100">
                {order.items && Array.isArray(order.items) && order.items.map((item: any, idx: number) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-4 opacity-75 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 overflow-hidden relative">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover grayscale-[30%]" />
                        ) : (
                          <Cake size={18} className="text-stone-400" />
                        )}
                        <span className="absolute inset-0 bg-stone-900/10" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-stone-800 leading-snug">
                          {item.name}
                        </h4>
                        <span className="text-[11px] text-stone-400 font-medium">
                          Qty: {item.quantity || 1} × ₹{item.price}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs sm:text-sm font-bold text-stone-500 font-mono line-through">
                        ₹{(item.price || 0) * (item.quantity || 1)}
                      </span>
                      <span className="block text-[10px] font-bold uppercase text-rose-500">
                        Cancelled
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Address Destination Info */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-start gap-2.5 text-xs text-stone-600">
                <MapPin size={15} className="text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800">Original Destination:</span>{' '}
                  <span>{order.address || order.delivery_address || 'Delivery address on record'}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Empathetic Bottom Action Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2"
      >
        {/* Reorder Button */}
        <button
          type="button"
          onClick={handleReorder}
          disabled={isReordering}
          className="w-full py-3.5 px-4 rounded-2xl bg-[#E76A54] hover:bg-[#d85c46] text-white font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#E76A54]/20 transition-all active:scale-[0.98] cursor-pointer"
        >
          <RotateCcw size={16} className={cn(isReordering && "animate-spin")} />
          <span>{isReordering ? 'Restoring Items…' : 'Order Again 🔁'}</span>
        </button>

        {/* WhatsApp Support Button */}
        <button
          type="button"
          onClick={handleWhatsAppSupport}
          className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#128C7E] border border-[#25D366]/30 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          <MessageCircle size={16} />
          <span>Bakery Support</span>
        </button>

        {/* Browse Menu */}
        <button
          type="button"
          onClick={() => {
            haptic.light();
            navigate('/');
          }}
          className="w-full py-3.5 px-4 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
        >
          <ShoppingBag size={16} />
          <span>Explore Specials</span>
        </button>
      </motion.div>
    </div>
  );
};
