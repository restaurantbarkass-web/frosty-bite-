import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  MessageSquare, 
  X, 
  ExternalLink, 
  Copy, 
  Phone, 
  ArrowLeft, 
  AlertTriangle, 
  RefreshCw, 
  Sparkles, 
  Check, 
  Clock, 
  Package, 
  ShieldCheck, 
  Receipt, 
  User, 
  MapPin, 
  CreditCard,
  Edit3,
  ShoppingBag
} from 'lucide-react';
import { Order } from '../../types';
import { normalizePhoneNumber, buildReadyForPickupWhatsAppMessage } from '../../utils/whatsapp';
import { formatOrderId } from '../../utils/orderUtils';
import { BAKERY_ADDRESS } from '../../constants';
import toast from 'react-hot-toast';

interface OrderReadyPickupPageProps {
  order: Order | null;
  onBack?: () => void;
  isStandalonePage?: boolean;
}

export const OrderReadyPickupPage: React.FC<OrderReadyPickupPageProps> = ({
  order,
  onBack,
  isStandalonePage = false
}) => {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [hasOpenedWhatsApp, setHasOpenedWhatsApp] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // Fallback default order if none provided
  const displayOrder: Order = order || {
    id: 'FB1024',
    user_id: 'guest',
    customer_name: 'Aisha',
    phone: '9876543210',
    address: BAKERY_ADDRESS,
    total: 450,
    subtotal: 450,
    delivery_charge: 0,
    status: 'out_for_delivery',
    order_type: 'pickup',
    payment_method: 'upi',
    payment_status: 'paid',
    delivery_date: 'Today',
    delivery_time: '6:30 PM',
    created_at: new Date().toISOString(),
    items: [
      { id: '1', name: 'Chocolate Truffle Cake', quantity: 1, price: 450 }
    ]
  };

  const customerName = (displayOrder.customer_name || displayOrder.customerName || 'Customer').trim();
  const orderIdShort = formatOrderId(displayOrder.id);
  const amount = displayOrder.total ?? displayOrder.total_amount ?? 0;

  const normalizedPhone = normalizePhoneNumber(displayOrder.phone);
  const hasValidPhone = Boolean(normalizedPhone);

  const defaultMessage = buildReadyForPickupWhatsAppMessage(displayOrder);
  const [customMessage, setCustomMessage] = useState(defaultMessage);

  useEffect(() => {
    setCustomMessage(buildReadyForPickupWhatsAppMessage(displayOrder));
  }, [displayOrder]);

  const handleOpenWhatsApp = () => {
    if (!hasValidPhone || !normalizedPhone) {
      toast.error('No customer phone number is available or phone number is invalid.');
      return;
    }

    const encodedMessage = encodeURIComponent(customMessage);
    const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;

    try {
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (win) {
        setHasOpenedWhatsApp(true);
        toast.success('✓ WhatsApp opened with the pickup notification', {
          style: {
            background: '#121212',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.3)'
          }
        });
      } else {
        toast.error('Unable to open WhatsApp. Please check popup blocker.');
      }
    } catch (err: any) {
      toast.error('Unable to open WhatsApp. Please contact customer manually.');
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(customMessage);
    setCopiedMessage(true);
    toast.success('Message copied to clipboard!');
    setTimeout(() => setCopiedMessage(false), 3000);
  };

  const handleCopyPhone = () => {
    if (displayOrder.phone) {
      navigator.clipboard.writeText(displayOrder.phone);
      setCopiedPhone(true);
      toast.success('Phone number copied!');
      setTimeout(() => setCopiedPhone(false), 3000);
    }
  };

  const pickupLocation = displayOrder.address || displayOrder.delivery_address || BAKERY_ADDRESS;
  const cleanPickupLocation = pickupLocation ? pickupLocation.replace(/^\[IN-STORE PICKUP\]\s*(Bakery:\s*)?/i, '').trim() : BAKERY_ADDRESS;

  return (
    <div id="order-ready-pickup-view" className={`min-h-screen bg-[#070709] text-white selection:bg-amber-500/30 font-sans p-4 sm:p-6 lg:p-8 relative overflow-x-hidden ${isStandalonePage ? 'pt-6' : ''}`}>
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* Top Header Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                id="btn-back-to-orders"
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-2xl text-xs font-bold transition-all border border-white/10 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft size={16} />
                <span>Back to Orders</span>
              </button>
            )}

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-wider">
                  <ShoppingBag size={14} className="text-amber-400" />
                  ✓ Ready for Pickup
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs font-mono font-bold">
                  #{orderIdShort}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-400/30">
                  PICKUP ORDER ONLY
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5">
                Ready for Pickup &amp; WhatsApp Notification
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {onBack && (
              <button
                id="btn-done-pickup-modal"
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>

        {/* Main 2-Column Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column (7 cols): WhatsApp Dispatch & Studio */}
          <div className="lg:col-span-7 space-y-6">

            {/* Main Action Box */}
            <div className="bg-[#0f0f13] border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">Customer Notification</h3>
                    <p className="text-xs text-zinc-400">Notify {customerName} that order #{orderIdShort} is ready</p>
                  </div>
                </div>

                {hasValidPhone && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono font-bold border border-amber-500/20">
                    +{normalizedPhone}
                  </span>
                )}
              </div>

              {hasValidPhone ? (
                <div className="space-y-4">
                  {/* WhatsApp Big CTA Button */}
                  <button
                    id="btn-notify-pickup-whatsapp"
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-black font-black text-base flex items-center justify-center gap-3 transition-all shadow-xl shadow-amber-950/60 active:scale-[0.98] cursor-pointer group border border-amber-400/40"
                  >
                    <MessageSquare size={22} className="fill-current text-black group-hover:rotate-6 transition-transform" />
                    <span>📱 {hasOpenedWhatsApp ? 'WhatsApp Opened — Resend Message' : 'Notify Customer on WhatsApp'}</span>
                    <ExternalLink size={18} className="opacity-80 ml-auto group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-zinc-400 px-1">
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                      <CheckCircle2 size={14} />
                      WhatsApp opens with the pickup notification
                    </span>
                    <span className="text-zinc-500">Admin manually presses Send</span>
                  </div>

                  {/* Quick Action Tools */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    <button
                      id="btn-copy-pickup-message"
                      type="button"
                      onClick={handleCopyMessage}
                      className="min-h-[44px] py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedMessage ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedMessage ? 'Copied Text!' : 'Copy Text'}</span>
                    </button>

                    <button
                      id="btn-copy-pickup-phone"
                      type="button"
                      onClick={handleCopyPhone}
                      className="min-h-[44px] py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedPhone ? <Check size={14} className="text-emerald-400" /> : <Phone size={14} />}
                      <span>{copiedPhone ? 'Copied Phone!' : 'Copy Phone'}</span>
                    </button>

                    {displayOrder.phone && (
                      <a
                        id="btn-call-pickup-customer"
                        href={`tel:${displayOrder.phone}`}
                        className="min-h-[44px] py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all col-span-2 sm:col-span-1"
                      >
                        <Phone size={14} className="text-amber-400" />
                        <span>Call Customer</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div id="pickup-no-phone-warning" className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2 text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                    <AlertTriangle size={18} />
                    <span>⚠️ No customer phone number is available.</span>
                  </div>
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    WhatsApp notification cannot be sent. Please contact the customer manually when they arrive at the counter.
                  </p>
                </div>
              )}
            </div>

            {/* WhatsApp Message Previewer & Customizer */}
            <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  <h4 className="text-xs font-extrabold text-zinc-300 uppercase tracking-wider">
                    Ready for Pickup Message Preview
                  </h4>
                </div>

                <button
                  id="btn-toggle-edit-pickup-message"
                  type="button"
                  onClick={() => setIsEditingMessage(!isEditingMessage)}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>{isEditingMessage ? 'Done Editing' : 'Edit Message'}</span>
                </button>
              </div>

              {/* Realistic WhatsApp Chat Bubble */}
              <div className="bg-[#0b141a] border border-amber-900/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden font-sans shadow-inner">
                {/* Chat Top Header Mock */}
                <div className="flex items-center gap-2.5 pb-3 border-b border-white/5 mb-3 text-xs text-zinc-400">
                  <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-[10px]">
                    FB
                  </div>
                  <div>
                    <p className="font-bold text-white text-xs">Frosty Bite Bakery</p>
                    <p className="text-[10px] text-amber-400">Official WhatsApp Business</p>
                  </div>
                </div>

                {isEditingMessage ? (
                  <div className="space-y-3">
                    <textarea
                      id="textarea-pickup-custom-message"
                      rows={10}
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="w-full bg-[#111b21] text-[#e9edef] p-4 rounded-xl text-xs sm:text-sm font-sans border border-amber-500/30 focus:outline-none focus:border-amber-400 leading-relaxed custom-scrollbar"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomMessage(defaultMessage)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#005c4b] text-[#e9edef] p-4 sm:p-5 rounded-2xl rounded-tr-none text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-lg font-sans max-w-xl ml-auto border border-emerald-500/20">
                    {customMessage}
                    <div className="text-[10px] text-emerald-200/70 text-right mt-2 flex items-center justify-end gap-1">
                      <span>Now</span>
                      <Check size={12} className="text-emerald-300" />
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column (5 cols): Order & Pickup Details Summary */}
          <div className="lg:col-span-5 space-y-6">

            {/* Pickup Info Banner */}
            <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/10 pb-3">
                <ShoppingBag size={16} className="text-amber-400" />
                Pickup Order Information
              </h3>

              <div className="space-y-4">
                {/* Customer Info */}
                <div className="flex items-center gap-3.5 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Customer Name</p>
                    <p className="text-sm font-bold text-white truncate">{customerName}</p>
                    {displayOrder.phone && (
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">{displayOrder.phone}</p>
                    )}
                  </div>
                </div>

                {/* Pickup Location */}
                <div className="flex items-start gap-3.5 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Pickup Location</p>
                    <p className="text-xs font-semibold text-zinc-200 leading-relaxed mt-0.5">
                      {cleanPickupLocation}
                    </p>
                  </div>
                </div>

                {/* Scheduled Time if Available */}
                {(displayOrder.delivery_date || displayOrder.delivery_time || displayOrder.estimated_delivery_time) && (
                  <div className="flex items-center gap-3.5 bg-white/5 p-3.5 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                      <Clock size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Pickup Schedule</p>
                      <p className="text-xs font-bold text-amber-300 mt-0.5">
                        {[displayOrder.delivery_date, displayOrder.delivery_time].filter(Boolean).join(' at ') || displayOrder.estimated_delivery_time}
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment Summary */}
                <div className="flex items-center justify-between bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Payment</p>
                      <p className="text-xs font-extrabold text-white uppercase">
                        {displayOrder.payment_method || 'Online'} • {displayOrder.payment_status || 'Paid'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Total</p>
                    <p className="text-base font-black text-amber-400">₹{amount}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Summary */}
            <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/10 pb-3">
                <Receipt size={16} className="text-amber-400" />
                Ordered Items ({displayOrder.items?.length || 0})
              </h3>

              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {displayOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center font-bold text-amber-400 text-[11px] shrink-0">
                        {item.quantity}x
                      </span>
                      <span className="font-semibold text-zinc-200 truncate">{item.name}</span>
                    </div>
                    <span className="font-bold text-white shrink-0 ml-2">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
