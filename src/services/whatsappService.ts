export const whatsappService = {
  PHONE_NUMBER: "919000000000", // Default bakery number. User can change this.

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

  chatWithUs() {
    const message = "Hi Frosty Bite! I'd like to ask about...";
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${this.PHONE_NUMBER}?text=${encodedMessage}`, '_blank');
  },
  
  contactRider(riderPhone: string, orderId: string) {
    const message = `Hi, I'm checking on my order #${orderId}.`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${riderPhone}?text=${encodedMessage}`, '_blank');
  }
};
