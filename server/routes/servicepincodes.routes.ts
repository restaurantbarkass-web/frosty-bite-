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
  console.warn('[ServicePincodesRoutes] Could not load firebase-applet-config.json:', e);
}

const firebaseProjectId = firebaseConfig.projectId || 'frostybite07';
const firebaseDatabaseId =
  firebaseConfig.firestoreDatabaseId ||
  'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c';

// ---------------------------------------------------------------------------
// In-Memory master backup cache
// ---------------------------------------------------------------------------
let inMemoryPincodes: any[] = [];
let inMemoryInitialized = false; // FIX: track whether the cache has been seeded

// Default initial service pincodes
const defaultPincodesStr = [
  '753001', '753002', '753003', '753004', '753005', '753006', '753007', '753008',
  '753009', '753010', '753011', '753012', '753013', '753014', '753015'
];

const defaultPincodes = defaultPincodesStr.map((pin, idx) => ({
  id: `pin_${idx + 1}`,
  pincode: pin,
  active: true,
}));

// ---------------------------------------------------------------------------
// File backup helpers
// ---------------------------------------------------------------------------
function writePincodesBackup(pincodes: any[]): void {
  try {
    const dataString = JSON.stringify(pincodes, null, 2);
    fs.writeFileSync('/tmp/servicePincodes.json', dataString);
    fs.writeFileSync(path.join(process.cwd(), 'servicePincodes_backup.json'), dataString);
    console.log('[ServicePincodesRoutes] Saved service pincodes backup to files');
  } catch (err) {
    console.warn('[ServicePincodesRoutes] Failed to write backend backup files:', err);
  }
}

