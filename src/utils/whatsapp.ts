import { RESTAURANT_WHATSAPP, BAKERY_ADDRESS } from '../constants';
import { formatOrderId } from './orderUtils';

export const openWhatsAppOrder = (orderData: {
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  delivery_date?: string;
  delivery_time?: string;
  cake_message?: string;
  cake_occasion?: string;
  cake_candle_knife?: boolean;
  is_scheduled?: boolean;
  method: 'upi' | 'cod';
  amount: number;
  delivery_charge?: number;
  delivery_fee?: number;
  discount?: number;
  utr?: string;
  items?: { name: string; quantity: number }[];
}) => {
  const adminNumber = RESTAURANT_WHATSAPP; 
  
  const itemsText = orderData.items 
    ? orderData.items.map(item => `• ${item.name} x ${item.quantity}`).join('\n')
    : '';

  const scheduleText = orderData.delivery_date
    ? `\n📅 *Requested Delivery Date:* ${orderData.delivery_date}${orderData.delivery_time ? `\n⏰ *Preferred Time:* ${orderData.delivery_time}` : ''}`
    : '';

  const cakeText = [
    orderData.cake_message ? `🎂 *Cake Inscription:* "${orderData.cake_message}"` : '',
    orderData.cake_occasion ? `🎉 *Occasion:* ${orderData.cake_occasion}` : '',
    orderData.cake_candle_knife ? `🕯️ *Complimentary Candles & Knife:* Included` : ''
  ].filter(Boolean).join('\n');

  const cakeSection = cakeText ? `\n----------------------------\n${cakeText}` : '';
  const notesText = orderData.notes ? `\n*Notes:* ${orderData.notes}` : '';
  const effectiveDelivery = orderData.delivery_charge ?? orderData.delivery_fee;
  const deliveryText = effectiveDelivery ? `\n*Delivery Fee:* ₹${effectiveDelivery}` : '';
  const discountText = orderData.discount ? `\n*Discount Applied:* -₹${orderData.discount}` : '';

  const message = `🛒 *New Order Received!*
----------------------------
*Order ID:* ${formatOrderId(orderData.orderId)}
*Name:* ${orderData.customerName}
*Phone:* ${orderData.phone}
*Address:* ${orderData.address}${scheduleText}${cakeSection}${notesText}
----------------------------
*Items:*
${itemsText}
----------------------------${deliveryText}${discountText}
*Final Amount:* ₹${orderData.amount}
*Payment Method:* ${orderData.method.toUpperCase()}
${orderData.utr ? `*UPI UTR:* ${orderData.utr}\n_(Waiting for verification)_` : '*Status:* Cash on Delivery'}
----------------------------`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${adminNumber}?text=${encodedMessage}`, '_blank');
};

export const sendWhatsAppMessage = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
};

export const sendOTP = (phone: string, otp: string) => {
  const message = `Your delivery verification OTP is: *${otp}* 🚚`;
  sendWhatsAppMessage(phone, message);
};

/**
 * Reusable phone number normalization utility for WhatsApp click-to-chat.
 * Strips formatting, handles Indian 10-digit/11-digit numbers, preserves existing 91 country code,
 * and validates that the number is usable.
 */
export function normalizePhoneNumber(phone?: string | null): string | null {
  if (!phone || typeof phone !== 'string') return null;

  // 1. Remove all non-digit characters
  const clean = phone.replace(/\D/g, '');
  if (!clean) return null;

  // 2. If 12 digits starting with 91 (Indian standard format), preserve
  if (clean.length === 12 && clean.startsWith('91')) {
    return clean;
  }

  // 3. Indian 10-digit mobile starting with 6,7,8,9
  if (clean.length === 10 && /^[6-9]/.test(clean)) {
    return `91${clean}`;
  }

  // 4. Indian 11-digit mobile starting with 0 followed by 6,7,8,9
  if (clean.length === 11 && clean.startsWith('0') && /^[6-9]/.test(clean.slice(1))) {
    return `91${clean.slice(1)}`;
  }

  // 5. Standard international format (10 to 15 digits)
  if (clean.length >= 10 && clean.length <= 15) {
    return clean;
  }

  return null;
}

/**
 * Builds the standard Frosty Bite WhatsApp order cancellation notification message.
 */
export function buildCancellationWhatsAppMessage(
  order: {
    id: string;
    customer_name?: string;
    customerName?: string;
    total?: number;
    total_amount?: number;
    cancellation_reason?: string;
  },
  customReason?: string
): string {
  const customerName = (order.customer_name || order.customerName || 'Customer').trim();
  const orderNumber = formatOrderId(order.id);
  const amount = order.total ?? order.total_amount ?? 0;

  const rawReason = customReason || order.cancellation_reason;
  const reasonText = (rawReason && rawReason.trim())
    ? `Reason: ${rawReason.trim()}`
    : `Reason: Order cancelled by bakery management.`;

  return `Hello ${customerName} 👋

This is Frosty Bite Bakery.

Your order #${orderNumber} has been cancelled.

Order Amount: ₹${amount}

${reasonText}

If you have any questions, please contact Frosty Bite Bakery.

We’re sorry for the inconvenience and appreciate your understanding. 🍰

— Frosty Bite Bakery`;
}

/**
 * Opens WhatsApp click-to-chat with pre-filled cancellation message.
 * Returns success status or error message.
 */
export function openCancellationWhatsApp(
  phone: string | null | undefined,
  order: any,
  customReason?: string
): { success: boolean; error?: string; normalizedPhone?: string } {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return {
      success: false,
      error: 'No customer phone number is available or phone number is invalid.'
    };
  }

  const message = buildCancellationWhatsAppMessage(order, customReason);
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${normalized}?text=${encodedMessage}`;

  try {
    const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      return {
        success: false,
        error: 'Unable to open WhatsApp window. Please check your browser popup blocker permissions.'
      };
    }
    return { success: true, normalizedPhone: normalized };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to open WhatsApp.'
    };
  }
}

