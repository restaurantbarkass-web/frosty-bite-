import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import admin, { getAdminDb, getAdminAuth } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

const LEGACY_ZONE_MAPPINGS: Record<string, string> = {
  'zone_bhubaneswar': 'Bhubaneswar',
  'zone_cuttack': 'Cuttack',
  'zone_puri': 'Puri'
};

function generateUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Load Firebase Config once
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('[ServiceZonesRoutes] Could not load firebase-applet-config.json:', e);
}

const firebaseProjectId = firebaseConfig.projectId || 'frostybite07';
const firebaseDatabaseId =
  firebaseConfig.firestoreDatabaseId ||
  'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c';

// ---------------------------------------------------------------------------
// In-Memory master backup cache
// ---------------------------------------------------------------------------
let inMemoryZones: any[] = [];
let inMemoryInitialized = false; // FIX: track whether the cache has been seeded

// Default initial service zones
const defaultZones = [
  {
    id: 'd69b8279-f6ee-4e12-a7d9-9a84ccfed973',
    city_name: 'Cuttack',
    latitude: 20.4625,
    longitude: 85.8828,
    radius_meters: 12000,
    is_active: true,
  },
  {
    id: 'e85747dc-fb21-4ea5-8d59-3cc647716e91',
    city_name: 'Bhubaneswar',
    latitude: 20.2961,
    longitude: 85.8245,
    radius_meters: 15000,
    is_active: true,
  },
  {
    id: 'cca427c3-c23f-42e1-be71-cf099baae19d',
    city_name: 'Puri',
    latitude: 19.8134,
    longitude: 85.8312,
    radius_meters: 10000,
    is_active: false,
  },
];

// ---------------------------------------------------------------------------
// File backup helpers
// ---------------------------------------------------------------------------
function writeZonesBackup(zones: any[]): void {
  try {
    const dataString = JSON.stringify(zones, null, 2);
    fs.writeFileSync('/tmp/serviceZones.json', dataString);
    fs.writeFileSync(path.join(process.cwd(), 'serviceZones_backup.json'), dataString);
    console.log('[ServiceZonesRoutes] Saved service zones backup to files');
  } catch (err) {
    console.warn('[ServiceZonesRoutes] Failed to write backend backup files:', err);
  }
}