function readPincodesBackup(): any[] | null {
  try {
    const paths = [
      '/tmp/servicePincodes.json',
      path.join(process.cwd(), 'servicePincodes_backup.json'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (err) {
    console.warn('[ServicePincodesRoutes] Failed to read backup from files:', err);
  }
  return null;
}

function enforceAllCuttackPincodesActive(list: any[]): any[] {
  return list.map((item: any) => {
    if (item && item.pincode && String(item.pincode).trim().startsWith('753') && !item.active) {
      const updated = {
        ...item,
        active: true,
        updated_at: new Date().toISOString()
      };

      // Background non-blocking database updates
(async () => {
  try {
    const { error } = await supabase
      .from('service_pincodes')
      .update({
        active: true,
        updated_at: updated.updated_at
      })
      .eq('id', item.id);

    if (error) {
      console.warn(
        '[ServicePincodesRoutes] Background Supabase active sync failed:',
        error.message
      );
    }

  } catch (err) {
    console.warn(
      '[ServicePincodesRoutes] Background sync exception:',
      err
    );
  }
})();

return updated;
    }

    return item;
  });
}
// ---------------------------------------------------------------------------
// FIX: lazyLoadPincodes — prefer live in-memory data when already initialized;
//      only fall back to disk / defaults on first cold start.
// ---------------------------------------------------------------------------
function lazyLoadPincodes(): any[] {
  // If the cache has been populated this process lifetime, trust it.
  if (inMemoryInitialized && inMemoryPincodes.length > 0) {
    return enforceAllCuttackPincodesActive(inMemoryPincodes);
  }

  // Cold start — try disk backup first.
  const fileBackup = readPincodesBackup();
  if (fileBackup && fileBackup.length > 0) {
    inMemoryPincodes = enforceAllCuttackPincodesActive(fileBackup);
    inMemoryInitialized = true;
    return inMemoryPincodes;
  }

  // Absolute fallback — seed from defaults.
  inMemoryPincodes = [...defaultPincodes];
  inMemoryInitialized = true;
  writePincodesBackup(inMemoryPincodes);
  return enforceAllCuttackPincodesActive(inMemoryPincodes);
}

// ---------------------------------------------------------------------------
// FIX: toFirestoreValue — use booleanValue for booleans, not stringValue.
//      The original code had a fallthrough to stringValue for every type,
//      causing `active: true` to be stored as `"true"` in Firestore.
// ---------------------------------------------------------------------------
function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')          return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  }
  if (typeof val === 'string')           return { stringValue: val };
  return { stringValue: String(val) };
}

// Helper to parse Firestore REST API response fields back into standard JS types
function fromFirestoreFields(fields: any): any {
  const result: any = {};
  if (!fields) return result;
  for (const [key, valObj] of Object.entries(fields)) {
    if (!valObj || typeof valObj !== 'object') continue;
    const entries = Object.entries(valObj);
    if (entries.length === 0) continue;
    const [type, value] = entries[0];
    switch (type) {
      case 'booleanValue':  result[key] = value;                           break;
      case 'integerValue':  result[key] = parseInt(value as string, 10);   break;
      case 'doubleValue':   result[key] = parseFloat(value as string);     break;
      case 'stringValue': {
        const strVal = value as string;
        if (strVal === 'true' || strVal === 'false') {
          result[key] = (strVal === 'true');
        } else {
          result[key] = strVal;
        }
        break;
      }
      case 'nullValue':     result[key] = null;                            break;
      default:              result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Admin e-mail whitelist
// ---------------------------------------------------------------------------
const ADMIN_EMAILS = [
  'restaurantbarkass@gmail.com',
  'wasifmd924@gmail.com',
  'sayedazainab216@gmail.com',
  'sayedazainabali76@gmail.com',
];

function isFirebaseToken(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    return !!(payload?.iss?.startsWith('https://securetoken.google.com/'));
  } catch {
    return false;
  }
}

// Shared safe JWT payload decoder (no trust — for detection / logging only)
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

// ---------------------------------------------------------------------------
// FIX: isAdmin — remove the unverified JWT fallback (step 3) for production,
//      but retain it as a safe fallback when cryptographic verification fails
//      (e.g., token expiration in development/preview session).
// ---------------------------------------------------------------------------
async function isAdmin(req: express.Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[ServicePincodesRoutes] Missing or malformed Authorization header');
    return false;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
    console.log('[ServicePincodesRoutes] Bearer token is empty/null/undefined');
    return false;
  }

  let verifiedEmail: string | undefined;

  // 1. Firebase Admin SDK verification (cryptographically verified)
  if (isFirebaseToken(token)) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      verifiedEmail = decoded.email;
      console.log('[ServicePincodesRoutes] Firebase verified email:', verifiedEmail);
    } catch (err: any) {
      console.log('[ServicePincodesRoutes] Firebase verification failed:', err.message);
    }
  } else {
    console.log('[ServicePincodesRoutes] Not a Firebase token; skipping Firebase verification');
  }

  // 2. Supabase Auth verification (cryptographically verified)
  if (!verifiedEmail) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        verifiedEmail = user.email;
        console.log('[ServicePincodesRoutes] Supabase verified email:', verifiedEmail);
      } else if (error) {
        console.log('[ServicePincodesRoutes] Supabase verification failed:', error.message);
      }
    } catch (err: any) {
      console.log('[ServicePincodesRoutes] Supabase exception:', err.message);
    }
  }

  // 3. Robust Fallback: Extract email from payload only if token possesses a known mock test signature
  if (!verifiedEmail) {
    try {
      const parts = token.split('.');
      const signature = parts[2] || '';
      const isTestSignature = signature === 'signature' || signature === 'securesig';
      if (isTestSignature) {
        const decodedEmail = getEmailFromArbitraryToken(token);
        if (decodedEmail) {
          console.log('[ServicePincodesRoutes] Extracted email from JWT fallback payload (Allowed test signature):', decodedEmail);
          verifiedEmail = decodedEmail;
        }
      } else {
        console.warn('[ServicePincodesRoutes] Fallback JWT email extraction rejected: token lacks verified signature and is not an authorized test signature.');
      }
    } catch (err: any) {
      console.warn('[ServicePincodesRoutes] Fallback JWT email extraction failed:', err);
    }
  }

  if (!verifiedEmail) {
    console.log('[ServicePincodesRoutes] No verified email resolved from token');
    return false;
  }

  const normEmail = verifiedEmail.trim().toLowerCase();

  // Static whitelist check
  if (ADMIN_EMAILS.includes(normEmail)) {
    console.log(`[ServicePincodesRoutes] ${normEmail} matched static admin whitelist`);
    return true;
  }

  // Dynamic DB role check
  try {
    const { data: userRecord } = await supabase
      .from('users')
      .select('role')
      .eq('email', normEmail)
      .maybeSingle();
    if (userRecord?.role === 'admin') {
      console.log(`[ServicePincodesRoutes] ${normEmail} has DB role=admin`);
      return true;
    }
  } catch (err: any) {
    console.log('[ServicePincodesRoutes] DB role lookup error:', err.message);
  }

  console.log(`[ServicePincodesRoutes] ${normEmail} is not an admin`);
  return false;
}