/**
 * Builds the standard Frosty Bite WhatsApp order delivery confirmation notification message.
 */
export function buildDeliveryWhatsAppMessage(
  order: {
    id: string;
    customer_name?: string;
    customerName?: string;
    total?: number;
    total_amount?: number;
  }
): string {
  const customerName = (order.customer_name || order.customerName || 'Customer').trim();
  const orderNumber = formatOrderId(order.id);
  const amount = order.total ?? order.total_amount ?? 0;

  return `Hello ${customerName} 👋

This is Frosty Bite Bakery. 🍰

Your order #${orderNumber} has been successfully delivered! 🎉

Order Amount: ₹${amount}

We hope you enjoyed your order. ❤️

Thank you for choosing Frosty Bite Bakery!

We'd love to have you order from us again. 😊

— Frosty Bite Bakery`;
}

/**
 * Opens WhatsApp click-to-chat with pre-filled delivery confirmation message.
 * Returns success status or error message.
 */
export function openDeliveryWhatsApp(
  phone: string | null | undefined,
  order: any
): { success: boolean; error?: string; normalizedPhone?: string } {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return {
      success: false,
      error: 'No customer phone number is available or phone number is invalid.'
    };
  }

  const message = buildDeliveryWhatsAppMessage(order);
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${normalized}?text=${encodedMessage}`;

  try {
    const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      return {
        success: false,
        error: 'Unable to open WhatsApp window. Please check your browser popup blocker permissions.'
      };
    }
    return { success: true, normalizedPhone: normalized };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to open WhatsApp.'
    };
  }
}

/**
 * Builds the standard Frosty Bite WhatsApp order confirmation notification message.
 */
export function buildOrderConfirmationWhatsAppMessage(
  order: {
    id: string;
    customer_name?: string;
    customerName?: string;
    total?: number;
    total_amount?: number;
    order_type?: 'delivery' | 'pickup';
  },
  trackingLink?: string
): string {
  const customerName = (order.customer_name || order.customerName || 'Customer').trim();
  const orderNumber = formatOrderId(order.id);
  const amount = order.total ?? order.total_amount ?? 0;
  const deliveryType = order.order_type || 'delivery';
  
  const etaText = deliveryType === 'pickup' 
    ? 'Your order is confirmed! You will receive a notification when your order is ready for collection.' 
    : 'Your order is confirmed and is being prepared for delivery.';

  const linkLine = trackingLink ? `\nTrack your order live here: ${trackingLink}\n` : '';

  return `Hello ${customerName} 👋

This is Frosty Bite Bakery. 🍰

Your order #${orderNumber} has been successfully confirmed! 🎉

Order Amount: ₹${amount}
Order Type: ${deliveryType.toUpperCase()}

${etaText}
${linkLine}
We’re baking love into your treats! Thank you for choosing Frosty Bite Bakery. 😊

— Frosty Bite Bakery`;
}

/**
 * Opens WhatsApp click-to-chat with pre-filled order confirmation message.
 * Returns success status or error message.
 */
export function openOrderConfirmationWhatsApp(
  phone: string | null | undefined,
  order: any,
  trackingLink?: string
): { success: boolean; error?: string; normalizedPhone?: string } {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return {
      success: false,
      error: 'No customer phone number is available or phone number is invalid.'
    };
  }

  const message = buildOrderConfirmationWhatsAppMessage(order, trackingLink);
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${normalized}?text=${encodedMessage}`;

  try {
    const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      return {
        success: false,
        error: 'Unable to open WhatsApp window. Please check your browser popup blocker permissions.'
      };
    }
    return { success: true, normalizedPhone: normalized };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to open WhatsApp.'
    };
  }
}

