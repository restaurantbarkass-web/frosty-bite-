/**
 * Client-side service to trigger emails via the server-side Resend integration.
 */
export const emailService = {
  async sendWelcomeEmail(email: string, name: string) {
    try {
      const response = await fetch('/api/email/welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send welcome email');
      }

      return await response.json();
    } catch (error) {
      console.error('[EmailService] Welcome Email Error:', error);
      // We don't throw here to avoid breaking the user experience if email fails
      return null;
    }
  },

  async sendOrderConfirmation(email: string, orderId: string, amount: number) {
    try {
      const response = await fetch('/api/email/order-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, orderId, amount }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send order confirmation email');
      }

      return await response.json();
    } catch (error) {
      console.error('[EmailService] Order Confirmation Error:', error);
      return null;
    }
  },

  async sendDeliveryUpdate(email: string, orderId: string, status: string) {
    try {
      const response = await fetch('/api/email/delivery-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, orderId, status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send delivery update email');
      }

      return await response.json();
    } catch (error) {
      console.error('[EmailService] Delivery Update Error:', error);
      return null;
    }
  }
};
