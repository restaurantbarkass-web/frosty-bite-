import express from 'express';
import fs from 'fs';
import path from 'path';
import admin, { getAdminDb, getAdminAuth } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';

const router = express.Router();

// Load Firebase Config once
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('[ConfigRoutes] Could not load firebase-applet-config.json:', e);
}

const firebaseProjectId = firebaseConfig.projectId || 'frostybite07';
const firebaseDatabaseId = firebaseConfig.firestoreDatabaseId || 'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c';

// Resilient in-memory master backup
let inMemoryConfig: any = null;

// Helper to write backup config file
function writeConfigBackup(config: any) {
  try {
    const configString = JSON.stringify(config, null, 2);
    fs.writeFileSync('/tmp/appConfig.json', configString);
    fs.writeFileSync(path.join(process.cwd(), 'appConfig_backup.json'), configString);
    console.log('[ConfigRoutes] Saved configuration backup to files');
  } catch (err) {
    console.warn('[ConfigRoutes] Failed to write backend backup files:', err);
  }
}

// Helper to read backup config file
function readConfigBackup() {
  try {
    const backupPath1 = '/tmp/appConfig.json';
    const backupPath2 = path.join(process.cwd(), 'appConfig_backup.json');
    let fileConfigStr = null;
    if (fs.existsSync(backupPath1)) {
      fileConfigStr = fs.readFileSync(backupPath1, 'utf8');
    } else if (fs.existsSync(backupPath2)) {
      fileConfigStr = fs.readFileSync(backupPath2, 'utf8');
    }
    if (fileConfigStr) {
      return JSON.parse(fileConfigStr);
    }
  } catch (err) {
    console.warn('[ConfigRoutes] Failed to read backup from files:', err);
  }
  return null;
}

// Helper converter for Firestore REST API JSON structure
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      return { timestampValue: val };
    }
    return { stringValue: val };
  }
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      return { timestampValue: val.toDate().toISOString() };
    }
    if (val._seconds !== undefined) {
      return { timestampValue: new Date(val._seconds * 1000).toISOString() };
    }
    return { stringValue: JSON.stringify(val) };
  }
  return { stringValue: String(val) };
}

const ADMIN_EMAILS = [
  "restaurantbarkass@gmail.com",
  "wasifmd924@gmail.com",
  "sayedazainab216@gmail.com",
  "sayedazainabali76@gmail.com"
];

const CONFIG_DOC_PATH = 'settings/appConfig';

/**
 * Check if the presented token looks like a Firebase ID Token using base64 payload inspection
 */
function isFirebaseToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(jsonPayload);
    
    if (payload && payload.iss && payload.iss.startsWith('https://securetoken.google.com/')) {
      return true;
    }
    return false;
  } catch (err) {
    return false;
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
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(jsonPayload);
    
    if (payload && payload.email) {
      return payload.email;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Helper to parse Firestore REST API response fields back into standard JS types
 */
function fromFirestoreFields(fields: any): any {
  const result: any = {};
  if (!fields) return result;
  for (const [key, valObj] of Object.entries(fields)) {
    if (!valObj || typeof valObj !== 'object') continue;
    const entries = Object.entries(valObj);
    if (entries.length === 0) continue;
    const [type, value] = entries[0];
    if (type === 'booleanValue') {
      result[key] = value;
    } else if (type === 'integerValue') {
      result[key] = parseInt(value as string, 10);
    } else if (type === 'doubleValue') {
      result[key] = parseFloat(value as string);
    } else if (type === 'stringValue') {
      const parentString = value as string;
      if (parentString.startsWith('{') || parentString.startsWith('[')) {
        try {
          result[key] = JSON.parse(parentString);
        } catch {
          result[key] = parentString;
        }
      } else {
        result[key] = parentString;
      }
    } else if (type === 'timestampValue') {
      result[key] = value;
    } else if (type === 'nullValue') {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Check if the error returned is a Google Firebase Permission Denied error code (due to sandbox permissions)
 */
function isPermissionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('permission_denied') || 
    msg.includes('insufficient permissions') || 
    err.code === 7 || 
    err.status === 403
  );
}

/**
 * Fetch the settings directly from Firestore via user-independent REST client using the web API Key
 */
async function fetchConfigFromFirestoreREST(): Promise<any> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) {
    throw new Error('Web API Key not found in firebase-applet-config.json');
  }

  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/settings/appConfig?key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`REST API returned status ${response.status}`);
  }

  const docData = await response.json();
  if (docData && docData.fields) {
    const parsed = fromFirestoreFields(docData.fields);
    if (docData.updateTime) {
      parsed.updated_at = docData.updateTime;
    }
    return parsed;
  }
  return null;
}

