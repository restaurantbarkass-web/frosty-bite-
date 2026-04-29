import { RESTAURANT_WHATSAPP } from '../constants';

export const openWhatsAppOrder = (orderData: {
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  notes?: string;
  method: 'upi' | 'cod';
  amount: number;
  utr?: string;
  items?: { name: string; quantity: number }[];
}) => {
  const adminNumber = RESTAURANT_WHATSAPP; // Using global restaurant number
  
  const itemsText = orderData.items 
    ? orderData.items.map(item => `• ${item.name} x ${item.quantity}`).join('\n')
    : '';

  const notesText = orderData.notes ? `\n*Notes:* ${orderData.notes}` : '';

  const message = `🛒 *New Order Received!*
----------------------------
*Order ID:* ${orderData.orderId.slice(-6).toUpperCase()}
*Name:* ${orderData.customerName}
*Phone:* ${orderData.phone}
*Address:* ${orderData.address}${notesText}
----------------------------
*Items:*
${itemsText}
----------------------------
*Total Amount:* ₹${orderData.amount}
*Payment:* ${orderData.method.toUpperCase()}
${orderData.utr ? `*UPI UTR:* ${orderData.utr}\n_(Waiting for your verification in Admin Panel)_` : '*Method:* Cash on Delivery'}
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
