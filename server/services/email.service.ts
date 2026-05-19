import { resend } from '../lib/resend';

export class EmailService {
  static async sendWelcomeEmail(email: string, name: string) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Frosty Bite <onboarding@resend.dev>',
        to: email,
        subject: 'Welcome to Frosty Bite 🎂',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 12px;">
            <h1 style="color: #ea580c;">Hello ${name}</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Welcome to Frosty Bite! We're excited to have you join our community of food lovers.</p>
            <p style="font-size: 16px; line-height: 1.5; color: #333;">Start exploring our menu and order your first delicious treat today!</p>
            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.APP_URL || '#'}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Browse Menu</a>
            </div>
            <p style="margin-top: 40px; font-size: 12px; color: #999; text-align: center;">If you didn't sign up for this account, please ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        console.error('[EmailService] Resend Error (Welcome):', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[EmailService] Error sending welcome email:', error);
      throw error;
    }
  }

  static async sendOrderEmail(email: string, orderId: string, amount: number) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Frosty Bite <onboarding@resend.dev>',
        to: email,
        subject: `Order Confirmed #${orderId} 🎉`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 12px;">
            <h2 style="color: #ea580c;">Order Confirmed!</h2>
            <p style="font-size: 16px; color: #333;">Thanks for your order. We're getting it ready for you.</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>
              <p style="margin: 5px 0;"><strong>Total Amount:</strong> ₹${amount.toFixed(2)}</p>
            </div>
            <p style="font-size: 16px; color: #333;">You can track your order status in the app.</p>
            <div style="margin-top: 30px; text-align: center;">
              <a href="${process.env.APP_URL || '#'}/orders/${orderId}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Track Order</a>
            </div>
          </div>
        `,
      });

      if (error) {
        console.error('[EmailService] Resend Error (Order):', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[EmailService] Error sending order email:', error);
      throw error;
    }
  }

  static async sendDeliveryEmail(email: string, orderId: string, status: string) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'Frosty Bite <onboarding@resend.dev>',
        to: email,
        subject: `Order Status Update: ${status}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 12px;">
            <h2 style="color: #ea580c;">Order Update</h2>
            <p style="font-size: 16px; color: #333;">Your order <strong>#${orderId}</strong> status has been updated to:</p>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold; color: #ea580c; text-transform: uppercase;">${status}</span>
            </div>
            <p style="font-size: 16px; color: #333;">Thank you for choosing Frosty Bite!</p>
          </div>
        `,
      });

      if (error) {
        console.error('[EmailService] Resend Error (Delivery):', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[EmailService] Error sending delivery email:', error);
      throw error;
    }
  }

  static async sendOTPEmail(email: string, otp: string) {
    if (!process.env.RESEND_API_KEY) {
      console.error('[EmailService] Cannot send OTP: RESEND_API_KEY is missing');
      throw new Error('Email service configuration missing. Please check RESEND_API_KEY in Settings > Secrets.');
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'Frosty Bite <onboarding@resend.dev>',
        to: email,
        subject: `Your Login Code: ${otp}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 12px; text-align: center;">
            <h2 style="color: #ea580c;">Login to Frosty Bite</h2>
            <p style="font-size: 16px; color: #333;">Use the following code to complete your sign-in. This code will expire in 10 minutes.</p>
            <div style="background-color: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <span style="font-size: 32px; font-weight: bold; color: #ea580c; letter-spacing: 5px;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #666;">If you didn't request this code, you can safely ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        console.error('[EmailService] Resend Error (OTP):', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[EmailService] Error sending OTP email:', error);
      throw error;
    }
  }
}
