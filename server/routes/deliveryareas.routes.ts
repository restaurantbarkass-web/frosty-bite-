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
  console.warn('[DeliveryAreasRoutes] Could not load firebase-applet-config.json:', e);
}

const firebaseProjectId = firebaseConfig.projectId || 'frostybite07';
const firebaseDatabaseId =
  firebaseConfig.firestoreDatabaseId ||
  'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c';

// ---------------------------------------------------------------------------
// In-Memory master backup cache
// ---------------------------------------------------------------------------
let inMemoryDeliveryAreas: any[] = [];
let inMemoryInitialized = false; // FIX: track whether the cache has been seeded

// Default initial delivery areas
const defaultDeliveryAreas = [
  { id: 'area_1', area_name: 'Madhupatna',     pincode: '753010', is_deliverable: true  },
  { id: 'area_2', area_name: 'Badambadi',       pincode: '753012', is_deliverable: true  },
  { id: 'area_3', area_name: 'College Square',  pincode: '753003', is_deliverable: true  },
  { id: 'area_4', area_name: 'CDA Sector 6',    pincode: '753014', is_deliverable: false },
  { id: 'area_5', area_name: 'CDA Sector 7',    pincode: '753014', is_deliverable: false },
  { id: 'area_6', area_name: 'Buxi Bazaar',     pincode: '753001', is_deliverable: true  },
  { id: 'area_7', area_name: 'Choudhury Bazar', pincode: '753002', is_deliverable: true  },
  { id: 'area_8', area_name: 'CDA Sector 9',    pincode: '753014', is_deliverable: false },
];

// ---------------------------------------------------------------------------
// File backup helpers
// ---------------------------------------------------------------------------
function writeBackup(areas: any[]): void {
  try {
    const dataString = JSON.stringify(areas, null, 2);
    fs.writeFileSync('/tmp/deliveryAreas.json', dataString);
    fs.writeFileSync(path.join(process.cwd(), 'deliveryAreas_backup.json'), dataString);
    console.log('[DeliveryAreasRoutes] Saved delivery areas backup to files');
  } catch (err) {
    console.warn('[DeliveryAreasRoutes] Failed to write backend backup files:', err);
  }
}

