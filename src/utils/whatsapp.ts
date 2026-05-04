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
