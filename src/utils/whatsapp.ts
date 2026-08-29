import { RESTAURANT_WHATSAPP } from '../constants';

export const openWhatsAppOrder = (orderData: {
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  method: 'upi' | 'cod';
  amount: number;
  delivery_fee?: number;
  discount?: number;
  utr?: string;
  items?: { name: string; quantity: number }[];
}) => {
  const adminNumber = RESTAURANT_WHATSAPP; 
  
  const itemsText = orderData.items 
    ? orderData.items.map(item => `• ${item.name} x ${item.quantity}`).join('\n')
    : '';

  const notesText = orderData.notes ? `\n*Notes:* ${orderData.notes}` : '';
  const deliveryText = orderData.delivery_fee ? `\n*Delivery Fee:* ₹${orderData.delivery_fee}` : '';
  const discountText = orderData.discount ? `\n*Discount Applied:* -₹${orderData.discount}` : '';

  const message = `🛒 *New Order Received!*
----------------------------
*Order ID:* ${orderData.orderId.slice(-6).toUpperCase()}
*Name:* ${orderData.customerName}
*Phone:* ${orderData.phone}
*Address:* ${orderData.address}${notesText}
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
  const orderNumber = order.id ? (order.id.length > 8 ? order.id.slice(-6).toUpperCase() : order.id.toUpperCase()) : 'N/A';
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
  const orderNumber = order.id ? (order.id.length > 8 ? order.id.slice(-6).toUpperCase() : order.id.toUpperCase()) : 'N/A';
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
  const orderNumber = order.id ? (order.id.length > 8 ? order.id.slice(-6).toUpperCase() : order.id.toUpperCase()) : 'N/A';
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