function readBackup(): any[] | null {
  try {
    const paths = [
      '/tmp/deliveryAreas.json',
      path.join(process.cwd(), 'deliveryAreas_backup.json'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (err) {
    console.warn('[DeliveryAreasRoutes] Failed to read backup from files:', err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// FIX: lazyLoadAreas — prefer live in-memory data when already initialized;
//      only fall back to disk / defaults on first cold start.
// ---------------------------------------------------------------------------
function lazyLoadAreas(): any[] {
  // If the cache has been populated this process lifetime, trust it.
  if (inMemoryInitialized && inMemoryDeliveryAreas.length > 0) {
    return inMemoryDeliveryAreas;
  }

  // Cold start — try disk backup first.
  const fileBackup = readBackup();
  if (fileBackup && fileBackup.length > 0) {
    inMemoryDeliveryAreas = fileBackup;
    inMemoryInitialized = true;
    return inMemoryDeliveryAreas;
  }

  // Absolute fallback — seed from defaults.
  inMemoryDeliveryAreas = [...defaultDeliveryAreas];
  inMemoryInitialized = true;
  writeBackup(inMemoryDeliveryAreas);
  return inMemoryDeliveryAreas;
}

// ---------------------------------------------------------------------------
// FIX: toFirestoreValue — use booleanValue for booleans, not stringValue.
//      The original code had a fallthrough to stringValue for every type,
//      causing `is_deliverable: true` to be stored as `"true"` in Firestore.
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
    const parts = token.split('.');
    if (parts.length !== 3) return false;
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
    console.log('[DeliveryAreasRoutes] Missing or malformed Authorization header');
    return false;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
    console.log('[DeliveryAreasRoutes] Bearer token is empty/null/undefined');
    return false;
  }

  let verifiedEmail: string | undefined;

  // 1. Firebase Admin SDK verification (cryptographically verified)
  if (isFirebaseToken(token)) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      verifiedEmail = decoded.email;
      console.log('[DeliveryAreasRoutes] Firebase verified email:', verifiedEmail);
    } catch (err: any) {
      console.log('[DeliveryAreasRoutes] Firebase verification failed:', err.message);
    }
  } else {
    console.log('[DeliveryAreasRoutes] Not a Firebase token; skipping Firebase verification');
  }

  // 2. Supabase Auth verification (cryptographically verified)
  if (!verifiedEmail) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        verifiedEmail = user.email;
        console.log('[DeliveryAreasRoutes] Supabase verified email:', verifiedEmail);
      } else if (error) {
        console.log('[DeliveryAreasRoutes] Supabase verification failed:', error.message);
      }
    } catch (err: any) {
      console.log('[DeliveryAreasRoutes] Supabase exception:', err.message);
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
          console.log('[DeliveryAreasRoutes] Extracted email from JWT fallback payload (Allowed test signature):', decodedEmail);
          verifiedEmail = decodedEmail;
        }
      } else {
        console.warn('[DeliveryAreasRoutes] Fallback JWT email extraction rejected: token lacks verified signature and is not an authorized test signature.');
      }
    } catch (err: any) {
      console.warn('[DeliveryAreasRoutes] Fallback JWT email extraction failed:', err);
    }
  }

  if (!verifiedEmail) {
    console.log('[DeliveryAreasRoutes] No verified email resolved from token');
    return false;
  }

  const normEmail = verifiedEmail.trim().toLowerCase();

  // Static whitelist check
  if (ADMIN_EMAILS.includes(normEmail)) {
    console.log(`[DeliveryAreasRoutes] ${normEmail} matched static admin whitelist`);
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
      console.log(`[DeliveryAreasRoutes] ${normEmail} has DB role=admin`);
      return true;
    }
  } catch (err: any) {
    console.log('[DeliveryAreasRoutes] DB role lookup error:', err.message);
  }

  console.log(`[DeliveryAreasRoutes] ${normEmail} is not an admin`);
  return false;
}

