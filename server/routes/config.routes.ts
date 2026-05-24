import express from 'express';
import admin, { getAdminDb, getAdminAuth } from '../lib/firebase-admin';
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
 * Retrieves the current app configuration directly and exclusively from the Firestore database, falling back to Supabase
 */
router.get('/', async (req, res) => {
  try {
    // 1. Try to fetch from Firestore settings/appConfig first (primary real-time source)
    try {
      const adminDb = getAdminDb();
      const docSnap = await adminDb.doc(CONFIG_DOC_PATH).get();
      if (docSnap.exists) {
        const rawData = docSnap.data();
        if (rawData) {
          const config = { ...rawData };
          // Convert Firestore timestamp to ISO string for standard JSON delivery
          if (config.updated_at && typeof config.updated_at.toDate === 'function') {
            config.updated_at = config.updated_at.toDate().toISOString();
          }
          return res.json(config);
        }
      }
    } catch (fbErr: any) {
      console.warn('[ConfigRoutes] Firestore config lookup failed, trying Supabase fallback:', fbErr.message);
    }

    // 2. Fallback to Supabase
    const { data, error } = await supabase
      .from('users')
      .select('address')
      .eq('email', 'system_settings_v1@frostybite.internal')
      .maybeSingle();

    if (!error && data && data.address) {
      try {
        const parsed = JSON.parse(data.address);
        // Sync Supabase config to Firestore so Firestore is populated
        try {
          const adminDb = getAdminDb();
          await adminDb.doc(CONFIG_DOC_PATH).set({
            ...parsed,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('[ConfigRoutes] Backfilled Firestore settings/appConfig from Supabase');
        } catch (syncErr) {
          // Suppressed
        }
        return res.json(parsed);
      } catch (jsonErr) {
        // Fallback if parsing failed
      }
    }

    // Default configuration if not yet created in either DB
    const defaultData = {
      isOrderingOpen: true,
      deliveryBaseFee: 15,
      deliveryFeePerKm: 5,
      deliveryFreeKm: 3
    };
    return res.json(defaultData);
  } catch (error: any) {
    console.error('[ConfigRoutes] Error fetching config from database:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/config
 * Unifies updating app configuration securely in both Firestore and Supabase databases.
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

    // 1. Update in Firestore settings/appConfig document (primary real-time source)
    try {
      const adminDb = getAdminDb();
      await adminDb.doc(CONFIG_DOC_PATH).set({
        ...updatedConfig,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('[ConfigRoutes] Configuration successfully updated in Firestore database (settings/appConfig)');
    } catch (fbErr: any) {
      console.error('[ConfigRoutes] Failed to update config in Firestore:', fbErr.message);
    }

    // 2. Update in Supabase for relational continuity
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'system_settings_v1@frostybite.internal')
        .maybeSingle();

      if (!fetchErr) {
        const configString = JSON.stringify(updatedConfig);

        if (existing) {
          await supabase
            .from('users')
            .update({ address: configString, updated_at: new Date().toISOString() })
            .eq('email', 'system_settings_v1@frostybite.internal');
        } else {
          await supabase
            .from('users')
            .insert({
              email: 'system_settings_v1@frostybite.internal',
              name: 'System Settings',
              address: configString,
              role: 'customer'
            });
        }
        console.log('[ConfigRoutes] Configuration successfully synchronized to Supabase database');
      }
    } catch (sbErr: any) {
      console.error('[ConfigRoutes] Failed to synchronize config update to Supabase:', sbErr.message);
    }

    res.json({ success: true, config: updatedConfig });
  } catch (error: any) {
    console.error('[ConfigRoutes] Error setting config:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;