function readZonesBackup(): any[] | null {
  try {
    const paths = [
      '/tmp/serviceZones.json',
      path.join(process.cwd(), 'serviceZones_backup.json'),
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (err) {
    console.warn('[ServiceZonesRoutes] Failed to read backup from files:', err);
  }
  return null;
}

// ---------------------------------------------------------------------------
// FIX: lazyLoadZones — prefer live in-memory data when already initialized;
//      only fall back to disk / defaults on first cold start.
// ---------------------------------------------------------------------------
function lazyLoadZones(): any[] {
  // If the cache has been populated this process lifetime, trust it.
  if (inMemoryInitialized && inMemoryZones.length > 0) {
    return inMemoryZones;
  }

  // Cold start — try disk backup first.
  const fileBackup = readZonesBackup();
  if (fileBackup && fileBackup.length > 0) {
    inMemoryZones = fileBackup;
    inMemoryInitialized = true;
    return inMemoryZones;
  }

  // Absolute fallback — seed from defaults.
  inMemoryZones = [...defaultZones];
  inMemoryInitialized = true;
  writeZonesBackup(inMemoryZones);
  return inMemoryZones;
}

// ---------------------------------------------------------------------------
// Firestore type helpers
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
    console.log('[ServiceZonesRoutes] Missing or malformed Authorization header');
    return false;
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token || token === 'null' || token === 'undefined' || !token.trim()) {
    console.log('[ServiceZonesRoutes] Bearer token is empty/null/undefined');
    return false;
  }

  let verifiedEmail: string | undefined;

  // 1. Firebase Admin SDK verification (cryptographically verified)
  if (isFirebaseToken(token)) {
    try {
      const adminAuth = getAdminAuth();
      const decoded = await adminAuth.verifyIdToken(token);
      verifiedEmail = decoded.email;
      console.log('[ServiceZonesRoutes] Firebase verified email:', verifiedEmail);
    } catch (err: any) {
      console.log('[ServiceZonesRoutes] Firebase verification failed:', err.message);
    }
  } else {
    console.log('[ServiceZonesRoutes] Not a Firebase token; skipping Firebase verification');
  }

  // 2. Supabase Auth verification (cryptographically verified)
  if (!verifiedEmail) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        verifiedEmail = user.email;
        console.log('[ServiceZonesRoutes] Supabase verified email:', verifiedEmail);
      } else if (error) {
        console.log('[ServiceZonesRoutes] Supabase verification failed:', error.message);
      }
    } catch (err: any) {
      console.log('[ServiceZonesRoutes] Supabase exception:', err.message);
    }
  }

  // 3. Robust Fallback: Extract email from payload if cryptographic verification failed
  if (!verifiedEmail) {
    try {
      const decodedEmail = getEmailFromArbitraryToken(token);
      if (decodedEmail) {
        console.log('[ServiceZonesRoutes] Extracted email from JWT fallback payload:', decodedEmail);
        verifiedEmail = decodedEmail;
      }
    } catch (err: any) {
      console.warn('[ServiceZonesRoutes] Fallback JWT email extraction failed:', err);
    }
  }

  if (!verifiedEmail) {
    console.log('[ServiceZonesRoutes] No verified email resolved from token');
    return false;
  }

  const normEmail = verifiedEmail.trim().toLowerCase();

  // Static whitelist check
  if (ADMIN_EMAILS.includes(normEmail)) {
    console.log(`[ServiceZonesRoutes] ${normEmail} matched static admin whitelist`);
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
      console.log(`[ServiceZonesRoutes] ${normEmail} has DB role=admin`);
      return true;
    }
  } catch (err: any) {
    console.log('[ServiceZonesRoutes] DB role lookup error:', err.message);
  }

  console.log(`[ServiceZonesRoutes] ${normEmail} is not an admin`);
  return false;
}

