/**
 * Server-side WhatsApp Service
 * Responsible for validating, formatting, and dispatching OTP verification messages
 * through the user's running whatsapp-web.js server or OpenWA API.
 */
export class WhatsAppService {
  /**
   * Dispatches a 6-digit verification code to the recipient's WhatsApp account
   */
  static async sendOtpWhatsApp(phone: string, otp: string): Promise<{
    success: boolean;
    provider: string;
    message: string;
    dev_otp_hint: string;
    client_dispatch_required?: boolean;
    textMessage?: string;
    formattedPhone?: string;
  }> {
    // 1. Phone number formatting & validation
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      throw new Error('Invalid phone number format. Must be at least 10 digits.');
    }

    // Ensure country code is prepended. Default to Indian country code '91' if length is exactly 10 digits
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    // 2. Format the official Frosty Bite WhatsApp text template
    const textMessage = `🍰 *Frosty Bite Bakery*\n\nYour verification code is:\n\n*${otp}*\n\nThis code expires in 5 minutes.\n\nDo not share this code with anyone.`;

    // 3. Resolve the configured WhatsApp server URL
    const whatsappUrl = (process.env.OPENWA_API_URL || process.env.WHATSAPP_SERVER_URL || 'http://localhost:3001').replace(/\/+$/, '');

    const isCloudEnv = !!process.env.K_SERVICE || process.env.NODE_ENV === 'production';
    if (isCloudEnv && (whatsappUrl.includes('localhost') || whatsappUrl.includes('127.0.0.1'))) {
      console.log(`[WhatsAppService] Running in cloud environment. Localhost is unreachable. Instantly delegating dispatch to browser client.`);
      return {
        success: true,
        provider: 'client-delegate',
        message: `Delegating dispatch to your local WhatsApp server...`,
        dev_otp_hint: otp,
        client_dispatch_required: true,
        textMessage,
        formattedPhone
      };
    }

    console.log(`[WhatsAppService] Dispatching WhatsApp message to +${formattedPhone} using server at: ${whatsappUrl}...`);

    try {
      // Determine if this is our custom server.cjs endpoint or an OpenWA session endpoint
      const isCustomServer = whatsappUrl.includes('localhost') || whatsappUrl.includes('127.0.0.1') || !process.env.OPENWA_SESSION_ID;
      
      const endpoint = isCustomServer 
        ? `${whatsappUrl}/send`
        : `${whatsappUrl}/api/${process.env.OPENWA_SESSION_ID || 'my-bot'}/send-text`;

      console.log(`[WhatsAppService] Resolved dispatch endpoint: ${endpoint}`);

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const openwaKey = process.env.OPENWA_API_KEY;
      if (openwaKey) {
        headers['X-API-Key'] = openwaKey;
        headers['Authorization'] = `Bearer ${openwaKey}`;
      }

      // Build payload matching the endpoint's expectation
      const body = isCustomServer 
        ? { number: formattedPhone, message: textMessage }
        : { to: `${formattedPhone}@c.us`, msg: textMessage, content: textMessage };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000), // timeout after 3s so cloud backend doesn't hang
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`WhatsApp server returned status ${response.status}: ${errorText || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log(`[WhatsAppService] Dispatch succeeded! Response:`, data);

      return {
        success: true,
        provider: isCustomServer ? 'whatsapp-web.js' : 'openwa',
        message: `Verification code sent to +${formattedPhone} via WhatsApp.`,
        dev_otp_hint: otp
      };

    } catch (err: any) {
      console.warn(`[WhatsAppService] Dispatch error:`, err.message || err);

      // If we are using a local server, and we are running in the cloud (which cannot reach localhost),
      // we request the client/browser to perform the dispatch to their local server!
      if (whatsappUrl.includes('localhost') || whatsappUrl.includes('127.0.0.1')) {
        console.log(`[WhatsAppService] Backend cannot reach local server ${whatsappUrl}. Delegating dispatch to browser client.`);
        return {
          success: true,
          provider: 'client-delegate',
          message: `Delegating dispatch to your local WhatsApp server...`,
          dev_otp_hint: otp,
          client_dispatch_required: true,
          textMessage,
          formattedPhone
        };
      }

      throw new Error(
        `Failed to send WhatsApp verification code. Please make sure your WhatsApp server is active and authenticated at ${whatsappUrl}. (Error: ${err.message || err})`
      );
    }
  }
}
