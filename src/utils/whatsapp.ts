import { RESTAURANT_WHATSAPP, BAKERY_ADDRESS, RESTAURANT_LOCATION } from '../constants';
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
 * Validates geographical coordinates (latitude must be between -90 and 90, longitude between -180 and 180).
 */
export function validateBakeryCoordinates(lat?: number | string | null, lng?: number | string | null): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const numLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const numLng = typeof lng === 'string' ? parseFloat(lng) : lng;

  if (typeof numLat !== 'number' || typeof numLng !== 'number' || isNaN(numLat) || isNaN(numLng)) return false;
  if (numLat < -90 || numLat > 90) return false;
  if (numLng < -180 || numLng > 180) return false;
  if (numLat === 0 && numLng === 0) return false;

  return true;
}

/**
 * Builds a standard, public Google Maps URL without any API keys.
 * Preferred format: https://www.google.com/maps/search/?api=1&query=<LATITUDE>,<LONGITUDE>
 */
export function getBakeryMapUrl(location?: {
  bakeryMapUrl?: string;
  bakeryLatitude?: number | string;
  bakeryLongitude?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
} | null): string | null {
  if (!location) return null;

  // 1. Explicit valid custom map URL
  if (location.bakeryMapUrl && typeof location.bakeryMapUrl === 'string') {
    const trimmed = location.bakeryMapUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // 2. Numerical coordinates validation and generation
  const rawLat = location.bakeryLatitude ?? location.latitude ?? location.lat;
  const rawLng = location.bakeryLongitude ?? location.longitude ?? location.lng;

  if (validateBakeryCoordinates(rawLat, rawLng)) {
    const numLat = typeof rawLat === 'string' ? parseFloat(rawLat) : rawLat;
    const numLng = typeof rawLng === 'string' ? parseFloat(rawLng) : rawLng;
    return `https://www.google.com/maps/search/?api=1&query=${numLat},${numLng}`;
  }

  return null;
}

/**
 * Resolves the Frosty Bite Bakery pickup location adhering strictly to Location Precedence:
 * 1. Explicitly saved Frosty Bite bakery location in app settings/config
 * 2. Existing configured store geofence coordinates
 * 3. Fallback to default BAKERY_ADDRESS & RESTAURANT_LOCATION
 */
export function getResolvedBakeryLocation(config?: any): {
  bakeryName: string;
  bakeryAddress: string;
  bakeryLatitude: number | null;
  bakeryLongitude: number | null;
  bakeryMapUrl: string | null;
  isValidLocation: boolean;
} {
  const bakeryName = (config?.bakeryName || 'Frosty Bite Bakery').trim();
  const bakeryAddress = (config?.bakeryAddress || BAKERY_ADDRESS).trim();
  
  const rawLat = config?.bakeryLatitude ?? config?.geofencingLatitude ?? RESTAURANT_LOCATION.lat;
  const rawLng = config?.bakeryLongitude ?? config?.geofencingLongitude ?? RESTAURANT_LOCATION.lng;

  const valid = validateBakeryCoordinates(rawLat, rawLng);
  const numLat = valid ? (typeof rawLat === 'string' ? parseFloat(rawLat) : rawLat) : null;
  const numLng = valid ? (typeof rawLng === 'string' ? parseFloat(rawLng) : rawLng) : null;

  const explicitMapUrl = config?.bakeryMapUrl && typeof config.bakeryMapUrl === 'string' && config.bakeryMapUrl.trim().startsWith('http')
    ? config.bakeryMapUrl.trim()
    : null;

  const mapUrl = explicitMapUrl || (valid && numLat !== null && numLng !== null ? `https://www.google.com/maps/search/?api=1&query=${numLat},${numLng}` : null);

  return {
    bakeryName,
    bakeryAddress,
    bakeryLatitude: numLat,
    bakeryLongitude: numLng,
    bakeryMapUrl: mapUrl,
    isValidLocation: Boolean(bakeryAddress && (valid || mapUrl))
  };
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
 * Adheres strictly to the user specification:
 * - Clean greeting (Hello {{customerName}} 👋 or Hello 👋)
 * - Order reference number (#{{orderNumber}})
 * - Real bakery pickup location (never admin current GPS)
 * - Standard map URL (🗺️ Get Directions)
 * - Pickup time if available
 * - Missing data safety (no undefined, null, NaN, Invalid Date, Invalid Location)
 */
export function buildReadyForPickupWhatsAppMessage(
  order: {
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
  },
  bakeryLocation?: {
    bakeryName?: string;
    bakeryAddress?: string;
    bakeryLatitude?: number | string;
    bakeryLongitude?: number | string;
    bakeryMapUrl?: string;
  } | null
): string {
  // 1. Customer Name with safe fallback
  const rawCustomerName = (order.customer_name || order.customerName || '').trim();
  const greeting = (rawCustomerName && rawCustomerName.toLowerCase() !== 'customer' && rawCustomerName.toLowerCase() !== 'guest')
    ? `Hello ${rawCustomerName} 👋`
    : `Hello 👋`;

  // 2. Order Reference Number
  const rawOrderId = formatOrderId(order.id);
  const cleanId = rawOrderId.replace(/^#+/, '');
  const orderNumber = `#${cleanId}`;

  // 3. Resolve Bakery Pickup Location
  const resolvedName = (bakeryLocation?.bakeryName || 'Frosty Bite Bakery').trim();
  let resolvedAddress = (bakeryLocation?.bakeryAddress || '').trim();

  // If no explicit bakery address provided in bakeryLocation, check order address or default constant
  if (!resolvedAddress) {
    const rawLoc = order.address || order.delivery_address || BAKERY_ADDRESS;
    if (rawLoc && typeof rawLoc === 'string') {
      const cleanLoc = rawLoc.replace(/^\[IN-STORE PICKUP\]\s*(Bakery:\s*)?/i, '').trim();
      if (cleanLoc && !cleanLoc.toLowerCase().includes('undefined') && !cleanLoc.toLowerCase().includes('null')) {
        resolvedAddress = cleanLoc;
      }
    }
  }

  // Format Pickup Location Block
  let pickupLocationBlock = `📍 Pickup Location:\n${resolvedName}`;
  if (resolvedAddress && resolvedAddress !== resolvedName) {
    pickupLocationBlock += `\n${resolvedAddress}`;
  }

  // 4. Map / Directions URL (Only if valid)
  const mapUrl = getBakeryMapUrl(bakeryLocation);
  const directionsBlock = mapUrl ? `🗺️ Get Directions:\n${mapUrl}` : null;

  // 5. Pickup Schedule (Include only when real date/time exists, never invent fake schedule)
  let pickupTimeBlock: string | null = null;
  if (order.delivery_date || order.delivery_time) {
    const parts = [];
    if (order.delivery_date && !order.delivery_date.toLowerCase().includes('invalid')) {
      parts.push(order.delivery_date.trim());
    }
    if (order.delivery_time && !order.delivery_time.toLowerCase().includes('invalid')) {
      parts.push(order.delivery_time.trim());
    }
    if (parts.length > 0) {
      pickupTimeBlock = `🕒 Pickup Time: ${parts.join(', ')}`;
    }
  } else if (order.estimated_delivery_time && typeof order.estimated_delivery_time === 'string') {
    const est = order.estimated_delivery_time.trim();
    if (est && !est.toLowerCase().includes('nan') && !est.toLowerCase().includes('undefined')) {
      pickupTimeBlock = `🕒 Pickup Time: ${est}`;
    }
  }

  // 6. Optional concise items list
  let itemsSection: string | null = null;
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    const itemsList = order.items
      .filter(item => item && item.name && typeof item.name === 'string')
      .map(item => `• ${item.quantity || 1} × ${item.name.trim()}`)
      .join('\n');
    if (itemsList) {
      itemsSection = `🛍️ Order Items:\n${itemsList}`;
    }
  }

  // Assemble full clean message
  const sections = [
    greeting,
    ``,
    `This is Frosty Bite Bakery. 🍰`,
    ``,
    `Great news! Your order ${orderNumber} is ready for pickup! 🎉`,
    ``,
    `🛍️ Your order is packed and ready for collection.`,
    itemsSection,
    pickupLocationBlock,
    directionsBlock,
    pickupTimeBlock,
    `Please mention order ${orderNumber} when collecting your order.`,
    ``,
    `Thank you for choosing Frosty Bite Bakery! ❤️`,
    ``,
    `— Frosty Bite Bakery`
  ].filter(section => section !== null && section !== undefined);

  return sections.join('\n\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Opens WhatsApp click-to-chat with pre-filled ready-for-pickup message.
 * Returns success status or error message.
 */
export function openReadyForPickupWhatsApp(
  phone: string | null | undefined,
  order: any,
  bakeryLocation?: any
): { success: boolean; error?: string; normalizedPhone?: string; url?: string } {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return {
      success: false,
      error: 'No customer phone number is available or phone number is invalid.'
    };
  }

  const message = buildReadyForPickupWhatsAppMessage(order, bakeryLocation);
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