/**
 * Determines whether an order is explicitly a pickup order based on actual application schema.
 */
export function isPickupOrder(order: { order_type?: string; type?: string; fulfillmentType?: string } | null | undefined): boolean {
  if (!order) return false;
  const t = (order.order_type || (order as any).type || (order as any).fulfillmentType || '').toString().toLowerCase().trim();
  return t === 'pickup' || t === 'self_pickup' || t === 'store_pickup' || t === 'takeaway' || t === 'collection';
}

/**
 * Builds the standard Frosty Bite WhatsApp order ready-for-pickup notification message.
 * Adheres strictly to the pickup-ready format:
 * - Ready for pickup announcement
 * - Order reference number
 * - Real configured pickup location (if available)
 * - Scheduled pickup time (if available, never invented)
 * - Clear pickup instructions
 * - No internal cake/staff notes
 */
export function buildReadyForPickupWhatsAppMessage(order: {
  id: string;
  customer_name?: string;
  customerName?: string;
  order_type?: string;
  type?: string;
  address?: string;
  delivery_address?: string;
  delivery_date?: string;
  delivery_time?: string;
  estimated_delivery_time?: string | number;
  items?: Array<{ name: string; quantity: number }>;
}): string {
  const customerName = (order.customer_name || order.customerName || 'Customer').trim();
  const rawOrderId = formatOrderId(order.id);
  const orderNumber = rawOrderId.startsWith('#') ? rawOrderId : `#${rawOrderId}`;

  // Pickup location: Use real configured bakery address or stored pickup location
  let pickupLocationText = '';
  const rawLoc = order.address || order.delivery_address || BAKERY_ADDRESS;
  if (rawLoc && typeof rawLoc === 'string') {
    const cleanLoc = rawLoc.replace(/^\[IN-STORE PICKUP\]\s*(Bakery:\s*)?/i, '').trim();
    if (cleanLoc) {
      pickupLocationText = `📍 Pickup from: ${cleanLoc}`;
    }
  }

  // Pickup schedule: Include only when real date/time exists, never invent fake schedule
  let pickupTimeText = '';
  if (order.delivery_date || order.delivery_time) {
    const parts = [];
    if (order.delivery_date) parts.push(order.delivery_date);
    if (order.delivery_time) parts.push(order.delivery_time);
    pickupTimeText = `🕒 Pickup time: ${parts.join(', ')}`;
  } else if (order.estimated_delivery_time && typeof order.estimated_delivery_time === 'string' && order.estimated_delivery_time.trim()) {
    // Only if it looks like a formatted time or slot (e.g. "Today, 6:30 PM")
    pickupTimeText = `🕒 Pickup time: ${order.estimated_delivery_time.trim()}`;
  }

  // Optional concise items summary (reliable item data only, no internal cake/baker instructions)
  let itemsSection = '';
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    const itemsList = order.items
      .filter(item => item && item.name)
      .map(item => `${item.quantity || 1} × ${item.name}`)
      .join('\n');
    if (itemsList) {
      itemsSection = `\n🛍️ Items in your order:\n${itemsList}\n`;
    }
  }

  const lines = [
    `Hello ${customerName} 👋`,
    ``,
    `This is Frosty Bite Bakery. 🍰`,
    ``,
    `Great news! Your order ${orderNumber} is ready for pickup! 🎉`,
    ``,
    `🛍️ Your order is packed and ready for collection.`,
    itemsSection ? itemsSection.trim() : null,
    pickupLocationText || null,
    pickupTimeText || null,
    ``,
    `Please mention your order number ${orderNumber} when collecting your order.`,
    ``,
    `Thank you for choosing Frosty Bite Bakery! ❤️`,
    ``,
    `— Frosty Bite Bakery`
  ].filter(line => line !== null);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Opens WhatsApp click-to-chat with pre-filled ready-for-pickup message.
 * Returns success status or error message.
 */
export function openReadyForPickupWhatsApp(
  phone: string | null | undefined,
  order: any
): { success: boolean; error?: string; normalizedPhone?: string; url?: string } {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return {
      success: false,
      error: 'No customer phone number is available or phone number is invalid.'
    };
  }

  const message = buildReadyForPickupWhatsAppMessage(order);
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${normalized}?text=${encodedMessage}`;

  try {
    const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      return {
        success: false,
        error: 'Unable to open WhatsApp window. Please check your browser popup blocker permissions.'
      };
    }
    return { success: true, normalizedPhone: normalized, url: whatsappUrl };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Unable to open WhatsApp.'
    };
  }
}



