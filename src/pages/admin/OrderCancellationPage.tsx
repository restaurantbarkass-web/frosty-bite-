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
  Edit3
} from 'lucide-react';
import { Order } from '../../types';
import { normalizePhoneNumber, buildCancellationWhatsAppMessage } from '../../utils/whatsapp';
import { formatOrderId } from '../../utils/orderUtils';
import toast from 'react-hot-toast';

interface OrderCancellationPageProps {
  order: Order | null;
  cancellationReason?: string;
  onBack?: () => void;
  isStandalonePage?: boolean;
}

export const OrderCancellationPage: React.FC<OrderCancellationPageProps> = ({
  order,
  cancellationReason,
  onBack,
  isStandalonePage = false
}) => {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [hasOpenedWhatsApp, setHasOpenedWhatsApp] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // Fallback default order if none provided
  const displayOrder: Order = order || {
    id: 'order-preview-123456',
    user_id: 'guest',
    customer_name: 'Swaleha firdosh',
    phone: '9876543210',
    address: '12-2-418/A, Gudimalkapur, Mehdipatnam, Hyderabad',
    total: 300,
    subtotal: 280,
    delivery_charge: 20,
    status: 'cancelled',
    payment_method: 'cod',
    payment_status: 'pending',
    cancellation_reason: cancellationReason || 'Cancelled by Administrator',
    created_at: new Date().toISOString(),
    items: [
      { id: '1', name: 'Kinder Joy Brownie Tub', quantity: 1, price: 300 }
    ]
  };

  const customerName = (displayOrder.customer_name || displayOrder.customerName || 'Customer').trim();
  const orderIdShort = formatOrderId(displayOrder.id);
  const amount = displayOrder.total ?? displayOrder.total_amount ?? 0;
  const rawReason = cancellationReason || displayOrder.cancellation_reason || 'Cancelled by Administrator';

  const normalizedPhone = normalizePhoneNumber(displayOrder.phone);
  const hasValidPhone = Boolean(normalizedPhone);

  const defaultMessage = buildCancellationWhatsAppMessage(displayOrder, rawReason);
  const [customMessage, setCustomMessage] = useState(defaultMessage);

  useEffect(() => {
    setCustomMessage(buildCancellationWhatsAppMessage(displayOrder, rawReason));
  }, [displayOrder, rawReason]);

  const handleOpenWhatsApp = () => {
    if (!hasValidPhone || !normalizedPhone) {
      toast.error('No valid customer phone number found.');
      return;
    }

    const encodedMessage = encodeURIComponent(customMessage);
    const whatsappUrl = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;

    try {
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (win) {
        setHasOpenedWhatsApp(true);
        toast.success('✓ Opening WhatsApp with message', {
          style: {
            background: '#121212',
            color: '#22c55e',
            border: '1px solid rgba(34, 197, 94, 0.3)'
          }
        });
      } else {
        toast.error('Popup blocked by browser. Please allow popups.');
      }
    } catch (err: any) {
      toast.error('Failed to open WhatsApp.');
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

  const appendSnippet = (snippet: string) => {
    setCustomMessage(prev => `${prev}\n\n${snippet}`);
    toast.success('Snippet added!');
  };

  return (
    <div className={`min-h-screen bg-[#070709] text-white selection:bg-rose-500/30 font-sans p-4 sm:p-6 lg:p-8 relative overflow-x-hidden ${isStandalonePage ? 'pt-6' : ''}`}>
      {/* Background Decorative Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* Top Header Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
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
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Order Cancelled
                </span>
                <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold">
                  #{orderIdShort}
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                  <ShieldCheck size={13} />
                  Stock Restored
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5">
                Cancellation &amp; WhatsApp Dispatch Center
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {onBack && (
              <button
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
            <div className="bg-[#0f0f13] border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">WhatsApp Customer Dispatch</h3>
                    <p className="text-xs text-zinc-400">Direct click-to-chat notification with customer</p>
                  </div>
                </div>

                {hasValidPhone && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/20">
                    +{normalizedPhone}
                  </span>
                )}
              </div>

              {hasValidPhone ? (
                <div className="space-y-4">
                  {/* WhatsApp Big CTA Button */}
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="w-full min-h-[56px] py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-base flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-950/60 active:scale-[0.98] cursor-pointer group border border-emerald-400/30"
                  >
                    <MessageSquare size={22} className="fill-current text-white group-hover:rotate-6 transition-transform" />
                    <span>{hasOpenedWhatsApp ? '📱 WhatsApp Opened — Send Again' : '📱 Send via WhatsApp'}</span>
                    <ExternalLink size={18} className="opacity-80 ml-auto group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>

                  <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 size={14} />
                      WhatsApp pre-fills automatically
                    </span>
                    <span>Admin manually presses send</span>
                  </div>

                  {/* Quick Action Tools */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedMessage ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedMessage ? 'Copied Text!' : 'Copy Text'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedPhone ? <Check size={14} className="text-emerald-400" /> : <Phone size={14} />}
                      <span>{copiedPhone ? 'Copied Number!' : 'Copy Phone'}</span>
                    </button>

                    {displayOrder.phone && (
                      <a
                        href={`tel:${displayOrder.phone}`}
                        className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all col-span-2 sm:col-span-1"
                      >
                        <Phone size={14} className="text-amber-400" />
                        <span>Call Customer</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2 text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                    <AlertTriangle size={18} />
                    <span>No valid customer phone number found</span>
                  </div>
                  <p className="text-xs text-amber-300/80 leading-relaxed">
                    WhatsApp click-to-chat requires a registered customer phone number. No phone number was associated with this order record.
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
                    Message Preview &amp; Customizer
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingMessage(!isEditingMessage)}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>{isEditingMessage ? 'Done Editing' : 'Edit Message'}</span>
                </button>
              </div>

              {/* Realistic WhatsApp Chat Bubble */}
              <div className="bg-[#0b141a] border border-emerald-900/40 rounded-2xl p-4 sm:p-5 relative overflow-hidden font-sans shadow-inner">
                {/* Chat Top Header Mock */}
                <div className="flex items-center gap-2.5 pb-3 border-b border-white/5 mb-3 text-xs text-zinc-400">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-[10px]">
                    FB
                  </div>
                  <div>
                    <p className="font-bold text-white text-xs">Frosty Bite Bakery</p>
                    <p className="text-[10px] text-emerald-400">Official WhatsApp Business</p>
                  </div>
                </div>

                {isEditingMessage ? (
                  <div className="space-y-3">
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      rows={8}
                      className="w-full bg-[#111b21] text-emerald-100 border border-emerald-500/30 rounded-xl p-3 text-xs font-mono leading-relaxed focus:outline-none focus:border-emerald-400 custom-scrollbar"
                    />

                    {/* Quick Snippets */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider self-center mr-1">
                        Add Snippet:
                      </span>
                      <button
                        type="button"
                        onClick={() => appendSnippet('💳 *Refund Info:* Refund of ₹' + amount + ' will be credited to your account within 24-48 hours.')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer"
                      >
                        + Refund Info
                      </button>
                      <button
                        type="button"
                        onClick={() => appendSnippet('🎁 *Apology Offer:* Use code *SORRY50* for ₹50 OFF on your next order!')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer"
                      >
                        + Apology Coupon
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomMessage(defaultMessage)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-[10px] font-bold cursor-pointer ml-auto"
                      >
                        <RefreshCw size={10} className="inline mr-1" />
                        Reset Default
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#005c4b] text-white p-3.5 rounded-2xl rounded-tl-none max-w-md text-xs whitespace-pre-wrap leading-relaxed shadow-md border border-emerald-400/20">
                    {customMessage}
                    <div className="text-[9px] text-emerald-200/70 text-right mt-2 font-mono">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column (5 cols): Order Summary & Audit Details */}
          <div className="lg:col-span-5 space-y-6">

            {/* Order Card Overview */}
            <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-amber-400" />
                  <h3 className="text-base font-extrabold text-white">Order Breakdown</h3>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                  ₹{amount}
                </span>
              </div>

              {/* Customer Quick Summary */}
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-zinc-300">
                  <User size={14} className="text-zinc-500 shrink-0" />
                  <span className="text-zinc-400">Customer:</span>
                  <strong className="text-white ml-auto">{customerName}</strong>
                </div>

                <div className="flex items-center gap-2 text-zinc-300">
                  <Phone size={14} className="text-zinc-500 shrink-0" />
                  <span className="text-zinc-400">Phone:</span>
                  <span className="font-mono text-white ml-auto">{displayOrder.phone || 'N/A'}</span>
                </div>

                <div className="flex items-start gap-2 text-zinc-300 pt-1 border-t border-white/5">
                  <MapPin size={14} className="text-zinc-500 shrink-0 mt-0.5" />
                  <span className="text-zinc-400 shrink-0">Address:</span>
                  <span className="text-zinc-300 text-right ml-auto leading-snug max-w-[200px]">
                    {displayOrder.address || 'Pickup / Store Order'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-zinc-300 pt-1 border-t border-white/5">
                  <CreditCard size={14} className="text-zinc-500 shrink-0" />
                  <span className="text-zinc-400">Payment:</span>
                  <span className="uppercase font-mono font-bold text-amber-300 ml-auto">
                    {displayOrder.payment_method || 'COD'} ({displayOrder.payment_status || 'pending'})
                  </span>
                </div>
              </div>

              {/* Order Items List */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Ordered Items</span>
                  <span>{displayOrder.items?.length || 0} items</span>
                </h4>

                <div className="bg-black/40 border border-white/5 rounded-2xl p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {displayOrder.items && displayOrder.items.length > 0 ? (
                    displayOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                          <Package size={13} className="text-zinc-500" />
                          <span className="font-medium text-zinc-200">{item.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">x{item.quantity}</span>
                        </div>
                        <span className="font-mono font-bold text-zinc-300">
                          ₹{(item.price || 0) * (item.quantity || 1)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-500 italic text-center py-2">
                      Item details recorded in master order history
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Totals */}
              <div className="border-t border-white/10 pt-3 space-y-1.5 text-xs">
                {displayOrder.subtotal !== undefined && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal:</span>
                    <span className="font-mono">₹{displayOrder.subtotal}</span>
                  </div>
                )}
                {displayOrder.delivery_charge !== undefined && displayOrder.delivery_charge > 0 && (
                  <div className="flex justify-between text-zinc-400">
                    <span>Delivery Charge:</span>
                    <span className="font-mono">₹{displayOrder.delivery_charge}</span>
                  </div>
                )}
                {displayOrder.discount !== undefined && displayOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount:</span>
                    <span className="font-mono">-₹{displayOrder.discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-white/10">
                  <span>Total Amount:</span>
                  <span className="font-mono text-amber-400">₹{amount}</span>
                </div>
              </div>

            </div>

            {/* Cancellation Reason & Audit Box */}
            <div className="bg-[#0f0f13] border border-rose-500/20 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle size={18} />
                <h3 className="text-sm font-extrabold uppercase tracking-wider">Cancellation Audit Record</h3>
              </div>

              <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 space-y-2">
                <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider block">
                  Logged Reason:
                </span>
                <p className="text-xs font-medium text-zinc-200 italic leading-relaxed">
                  "{rawReason}"
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-400 py-1 border-b border-white/5">
                  <span>Inventory Status:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    Restored to Menu
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-400 py-1 border-b border-white/5">
                  <span>Log Timestamp:</span>
                  <span className="font-mono text-zinc-300">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-400 py-1">
                  <span>Audit Source:</span>
                  <span className="font-bold text-zinc-300">Bakery Administrator</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
