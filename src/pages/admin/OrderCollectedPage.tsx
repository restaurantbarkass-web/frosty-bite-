import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  CheckCircle2, 
  MessageSquare, 
  ExternalLink, 
  Copy, 
  Phone, 
  ArrowLeft, 
  AlertTriangle, 
  Sparkles, 
  Check, 
  Clock, 
  ShoppingBag, 
  Edit3,
  Globe,
  Star,
  Receipt,
  User,
  Settings
} from 'lucide-react';
import { Order } from '../../types';
import { 
  normalizePhoneNumber, 
  buildOrderCollectedWhatsAppMessage,
  sanitizeCustomerUrl,
  isValidHttpsUrl,
  isPickupOrder
} from '../../utils/whatsapp';
import { formatOrderId } from '../../utils/orderUtils';
import { useConfig } from '../../context/ConfigContext';
import toast from 'react-hot-toast';

interface OrderCollectedPageProps {
  order: Order | null;
  onBack?: () => void;
  isStandalonePage?: boolean;
}

export const OrderCollectedPage: React.FC<OrderCollectedPageProps> = ({
  order,
  onBack,
  isStandalonePage = false
}) => {
  const { config } = useConfig();
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [hasOpenedWhatsApp, setHasOpenedWhatsApp] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // Fallback default order if none provided
  const displayOrder: Order = order || {
    id: 'FB1024',
    user_id: 'guest',
    customer_name: 'Pooja',
    phone: '9876543210',
    address: 'Counter Pickup',
    total: 350,
    subtotal: 350,
    delivery_charge: 0,
    status: 'delivered',
    order_type: 'pickup',
    payment_method: 'upi',
    payment_status: 'paid',
    delivery_date: 'Today',
    delivery_time: '6:30 PM',
    created_at: new Date().toISOString(),
    items: [
      { id: '1', name: 'Fresh Fruit Pastry', quantity: 2, price: 175 }
    ]
  };

  const customerName = (displayOrder.customer_name || displayOrder.customerName || 'Customer').trim();
  const orderIdShort = formatOrderId(displayOrder.id);
  const amount = displayOrder.total ?? displayOrder.total_amount ?? 0;

  const normalizedPhone = normalizePhoneNumber(displayOrder.phone);
  const hasValidPhone = Boolean(normalizedPhone);

  // Retrieve customer links from settings
  // If feedbackUrl is empty in settings, provide an intelligent link to local /feedback?order=id if available
  const configuredFeedback = config?.feedbackUrl || '';
  const configuredWebsite = config?.websiteUrl || 'https://frostybite.in';

  // Resolved feedback URL: if configured, use it (or append order id); otherwise use window origin /feedback if local
  let resolvedFeedbackUrl: string | null = null;
  if (configuredFeedback && isValidHttpsUrl(configuredFeedback)) {
    resolvedFeedbackUrl = configuredFeedback.includes('?') 
      ? `${configuredFeedback}&order=${displayOrder.id}` 
      : `${configuredFeedback}?order=${displayOrder.id}`;
  } else if (typeof window !== 'undefined' && window.location?.origin && isValidHttpsUrl(window.location.origin)) {
    // Dynamic fallback to the running applet feedback route
    resolvedFeedbackUrl = `${window.location.origin}/feedback?order=${displayOrder.id}`;
  }

  const resolvedWebsiteUrl = sanitizeCustomerUrl(configuredWebsite);

  // Build standard message
  const defaultMessage = buildOrderCollectedWhatsAppMessage(
    displayOrder,
    resolvedFeedbackUrl,
    resolvedWebsiteUrl
  );

  const [customMessage, setCustomMessage] = useState(defaultMessage);

  useEffect(() => {
    setCustomMessage(
      buildOrderCollectedWhatsAppMessage(
        displayOrder,
        resolvedFeedbackUrl,
        resolvedWebsiteUrl
      )
    );
  }, [displayOrder, config]);

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
        toast.success('✓ WhatsApp opened with the collection confirmation', {
          icon: '📱',
          style: {
            background: '#121212',
            color: '#fbbf24',
            border: '1px solid rgba(251, 191, 36, 0.3)'
          }
        });
      } else {
        toast.error('Unable to open WhatsApp. Please check popup blocker permissions.');
      }
    } catch (err: any) {
      toast.error('Unable to open WhatsApp window.');
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

  return (
    <div className={`min-h-screen bg-[#070709] text-white selection:bg-amber-500/30 selection:text-amber-400 font-sans p-4 sm:p-6 lg:p-8 relative overflow-x-hidden ${isStandalonePage ? 'pt-6' : ''}`}>
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        
        {/* Top Header Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                type="button"
                id="collected-back-btn"
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
                  <CheckCircle2 size={14} className="text-amber-400" />
                  ✓ Order Collected
                </span>
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs font-mono font-bold">
                  #{orderIdShort}
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  Pickup Order
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5">
                Collection Confirmation &amp; WhatsApp Notification
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {onBack && (
              <button
                type="button"
                id="collected-done-btn"
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
                    <h2 className="text-base font-extrabold text-white">Customer Notification</h2>
                    <p className="text-xs text-zinc-400">Send collection confirmation &amp; feedback request to {customerName}</p>
                  </div>
                </div>

                {hasValidPhone && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono font-bold border border-amber-500/20">
                    +{normalizedPhone}
                  </span>
                )}
              </div>

              {/* Status Notice */}
              {hasValidPhone ? (
                <div className="space-y-4">
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-zinc-300 space-y-1">
                      <p className="font-bold text-amber-300">Ready to notify customer via WhatsApp Click-to-Chat</p>
                      <p className="text-zinc-400 leading-relaxed">
                        Clicking the button opens WhatsApp with the pre-filled collection message. You can review the text and manually tap Send in WhatsApp.
                      </p>
                    </div>
                  </div>

                  {/* Primary WhatsApp Action Button */}
                  <button
                    type="button"
                    id="btn-send-collected-whatsapp"
                    onClick={handleOpenWhatsApp}
                    className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <MessageSquare size={20} className="fill-black" />
                    <span>📱 Send Collection Confirmation</span>
                  </button>

                  {hasOpenedWhatsApp && (
                    <p className="text-center text-xs text-amber-400/90 font-medium flex items-center justify-center gap-1.5 pt-1">
                      <Check size={14} />
                      <span>WhatsApp window was opened. You can click again to resend if needed.</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <AlertTriangle size={18} />
                    <span>⚠️ No customer phone number is available.</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    WhatsApp notification cannot be opened because this order does not have a valid customer phone number.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="w-full py-3.5 px-6 bg-white/5 border border-white/10 text-zinc-500 font-bold text-xs uppercase tracking-wider rounded-2xl cursor-not-allowed opacity-60"
                  >
                    WhatsApp Unavailable (No Phone)
                  </button>
                </div>
              )}
            </div>

            {/* WhatsApp Message Preview & Live Editor */}
            <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 size={16} className="text-amber-400" />
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-300">
                    Pre-filled Message Preview
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-copy-collected-msg"
                    onClick={handleCopyMessage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300 hover:text-white transition-all border border-white/10 cursor-pointer"
                  >
                    {copiedMessage ? <Check size={14} className="text-amber-400" /> : <Copy size={14} />}
                    <span>{copiedMessage ? 'Copied!' : 'Copy Text'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditingMessage(!isEditingMessage)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-amber-400 transition-all border border-white/10 cursor-pointer"
                  >
                    {isEditingMessage ? 'Done Editing' : 'Customize'}
                  </button>
                </div>
              </div>

              {isEditingMessage ? (
                <textarea
                  rows={10}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full bg-white/5 border border-amber-500/40 rounded-2xl p-4 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500 transition-all resize-none leading-relaxed"
                />
              ) : (
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {customMessage}
                </div>
              )}

              {/* Customer Links Details */}
              <div className="pt-2 border-t border-white/5 space-y-2 text-xs">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Included Customer Links:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 space-y-1">
                    <div className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Star size={12} />
                      <span>Feedback Link</span>
                    </div>
                    <p className="text-zinc-400 truncate font-mono text-[10px]">
                      {resolvedFeedbackUrl || '(None configured — omitted)'}
                    </p>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-2.5 space-y-1">
                    <div className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Globe size={12} />
                      <span>Website Link</span>
                    </div>
                    <p className="text-zinc-400 truncate font-mono text-[10px]">
                      {resolvedWebsiteUrl || '(None configured — omitted)'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column (5 cols): Order Details & Customer Snapshot */}
          <div className="lg:col-span-5 space-y-6">

            {/* Customer & Order Summary Card */}
            <div className="bg-[#0f0f13] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Receipt size={16} className="text-amber-400" />
                <span>Order Summary</span>
              </h2>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <User size={14} /> Customer Name
                  </span>
                  <span className="font-bold text-white text-sm">{customerName}</span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Phone size={14} /> Phone Number
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white">
                      {displayOrder.phone || 'No phone provided'}
                    </span>
                    {displayOrder.phone && (
                      <button
                        type="button"
                        onClick={handleCopyPhone}
                        className="text-zinc-400 hover:text-amber-400 transition-colors p-1"
                        title="Copy phone"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <ShoppingBag size={14} /> Order Type
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-extrabold uppercase border border-amber-500/20">
                    Bakery Pickup
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Order Status
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold uppercase border border-emerald-500/20">
                    Collected
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-zinc-300 font-bold text-sm">Total Paid</span>
                  <span className="text-amber-400 font-black text-lg">₹{amount}</span>
                </div>
              </div>

              {/* Ordered Items List */}
              {displayOrder.items && displayOrder.items.length > 0 && (
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Collected Items ({displayOrder.items.length})
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {displayOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <span className="text-zinc-200">
                          {item.quantity} × {item.name}
                        </span>
                        {item.price && (
                          <span className="text-zinc-400 font-mono">
                            ₹{item.price * (item.quantity || 1)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Operational Note */}
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-5 text-xs text-zinc-400 space-y-2">
              <p className="font-bold text-zinc-300">💡 Customer Engagement Tip</p>
              <p className="leading-relaxed text-zinc-400">
                Sending a collection confirmation with your feedback link helps build loyalty and ensures satisfied customers leave 5-star ratings for Frosty Bite Bakery.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default OrderCollectedPage;
