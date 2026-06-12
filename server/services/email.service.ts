import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;
let lastUsedCredsKey = '';

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER || 'frostybitebakery07@gmail.com';
  const pass = process.env.SMTP_PASS || 'ymmy apat kkhr vepw';

  if (!user || !pass) {
    console.warn('[EmailService] SMTP credentials are not fully configured in your environment variables. Using fallback mode.');
    return null;
  }

  // Create or recreate transporter if config changed during hot reloading
  const credsKey = `${host}:${port}:${user}:${pass}`;
  if (transporter && lastUsedCredsKey === credsKey) {
    return transporter;
  }

  console.log(`[EmailService] Creating SMTP transporter for ${host}:${port} with user: ${user}`);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 4000, // 4 seconds
    greetingTimeout: 3000,    // 3 seconds
    socketTimeout: 5000,     // 5 seconds
  });

  // Prevent uncaught transport exception from crashing node
  transporter.on('error', (err) => {
    console.error('[EmailService] Async Transporter Error:', err);
  });

  lastUsedCredsKey = credsKey;

  return transporter;
}

/**
 * Normalizes email FROM addresses (e.g., converts "Frosty Bite" onboarding@resend.dev to "Frosty Bite" <onboarding@resend.dev>)
 */
function formatFromAddress(fromStr: string): string {
  if (!fromStr) return '"Frosty Bite" <noreply@frostybite.com>';
  
  // Format already has angle brackets, e.g., "Frosty Bite" <onboarding@resend.dev>
  if (fromStr.includes('<') && fromStr.includes('>')) {
    return fromStr;
  }
  
  // Try to extract any email address pattern from the string
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const match = fromStr.match(emailRegex);
  
  if (match) {
    const email = match[1];
    // Grab everything that isn't the email address
    let restOfStr = fromStr.replace(email, '').trim();
    // Trim down surrounding quotes or extra whitespaces
    restOfStr = restOfStr.replace(/^['"]|['"]$/g, '').trim();
    
    if (restOfStr) {
      return `"${restOfStr}" <${email}>`;
    }
    return email;
  }
  
  return fromStr;
}

export class EmailService {
  /**
   * Sends an OTP (Verification Code) via SMTP
   */
  static async sendOTPEmail(email: string, otp: string): Promise<boolean> {
    const defaultUser = process.env.SMTP_USER || 'frostybitebakery07@gmail.com';
    const rawFrom = process.env.SMTP_FROM || `"Frosty Bite" <${defaultUser}>`;
    const from = formatFromAddress(rawFrom);
    
    console.log(`[EmailService] Normalized From: ${from} (Raw: ${rawFrom})`);

    const mailOptions = {
      from,
      to: email,
      subject: `Your Frosty Bite Verification Code: ${otp}`,
      text: `Welcome to Frosty Bite! Your login verification code is: ${otp}. This code is valid for 5 minutes.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Frosty Bite Verification</title>
          <style>
            body {
              background-color: #080808;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #ffffff;
            }
            .container {
              max-width: 500px;
              margin: 40px auto;
              background-color: #111111;
              border: 1px solid #222222;
              border-radius: 24px;
              padding: 40px;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            .logo {
              font-family: system-ui, sans-serif;
              font-size: 28px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -1px;
              color: #ff6b00;
              margin-bottom: 24px;
              font-style: italic;
            }
            .logo span {
              color: #ffffff;
            }
            h1 {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 12px;
              color: #ffffff;
            }
            p {
              font-size: 15px;
              line-height: 1.6;
              color: #a0a0a0;
              margin-bottom: 30px;
            }
            .code-box {
              background: linear-gradient(135deg, rgba(255,107,0,0.1) 0%, rgba(255,107,0,0.02) 100%);
              border: 2px dashed rgba(255, 107, 0, 0.3);
              border-radius: 16px;
              padding: 20px;
              margin: 24px 0;
              display: inline-block;
              width: 80%;
            }
            .code {
              font-family: "Courier New", Courier, monospace;
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #ff6b00;
            }
            .footer {
              font-size: 12px;
              color: #555555;
              margin-top: 40px;
              border-top: 1px solid #222222;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">FROSTY<span>BITE</span></div>
            <h1>Log Into Your Account</h1>
            <p>Welcome back! Use the following one-time passcode to complete your sign-in. This code will expire in 5 minutes.</p>
            
            <div class="code-box">
              <div class="code">${otp}</div>
            </div>
            
            <p style="font-size: 13px; margin-top: 20px; color: #ff6b00;">If you did not request this code, you can safely ignore this email.</p>
            
            <div class="footer">
              &copy; ${new Date().getFullYear()} Frosty Bite. All rights reserved.<br>
              Premium Desserts & Bites Delivered Fresh.
            </div>
          </div>
        </body>
        </html>
      `
    };

    const client = getTransporter();
    
    if (!client) {
      console.warn(`[EmailService] No SMTP transporter. Printed Login Code: ${otp} for ${email}`);
      return false;
    }

    try {
      console.log(`[EmailService] Sending OTP email to ${email} via SMTP...`);
      const info = await client.sendMail(mailOptions);
      console.log(`[EmailService] SMTP Email sent: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error('[EmailService] SMTP Error sending email:', err);
      return false;
    }
  }

  /**
   * Sends a Welcome Email via SMTP
   */
  static async sendWelcomeEmail(email: string, name?: string | null): Promise<boolean> {
    const defaultUser = process.env.SMTP_USER || 'frostybitebakery07@gmail.com';
    const rawFrom = process.env.SMTP_FROM || `"Frosty Bite" <${defaultUser}>`;
    const from = formatFromAddress(rawFrom);
    const displayName = name || email.split('@')[0];

    const mailOptions = {
      from,
      to: email,
      subject: `Welcome to Frosty Bite, ${displayName}!`,
      text: `Hello ${displayName},\n\nWelcome to Frosty Bite! We are thrilled to have you join our community of premium dessert lovers.\n\nEnjoy browsing our delicious menu and get ready to indulge in the fresh desserts & bites of your dreams!\n\nBest regards,\nThe Frosty Bite Team`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Frosty Bite</title>
          <style>
            body {
              background-color: #080808;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #ffffff;
            }
            .container {
              max-width: 500px;
              margin: 40px auto;
              background-color: #111111;
              border: 1px solid #222222;
              border-radius: 24px;
              padding: 40px;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            .logo {
              font-family: system-ui, sans-serif;
              font-size: 28px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: -1px;
              color: #ff6b00;
              margin-bottom: 24px;
              font-style: italic;
            }
            .logo span {
              color: #ffffff;
            }
            h1 {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 12px;
              color: #ffffff;
            }
            p {
              font-size: 15px;
              line-height: 1.6;
              color: #a0a0a0;
              margin-bottom: 30px;
            }
            .welcome-box {
              background: linear-gradient(135deg, rgba(255,107,0,0.1) 0%, rgba(255,107,0,0.02) 100%);
              border: 1px solid rgba(255, 107, 0, 0.2);
              border-radius: 16px;
              padding: 24px;
              margin: 24px 0;
              text-align: left;
            }
            .welcome-box p {
              margin: 0;
              color: #ffffff;
              font-weight: 500;
            }
            .footer {
              font-size: 12px;
              color: #555555;
              margin-top: 40px;
              border-top: 1px solid #222222;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">FROSTY<span>BITE</span></div>
            <h1>Welcome, ${displayName}!</h1>
            <p>Thank you for creating an account with Frosty Bite. We are absolutely thrilled to bake for you.</p>
            
            <div class="welcome-box">
              <p>What's next?</p>
              <ul style="color: #a0a0a0; padding-left: 20px; margin-top: 10px; margin-bottom: 0; font-size: 14px; line-height: 1.6;">
                <li>Explore our curated menu of premium cookies, pastries, and bite-sized treats</li>
                <li>Set up your preferred delivery address and preferences</li>
                <li>Earn rewards and unlock exclusive sweets with our loyalty perks</li>
              </ul>
            </div>
            
            <p style="margin-top: 30px;">Let's make today a little sweeter.</p>
            
            <div class="footer">
              &copy; ${new Date().getFullYear()} Frosty Bite. All rights reserved.<br>
              Premium Desserts & Bites Delivered Fresh.
            </div>
          </div>
        </body>
        </html>
      `
    };

    const client = getTransporter();
    if (!client) {
      console.warn(`[EmailService] No SMTP transporter. Welcome email printed to console for ${email}`);
      return false;
    }

    try {
      console.log(`[EmailService] Sending Welcome email to ${email} via SMTP...`);
      const info = await client.sendMail(mailOptions);
      console.log(`[EmailService] Welcome email sent: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error('[EmailService] SMTP Error sending welcome email:', err);
      return false;
    }
  }
}