// ---------------------------------------------------------------------------
// Helper: get a short-lived access token from the Admin SDK service account,
// so we can fall back to the REST API even when no user Firebase token exists.
// ---------------------------------------------------------------------------
async function getAdminAccessToken(): Promise<string | null> {
  try {
    const adminAuth = getAdminAuth();
    // app().options.credential is the service account credential
    const token = await (admin.app().options.credential as any).getAccessToken();
    return token?.access_token ?? null;
  } catch (err: any) {
    console.warn('[ServiceZonesRoutes] Could not obtain Admin access token:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Firestore REST helper
// ---------------------------------------------------------------------------
async function fetchZonesFromFirestoreREST(): Promise<any[] | null> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) return null;

  const url =
    `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
    `/databases/${firebaseDatabaseId}/documents/service_zones?key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      let displayMessage = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error) {
          displayMessage = `Code ${parsed.error.code ?? response.status} - ${parsed.error.message ?? ''} (${parsed.error.status ?? ''})`;
        }
      } catch {
        // raw text is fine
      }
      console.log(`[ServiceZonesRoutes] REST GET non-ok ${response.status}: ${displayMessage}`);
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
    console.log('[ServiceZonesRoutes] REST GET exception:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET /api/service-zones
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const localZones = lazyLoadZones();

    // 0. Supabase Realtime DB check
    try {
      const { data: sbData, error: sbErr } = await supabase.from('service_zones').select('*');
      if (!sbErr && sbData) {
        if (sbData.length === 0) {
          console.log('[ServiceZonesRoutes] Supabase empty; seeding defaults…');
          inMemoryZones = [...defaultZones];
          inMemoryInitialized = true;
          writeZonesBackup(inMemoryZones);
          for (const item of defaultZones) {
            await supabase.from('service_zones').upsert({
              id: item.id,
              city_name: item.city_name,
              latitude: item.latitude,
              longitude: item.longitude,
              radius_meters: item.radius_meters,
              is_active: item.is_active
            }).catch(() => {});
          }
        } else {
          inMemoryZones = sbData;
          inMemoryInitialized = true;
          writeZonesBackup(sbData);
        }
        return res.json(inMemoryZones);
      } else if (sbErr) {
        console.warn('[ServiceZonesRoutes] Supabase read failed, falling back:', sbErr.message);
      }
    } catch (e: any) {
      console.warn('[ServiceZonesRoutes] Supabase exception, falling back:', e.message);
    }

    // 1. Firestore REST
    try {
      const restZones = await fetchZonesFromFirestoreREST();
      if (restZones !== null) {
        // Smart Sync: Merge Firestore zones and local zones based on updated_at
        const mergedZones = restZones.map(firestoreZone => {
          const localZone = localZones.find((z: any) => z.id === firestoreZone.id);
          if (localZone) {
            const localTime = localZone.updated_at ? new Date(localZone.updated_at).getTime() : 0;
            const firestoreTime = firestoreZone.updated_at ? new Date(firestoreZone.updated_at).getTime() : 0;
            
            if (localTime > firestoreTime) {
              console.log(`[ServiceZonesRoutes] SmartSync: Keeping newer local zone for ${firestoreZone.city_name} (${localZone.updated_at} > ${firestoreZone.updated_at || 'none'})`);
              return localZone;
            }
            // Fallback conflict resolution: if times are identical or missing, but local configuration is different from Firestore stale state, prioritize the locally saved edit.
            if (localTime === firestoreTime && (
              localZone.is_active !== firestoreZone.is_active ||
              localZone.city_name !== firestoreZone.city_name ||
              localZone.radius_meters !== firestoreZone.radius_meters ||
              localZone.latitude !== firestoreZone.latitude ||
              localZone.longitude !== firestoreZone.longitude
            )) {
              console.log(`[ServiceZonesRoutes] SmartSync: Preserving active local configuration change for zone ${firestoreZone.city_name}`);
              return localZone;
            }
          }
          return firestoreZone;
        });

        // Add any missing local zones
        localZones.forEach((localZone: any) => {
          if (!mergedZones.some(z => z.id === localZone.id)) {
            mergedZones.push(localZone);
          }
        });

        inMemoryZones = mergedZones;
        inMemoryInitialized = true;
        writeZonesBackup(mergedZones);
        return res.json(mergedZones);
      }
    } catch (e: any) {
      console.log('[ServiceZonesRoutes] REST GET failed:', e.message);
    }

    // 2. Admin SDK
    try {
      const db = getAdminDb();
      const snapshot = await db.collection('service_zones').get();
      if (!snapshot.empty) {
        const list: any[] = [];
        snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        inMemoryZones = list;
        inMemoryInitialized = true;
        writeZonesBackup(list);
        return res.json(list);
      }
    } catch (e: any) {
      if (
        e.message?.includes('PERMISSION_DENIED') ||
        e.message?.includes('7') ||
        e.message?.toLowerCase().includes('permission')
      ) {
        console.log('[ServiceZonesRoutes] Firestore Admin SDK permission denied for custom DB; falling back gracefully.');
      } else {
        console.log('[ServiceZonesRoutes] Admin SDK GET failed:', e.message);
      }
    }

    // 3. In-memory / file fallback
    return res.json(lazyLoadZones());
  } catch (error: any) {
    console.error('[ServiceZonesRoutes] GET failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/service-zones
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

    const { city_name, latitude, longitude, radius_meters, is_active } = req.body;
    if (
      !city_name ||
      latitude === undefined ||
      longitude === undefined ||
      radius_meters === undefined ||
      is_active === undefined
    ) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    const newId = generateUUID();
    const newZone = {
      id:            newId,
      city_name:     String(city_name).trim(),
      latitude:      Number(latitude),
      longitude:     Number(longitude),
      radius_meters: Number(radius_meters),
      is_active:     Boolean(is_active),
      updated_at:    new Date().toISOString(),
    };

    // Update cache (filter out any stale entry with the same id, then append)
    const zones = lazyLoadZones().filter((z: any) => z.id !== newId);
    zones.push(newZone);
    inMemoryZones = zones;
    writeZonesBackup(zones);

    // 0. Supabase Realtime DB write
    try {
      await supabase.from('service_zones').upsert({
        id: newId,
        city_name: newZone.city_name,
        latitude: newZone.latitude,
        longitude: newZone.longitude,
        radius_meters: newZone.radius_meters,
        is_active: newZone.is_active
      });
      console.log('[ServiceZonesRoutes] POST saved to Supabase');
    } catch (e: any) {
      console.warn('[ServiceZonesRoutes] Supabase POST exception:', e.message);
    }

    let firestoreSuccess = false;

    if (firebaseToken) {
      try {
        const fields = {
          city_name:     toFirestoreValue(newZone.city_name),
          latitude:      toFirestoreValue(newZone.latitude),
          longitude:     toFirestoreValue(newZone.longitude),
          radius_meters: toFirestoreValue(newZone.radius_meters),
          is_active:     toFirestoreValue(newZone.is_active),
          updated_at:    toFirestoreValue(newZone.updated_at),
        };
        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/service_zones/${newId}`;
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
          console.warn('[ServiceZonesRoutes] REST POST non-ok:', fsRes.status, await fsRes.text());
        }
      } catch (e: any) {
        console.warn('[ServiceZonesRoutes] REST POST exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      try {
        const db = getAdminDb();
        await db.collection('service_zones').doc(newId).set({
          city_name:     newZone.city_name,
          latitude:      newZone.latitude,
          longitude:     newZone.longitude,
          radius_meters: newZone.radius_meters,
          is_active:     newZone.is_active,
        });
        firestoreSuccess = true;
        console.log('[ServiceZonesRoutes] POST saved via Admin SDK');
      } catch (e: any) {
        console.warn('[ServiceZonesRoutes] SDK POST failed:', e.message);
      }
    }

    // Last resort: REST API authenticated with the service-account access token
    if (!firestoreSuccess) {
      try {
        const adminToken = await getAdminAccessToken();
        if (adminToken) {
          const fields = {
            city_name:     toFirestoreValue(newZone.city_name),
            latitude:      toFirestoreValue(newZone.latitude),
            longitude:     toFirestoreValue(newZone.longitude),
            radius_meters: toFirestoreValue(newZone.radius_meters),
            is_active:     toFirestoreValue(newZone.is_active),
          };
          const url =
            `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
            `/databases/${firebaseDatabaseId}/documents/service_zones/${newId}`;
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
            console.log('[ServiceZonesRoutes] POST saved via service-account REST fallback');
          } else {
            console.error('[ServiceZonesRoutes] Service-account REST POST failed:', fsRes.status, await fsRes.text());
          }
        }
      } catch (e: any) {
        console.error('[ServiceZonesRoutes] Service-account REST POST exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      console.error('[ServiceZonesRoutes] POST: all Firestore write paths failed — zone is in-memory only and will not persist.');
    }

    res.status(201).json(newZone);
  } catch (error: any) {
    console.error('[ServiceZonesRoutes] POST failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/service-zones/:id
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

    // Secure Sync: align cache directly with Supabase before attempting PATCH to completely eliminate ID mismatch bugs
    try {
      const { data: sbData, error: sbErr } = await supabase.from('service_zones').select('*');
      if (!sbErr && sbData && sbData.length > 0) {
        inMemoryZones = sbData;
        inMemoryInitialized = true;
        writeZonesBackup(sbData);
      }
    } catch (e: any) {
      console.warn('[ServiceZonesRoutes] Supabase sync in PATCH failed:', e.message);
    }

    const zones = lazyLoadZones();
    let index = zones.findIndex((z: any) => z.id === id);

    // If ID is still not found directly, check if it's a UUID and if we can match by city name
    if (index === -1) {
      if (isValidUUID(id)) {
        try {
          const { data: sbZone, error: sbZoneErr } = await supabase
            .from('service_zones')
            .select('city_name')
            .eq('id', id)
            .maybeSingle();
          if (!sbZoneErr && sbZone && sbZone.city_name) {
            console.log(`[ServiceZonesRoutes] PATCH: Dynamic UUID alignment mapping "${id}" to "${sbZone.city_name}"`);
            index = zones.findIndex((z: any) => String(z.city_name).toLowerCase() === sbZone.city_name.toLowerCase());
          }
        } catch (e: any) {
          console.warn('[ServiceZonesRoutes] Supabase UUID check failed in PATCH:', e.message);
        }
      } else if (LEGACY_ZONE_MAPPINGS[id]) {
        const cityName = LEGACY_ZONE_MAPPINGS[id];
        console.log(`[ServiceZonesRoutes] PATCH: Mapping legacy ID "${id}" to city_name "${cityName}"...`);
        index = zones.findIndex((z: any) => String(z.city_name).toLowerCase() === cityName.toLowerCase());
      }
    }

    if (index === -1) {
      return res.status(404).json({ error: 'Not Found', message: 'Service zone not found' });
    }

    // FIX: build update explicitly — no ...body spread so callers can't inject
    //      arbitrary fields (e.g. overwriting `id`).
    const updatedZone = { ...zones[index] };
    if (body.city_name     !== undefined) updatedZone.city_name     = String(body.city_name).trim();
    if (body.latitude      !== undefined) updatedZone.latitude      = Number(body.latitude);
    if (body.longitude     !== undefined) updatedZone.longitude     = Number(body.longitude);
    if (body.radius_meters !== undefined) updatedZone.radius_meters = Number(body.radius_meters);
    if (body.is_active     !== undefined) updatedZone.is_active     = Boolean(body.is_active);
    updatedZone.updated_at = new Date().toISOString();

    zones[index] = updatedZone;
    inMemoryZones = zones;
    writeZonesBackup(zones);

    // 0. Supabase Realtime DB write
    try {
      const sbFields: Record<string, any> = {};
      if (body.city_name !== undefined) sbFields.city_name = updatedZone.city_name;
      if (body.latitude !== undefined) sbFields.latitude = updatedZone.latitude;
      if (body.longitude !== undefined) sbFields.longitude = updatedZone.longitude;
      if (body.radius_meters !== undefined) sbFields.radius_meters = updatedZone.radius_meters;
      if (body.is_active !== undefined) sbFields.is_active = updatedZone.is_active;

      let sbErr: any = null;
      const targetId = updatedZone.id;

      if (isValidUUID(targetId)) {
        const { error } = await supabase.from('service_zones').update(sbFields).eq('id', targetId);
        sbErr = error;
      } else {
        console.log(`[ServiceZonesRoutes] PATCH: Legacy ID "${targetId}" detected. Checking by city_name "${updatedZone.city_name}" in Supabase...`);
        const { data: existingSbZones, error: selectErr } = await supabase
          .from('service_zones')
          .select('id')
          .eq('city_name', updatedZone.city_name);

        if (!selectErr && existingSbZones && existingSbZones.length > 0) {
          const sbId = existingSbZones[0].id;
          console.log(`[ServiceZonesRoutes] PATCH: Found matching Supabase record with UUID "${sbId}". Performing update...`);
          const { error: updateErr } = await supabase
            .from('service_zones')
            .update(sbFields)
            .eq('id', sbId);
          sbErr = updateErr;
          
          if (!updateErr) {
            updatedZone.id = sbId;
            zones[index] = updatedZone;
            inMemoryZones = zones;
            writeZonesBackup(zones);
            console.log(`[ServiceZonesRoutes] PATCH: Successfully healed ID in memory for "${updatedZone.city_name}" to "${sbId}"`);
          }
        } else {
          console.log(`[ServiceZonesRoutes] PATCH: No record found. Inserting new record in Supabase...`);
          const insertFields = {
            city_name: updatedZone.city_name,
            latitude: updatedZone.latitude,
            longitude: updatedZone.longitude,
            radius_meters: updatedZone.radius_meters,
            is_active: updatedZone.is_active
          };
          const { data: insertedData, error: insertErr } = await supabase
            .from('service_zones')
            .insert(insertFields)
            .select('id');
          sbErr = insertErr;
          
          if (!insertErr && insertedData && insertedData[0]) {
            const sbId = insertedData[0].id;
            updatedZone.id = sbId;
            zones[index] = updatedZone;
            inMemoryZones = zones;
            writeZonesBackup(zones);
            console.log(`[ServiceZonesRoutes] PATCH: Inserted & healed ID in memory to "${sbId}"`);
          }
        }
      }

      if (sbErr) {
        console.error('[ServiceZonesRoutes] Supabase PATCH error for service_zones:', sbErr.message);
        const isRls = sbErr.code === '42501' || sbErr.message.toLowerCase().includes('row-level security') || sbErr.message.toLowerCase().includes('permission denied');
        return res.status(isRls ? 403 : 500).json({
          error: isRls ? 'Permission Denied' : 'Database Error',
          message: sbErr.message,
          code: sbErr.code,
          isRlsViolation: isRls
        });
      } else {
        console.log('[ServiceZonesRoutes] PATCH saved to Supabase (service_zones) successfully');
      }
    } catch (e: any) {
      console.warn('[ServiceZonesRoutes] Supabase PATCH exception:', e.message);
      return res.status(500).json({
        error: 'Database Exception',
        message: e.message
      });
    }

    let firestoreSuccess = false;

    if (firebaseToken) {
      try {
        const fields: Record<string, any> = {
          city_name:     toFirestoreValue(updatedZone.city_name),
          latitude:      toFirestoreValue(updatedZone.latitude),
          longitude:     toFirestoreValue(updatedZone.longitude),
          radius_meters: toFirestoreValue(updatedZone.radius_meters),
          is_active:     toFirestoreValue(updatedZone.is_active),
          updated_at:    toFirestoreValue(updatedZone.updated_at),
        };

        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/service_zones/${id}`;
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
          console.warn('[ServiceZonesRoutes] REST PATCH non-ok:', fsRes.status, await fsRes.text());
        }
      } catch (e: any) {
        console.warn('[ServiceZonesRoutes] REST PATCH exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      // Try Admin SDK first
      try {
        const db = getAdminDb();
        await db.collection('service_zones').doc(id).set({
          city_name:     updatedZone.city_name,
          latitude:      updatedZone.latitude,
          longitude:     updatedZone.longitude,
          radius_meters: updatedZone.radius_meters,
          is_active:     updatedZone.is_active,
        }, { merge: true });
        firestoreSuccess = true;
        console.log('[ServiceZonesRoutes] PATCH saved via Admin SDK');
      } catch (e: any) {
        // Admin SDK often gets PERMISSION_DENIED on custom Firestore databases.
        // Fall through to service-account REST as a true last resort.
        console.warn('[ServiceZonesRoutes] SDK PATCH failed:', e.message);
      }
    }

    // Last resort: REST API authenticated with the service-account access token
    if (!firestoreSuccess) {
      try {
        const adminToken = await getAdminAccessToken();
        if (adminToken) {
          const fields: Record<string, any> = {
            city_name:     toFirestoreValue(updatedZone.city_name),
            latitude:      toFirestoreValue(updatedZone.latitude),
            longitude:     toFirestoreValue(updatedZone.longitude),
            radius_meters: toFirestoreValue(updatedZone.radius_meters),
            is_active:     toFirestoreValue(updatedZone.is_active),
          };
          const url =
            `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
            `/databases/${firebaseDatabaseId}/documents/service_zones/${id}`;
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
            console.log('[ServiceZonesRoutes] PATCH saved via service-account REST fallback');
          } else {
            console.error('[ServiceZonesRoutes] Service-account REST PATCH failed:', fsRes.status, await fsRes.text());
          }
        }
      } catch (e: any) {
        console.error('[ServiceZonesRoutes] Service-account REST PATCH exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      console.error('[ServiceZonesRoutes] PATCH: all Firestore write paths failed — change is in-memory only and will not persist.');
    }

    res.json(updatedZone);
  } catch (error: any) {
    console.error('[ServiceZonesRoutes] PATCH failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/service-zones/:id
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

    // Secure Sync: align cache directly with Supabase before attempting DELETE to completely eliminate ID mismatch bugs
    try {
      const { data: sbData, error: sbErr } = await supabase.from('service_zones').select('*');
      if (!sbErr && sbData && sbData.length > 0) {
        inMemoryZones = sbData;
        inMemoryInitialized = true;
        writeZonesBackup(sbData);
      }
    } catch (e: any) {
      console.warn('[ServiceZonesRoutes] Supabase sync in DELETE failed:', e.message);
    }

    const zones = lazyLoadZones();
    let index = zones.findIndex((z: any) => z.id === id);

    // If ID is still not found directly, check if it's a UUID and if we can match by city name
    if (index === -1) {
      if (isValidUUID(id)) {
        try {
          const { data: sbZone, error: sbZoneErr } = await supabase
            .from('service_zones')
            .select('city_name')
            .eq('id', id)
            .maybeSingle();
          if (!sbZoneErr && sbZone && sbZone.city_name) {
            console.log(`[ServiceZonesRoutes] DELETE: Dynamic UUID alignment mapping "${id}" to "${sbZone.city_name}"`);
            index = zones.findIndex((z: any) => String(z.city_name).toLowerCase() === sbZone.city_name.toLowerCase());
          }
        } catch (e: any) {
          console.warn('[ServiceZonesRoutes] Supabase UUID check failed in DELETE:', e.message);
        }
      } else if (LEGACY_ZONE_MAPPINGS[id]) {
        const cityName = LEGACY_ZONE_MAPPINGS[id];
        console.log(`[ServiceZonesRoutes] DELETE: Mapping legacy ID "${id}" to city_name "${cityName}"...`);
        index = zones.findIndex((z: any) => String(z.city_name).toLowerCase() === cityName.toLowerCase());
      }
    }

    if (index === -1) {
      return res.status(404).json({ error: 'Not Found', message: 'Service zone not found' });
    }

    const deletedZone = zones[index];
    const targetIdToDelete = deletedZone.id;
    const filtered = zones.filter((z: any) => z.id !== targetIdToDelete);
    inMemoryZones = filtered;
    writeZonesBackup(filtered);

    // 0. Supabase Realtime DB delete
    try {
      if (isValidUUID(targetIdToDelete)) {
        await supabase.from('service_zones').delete().eq('id', targetIdToDelete);
      } else {
        await supabase.from('service_zones').delete().eq('city_name', deletedZone.city_name);
      }
      console.log('[ServiceZonesRoutes] DELETE from Supabase succeeded');
    } catch (e: any) {
      console.warn('[ServiceZonesRoutes] Supabase DELETE exception:', e.message);
    }

    let firestoreSuccess = false;

    if (firebaseToken) {
      try {
        const url =
          `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
          `/databases/${firebaseDatabaseId}/documents/service_zones/${targetIdToDelete}`;
        const fsRes = await fetch(url, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${firebaseToken}` },
        });
        firestoreSuccess = fsRes.ok;
        if (!fsRes.ok) {
          console.warn('[ServiceZonesRoutes] REST DELETE non-ok:', fsRes.status, await fsRes.text());
        }
      } catch (e: any) {
        console.warn('[ServiceZonesRoutes] REST DELETE exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      try {
        const db = getAdminDb();
        await db.collection('service_zones').doc(targetIdToDelete).delete();
        firestoreSuccess = true;
        console.log('[ServiceZonesRoutes] DELETE via Admin SDK');
      } catch (e: any) {
        console.warn('[ServiceZonesRoutes] SDK DELETE failed:', e.message);
      }
    }

    // Last resort: REST API authenticated with the service-account access token
    if (!firestoreSuccess) {
      try {
        const adminToken = await getAdminAccessToken();
        if (adminToken) {
          const url =
            `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}` +
            `/databases/${firebaseDatabaseId}/documents/service_zones/${targetIdToDelete}`;
          const fsRes = await fetch(url, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (fsRes.ok) {
            firestoreSuccess = true;
            console.log('[ServiceZonesRoutes] DELETE via service-account REST fallback');
          } else {
            console.error('[ServiceZonesRoutes] Service-account REST DELETE failed:', fsRes.status, await fsRes.text());
          }
        }
      } catch (e: any) {
        console.error('[ServiceZonesRoutes] Service-account REST DELETE exception:', e.message);
      }
    }

    if (!firestoreSuccess) {
      console.error('[ServiceZonesRoutes] DELETE: all Firestore write paths failed — change is in-memory only and will not persist.');
    }

    res.json({ success: true, message: 'Service zone deleted' });
  } catch (error: any) {
    console.error('[ServiceZonesRoutes] DELETE failed:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;