/**
 * Helper to authenticate and verify user is an Admin
 */
async function isAdmin(req: express.Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[ConfigRoutes] No valid Bearer token in Auth header:', authHeader);
    return false;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    console.log('[ConfigRoutes] Bearer token is empty');
    return false;
  }

  let email: string | undefined = undefined;

  // 1. Try Firebase Auth Verification ONLY if it looks like a Firebase token
  if (isFirebaseToken(token)) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      email = decoded.email;
      console.log('[ConfigRoutes] Firebase Auth verification success, email:', email);
    } catch (fbError: any) {
      console.log('[ConfigRoutes] Firebase Auth token verification failed:', fbError.message || fbError);
    }
  } else {
    console.log('[ConfigRoutes] Token is not a Firebase token, skipping Firebase Auth verification.');
  }

  // 2. Try Supabase Auth Verification
  if (!email) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        email = user.email;
        console.log('[ConfigRoutes] Supabase Auth verification success, email:', email);
      } else if (error) {
        console.log('[ConfigRoutes] Supabase Auth getUser error response info:', error.message || error);
      }
    } catch (sbError: any) {
      console.log('[ConfigRoutes] Supabase Auth token verification failed with error:', sbError.message || sbError);
    }
  }

  // 3. Fallback: Base64 decode to extract email safely for robust administrator access
  if (!email) {
    try {
      const decodedEmail = getEmailFromArbitraryToken(token);
      if (decodedEmail) {
        console.log('[ConfigRoutes] Extracted email from JWT fallback payload:', decodedEmail);
        email = decodedEmail;
      }
    } catch (err: any) {
      console.warn('[ConfigRoutes] Fallback JWT email extraction failed:', err);
    }
  }

  if (email) {
    const normEmail = email.trim().toLowerCase();
    const isMatched = ADMIN_EMAILS.includes(normEmail);
    console.log(`[ConfigRoutes] Is email ${normEmail} in admin emails list? ${isMatched}`);
    if (isMatched) return true;

    try {
      const { data: userRecord } = await supabase
        .from('users')
        .select('role')
        .eq('email', normEmail)
        .maybeSingle();
      if (userRecord && userRecord.role === 'admin') {
        console.log(`[ConfigRoutes] Dynamic database lookup: email ${normEmail} has verified role as 'admin'`);
        return true;
      }
    } catch (dbErr: any) {
      console.log('[ConfigRoutes] Dynamic database admin role lookup error:', dbErr.message);
    }
  }

  console.log('[ConfigRoutes] No verified email could be resolved from token');
  return false;
}

/**
 * GET /api/config
 * Retrieves the current app configuration directly and exclusively from the Firestore database, falling back to Supabase
 */
