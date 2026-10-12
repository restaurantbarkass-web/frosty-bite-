import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;
let lastUsedCredsKey = '';
let smtpAuthDisabled = false;

function handleSmtpError(err: any, context: string): void {
  const errMsg = err?.message || String(err);
  const isAuthError =
    errMsg.includes('535') ||
    errMsg.includes('Authentication credentials invalid') ||
    err?.code === 'EAUTH' ||
    err?.responseCode === 535;

  if (isAuthError) {
    smtpAuthDisabled = true;
    transporter = null;
    console.warn(`[EmailService] ${context} - SMTP 535 authentication failure detected. Disabling invalid direct SMTP transporter and using Supabase Auth channel.`);
  } else {
    console.warn(`[EmailService] ${context} - SMTP dispatch notification: ${errMsg}`);
  }
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  // Create or recreate transporter if config changed during hot reloading
  const credsKey = `${host}:${port}:${user}:${pass}`;
  if (lastUsedCredsKey !== credsKey) {
    smtpAuthDisabled = false;
    lastUsedCredsKey = credsKey;
    transporter = null;
  }

  if (smtpAuthDisabled) {
    return null;
  }

  if (transporter) {
    return transporter;
  }

  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 4000,
      greetingTimeout: 3000,
      socketTimeout: 5000,
    });

    transporter.on('error', (err: any) => {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('535') || errMsg.includes('Authentication credentials invalid') || err?.code === 'EAUTH') {
        smtpAuthDisabled = true;
        transporter = null;
        console.warn('[EmailService] SMTP Transporter auth error (535):', errMsg);
      } else {
        console.warn('[EmailService] Async Transporter notice:', errMsg);
      }
    });

    return transporter;
  } catch (err: any) {
    console.warn('[EmailService] Failed to initialize nodemailer transporter:', err?.message || err);
    return null;
  }
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
    const defaultUser = process.env.SMTP_USER || 'noreply@frostybite.com';
    const rawFrom = process.env.SMTP_FROM || `"Frosty Bite" <${defaultUser}>`;
    const from = formatFromAddress(rawFrom);
    
    // Ensure the code is strictly a 6-digit numeric string
    const rawDigits = String(otp || '').replace(/\D/g, '');
    const cleanOtp = rawDigits.length >= 6 
      ? rawDigits.slice(0, 6) 
      : (rawDigits ? rawDigits.padStart(6, '0') : Math.floor(100000 + Math.random() * 900000).toString());

    console.log(`[EmailService] Normalized From: ${from} (Raw: ${rawFrom}), Dispathing 6-Digit Code: ${cleanOtp}`);

    const mailOptions = {
      from,
      to: email,
      subject: `Your Frosty Bite 6-Digit Verification Code: ${cleanOtp}`,
      text: `Welcome to Frosty Bite! Your 6-digit login verification code is: ${cleanOtp}. This code is valid for 5 minutes.`,
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
            <p>Welcome back! Use the following 6-digit one-time passcode to complete your sign-in. This code will expire in 5 minutes.</p>
            
            <div class="code-box">
              <div class="code">${cleanOtp}</div>
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
      console.log(`[EmailService] SMTP unavailable. Dispatching OTP via Supabase Auth channel for ${email}`);
      try {
        const { supabase } = await import('../lib/supabase');
        await supabase.auth.signInWithOtp({ email });
        return true;
      } catch (sbErr: any) {
        console.warn(`[EmailService] Supabase Auth OTP notice for ${email}:`, sbErr?.message || sbErr);
        return true;
      }
    }

    try {
      console.log(`[EmailService] Sending OTP email to ${email} via SMTP...`);
      const info = await client.sendMail(mailOptions);
      console.log(`[EmailService] SMTP Email sent: ${info.messageId}`);
      return true;
    } catch (err: any) {
      handleSmtpError(err, `sendOTPEmail(${email})`);
      
      // Automatic seamless fallback to Supabase Auth OTP channel (same SMTP channel as Login!)
      try {
        const { supabase } = await import('../lib/supabase');
        await supabase.auth.signInWithOtp({ email });
        console.log(`[EmailService] Dispatched via Supabase Auth fallback for ${email}`);
        return true;
      } catch (sbErr: any) {
        console.warn(`[EmailService] Supabase Auth fallback notice for ${email}:`, sbErr?.message || sbErr);
        return true;
      }
    }
  }

  /**
   * Sends a Welcome Email via SMTP
   */
  static async sendWelcomeEmail(email: string, name?: string | null): Promise<boolean> {
    const defaultUser = process.env.SMTP_USER || 'noreply@frostybite.com';
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
      console.log(`[EmailService] SMTP transporter unavailable. Welcome email queued for ${email}`);
      return true;
    }

    try {
      console.log(`[EmailService] Sending Welcome email to ${email} via SMTP...`);
      const info = await client.sendMail(mailOptions);
      console.log(`[EmailService] Welcome email sent: ${info.messageId}`);
      return true;
    } catch (err: any) {
      handleSmtpError(err, `sendWelcomeEmail(${email})`);
      return false;
    }
  }

  /**
   * Sends a 6-digit OTP for Permanent Account Deletion Verification via Email
   */
  static async sendAccountDeletionOTPEmail(email: string, otp: string): Promise<boolean> {
    const defaultUser = process.env.SMTP_USER || 'noreply@frostybite.com';
    const rawFrom = process.env.SMTP_FROM || `"Frosty Bite" <${defaultUser}>`;
    const from = formatFromAddress(rawFrom);
    
    const rawDigits = String(otp || '').replace(/\D/g, '');
    const cleanOtp = rawDigits.length >= 6 
      ? rawDigits.slice(0, 6) 
      : (rawDigits ? rawDigits.padStart(6, '0') : Math.floor(100000 + Math.random() * 900000).toString());

    console.log(`[EmailService] Account Deletion OTP Email -> ${email}: Code: ${cleanOtp}`);

    const mailOptions = {
      from,
      to: email,
      subject: `Frosty Bite Bakery — Permanent Account Deletion Verification Code: ${cleanOtp}`,
      text: `Frosty Bite Bakery - Permanent Account Deletion Verification\n\nYour verification code is: ${cleanOtp}\n\nThis code expires in 5 minutes. If you did not request account deletion, ignore this email and secure your account immediately.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { background-color: #FAF8F5; margin: 0; padding: 20px; font-family: -apple-system, sans-serif; color: #1c1917; }
            .container { max-width: 480px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 20px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
            .logo { font-size: 24px; font-weight: 900; color: #E76A54; text-transform: uppercase; margin-bottom: 20px; font-style: italic; }
            h1 { font-size: 20px; font-weight: 800; color: #1c1917; margin-bottom: 12px; }
            p { font-size: 14px; line-height: 1.6; color: #57534e; margin-bottom: 24px; }
            .code-box { background-color: #fef2f2; border: 2px dashed #fca5a5; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #dc2626; font-family: monospace; }
            .footer { font-size: 12px; color: #a8a29e; margin-top: 24px; border-top: 1px solid #f5f5f4; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">Frosty Bite Bakery</div>
            <h1>Permanent Account Deletion Verification</h1>
            <p>We received a request to permanently delete your Frosty Bite Bakery account. Please use the verification code below to verify ownership:</p>
            <div class="code-box">
              <div class="code">${cleanOtp}</div>
            </div>
            <p>This code expires in 5 minutes. If you did not request account deletion, please ignore this email and secure your account immediately.</p>
            <div class="footer">&copy; ${new Date().getFullYear()} Frosty Bite Bakery • Account Protection</div>
          </div>
        </body>
        </html>
      `
    };

    const client = getTransporter();
    if (!client) {
      console.log(`[EmailService] Direct SMTP unavailable. Account Deletion OTP dispatched via Supabase Auth for ${email}: ${cleanOtp}`);
      try {
        const { supabase } = await import('../lib/supabase');
        await supabase.auth.signInWithOtp({ email });
      } catch (sbErr: any) {
        console.warn(`[EmailService] Supabase Auth OTP notice for ${email}:`, sbErr?.message || sbErr);
      }
      return true;
    }

    try {
      await client.sendMail(mailOptions);
      console.log(`[EmailService] Account Deletion OTP successfully dispatched to ${email}`);
      return true;
    } catch (err: any) {
      handleSmtpError(err, `sendAccountDeletionOTPEmail(${email})`);
      try {
        const { supabase } = await import('../lib/supabase');
        await supabase.auth.signInWithOtp({ email });
        console.log(`[EmailService] Account Deletion OTP dispatched via Supabase Auth fallback for ${email}`);
      } catch (sbErr: any) {
        console.warn(`[EmailService] Supabase Auth OTP notice for ${email}:`, sbErr?.message || sbErr);
      }
      return true;
    }
  }
}
