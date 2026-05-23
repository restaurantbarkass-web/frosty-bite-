import express from 'express';
import { getAdminDb, getAdminAuth } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';

const router = express.Router();

const ADMIN_EMAILS = [
  "restaurantbarkass@gmail.com",
  "wasifmd924@gmail.com",
  "sayedazainab216@gmail.com",
  "sayedazainabali76@gmail.com"
];

const CONFIG_DOC_PATH = 'settings/appConfig';

/**
 * Helper to authenticate and verify user is an Admin
 */
async function isAdmin(req: express.Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) return false;

  let email: string | undefined = undefined;

  // 1. Try Firebase Auth Verification
  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    email = decoded.email;
  } catch (fbError: any) {
    // If it fails, probably a Supabase token, continue to Supabase
  }

  // 2. Try Supabase Auth Verification
  if (!email) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        email = user.email;
      }
    } catch (sbError: any) {
      // Ignored
    }
  }

  if (email) {
    const normEmail = email.trim().toLowerCase();
    return ADMIN_EMAILS.includes(normEmail);
  }

  return false;
}

/**
 * GET /api/config
 * Retrieves the current app configuration directly and exclusively from the Supabase DB
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('address')
      .eq('email', 'system_settings_v1@frostybite.internal')
      .maybeSingle();

    if (!error && data && data.address) {
      try {
        return res.json(JSON.parse(data.address));
      } catch (jsonErr) {
        // Fallback if parsing failed
      }
    }

    // Default configuration if not yet created in Supabase SQL DB
    const defaultData = {
      isOrderingOpen: true,
      deliveryBaseFee: 15,
      deliveryFeePerKm: 5,
      deliveryFreeKm: 3
    };
    return res.json(defaultData);
  } catch (error: any) {
    console.error('[ConfigRoutes] Error fetching config from Supabase:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/config
 * Unifies updating app configuration securely in the Supabase DB.
 */
router.post('/', async (req, res) => {
  try {
    const isUserAdmin = await isAdmin(req);
    if (!isUserAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin permissions required to change settings' });
    }

    const payload = req.body;
    const updatedConfig = {
      ...payload,
      updated_at: new Date()
    };

    const { data: existing, error: fetchErr } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'system_settings_v1@frostybite.internal')
      .maybeSingle();

    if (fetchErr) {
      throw new Error(`Failed to check existing config: ${fetchErr.message}`);
    }

    const configString = JSON.stringify(updatedConfig);

    if (existing) {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ address: configString, updated_at: new Date().toISOString() })
        .eq('email', 'system_settings_v1@frostybite.internal');

      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from('users')
        .insert({
          email: 'system_settings_v1@frostybite.internal',
          name: 'System Settings',
          address: configString,
          role: 'customer'
        });

      if (insertErr) throw insertErr;
    }

    console.log('[ConfigRoutes] Configuration successfully updated in Supabase database');
    res.json({ success: true, config: updatedConfig });
  } catch (error: any) {
    console.error('[ConfigRoutes] Error setting config in Supabase:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;
