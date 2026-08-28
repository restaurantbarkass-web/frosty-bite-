import React, { useState } from 'react';
import { 
  ArrowLeft, Save, Clock, Phone, MapPin, User as UserIcon, Mail, 
  ShoppingBag, Truck, AlertCircle, CheckCircle2, XCircle, 
  Printer, MessageSquare, ExternalLink, RefreshCw, Sparkles, 
  DollarSign, Hash, Check, Copy, AlertTriangle, ChevronRight, ShieldAlert, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { SlideToConfirm } from '../../components/ui/SlideToConfirm';
import { AdminCancellationSuccessModal } from '../../components/admin/AdminCancellationSuccessModal';
import { normalizePhoneNumber, openCancellationWhatsApp } from '../../utils/whatsapp';
import toast from 'react-hot-toast';

interface OrderEditPageProps {
  order: Order;
  onBack: () => void;
  onOrderUpdated?: (updatedOrder: Order) => void;
  onPrintKOT?: (order: Order) => void;
}

export const OrderEditPage: React.FC<OrderEditPageProps> = ({
  order,
  onBack,
  onOrderUpdated,
  onPrintKOT
}) => {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState(order.customer_name || order.customerName || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [email, setEmail] = useState(order.email || '');
  const [address, setAddress] = useState(order.address || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>(order.order_type || 'delivery');
  const [status, setStatus] = useState<Order['status']>(order.status || 'pending');
  const [paymentStatus, setPaymentStatus] = useState<Order['payment_status']>(order.payment_status || 'pending');
  const [paymentMethod, setPaymentMethod] = useState<Order['payment_method']>(order.payment_method || 'cod');
  const [utr, setUtr] = useState(order.utr || '');
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState<string | number>(order.estimated_delivery_time || 30);
  const [cancellationReason, setCancellationReason] = useState(order.cancellation_reason || '');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Financial fields
  const [deliveryCharge, setDeliveryCharge] = useState<number>(order.delivery_charge ?? 0);
  const [discount, setDiscount] = useState<number>(order.discount ?? 0);
  const [items, setItems] = useState<any[]>(Array.isArray(order.items) ? [...order.items] : []);

  // Compute calculated subtotal
  const computedSubtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    return sum + (qty * price);
  }, 0);

  const computedTotal = Math.max(0, computedSubtotal + Number(deliveryCharge) - Number(discount));

  const handleFieldChange = (setter: any, value: any) => {
    setter(value);
    setHasChanges(true);
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const updated = [...items];
    updated[index] = { ...updated[index], quantity: newQty };
    setItems(updated);
    setHasChanges(true);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('An order must have at least one item');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    setHasChanges(true);
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard!');
    }
  };

  const handleOpenMaps = () => {
    if (address) {
      const query = encodeURIComponent(address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  const handleWhatsAppCustomer = () => {
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const formatted = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
      const msg = encodeURIComponent(`Hello ${customerName}, updating you regarding your Frosty Bite order #${order.id.slice(0, 8)}...`);
      window.open(`https://wa.me/${formatted}?text=${msg}`, '_blank');
    } else {
      toast.error('No phone number available');
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    const updatePayload = {
      customer_name: customerName,
      customerName: customerName,
      phone: phone,
      email: email,
      address: address,
      notes: notes,
      order_type: orderType,
      status: status,
      payment_status: paymentStatus,
      payment_method: paymentMethod,
      utr: utr,
      estimated_delivery_time: estimatedDeliveryTime,
      cancellation_reason: status === 'cancelled' ? cancellationReason : null,
      delivery_charge: deliveryCharge,
      discount: discount,
      subtotal: computedSubtotal,
      total: computedTotal,
      total_amount: computedTotal,
      items: items,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabaseService.updateData('orders', order.id, updatePayload);
      if (error) {
        throw new Error(error.message || 'Failed to update order in database');
      }

      toast.success('Order details updated successfully!');
      setHasChanges(false);

      const mergedOrder = { ...order, ...updatePayload };
      if (onOrderUpdated) {
        onOrderUpdated(mergedOrder as Order);
      }

      if (status === 'cancelled') {
        setShowWhatsAppModal(true);
      }
    } catch (err: any) {
      console.error('Error updating order:', err);
      toast.error(err.message || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    awaiting_payment: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
    confirmed: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    preparing: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    out_for_delivery: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    delivered: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    cancelled: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  };

  const currStatusStyle = statusColors[status] || statusColors.pending;

  return (
    <div className="fixed inset-0 z-[120] bg-[#09090b] text-zinc-100 flex flex-col overflow-hidden font-sans">
      {/* Top Header Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#0d0d12]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all active:scale-95 flex items-center gap-2 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-semibold hidden sm:inline">Back to Dashboard</span>
          </button>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                Order <span className="font-mono text-primary">#{order.id.slice(0, 8)}</span>
              </h1>
              <span className={`px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider rounded-full border ${currStatusStyle.bg} ${currStatusStyle.text} ${currStatusStyle.border}`}>
                {status.replace(/_/g, ' ')}
              </span>
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider rounded-full border bg-white/5 border-white/10 text-zinc-300 flex items-center gap-1">
                {orderType === 'pickup' ? <ShoppingBag size={12} className="text-amber-400" /> : <Truck size={12} className="text-cyan-400" />}
                {orderType.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block mt-0.5">
              Created: {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          {onPrintKOT && (
            <button
              type="button"
              onClick={() => onPrintKOT(order)}
              className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 hover:text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
              title="Print Receipt / KOT"
            >
              <Printer size={16} />
              <span className="hidden md:inline">Print Receipt</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleWhatsAppCustomer}
            className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
            title="WhatsApp Customer"
          >
            <MessageSquare size={16} />
            <span className="hidden md:inline">WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
              hasChanges 
                ? 'bg-primary text-white hover:bg-orange-600 shadow-primary/20 animate-pulse' 
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {saving ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>{saving ? 'Saving...' : hasChanges ? 'Save Changes *' : 'Save'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Scrollable Container */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8 pb-32">
        {/* Has Unsaved Changes Notification Banner */}
        <AnimatePresence>
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold">
                <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                <span>You have unsaved changes to this order. Remember to click <strong>"Save Changes"</strong>.</span>
              </div>
              <button
                onClick={() => handleSave()}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-all shrink-0"
              >
                Save Now
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (8 cols): Order Status Stepper & Customer Details & Order Items */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Order Lifecycle Status Interactive Stepper */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#111116] border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={18} className="text-primary" />
                    Order Status Management
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Select a status to advance this order's live progress for the customer.
                  </p>
                </div>
              </div>

              {/* Status Quick Toggle Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {[
                  { key: 'pending', label: 'Pending', icon: Clock },
                  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
                  { key: 'preparing', label: 'Baking', icon: Sparkles },
                  { key: 'out_for_delivery', label: orderType === 'pickup' ? 'Ready Pickup' : 'Dispatched', icon: Truck },
                  { key: 'delivered', label: 'Delivered', icon: Check },
                  { key: 'cancelled', label: 'Cancelled', icon: XCircle },
                ].map((st) => {
                  const isSelected = status === st.key;
                  const Icon = st.icon;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleFieldChange(setStatus, st.key)}
                      className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 ${
                        isSelected 
                          ? 'bg-primary/20 border-primary text-white shadow-lg shadow-primary/10' 
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Icon size={18} className={isSelected ? 'text-primary' : 'text-zinc-500'} />
                      <span className="text-xs font-bold">{st.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Cancellation Reason if Cancelled */}
              {status === 'cancelled' && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-3">
                  <label className="text-xs font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={14} />
                    Cancellation Reason
                  </label>
                  <input
                    type="text"
                    value={cancellationReason}
                    onChange={(e) => handleFieldChange(setCancellationReason, e.target.value)}
                    placeholder="e.g. Out of stock ingredients, Customer requested cancellation"
                    className="w-full bg-black/40 border border-rose-500/30 rounded-xl py-3 px-4 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500"
                  />
                  <div className="pt-2">
                    <SlideToConfirm
                      onConfirm={async () => {
                        await handleSave();
                      }}
                      label="Slide to Confirm Cancellation"
                      releaseLabel="Release to Confirm Cancel"
                      processingLabel="Saving Cancellation..."
                      successLabel="Order Cancelled!"
                      variant="danger"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Customer & Fulfillment Information Editor */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#111116] border border-white/10 shadow-2xl space-y-6">
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UserIcon size={18} className="text-primary" />
                Customer & Delivery Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => handleFieldChange(setCustomerName, e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Phone Number</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => handleFieldChange(setPhone, e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                    />
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-400 flex items-center justify-center transition-all"
                        title="Call Customer"
                      >
                        <Phone size={18} />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleFieldChange(setEmail, e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Fulfillment Type</label>
                  <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => handleFieldChange(setOrderType, 'delivery')}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        orderType === 'delivery' ? 'bg-primary text-white shadow-md' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Truck size={14} /> Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFieldChange(setOrderType, 'pickup')}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        orderType === 'pickup' ? 'bg-amber-500 text-black shadow-md' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <ShoppingBag size={14} /> Pickup
                    </button>
                  </div>
                </div>
              </div>

              {/* Delivery Address Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    {orderType === 'pickup' ? 'Store Pickup Location' : 'Delivery Address'}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-bold"
                    >
                      <Copy size={12} /> Copy
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenMaps}
                      className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      <MapPin size={12} /> Open Maps
                    </button>
                  </div>
                </div>
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => handleFieldChange(setAddress, e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none"
                />
              </div>

              {/* Kitchen / Order Notes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Kitchen & Preparation Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => handleFieldChange(setNotes, e.target.value)}
                  placeholder="e.g. Less sugar, Eggless preparation, Birthday candle required..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all resize-none"
                />
              </div>

              {/* Estimated Delivery Time Editor */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={14} className="text-amber-400" />
                  Estimated Delivery / Readiness Time
                </label>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={estimatedDeliveryTime}
                    onChange={(e) => handleFieldChange(setEstimatedDeliveryTime, e.target.value)}
                    placeholder="e.g. 30, 45 mins, 1-2 Days"
                    className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-mono focus:outline-none focus:border-primary/50"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2">
                  {['15 mins', '25 mins', '35 mins', '45 mins', '60 mins', '1-2 Days'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleFieldChange(setEstimatedDeliveryTime, preset)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        String(estimatedDeliveryTime) === preset
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Items Breakdown & Live Item Management */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#111116] border border-white/10 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShoppingBag size={18} className="text-primary" />
                  Ordered Items ({items.length})
                </h2>
              </div>

              <div className="space-y-4">
                {items.map((item: any, idx: number) => {
                  const qty = Number(item.quantity) || 1;
                  const price = Number(item.price) || 0;
                  const lineTotal = qty * price;

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden"
                    >
                      {/* Left: Product Thumbnail & Name & Unit Price */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                            <ShoppingBag size={20} className="text-zinc-500" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-white truncate">{item.name || 'Treat Item'}</h4>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">₹{price} each</p>
                        </div>
                      </div>

                      {/* Right: Quantity Controls, Total & Delete Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                        {/* Quantity Counter */}
                        <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(idx, qty - 1)}
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 flex items-center justify-center font-bold text-xs transition-all"
                          >
                            -
                          </button>
                          <span className="w-7 text-center font-mono font-bold text-xs text-white">{qty}</span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(idx, qty + 1)}
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 flex items-center justify-center font-bold text-xs transition-all"
                          >
                            +
                          </button>
                        </div>

                        {/* Total Price */}
                        <div className="text-right min-w-[64px]">
                          <span className="text-sm font-black text-amber-400 font-mono">₹{lineTotal}</span>
                        </div>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all shrink-0 flex items-center justify-center"
                          title="Remove item"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column (4 cols): Payment Details & Financial Breakdown Summary */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Payment Verification & Status Panel */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#111116] border border-white/10 shadow-2xl space-y-6">
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-400" />
                Payment Info
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => handleFieldChange(setPaymentStatus, e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50"
                  >
                    <option value="pending" className="bg-zinc-900">Pending</option>
                    <option value="pending_verification" className="bg-zinc-900">Pending Verification (UTR Submitted)</option>
                    <option value="paid" className="bg-zinc-900">Paid ✅</option>
                    <option value="failed" className="bg-zinc-900">Failed ❌</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => handleFieldChange(setPaymentMethod, e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white focus:outline-none focus:border-primary/50"
                  >
                    <option value="upi" className="bg-zinc-900">UPI Direct</option>
                    <option value="cod" className="bg-zinc-900">Cash on Delivery (COD)</option>
                    <option value="online" className="bg-zinc-900">Online Gateway</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">UTR / Reference No.</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={utr}
                      onChange={(e) => handleFieldChange(setUtr, e.target.value)}
                      placeholder="e.g. 4231238910"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm text-white font-mono focus:outline-none focus:border-primary/50"
                    />
                    <Hash size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  </div>
                </div>

                {order.payment_screenshot && (
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Payment Screenshot</label>
                    <a
                      href={order.payment_screenshot}
                      target="_blank"
                      rel="noreferrer"
                      className="block p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 transition-all text-xs font-bold text-primary flex items-center justify-between"
                    >
                      <span>View Payment Proof</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Summary & Adjustments */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#111116] border border-white/10 shadow-2xl space-y-6">
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                Financial Summary
              </h2>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Items Subtotal</span>
                  <span className="font-mono font-bold text-white text-sm">₹{computedSubtotal}</span>
                </div>

                <div className="flex justify-between items-center text-zinc-400 gap-4">
                  <span>Delivery Charge</span>
                  <input
                    type="number"
                    min="0"
                    value={deliveryCharge}
                    onChange={(e) => handleFieldChange(setDeliveryCharge, Number(e.target.value))}
                    className="w-24 bg-white/5 border border-white/10 rounded-xl py-1 px-2 text-right font-mono text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex justify-between items-center text-zinc-400 gap-4">
                  <span>Discount</span>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => handleFieldChange(setDiscount, Number(e.target.value))}
                    className="w-24 bg-white/5 border border-white/10 rounded-xl py-1 px-2 text-right font-mono text-sm text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-sm font-black uppercase text-white">Grand Total</span>
                  <span className="text-xl font-black font-mono text-primary">₹{computedTotal}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                  <span>{saving ? 'Saving Changes...' : 'Save Order Changes'}</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* WhatsApp Cancellation Success Modal */}
      <AdminCancellationSuccessModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        order={{
          ...order,
          customer_name: customerName,
          phone: phone,
          total: computedTotal,
          status: 'cancelled',
          cancellation_reason: cancellationReason
        }}
        cancellationReason={cancellationReason}
      />
    </div>
  );
};
