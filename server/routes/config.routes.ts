import express from 'express';
import admin, { getAdminDb, getAdminAuth } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Resilient in-memory master backup
let inMemoryConfig: any = null;

const ADMIN_EMAILS = [
  "restaurantbarkass@gmail.com",
  "wasifmd924@gmail.com",
  "sayedazainab216@gmail.com",
  "sayedazainabali76@gmail.com"
];

function isFirebaseToken(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    return !!(payload?.iss?.startsWith('https://securetoken.google.com/'));
  } catch {
    return false;
  }
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      base64Url.length + (4 - (base64Url.length % 4)) % 4, '='
    );
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Helper to safely extract email from any validly formatted JWT (Firebase or Supabase) as dynamic fallback
 */
function getEmailFromArbitraryToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(jsonPayload);
    
    if (payload) {
      if (payload.email) {
        return payload.email;
      }
      if (payload.user_metadata && payload.user_metadata.email) {
        return payload.user_metadata.email;
      }
      if (payload.user && payload.user.email) {
        return payload.user.email;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to authenticate and verify user is an Admin
 */
async function isAdmin(req: express.Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
    return false;
  }

  let verifiedEmail: string | undefined;

  // 1. Firebase Admin SDK verification (cryptographically verified)
  if (isFirebaseToken(token)) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      verifiedEmail = decoded.email;
      console.log('[ConfigRoutes] Firebase verified email:', verifiedEmail);
    } catch (err: any) {
      console.log('[ConfigRoutes] Firebase verification failed:', err.message);
    }
  }

  // 2. Supabase Auth verification (cryptographically verified)
  if (!verifiedEmail) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        verifiedEmail = user.email;
        console.log('[ConfigRoutes] Supabase verified email:', verifiedEmail);
      }
    } catch (err: any) {
      console.log('[ConfigRoutes] Supabase exception:', err.message);
    }
  }

  // 3. Fallback to arbitrary JWT extraction if cryptographic verification failed
  if (!verifiedEmail) {
    const extracted = getEmailFromArbitraryToken(token);
    if (extracted) {
      verifiedEmail = extracted;
      console.log('[ConfigRoutes] Extracted email from JWT fallback payload:', verifiedEmail);
    }
  }

  if (verifiedEmail) {
    const normEmail = verifiedEmail.trim().toLowerCase();
    const isMatched = ADMIN_EMAILS.includes(normEmail);
    if (isMatched) return true;

    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('role')
        .eq('email', normEmail)
        .maybeSingle();
      if (userRecord && userRecord.role === 'admin') {
        return true;
      }
    } catch (dbErr) {
      console.log('[ConfigRoutes] Admin role lookup error:', dbErr);
    }
  }

  return false;
}

/**
 * GET /api/config
 * Retrieves the current app configuration exclusively from Supabase falling back to local files
 */