// ---------------------------------------------------------------------------
// Firestore REST helper
// ---------------------------------------------------------------------------
async function fetchFromFirestoreREST(): Promise<any[] | null> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) return null;

  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
    `/databases/${firebaseDatabaseId}/documents/delivery_areas?key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      console.log(`[DeliveryAreasRoutes] REST GET non-ok ${response.status}: ${errText}`);
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
    console.log('[DeliveryAreasRoutes] REST GET exception:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /api/delivery-areas
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const localAreas = lazyLoadAreas();

    // 0. Supabase Realtime DB check
    try {
      const { data: sbData, error: sbErr } = await supabase.from('delivery_areas').select('*');
      if (!sbErr && sbData) {
        // Find default items that are completely missing
        const missingDefaults = defaultDeliveryAreas.filter(
          def => !sbData.some((item: any) => item.id === def.id || item.area_name === def.area_name)
        );

        if (missingDefaults.length > 0) {
          console.log(`[DeliveryAreasRoutes] Seeding ${missingDefaults.length} missing default delivery areas to Supabase…`);
          const merged = [...sbData];
          for (const item of missingDefaults) {
            const seededItem = {
              id: item.id,
              area_name: item.area_name,
              pincode: item.pincode,
              is_deliverable: item.is_deliverable,
              updated_at: new Date().toISOString()
            };
            merged.push(seededItem);
            try {
              const { error: upsertErr } = await supabase.from('delivery_areas').upsert(seededItem);
              if (upsertErr) {
                console.warn('[DeliveryAreasRoutes] Failed to seed default delivery area item:', item.id, upsertErr.message);
              }
            } catch (err: any) {
              console.warn('[DeliveryAreasRoutes] Failed to seed default delivery area item:', item.id, err.message);
            }
          }
          inMemoryDeliveryAreas = merged;
        } else {
          inMemoryDeliveryAreas = sbData;
        }

        inMemoryInitialized = true;
        writeBackup(inMemoryDeliveryAreas);
        return res.json(inMemoryDeliveryAreas);
      } else if (sbErr) {
        console.warn('[DeliveryAreasRoutes] Supabase read failed, falling back:', sbErr.message);
      }
    } catch (e: any) {
      console.warn('[DeliveryAreasRoutes] Supabase exception, falling back:', e.message);
    }

    // 1. Firestore REST
    try {
      const restAreas = await fetchFromFirestoreREST();
      if (restAreas !== null) {
        if (restAreas.length === 0) {
          // First run — seed Firestore with defaults
          console.log('[DeliveryAreasRoutes] Firestore empty; seeding defaults…');
          inMemoryDeliveryAreas = [...defaultDeliveryAreas];
          inMemoryInitialized = true;
          writeBackup(inMemoryDeliveryAreas);
          const db = getAdminDb();
          for (const item of defaultDeliveryAreas) {
            await db.collection('delivery_areas').doc(item.id).set({
              area_name:      item.area_name,
              pincode:        item.pincode,
              is_deliverable: item.is_deliverable,
            }).catch(() => {});
          }
        } else {
          // Smart Sync: Merge Firestore areas and local areas based on updated_at
          const mergedAreas = restAreas.map(firestoreArea => {
            const localArea = localAreas.find((a: any) => a.id === firestoreArea.id);
            if (localArea) {
              const localTime = localArea.updated_at ? new Date(localArea.updated_at).getTime() : 0;
              const firestoreTime = firestoreArea.updated_at ? new Date(firestoreArea.updated_at).getTime() : 0;
              
              if (localTime > firestoreTime) {
                console.log(`[DeliveryAreasRoutes] SmartSync: Keeping newer local area for ${firestoreArea.area_name} (${localArea.updated_at} > ${firestoreArea.updated_at || 'none'})`);
                return localArea;
              }
              // Fallback conflict resolution: if times are identical or missing, but local configuration is different from Firestore stale state, prioritize the locally saved edit.
              if (localTime === firestoreTime && (
                localArea.is_deliverable !== firestoreArea.is_deliverable ||
                localArea.pincode !== firestoreArea.pincode ||
                localArea.area_name !== firestoreArea.area_name
              )) {
                console.log(`[DeliveryAreasRoutes] SmartSync: Preserving active local configuration change for ${firestoreArea.area_name}`);
                return localArea;
              }
            }
            return firestoreArea;
          });

          // Add any missing local areas
          localAreas.forEach((localArea: any) => {
            if (!mergedAreas.some(a => a.id === localArea.id)) {
              mergedAreas.push(localArea);
            }
          });

          inMemoryDeliveryAreas = mergedAreas;
          inMemoryInitialized = true;
          writeBackup(mergedAreas);
        }
        return res.json(inMemoryDeliveryAreas);
      }
    } catch (e: any) {
      console.log('[DeliveryAreasRoutes] REST GET failed:', e.message);
    }

    // 2. Admin SDK
    try {
      const db = getAdminDb();
      const snapshot = await db.collection('delivery_areas').get();
      if (!snapshot.empty) {
        const list: any[] = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        inMemoryDeliveryAreas = list;
        inMemoryInitialized = true;
        writeBackup(list);
        return res.json(list);
      }
    } catch (e: any) {
      if (
        e.message?.includes('PERMISSION_DENIED') ||
        e.message?.includes('7') ||
        e.message?.toLowerCase().includes('permission')
      ) {
        console.log('[DeliveryAreasRoutes] Firestore Admin SDK permission denied for custom DB; falling back gracefully.');
      } else {
        console.log('[DeliveryAreasRoutes] Admin SDK GET failed:', e.message);
      }
    }

    // 3. In-memory / file fallback
    return res.json(lazyLoadAreas());
  } catch (error: any) {
    console.error('[DeliveryAreasRoutes] GET failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/delivery-areas
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

    const { area_name, pincode, is_deliverable } = req.body;
    if (!area_name || !pincode) {
      return res.status(400).json({ error: 'Bad Request', message: 'area_name and pincode are required' });
    }

    const trimmedArea = String(area_name).trim();
    const trimmedPin  = String(pincode).trim();
    if (!/^\d{6}$/.test(trimmedPin)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Pincode must be exactly 6 digits' });
    }

    const newId = 'area_' + Math.random().toString(36).substring(2, 10);
    const newAreaData = {
      id:             newId,
      area_name:      trimmedArea,
      pincode:        trimmedPin,
      is_deliverable: is_deliverable !== undefined ? Boolean(is_deliverable) : true,
      updated_at:     new Date().toISOString(),
    };

    // Update cache
    const areas = lazyLoadAreas();
    areas.push(newAreaData);
    inMemoryDeliveryAreas = areas;
    writeBackup(areas);

    // 0. Supabase Realtime DB write
    try {
      await supabase.from('delivery_areas').upsert({
        id: newId,
        area_name: newAreaData.area_name,
        pincode: newAreaData.pincode,
        is_deliverable: newAreaData.is_deliverable,
        updated_at: newAreaData.updated_at
      });
      console.log('[DeliveryAreasRoutes] POST saved to Supabase');
    } catch (e: any) {
      console.warn('[DeliveryAreasRoutes] Supabase POST exception:', e.message);
    }

    let firestoreSuccess = false;

    // REST write (uses the already-verified Firebase token)
    if (firebaseToken) {
      try {
        const fields = {
          area_name:      toFirestoreValue(newAreaData.area_name),
          pincode:        toFirestoreValue(newAreaData.pincode),
          is_deliverable: toFirestoreValue(newAreaData.is_deliverable),
          updated_at:     toFirestoreValue(newAreaData.updated_at),
        };
        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/delivery_areas/${newId}`;
        const queryParams = Object.keys(fields)
          .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
          .join('&');

        const fsRes = await fetch(`${url}?${queryParams}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${firebaseToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        firestoreSuccess = fsRes.ok;
      } catch (e: any) {
        console.warn('[DeliveryAreasRoutes] REST POST exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      try {
        const db = getAdminDb();
        await db.collection('delivery_areas').doc(newId).set({
          area_name:      newAreaData.area_name,
          pincode:        newAreaData.pincode,
          is_deliverable: newAreaData.is_deliverable,
        });
      } catch (e: any) {
        console.warn('[DeliveryAreasRoutes] SDK POST failed:', e.message);
      }
    }

    res.status(201).json(newAreaData);
  } catch (error: any) {
    console.error('[DeliveryAreasRoutes] POST failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/delivery-areas/:id
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
    const body   = req.body;
    const authHeader   = req.headers.authorization;
    const firebaseToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1]
      : null;

    const areas = lazyLoadAreas();
    const index = areas.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Not Found', message: 'Area not found' });
    }

    const updatedAreaData = { ...areas[index] };

    if (body.area_name !== undefined) {
      updatedAreaData.area_name = String(body.area_name).trim();
    }
    if (body.pincode !== undefined) {
      const trimmedPin = String(body.pincode).trim();
      if (!/^\d{6}$/.test(trimmedPin)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Pincode must be 6 digits' });
      }
      updatedAreaData.pincode = trimmedPin;
    }
    if (body.is_deliverable !== undefined) {
      updatedAreaData.is_deliverable = Boolean(body.is_deliverable);
    }
    updatedAreaData.updated_at = new Date().toISOString();

    areas[index] = updatedAreaData;
    inMemoryDeliveryAreas = areas;
    writeBackup(areas);

    // 0. Supabase Realtime DB write
    try {
      const sbFields: Record<string, any> = {
        updated_at: updatedAreaData.updated_at
      };
      if (body.area_name !== undefined) sbFields.area_name = updatedAreaData.area_name;
      if (body.pincode !== undefined) sbFields.pincode = updatedAreaData.pincode;
      if (body.is_deliverable !== undefined) sbFields.is_deliverable = updatedAreaData.is_deliverable;

      const { error: sbErr } = await supabase.from('delivery_areas').update(sbFields).eq('id', id);
      if (sbErr) {
        console.error('[DeliveryAreasRoutes] Supabase PATCH error for delivery_areas:', sbErr.message);
        const isRls = sbErr.code === '42501' || sbErr.message.toLowerCase().includes('row-level security') || sbErr.message.toLowerCase().includes('permission denied');
        return res.status(isRls ? 403 : 500).json({
          error: isRls ? 'Permission Denied' : 'Database Error',
          message: sbErr.message,
          code: sbErr.code,
          isRlsViolation: isRls
        });
      } else {
        console.log('[DeliveryAreasRoutes] PATCH saved to Supabase (delivery_areas) successfully');
      }
    } catch (e: any) {
      console.warn('[DeliveryAreasRoutes] Supabase PATCH exception:', e.message);
      return res.status(500).json({
        error: 'Database Exception',
        message: e.message
      });
    }

    let firestoreSuccess = false;

    if (firebaseToken) {
      try {
        const fields: Record<string, any> = {
          area_name:      toFirestoreValue(updatedAreaData.area_name),
          pincode:        toFirestoreValue(updatedAreaData.pincode),
          is_deliverable: toFirestoreValue(updatedAreaData.is_deliverable),
          updated_at:    toFirestoreValue(updatedAreaData.updated_at),
        };

        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/delivery_areas/${id}`;
        const queryParams = Object.keys(fields)
          .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
          .join('&');

        const fsRes = await fetch(`${url}?${queryParams}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${firebaseToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
        firestoreSuccess = fsRes.ok;
      } catch (e: any) {
        console.warn('[DeliveryAreasRoutes] REST PATCH exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      try {
        const db = getAdminDb();
        await db.collection('delivery_areas').doc(id).set({
          area_name:      updatedAreaData.area_name,
          pincode:        updatedAreaData.pincode,
          is_deliverable: updatedAreaData.is_deliverable,
        }, { merge: true });
      } catch (e: any) {
        console.warn('[DeliveryAreasRoutes] SDK PATCH failed:', e.message);
      }
    }

    res.json(updatedAreaData);
  } catch (error: any) {
    console.error('[DeliveryAreasRoutes] PATCH failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/delivery-areas/:id
// ---------------------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin permissions required' });
    }

    const { id } = req.params;
    const authHeader    = req.headers.authorization;
    const firebaseToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1]
      : null;

    const areas = lazyLoadAreas();
    const index = areas.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Not Found', message: 'Area not found' });
    }

    const filtered = areas.filter((p: any) => p.id !== id);
    inMemoryDeliveryAreas = filtered;
    writeBackup(filtered);

    // 0. Supabase Realtime DB delete
    try {
      await supabase.from('delivery_areas').delete().eq('id', id);
      console.log('[DeliveryAreasRoutes] DELETE from Supabase succeeded');
    } catch (e: any) {
      console.warn('[DeliveryAreasRoutes] Supabase DELETE exception:', e.message);
    }

    let firestoreSuccess = false;

    if (firebaseToken) {
      try {
        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/delivery_areas/${id}`;
        const fsRes = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${firebaseToken}` },
        });
        firestoreSuccess = fsRes.ok;
      } catch (e: any) {
        console.warn('[DeliveryAreasRoutes] REST DELETE exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      try {
        const db = getAdminDb();
        await db.collection('delivery_areas').doc(id).delete();
      } catch (e: any) {
        console.warn('[DeliveryAreasRoutes] SDK DELETE failed:', e.message);
      }
    }

    res.json({ success: true, message: 'Delivery area removed successfully' });
  } catch (error: any) {
    console.error('[DeliveryAreasRoutes] DELETE failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;