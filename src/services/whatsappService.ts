export const whatsappService = {
  PHONE_NUMBER: "917735800239", // Frosty Bite shop owner contact number.

  sendOrderMessage(order: any) {
    const itemsList = order.items
      .map((item: any) => `- ${item.name} x${item.quantity} (₹${item.price * item.quantity})`)
      .join('\n');

    const message = `*New Order - Frosty Bite*\n\n` +
      `*Order ID:* ${order.id}\n` +
      `*Customer:* ${order.customer_name}\n` +
      `*Phone:* ${order.phone}\n\n` +
      `*Items:*\n${itemsList}\n\n` +
      `*Total:* ₹${order.total}\n` +
      `*Address:* ${order.address}\n\n` +
      `*Payment Method:* ${order.payment_method}\n` +
      `*Notes:* ${order.notes || 'None'}\n\n` +
      `Please confirm my order!`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${this.PHONE_NUMBER}?text=${encodedMessage}`, '_blank');
  },

  sendCancellationMessage(order: any, reason: string) {
    const itemsList = (order.items || [])
      .map((item: any) => `- ${item.name} x${item.quantity}`)
      .join('\n');

    const message = `*Order Cancelled - Frosty Bite*\n\n` +
      `*Order ID:* ${order.id}\n` +
      `*Customer:* ${order.customer_name || 'Guest'}\n` +
      `*Phone:* ${order.phone || 'N/A'}\n\n` +
      `*Reason:* ${reason}\n\n` +
      `*Cancelled Items:*\n${itemsList}\n\n` +
      `*Refund Status:* ${order.refund_status === 'pending_refund' ? 'Refund of ₹' + (order.total || order.total_amount) + ' Initiated (Pending)' : 'None (Cash Order)'}\n\n` +
      `Your support request is logged. Thank you.`;

    const encodedMessage = encodeURIComponent(message);
    try {
      window.open(`https://wa.me/${this.PHONE_NUMBER}?text=${encodedMessage}`, '_blank');
    } catch (e) {
      console.error("Popup blocked for WhatsApp:", e);
    }
  },

  chatWithUs() {
    const message = "Hi Frosty Bite! I'd like to ask about...";
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${this.PHONE_NUMBER}?text=${encodedMessage}`, '_blank');
  }
};