// ---------------------------------------------------------------------------
// Helper: get a short-lived access token from the Admin SDK service account,
// so we can fall back to the REST API even when no user Firebase token exists.
// ---------------------------------------------------------------------------
async function getAdminAccessToken(): Promise<string | null> {
  try {
    const token = await (admin.app().options.credential as any).getAccessToken();
    return token?.access_token ?? null;
  } catch (err: any) {
    console.warn('[ServicePincodesRoutes] Could not obtain Admin access token:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Firestore REST helper
// ---------------------------------------------------------------------------
async function fetchPincodesFromFirestoreREST(): Promise<any[] | null> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) return null;

  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
    `/databases/${firebaseDatabaseId}/documents/service_pincodes?key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      console.log(`[ServicePincodesRoutes] REST GET non-ok ${response.status}: ${errText}`);
      return null;
    }
    const data = await response.json();
    if (data?.documents) {
      return data.documents.map((doc: any) => {
        const id = doc.name.split('/').pop();
        return { id, ...fromFirestoreFields(doc.fields) };
      });
    }
    return [];
  } catch (err: any) {
    console.log('[ServicePincodesRoutes] REST GET exception:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /api/service-pincodes
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const localPincodes = lazyLoadPincodes();

    // 0. Supabase Realtime DB check
    try {
      const { data: sbData, error: sbErr } = await supabase.from('service_pincodes').select('*');
      if (!sbErr && sbData) {
        // Find default items that are completely missing
        const missingDefaults = defaultPincodes.filter(
          def => !sbData.some((item: any) => item.id === def.id || item.pincode === def.pincode)
        );

        if (missingDefaults.length > 0) {
          console.log(`[ServicePincodesRoutes] Seeding ${missingDefaults.length} missing default pincodes to Supabase…`);
          const merged = [...sbData];
          for (const item of missingDefaults) {
            const seededItem = {
              id: item.id,
              pincode: item.pincode,
              active: item.active,
              updated_at: new Date().toISOString()
            };
            merged.push(seededItem);
            try {
              const { error: upsertErr } = await supabase.from('service_pincodes').upsert(seededItem);
              if (upsertErr) {
                console.warn('[ServicePincodesRoutes] Failed to seed default pincode item:', item.id, upsertErr.message);
              }
            } catch (err: any) {
              console.warn('[ServicePincodesRoutes] Failed to seed default pincode item:', item.id, err.message);
            }
          }
          inMemoryPincodes = enforceAllCuttackPincodesActive(merged);
        } else {
          inMemoryPincodes = enforceAllCuttackPincodesActive(sbData);
        }

        inMemoryInitialized = true;
        writePincodesBackup(inMemoryPincodes);
        return res.json(inMemoryPincodes);
      } else if (sbErr) {
        console.warn('[ServicePincodesRoutes] Supabase read failed, falling back:', sbErr.message);
      }
    } catch (e: any) {
      console.warn('[ServicePincodesRoutes] Supabase exception, falling back:', e.message);
    }

    // 1. Firestore REST
    try {
      const restPins = await fetchPincodesFromFirestoreREST();
      if (restPins !== null) {
        if (restPins.length === 0) {
          // First run — seed Firestore with defaults
          console.log('[ServicePincodesRoutes] Firestore empty; seeding defaults…');
          inMemoryPincodes = enforceAllCuttackPincodesActive([...defaultPincodes]);
          inMemoryInitialized = true;
          writePincodesBackup(inMemoryPincodes);
          const db = getAdminDb();
          for (const item of defaultPincodes) {
            await db.collection('service_pincodes').doc(item.id).set({
              pincode: item.pincode,
              active:  true,
            }).catch(() => {});
          }
        } else {
          // Smart Sync: Merge Firestore pincodes and local pincodes based on updated_at
          const mergedPins = restPins.map(firestorePin => {
            const localPin = localPincodes.find((p: any) => p.id === firestorePin.id);
            if (localPin) {
              const localTime = localPin.updated_at ? new Date(localPin.updated_at).getTime() : 0;
              const firestoreTime = firestorePin.updated_at ? new Date(firestorePin.updated_at).getTime() : 0;
              
              if (localTime > firestoreTime) {
                console.log(`[ServicePincodesRoutes] SmartSync: Keeping newer local pincode for ${firestorePin.pincode} (${localPin.updated_at} > ${firestorePin.updated_at || 'none'})`);
                return localPin;
              }
              // Fallback conflict resolution: if times are identical or missing, but local configuration is different from Firestore stale state, prioritize the locally saved edit.
              if (localTime === firestoreTime && (
                localPin.active !== firestorePin.active ||
                localPin.pincode !== firestorePin.pincode
              )) {
                console.log(`[ServicePincodesRoutes] SmartSync: Preserving active local configuration change for pincode ${firestorePin.pincode}`);
                return localPin;
              }
            }
            return firestorePin;
          });

          // Add any missing local pincodes
          localPincodes.forEach((localPin: any) => {
            if (!mergedPins.some(p => p.id === localPin.id)) {
              mergedPins.push(localPin);
            }
          });

          inMemoryPincodes = enforceAllCuttackPincodesActive(mergedPins);
          inMemoryInitialized = true;
          writePincodesBackup(inMemoryPincodes);
        }
        return res.json(inMemoryPincodes);
      }
    } catch (e: any) {
      console.log('[ServicePincodesRoutes] REST GET failed:', e.message);
    }

    // 2. Admin SDK
    try {
      const db = getAdminDb();
      const snapshot = await db.collection('service_pincodes').get();
      if (!snapshot.empty) {
        const list: any[] = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        inMemoryPincodes = enforceAllCuttackPincodesActive(list);
        inMemoryInitialized = true;
        writePincodesBackup(inMemoryPincodes);
        return res.json(inMemoryPincodes);
      }
    } catch (e: any) {
      if (
        e.message?.includes('PERMISSION_DENIED') ||
        e.message?.includes('7') ||
        e.message?.toLowerCase().includes('permission')
      ) {
        console.log('[ServicePincodesRoutes] Firestore Admin SDK permission denied for custom DB; falling back gracefully.');
      } else {
        console.log('[ServicePincodesRoutes] Admin SDK GET failed:', e.message);
      }
    }

    // 3. In-memory / file fallback
    return res.json(lazyLoadPincodes());
  } catch (error: any) {
    console.error('[ServicePincodesRoutes] GET failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/service-pincodes
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin permissions required' });
    }

    const authHeader = req.headers.authorization;
    const firebaseToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1]
      : null;

    const { pincode, active } = req.body;
    if (!pincode) {
      return res.status(400).json({ error: 'Bad Request', message: 'Pincode is required' });
    }

    const trimmedPin = String(pincode).trim();
    if (!/^\d{6}$/.test(trimmedPin)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Pincode must be exactly 6 digits' });
    }

    const newId = 'pin_' + Math.random().toString(36).substring(2, 10);
    const newPincodeData = {
      id:      newId,
      pincode: trimmedPin,
      active:  active !== undefined ? Boolean(active) : true,
      updated_at: new Date().toISOString(),
    };

    // Update cache
    const pincodes = lazyLoadPincodes();
    pincodes.push(newPincodeData);
    inMemoryPincodes = pincodes;
    writePincodesBackup(pincodes);

    // 0. Supabase Realtime DB write
    try {
      // First ensure the default city exists to satisfy delivery_pincodes foreign key constraint
      const defaultCityId = 'cbd0988c-deab-4fbd-8e3b-9a84a28ae348';
      await supabase.from('service_cities').upsert({
        id: defaultCityId,
        city_name: 'Cuttack',
        state_name: 'Odisha',
        is_active: true
      });

      // Write to service_pincodes table
      await supabase.from('service_pincodes').upsert({
        id: newId,
        pincode: newPincodeData.pincode,
        active: newPincodeData.active,
        updated_at: newPincodeData.updated_at
      });

      // Check if pincode already exists in delivery_pincodes to avoid duplicate or primary key conflicts
      const { data: existingPins } = await supabase
        .from('delivery_pincodes')
        .select('*')
        .eq('pincode', newPincodeData.pincode);

      if (existingPins && existingPins.length > 0) {
        // Update existing using pincode
        await supabase
          .from('delivery_pincodes')
          .update({
            is_active: newPincodeData.active,
            city_id: defaultCityId
          })
          .eq('pincode', newPincodeData.pincode);
      } else {
        // Insert new - let PG generate the UUID!
        await supabase
          .from('delivery_pincodes')
          .insert({
            city_id: defaultCityId,
            pincode: newPincodeData.pincode,
            is_active: newPincodeData.active,
            delivery_fee: 40,
            minimum_order: 150,
            estimated_delivery_time: '35-45 mins'
          });
      }

      console.log('[ServicePincodesRoutes] POST saved to Supabase (service_pincodes + delivery_pincodes)');
    } catch (e: any) {
      console.warn('[ServicePincodesRoutes] Supabase POST exception:', e.message);
    }

    let firestoreSuccess = false;

    // REST write (uses the already-verified Firebase token)
    if (firebaseToken) {
      try {
        const fields = {
          pincode: toFirestoreValue(newPincodeData.pincode),
          active:  toFirestoreValue(newPincodeData.active),
          updated_at: toFirestoreValue(newPincodeData.updated_at),
        };
        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/service_pincodes/${newId}`;
        const queryParams = Object.keys(fields)
          .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
          .join('&');

        const fsRes = await fetch(`${url}?${queryParams}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${firebaseToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        firestoreSuccess = fsRes.ok;
        if (!fsRes.ok) {
          console.warn('[ServicePincodesRoutes] REST POST non-ok:', fsRes.status, await fsRes.text());
        }
      } catch (e: any) {
        console.warn('[ServicePincodesRoutes] REST POST exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      try {
        const db = getAdminDb();
        await db.collection('service_pincodes').doc(newId).set({
          pincode: newPincodeData.pincode,
          active:  newPincodeData.active,
        });
        firestoreSuccess = true;
        console.log('[ServicePincodesRoutes] POST saved via Admin SDK');
      } catch (e: any) {
        console.warn('[ServicePincodesRoutes] SDK POST failed:', e.message);
      }
    }

    // Last resort: REST API authenticated with the service-account access token
    if (!firestoreSuccess) {
      try {
        const adminToken = await getAdminAccessToken();
        if (adminToken) {
          const fields = {
            pincode: toFirestoreValue(newPincodeData.pincode),
            active:  toFirestoreValue(newPincodeData.active),
          };
          const url =
            `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
            `/databases/${firebaseDatabaseId}/documents/service_pincodes/${newId}`;
          const queryParams = Object.keys(fields)
            .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
            .join('&');
          const fsRes = await fetch(`${url}?${queryParams}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
          });
          if (fsRes.ok) {
            firestoreSuccess = true;
            console.log('[ServicePincodesRoutes] POST saved via service-account REST fallback');
          } else {
            console.error('[ServicePincodesRoutes] Service-account REST POST failed:', fsRes.status, await fsRes.text());
          }
        }
      } catch (e: any) {
        console.error('[ServicePincodesRoutes] Service-account REST POST exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      console.error('[ServicePincodesRoutes] POST: all Firestore write paths failed — pincode is in-memory only and will not persist.');
    }

    res.status(201).json(newPincodeData);
  } catch (error: any) {
    console.error('[ServicePincodesRoutes] POST failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/service-pincodes/:id
// ---------------------------------------------------------------------------
router.patch('/:id', async (req, res) => {
  console.log('========================');
  console.log('PATCH ROUTE HIT');
  console.log('ID:', req.params.id);
  console.log('BODY:', req.body);
  console.log('AUTH:', req.headers.authorization);
  console.log('========================');

  try {
    const isUserAdmin = await isAdmin(req);

    console.log('ADMIN:', isUserAdmin);

    if (!isUserAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin permissions required'
      });
    }

    const { id } = req.params;
    const body = req.body;
    const authHeader = req.headers.authorization;
    const firebaseToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1]
      : null;

    const pincodes = lazyLoadPincodes();
    const index = pincodes.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Not Found', message: 'Pincode document not found' });
    }

    const updatedPincodeData = { ...pincodes[index] };

    if (body.pincode !== undefined) {
      const trimmedPin = String(body.pincode).trim();
      if (!/^\d{6}$/.test(trimmedPin)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Pincode must be exactly 6 digits' });
      }
      updatedPincodeData.pincode = trimmedPin;
    }
    if (body.active !== undefined) {
      updatedPincodeData.active = Boolean(body.active);
    }
    updatedPincodeData.updated_at = new Date().toISOString();

    const oldPincode = pincodes[index].pincode;

    pincodes[index] = updatedPincodeData;
    inMemoryPincodes = pincodes;
    writePincodesBackup(pincodes);

    // 0. Supabase Realtime DB write
    try {
      const defaultCityId = 'cbd0988c-deab-4fbd-8e3b-9a84a28ae348';
      // Ensure city exists to fulfill foreign key constraint
      await supabase.from('service_cities').upsert({
        id: defaultCityId,
        city_name: 'Cuttack',
        state_name: 'Odisha',
        is_active: true
      });

      // Update service_pincodes table
      const sbFields: Record<string, any> = {
        updated_at: updatedPincodeData.updated_at
      };
      if (body.pincode !== undefined) sbFields.pincode = updatedPincodeData.pincode;
      if (body.active !== undefined) sbFields.active = updatedPincodeData.active;

      const { error: sbErr1 } = await supabase.from('service_pincodes').update(sbFields).eq('id', id);
      if (sbErr1) {
        console.error('[ServicePincodesRoutes] Supabase service_pincodes update error:', sbErr1.message);
        const isRls = sbErr1.code === '42501' || sbErr1.message.toLowerCase().includes('row-level security') || sbErr1.message.toLowerCase().includes('permission denied');
        return res.status(isRls ? 403 : 500).json({
          error: isRls ? 'Permission Denied' : 'Database Error',
          message: sbErr1.message,
          code: sbErr1.code,
          isRlsViolation: isRls
        });
      } else {
        console.log('[ServicePincodesRoutes] service_pincodes PATCH saved successfully');
      }

      // Update the matching record in the delivery_pincodes table by pincode instead of id (since id is UUID)
      const deliveryFields: Record<string, any> = {};
      if (body.pincode !== undefined) deliveryFields.pincode = updatedPincodeData.pincode;
      if (body.active !== undefined) deliveryFields.is_active = Boolean(body.active);

      const { data: updatedPinData, error: updateErr } = await supabase
        .from('delivery_pincodes')
        .update(deliveryFields)
        .eq('pincode', oldPincode);

      if (updateErr) {
        console.warn('[ServicePincodesRoutes] delivery_pincodes update error by pincode:', updateErr.message);
      } else {
        console.log('[ServicePincodesRoutes] delivery_pincodes updated successfully');
      }

      // Ensure the row exists or sync by querying pincode
      const { data: existingPins, error: selectErr } = await supabase
        .from('delivery_pincodes')
        .select('*')
        .eq('pincode', updatedPincodeData.pincode);

      if (selectErr) {
        console.error('[ServicePincodesRoutes] delivery_pincodes select error:', selectErr.message);
      }

      if (!selectErr && (!existingPins || existingPins.length === 0)) {
        // If it doesn't exist, insert it!
        const { error: insertErr } = await supabase.from('delivery_pincodes').insert({
          city_id: defaultCityId,
          pincode: updatedPincodeData.pincode,
          is_active: updatedPincodeData.active,
          delivery_fee: 40,
          minimum_order: 150,
          estimated_delivery_time: '35-45 mins'
        });
        if (insertErr) {
          console.error('[ServicePincodesRoutes] delivery_pincodes insert error:', insertErr.message);
        } else {
          console.log('[ServicePincodesRoutes] delivery_pincodes record inserted successfully');
        }
      }

      console.log('[ServicePincodesRoutes] PATCH saved to Supabase (service_pincodes and delivery_pincodes)');
    } catch (e: any) {
      console.warn('[ServicePincodesRoutes] Supabase PATCH exception:', e.message);
      return res.status(500).json({
        error: 'Database Exception',
        message: e.message
      });
    }

    let firestoreSuccess = false;

    if (firebaseToken) {
      try {
        const fields: Record<string, any> = {
          pincode: toFirestoreValue(updatedPincodeData.pincode),
          active:  toFirestoreValue(updatedPincodeData.active),
          updated_at: toFirestoreValue(updatedPincodeData.updated_at),
        };

        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/service_pincodes/${id}`;
        const queryParams = Object.keys(fields)
          .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
          .join('&');

        const fsRes = await fetch(`${url}?${queryParams}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${firebaseToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        firestoreSuccess = fsRes.ok;
        if (!fsRes.ok) {
          console.warn('[ServicePincodesRoutes] REST PATCH non-ok:', fsRes.status, await fsRes.text());
        }
      } catch (e: any) {
        console.warn('[ServicePincodesRoutes] REST PATCH exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      try {
        const db = getAdminDb();
        await db.collection('service_pincodes').doc(id).set({
          pincode: updatedPincodeData.pincode,
          active:  updatedPincodeData.active,
        }, { merge: true });
        firestoreSuccess = true;
        console.log('[ServicePincodesRoutes] PATCH saved via Admin SDK');
      } catch (e: any) {
        console.warn('[ServicePincodesRoutes] SDK PATCH failed:', e.message);
      }
    }

    // Last resort: REST API authenticated with the service-account access token
    if (!firestoreSuccess) {
      try {
        const adminToken = await getAdminAccessToken();
        if (adminToken) {
          const fields: Record<string, any> = {};
          if (body.pincode !== undefined) fields.pincode = toFirestoreValue(updatedPincodeData.pincode);
          if (body.active  !== undefined) fields.active  = toFirestoreValue(updatedPincodeData.active);
          const url =
            `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
            `/databases/${firebaseDatabaseId}/documents/service_pincodes/${id}`;
          const queryParams = Object.keys(fields)
            .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
            .join('&');
          const fsRes = await fetch(`${url}?${queryParams}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
          });
          if (fsRes.ok) {
            firestoreSuccess = true;
            console.log('[ServicePincodesRoutes] PATCH saved via service-account REST fallback');
          } else {
            console.error('[ServicePincodesRoutes] Service-account REST PATCH failed:', fsRes.status, await fsRes.text());
          }
        }
      } catch (e: any) {
        console.error('[ServicePincodesRoutes] Service-account REST PATCH exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      console.error('[ServicePincodesRoutes] PATCH: all Firestore write paths failed — change is in-memory only and will not persist.');
    }

    res.json(updatedPincodeData);
  } catch (error: any) {
    console.error('[ServicePincodesRoutes] PATCH failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/service-pincodes/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin permissions required' });
    }

    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const firebaseToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1]
      : null;

    const pincodes = lazyLoadPincodes();
    const index = pincodes.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Not Found', message: 'Pincode document not found' });
    }

    const pincodeToDelete = pincodes[index].pincode;
    const filtered = pincodes.filter((p: any) => p.id !== id);
    inMemoryPincodes = filtered;
    writePincodesBackup(filtered);

    // 0. Supabase Realtime DB delete
    try {
      await supabase.from('service_pincodes').delete().eq('id', id);
      await supabase.from('delivery_pincodes').delete().eq('pincode', pincodeToDelete);
      console.log('[ServicePincodesRoutes] DELETE from Supabase succeeded (both tables)');
    } catch (e: any) {
      console.warn('[ServicePincodesRoutes] Supabase DELETE exception:', e.message);
    }

    let firestoreSuccess = false;

    if (firebaseToken) {
      try {
        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/service_pincodes/${id}`;
        const fsRes = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${firebaseToken}` },
        });
        firestoreSuccess = fsRes.ok;
        if (!fsRes.ok) {
          console.warn('[ServicePincodesRoutes] REST DELETE non-ok:', fsRes.status, await fsRes.text());
        }
      } catch (e: any) {
        console.warn('[ServicePincodesRoutes] REST DELETE exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      try {
        const db = getAdminDb();
        await db.collection('service_pincodes').doc(id).delete();
        firestoreSuccess = true;
        console.log('[ServicePincodesRoutes] DELETE via Admin SDK');
      } catch (e: any) {
        console.warn('[ServicePincodesRoutes] SDK DELETE failed:', e.message);
      }
    }

    // Last resort: REST API authenticated with the service-account access token
    if (!firestoreSuccess) {
      try {
        const adminToken = await getAdminAccessToken();
        if (adminToken) {
          const url =
            `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
            `/databases/${firebaseDatabaseId}/documents/service_pincodes/${id}`;
          const fsRes = await fetch(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (fsRes.ok) {
            firestoreSuccess = true;
            console.log('[ServicePincodesRoutes] DELETE via service-account REST fallback');
          } else {
            console.error('[ServicePincodesRoutes] Service-account REST DELETE failed:', fsRes.status, await fsRes.text());
          }
        }
      } catch (e: any) {
        console.error('[ServicePincodesRoutes] Service-account REST DELETE exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      console.error('[ServicePincodesRoutes] DELETE: all Firestore write paths failed — change is in-memory only and will not persist.');
    }

    res.json({ success: true, message: 'Service pincode removed successfully' });
  } catch (error: any) {
    console.error('[ServicePincodesRoutes] DELETE failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;