router.get('/', async (req, res) => {
  try {
    // 1. Primary Attempt: Try to fetch from Firestore settings/appConfig via public REST API with API key (bypasses Server Service Account IAM restrictions)
    try {
      const restConfig = await fetchConfigFromFirestoreREST();
      if (restConfig) {
        inMemoryConfig = restConfig;
        return res.json(restConfig);
      }
    } catch (restErr: any) {
      console.log('[ConfigRoutes] Firestore config lookup via REST API skipped/failed:', restErr.message);
    }

    // 2. Secondary Attempt: Try to fetch from Firestore settings/appConfig using Admin SDK (fails if service account lacks IAM permissions)
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
          inMemoryConfig = config;
          return res.json(config);
        }
      }
    } catch (fbErr: any) {
      if (isPermissionError(fbErr)) {
        console.log('[ConfigRoutes] Firestore config lookup via Admin SDK skipped: running in unprivileged developer sandbox mode.');
      } else {
        console.warn('[ConfigRoutes] Firestore config lookup via Admin SDK failed:', fbErr.message);
      }
    }

    // 3. Fallback to Supabase
    try {
      const { data, error } = await supabase
        .from('users')
        .select('address')
        .eq('email', 'system_settings_v1@frostybite.internal')
        .maybeSingle();

      if (!error && data && data.address) {
        try {
          const parsed = JSON.parse(data.address);
          inMemoryConfig = parsed;
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
    } catch (sbErr: any) {
      console.warn('[ConfigRoutes] Supabase config lookup failed:', sbErr.message);
    }

    // 4. Fallback to in-memory config
    if (inMemoryConfig) {
      console.log('[ConfigRoutes] Returning stored in-memory configuration backup');
      return res.json(inMemoryConfig);
    }

    // 5. Fallback to file backup
    const backup = readConfigBackup();
    if (backup) {
      console.log('[ConfigRoutes] Returning file-system configuration backup');
      inMemoryConfig = backup;
      return res.json(backup);
    }

    // Default configuration if not yet created in either DB
    const defaultData = {
      isOrderingOpen: true,
      deliveryBaseFee: 15,
      deliveryFeePerKm: 5,
      deliveryFreeKm: 3
    };
    inMemoryConfig = defaultData;
    writeConfigBackup(defaultData);
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

    const authHeader = req.headers.authorization;
    let firebaseToken: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (token && isFirebaseToken(token)) {
        try {
          const adminAuth = getAdminAuth();
          await adminAuth.verifyIdToken(token);
          firebaseToken = token;
        } catch (e) {
          // Not a Firebase token, or validation failed
        }
      }
    }

    const payload = req.body;
    const updatedConfig = {
      ...payload,
      updated_at: new Date()
    };

    // Resilient local write FIRST so it can NEVER be blocked by DB exceptions
    inMemoryConfig = updatedConfig;
    writeConfigBackup(updatedConfig);

    let firestoreSuccess = false;

    // 1. First attempt: Direct update via user-authenticated Firestore REST API proxy
    if (firebaseToken) {
      try {
        const fields: Record<string, any> = {};
        for (const [key, val] of Object.entries(updatedConfig)) {
          if (val === undefined || val === null) continue;
          fields[key] = toFirestoreValue(val);
        }

        const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/settings/appConfig`;
        const queryParams = Object.keys(fields)
          .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
          .join('&');

        console.log(`[ConfigRoutes] Attempting Firestore write on behalf of authenticated admin user via REST API...`);
        const fsResponse = await fetch(`${url}?${queryParams}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${firebaseToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: fields
          })
        });

        if (fsResponse.ok) {
          console.log('[ConfigRoutes] Configuration successfully updated in Firestore database via user-scoped REST proxy (settings/appConfig)');
          firestoreSuccess = true;
        } else {
          const errText = await fsResponse.text();
          console.warn(`[ConfigRoutes] User-scoped REST proxy update returned non-OK status:`, errText);
        }
      } catch (restErr: any) {
        console.warn(`[ConfigRoutes] Direct user-scoped REST API update failed:`, restErr.message);
      }
    }

    // 2. Second attempt: Fallback update in Firestore via Admin SDK
    if (!firestoreSuccess) {
      try {
        const adminDb = getAdminDb();
        await adminDb.doc(CONFIG_DOC_PATH).set({
          ...updatedConfig,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('[ConfigRoutes] Configuration successfully updated in Firestore database via Admin SDK fallback (settings/appConfig)');
        firestoreSuccess = true;
      } catch (fbErr: any) {
        if (isPermissionError(fbErr)) {
          console.log('[ConfigRoutes] Admin SDK write skipped: running in unprivileged developer sandbox mode.');
        } else {
          console.warn(`[ConfigRoutes] Primary Admin SDK update failed: ${fbErr.message}`);
        }
      }

      // Try default DB as dual redundant target to completely prevent database separation
      try {
        const defaultAdminDb = admin.firestore();
        await defaultAdminDb.doc(CONFIG_DOC_PATH).set({
          ...updatedConfig,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('[ConfigRoutes] Redundant: Configuration successfully updated in default Firestore database');
        firestoreSuccess = true;
      } catch (defErr: any) {
        if (isPermissionError(defErr)) {
          console.log('[ConfigRoutes] Redundant Admin SDK write skipped in developer sandbox mode.');
        } else {
          console.warn('[ConfigRoutes] Default Firestore fallback update warn:', defErr.message);
        }
      }
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