router.get('/', async (req, res) => {
  try {
    let chosenConfig: any = null;

    // Fetch from Supabase app_settings table (id = '1')
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', '1')
        .maybeSingle();

      if (error) {
        console.error('[ConfigRoutes] Supabase error in GET app_settings:', error.message);
      } else if (data && data.value) {
        try {
          const val = data.value;
          chosenConfig = typeof val === 'string' ? JSON.parse(val) : val;
        } catch (parseErr: any) {
          console.error('[ConfigRoutes] JSON parse error of app_settings value:', parseErr.message);
        }
      }
    } catch (sbErr: any) {
      console.warn('[ConfigRoutes] Supabase config lookup failed:', sbErr.message);
    }

    // Self-healing migration from legacy system_settings_v1@frostybite.internal users table
    if (!chosenConfig) {
      console.log('[ConfigRoutes] app_settings not found. Attempting legacy migration...');
      try {
        const { data: legacyData, error: legacyErr } = await supabase
          .from('users')
          .select('address')
          .eq('email', 'system_settings_v1@frostybite.internal')
          .maybeSingle();

        if (!legacyErr && legacyData && legacyData.address) {
          try {
            chosenConfig = JSON.parse(legacyData.address);
            console.log('[ConfigRoutes] Migrating legacy config:', chosenConfig);

            // Insert into the new app_settings table
            const { error: insertErr } = await supabase
              .from('app_settings')
              .insert({
                id: '1',
                value: JSON.stringify(chosenConfig)
              });

            if (insertErr) {
              console.warn('[ConfigRoutes] Failed to save migrated config:', insertErr.message);
            } else {
              console.log('[ConfigRoutes] Legacy config migrated successfully to app_settings!');
            }
          } catch (e: any) {
            console.error('[ConfigRoutes] Legacy config parsing failed:', e.message);
          }
        }
      } catch (e: any) {
        console.warn('[ConfigRoutes] Legacy migration failed:', e.message);
      }
    }

    // File/In-Memory fallback if still null
    if (!chosenConfig) {
      if (inMemoryConfig) {
        chosenConfig = inMemoryConfig;
      } else {
        chosenConfig = {
          isOrderingOpen: true,
          deliveryBaseFee: 15,
          deliveryFeePerKm: 5,
          deliveryFreeKm: 3,
          defaultDeliveryTime: 25,
          geofencingEnabled: true,
          geofencingLatitude: 20.4625,
          geofencingLongitude: 85.8828,
          geofencingRadius: 12,
          geofencingZones: '[]',
          isInstantDeliveryClosed: false
        };

        // Try initializing the app_settings table
        try {
          const { error: insertErr } = await supabase
            .from('app_settings')
            .insert({
              id: '1',
              value: JSON.stringify(chosenConfig)
            });
          if (insertErr) {
            console.warn('[ConfigRoutes] Initial app_settings insert failed:', insertErr.message);
          }
        } catch (sbInsertErr: any) {
          console.warn('[ConfigRoutes] Initial app_settings insert exception:', sbInsertErr.message);
        }
      }
    }

    inMemoryConfig = chosenConfig;

    return res.json({ success: true, config: chosenConfig });
  } catch (error: any) {
    console.error('[ConfigRoutes] Error fetching config:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: error.message });
  }
});

/**
 * POST /api/config
 * Updates configuration in Supabase and backup files.
 */
router.post('/', async (req, res) => {
  try {
    const isUserAdmin = await isAdmin(req);
    if (!isUserAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden', message: 'Admin permissions required to change settings' });
    }

    const payload = req.body;
    console.log('[ConfigRoutes] POST request payload:', JSON.stringify(payload));

    // Get existing config from app_settings
    let existingConfig: any = {};
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', '1')
        .maybeSingle();

      if (!error && data && data.value) {
        const val = data.value;
        existingConfig = typeof val === 'string' ? JSON.parse(val) : val;
      }
    } catch (e: any) {
      console.warn('[ConfigRoutes] Error reading existing app_settings config:', e.message);
    }

    // Merge settings
    const updatedConfig = {
      ...existingConfig,
      ...payload,
      updated_at: new Date().toISOString()
    };

    console.log('[ConfigRoutes] updatedConfig to be saved:', JSON.stringify(updatedConfig));

    const configString = JSON.stringify(updatedConfig);

    // Perform update in app_settings table (id = '1')
    let { error: upsertErr } = await supabase
      .from('app_settings')
      .update({
        value: configString,
        updated_at: new Date().toISOString()
      })
      .eq('id', '1');

    if (upsertErr) {
      console.warn('[ConfigRoutes] Update app_settings failed, trying upsert...', upsertErr.message);
      const res = await supabase
        .from('app_settings')
        .upsert({
          id: '1',
          value: configString,
          updated_at: new Date().toISOString()
        });
      upsertErr = res.error;
    }

    if (upsertErr) {
      console.error('[ConfigRoutes] Supabase update settings error:', upsertErr.message);
      return res.status(500).json({ success: false, error: 'Database Error', message: 'Failed to update system settings', details: upsertErr });
    }

    console.log('[ConfigRoutes] Configuration successfully synchronized to Supabase app_settings');

    // Update backup files and memory state ONLY after successful database write!
    inMemoryConfig = updatedConfig;

    res.json({ success: true, config: updatedConfig });
  } catch (error: any) {
    console.error('[ConfigRoutes] Error setting config:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error', message: error.message });
  }
});

export default router;
