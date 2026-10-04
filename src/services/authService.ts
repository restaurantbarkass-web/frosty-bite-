import { supabase } from '../supabase';
import { UserRepository } from '../repositories';
import { getRoleFromEmail } from '../constants';
import { safeFetchJson, safeResponseJson } from '../utils/safeFetch';

// Deduplicated Auth Sync requester to completely prevent duplicate concurrent /api/auth/sync requests
async function fetchSyncDeduplicated(idToken: string, markVerified: boolean) {
  const windowObj = typeof window !== 'undefined' ? (window as any) : {};
  if (!windowObj.__activeAuthSyncs) {
    windowObj.__activeAuthSyncs = new Map<string, Promise<any>>();
  }
  const cacheKey = `${idToken}_${markVerified}`;
  if (windowObj.__activeAuthSyncs.has(cacheKey)) {
    console.log('[DeduplicatedFetch] Reusing active sync fetch for key:', cacheKey);
    return windowObj.__activeAuthSyncs.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const res = await safeFetchJson('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken, markVerified }),
      });
      if (!res.ok || !res.data) {
        throw new Error(res.error || `Sync API returned status: ${res.status}`);
      }
      return res.data;
    } catch (err) {
      console.error('[DeduplicatedFetch] Sync API failed:', err);
      throw err;
    } finally {
      windowObj.__activeAuthSyncs.delete(cacheKey);
    }
  })();

  windowObj.__activeAuthSyncs.set(cacheKey, promise);
  return promise;
}

export const logout = async () => {
  await supabase.auth.signOut();
};

import { safeTrim, safeTrimLowerCase } from '../utils/string';

