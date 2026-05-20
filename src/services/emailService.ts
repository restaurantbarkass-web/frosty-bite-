/**
 * Client-side service to handle notifications.
 * Resend integration removed. Integration with Supabase/SMTP can be added here.
 */
export const emailService = {
  async sendWelcomeEmail(email: string, name: string) {
    console.log(`[EmailService] (No-op) Would send welcome email to ${email}`);
    return { success: true };
  },

  async sendOrderConfirmation(email: string, orderId: string, amount: number) {
    console.log(`[EmailService] (No-op) Would send order confirmation for ${orderId} to ${email}`);
    return { success: true };
  },

  async sendDeliveryUpdate(email: string, orderId: string, status: string) {
    console.log(`[EmailService] (No-op) Would send delivery update (${status}) for ${orderId} to ${email}`);
    return { success: true };
  }
};