async function safeParseResponse(res: Response): Promise<any> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const authService = {
  // Email/Password Login
  async handleEmailLogin(email: string, pass: string) {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email address is required.');
    }
    const cleanEmail = safeTrimLowerCase(email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pass,
    });

    if (error || !data.user) {
      throw new Error(error?.message || 'Incorrect email or password.');
    }

    console.log('[handleEmailLogin] Supabase login succeeded!', data.user.id);
    try {
      localStorage.setItem('frostybite_active_session_email', cleanEmail);
    } catch (e) {}
    
    // Perform background sync of user details
    try {
      await this.syncUserWithDatabase(data.user);
    } catch (syncErr) {
      console.warn('[handleEmailLogin] Background user sync warning:', syncErr);
    }

    return {
      user: {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.name || data.user.user_metadata?.full_name || (cleanEmail ? cleanEmail.split('@')[0] : 'User'),
        emailVerified: true,
      }
    } as any;
  },

  // Signup
  async handleSignup(email: string, pass: string, name?: string) {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email address is required.');
    }
    const cleanEmail = safeTrimLowerCase(email);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pass,
      options: {
        data: {
          name: name,
          full_name: name,
        }
      }
    });

    if (error || !data.user) {
      throw new Error(error?.message || 'Failed to create your Frosty Bite account.');
    }

    console.log('[handleSignup] Supabase signup succeeded!', data.user.id);
    try {
      localStorage.setItem('frostybite_active_session_email', cleanEmail);
    } catch (e) {}

    try {
      await UserRepository.createUserRecord({
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        full_name: name || cleanEmail.split('@')[0],
        auth_methods: ['password'],
      });
    } catch (dbErr) {
      console.warn('DB user sync during signup warning:', dbErr);
    }

    return {
      user: {
        uid: data.user.id,
        email: data.user.email,
        displayName: name || cleanEmail.split('@')[0],
        emailVerified: true,
      }
    } as any;
  },

  // Send Email Verification
  async verifyEmail() {
    // Supabase sends sign up / confirmation emails automatically if enabled
  },

  // Magic Link Login
  async sendSignInLink(email: string) {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email address is required.');
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: safeTrimLowerCase(email),
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw error;
  },

  // Send OTP directly using server email dispatcher with automatic Supabase Auth fallback
  async sendOTP(email: string) {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email address is required.');
    }
    const normalizedEmail = safeTrimLowerCase(email);
    let serverErrorMsg: string | null = null;

    // 1. Attempt server-side Express OTP dispatch
    try {
      const res = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const data = await safeParseResponse(res);

      if (res.ok && data?.success) {
        console.log('[authService] Server 6-digit email OTP dispatched successfully');
        return data;
      } else if (res.status === 429 && data?.error) {
        throw new Error(data.error);
      } else if (data?.error) {
        serverErrorMsg = data.error;
      }
    } catch (err: any) {
      if (err?.message && (err.message.includes('Security Limit') || err.message.includes('maximum daily limit') || err.message.includes('rate limit'))) {
        throw err;
      }
      console.warn('[authService] Server email OTP dispatcher unavailable, falling back to Supabase auth:', err?.message || err);
    }

    // 2. Fallback to Supabase client-side Auth (works on Vercel static deployments)
    try {
      console.log('[authService] Dispatching OTP via Supabase client fallback...');
      const { error: sbError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true
        }
      });

      if (sbError) {
        console.warn('[authService] Supabase client OTP error:', sbError);
        throw new Error(sbError.message || serverErrorMsg || 'Failed to dispatch email verification code.');
      }

      console.log('[authService] Supabase client OTP dispatched successfully!');
      return {
        success: true,
        message: 'A verification code has been dispatched to your email.',
        fallback: true
      };
    } catch (fallbackErr: any) {
      console.error('[authService] All email OTP channels failed:', fallbackErr);
      throw new Error(fallbackErr.message || serverErrorMsg || 'Failed to send verification code. Please check your network connection.');
    }
  },

  // Send mobile phone number verification code via physical-SIM SMS Gateway
  async sendMobileOTP(phone: string, isSignup?: boolean, email?: string, name?: string, password?: string) {
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone, purpose: isSignup ? 'SIGNUP' : 'LOGIN' })
    });
    const data = await safeParseResponse(res);
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || 'Failed to dispatch verification code via SMS.');
    }
    return {
      success: true,
      message: data.message || 'OTP sent successfully.',
      dev_otp_hint: undefined,
      local_dispatch_error: false,
      local_dispatch_error_message: undefined
    };
  },

  // Verify mobile phone number verification code
  async verifyMobileOTP(phone: string, otp: string) {
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone, purpose: 'LOGIN', otp })
    });
    const data = await safeParseResponse(res);
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || 'Invalid verification code.');
    }

    if (data?.user) {
      try {
        localStorage.setItem('frostybite_active_session_email', data.user.email);
        localStorage.setItem('frostybite_has_active_session', 'true');
      } catch (e) {}
    }
    return data;
  },

  // Resend mobile verification code
  async resendMobileOTP(phone: string) {
    const res = await fetch('/api/auth/otp/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone, purpose: 'LOGIN' })
    });
    const data = await safeParseResponse(res);
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || 'Failed to resend verification code.');
    }
    return {
      success: true,
      message: data.message || 'OTP resent successfully.',
      dev_otp_hint: undefined,
      local_dispatch_error: false,
      local_dispatch_error_message: undefined
    };
  },

  // Verify OTP directly using backend 8-digit email OTP validator with Supabase fallback
  async verifyOTP(email: string, otp: string, isSignupHint?: boolean) {
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email address is required.');
    }
    const normalizedEmail = safeTrimLowerCase(email);
    const cleanOtp = safeTrim(otp);

    if (cleanOtp.length !== 8) {
      throw new Error('Please enter the complete 8-digit verification code.');
    }

    // 1. Try server-side email OTP verification first
    try {
      const serverRes = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, otp: cleanOtp })
      });
      const serverData = await serverRes.json().catch(() => null);

      if (serverRes.ok && serverData?.success) {
        try {
          localStorage.setItem('frostybite_active_session_email', normalizedEmail);
          localStorage.setItem('frostybite_has_active_session', 'true');
          if (serverData.customToken) {
            localStorage.setItem('auth_token', serverData.customToken);
          }
        } catch (e) {}

        const syncedUid = serverData.user?.supabase_uid || serverData.user?.id || 'email-user';
        return {
          user: {
            uid: syncedUid,
            email: normalizedEmail,
            displayName: serverData.user?.name || serverData.user?.full_name || normalizedEmail.split('@')[0],
            emailVerified: true,
            getIdToken: async () => serverData.customToken || 'verified-email-token',
            reload: async () => {},
          }
        };
      } else if (serverRes.status === 400 || serverRes.status === 401 || serverRes.status === 429) {
        throw new Error(serverData?.error || 'Incorrect verification code. Please check your email and try again.');
      }
    } catch (err: any) {
      if (err?.message && (
        err.message.includes('Incorrect') || 
        err.message.includes('expired') || 
        err.message.includes('exceeded') || 
        err.message.includes('Invalid')
      )) {
        throw err;
      }
      console.warn('[AuthService] Server email OTP verification error, falling back to Supabase auth:', err);
    }

    let isNewUser = true;

    if (isSignupHint !== undefined) {
      isNewUser = isSignupHint;
    } else {
      try {
        const { data: existingSbUser } = await supabase
          .from('users')
          .select('email')
          .eq('email', normalizedEmail)
          .maybeSingle();
        if (existingSbUser) {
          isNewUser = false;
        }
      } catch (err) {
        console.warn('[AuthService] Error checking user in local table:', err);
      }
    }

    let verifyTypeHint: 'signup' | 'email' | 'magiclink' = isNewUser ? 'signup' : 'email';
    try {
      const typeRes = await fetch(`/api/auth/otp-type?email=${encodeURIComponent(normalizedEmail)}`);
      if (typeRes.ok && typeRes.headers.get('content-type')?.includes('application/json')) {
        const typeData = await typeRes.json();
        if (typeData && typeData.type) {
          verifyTypeHint = typeData.type;
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error checking OTP type with server:', err);
    }

    const verificationTypes: Array<'signup' | 'email' | 'magiclink'> = verifyTypeHint === 'signup'
      ? ['email', 'signup', 'magiclink']
      : [verifyTypeHint, 'email', 'signup', 'magiclink'];

    const uniqueTypes = Array.from(new Set(verificationTypes)) as Array<'signup' | 'email' | 'magiclink'>;

    console.log(`[AuthService] Verifying OTP for ${normalizedEmail} with fallback sequence:`, uniqueTypes);

    let supabaseAuthSession = null;
    let lastError: any = null;

    for (const currentType of uniqueTypes) {
      try {
        console.log(`[AuthService] Calling verifyOtp with type: ${currentType}`);
        const { data: resData, error: resError } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: cleanOtp,
          type: currentType,
        });

        if (!resError && resData?.user) {
          console.log(`[AuthService] verifyOtp succeeded with type: ${currentType}!`);
          supabaseAuthSession = resData;
          lastError = null;
          break;
        } else {
          lastError = resError || new Error(`No user returned for type ${currentType}`);
          console.log(`[AuthService] verifyOtp failed for type ${currentType}:`, lastError.message || lastError);
        }
      } catch (err: any) {
        lastError = err;
        console.log(`[AuthService] verifyOtp threw exception for type ${currentType}:`, err);
      }
    }

    if (lastError || !supabaseAuthSession) {
      throw new Error(lastError?.message || 'Verification token is invalid or has expired');
    }

    console.log("[AuthService] Supabase OTP verification succeeded securely.");

    const accessToken = supabaseAuthSession.session?.access_token;
    if (!accessToken) {
      throw new Error('Supabase login completed but no authenticated token was provided.');
    }

    try {
      localStorage.setItem('frostybite_active_session_email', normalizedEmail);
      localStorage.setItem('frostybite_has_active_session', 'true');
    } catch (e) {}

    // Sync profile
    try {
      await this.syncUserWithDatabase(supabaseAuthSession.user);
    } catch (err) {}

    return {
      user: {
        uid: supabaseAuthSession.user?.id || 'sb-user',
        email: normalizedEmail,
        displayName: normalizedEmail.split('@')[0],
        emailVerified: true,
        getIdToken: async () => accessToken,
        reload: async () => {},
      }
    };
  },

  // Google Login via Firebase OAuth
  async loginWithGoogle() {
    const { signInWithPopup } = await import('firebase/auth');
    const { auth, googleProvider } = await import('../firebase');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error: any) {
      console.error('[Firebase OAuth] signInWithPopup failed:', error);
      throw error;
    }
  },

  // Password Reset
  async forgotPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(safeTrimLowerCase(email), {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) throw error;
  },

  // Secure client-side wrapper to reset custom password via verified OTP code
  async resetPasswordWithOTP(email: string, otp: string, newPassword: string) {
    const res = await safeFetchJson('/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp, newPassword }),
    });

    const data = res.data;
    if (!res.ok || !data?.success) {
      throw new Error(res.error || data?.error || 'Password reset failed.');
    }
    return data;
  },

  // Sync user profile directly in Supabase Postgres
  async syncUserWithDatabase(user: any, name?: string) {
    try {
      const userEmail = safeTrimLowerCase(user.email);
      const sbUid = user.id || user.uid;

      let { data: existingDbUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      const determinedRole = getRoleFromEmail(userEmail);
      const nameVal = name || user.user_metadata?.full_name || user.user_metadata?.name || user.displayName || userEmail.split('@')[0];
      const photoURL = user.user_metadata?.avatar_url || user.photoURL || null;

      if (existingDbUser) {
        const updates: any = {
          last_login: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        };

        if (existingDbUser.email !== userEmail) {
          updates.email = userEmail;
        }
        if (nameVal && (!existingDbUser.name || existingDbUser.name === existingDbUser.email.split('@')[0])) {
          updates.name = nameVal;
          updates.full_name = nameVal;
        }
        if (photoURL && !existingDbUser.avatar_url) {
          updates.avatar_url = photoURL;
          updates.avatar = photoURL;
        }
        if (sbUid && existingDbUser.supabase_uid !== sbUid) {
          updates.supabase_uid = sbUid;
        }

        await supabase
          .from('users')
          .update(updates)
          .eq('id', existingDbUser.id);
      } else {
        const insertPayload: any = {
          email: userEmail,
          name: nameVal,
          full_name: nameVal,
          avatar_url: photoURL,
          avatar: photoURL,
          role: determinedRole,
          supabase_uid: sbUid,
          auth_methods: ['otp'],
          last_login: new Date().toISOString(),
          last_login_at: new Date().toISOString()
        };

        await supabase
          .from('users')
          .insert(insertPayload);
      }
    } catch (error) {
       console.error('[AuthService] Supabase client sync error:', error);
    }
  },

  // Sign out
  logout
};
