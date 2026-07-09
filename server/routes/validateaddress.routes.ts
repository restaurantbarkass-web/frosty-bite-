import express from 'express';
import fs from 'fs';
import path from 'path';
import { getAdminDb } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';
import { validate } from '../middleware/validate';
import { validateAddressSchema, notifyRequestSchema } from '../validators/validateaddress.schema';

const router = express.Router();

// Load Firebase Config once
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('[ValidateAddressRoutes] Could not load firebase-applet-config.json:', e);
}

const firebaseProjectId = firebaseConfig.projectId || 'frostybite07';
const firebaseDatabaseId = firebaseConfig.firestoreDatabaseId || 'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c';

const defaultZones = [
  {
    id: "zone_cuttack",
    city_name: "Cuttack",
    latitude: 20.4625,
    longitude: 85.8828,
    radius_meters: 12000,
    is_active: true
  },
  {
    id: "zone_bhubaneswar",
    city_name: "Bhubaneswar",
    latitude: 20.2961,
    longitude: 85.8245,
    radius_meters: 15000,
    is_active: true
  },
  {
    id: "zone_puri",
    city_name: "Puri",
    latitude: 19.8134,
    longitude: 85.8312,
    radius_meters: 10000,
    is_active: false
  }
];

// Helper to calculate distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to parse Firestore fields
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
      const strVal = value as string;
      if (strVal === 'true' || strVal === 'false') {
        result[key] = (strVal === 'true');
      } else {
        result[key] = strVal;
      }
    } else if (type === 'nullValue') {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Fetch the settings directly from Firestore via user-independent REST client using the web API Key
 */
async function fetchConfigFromFirestoreREST(): Promise<any> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) {
    throw new Error('Web API Key not found');
  }
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/settings/appConfig?key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`REST API returned status ${response.status}`);
  }
  const docData = await response.json();
  if (docData && docData.fields) {
    return fromFirestoreFields(docData.fields);
  }
  return null;
}

/**
 * Retrieves the current app configuration directly from Firestore or relational fallback
 */
async function getAppConfig(): Promise<any> {
  try {
    // 1. Primary Source: Supabase
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', '1')
        .maybeSingle();
      
      if (!error && data && data.value) {
        const val = data.value;
        return typeof val === 'string' ? JSON.parse(val) : val;
      }
      if (error) {
        console.warn('[ValidateAddressRoutes] getAppConfig Supabase error:', error.message);
      }
    } catch (sbErr: any) {
      console.warn('[ValidateAddressRoutes] getAppConfig Supabase fetch failed:', sbErr.message);
    }

    // 2. Fallback: File-system backup
    try {
      const backupPath2 = path.join(process.cwd(), 'appConfig_backup.json');
      if (fs.existsSync(backupPath2)) {
        return JSON.parse(fs.readFileSync(backupPath2, 'utf8'));
      }
    } catch (fsErr) {
      // Ignore
    }

    // 3. Fallback: REST Firestore
    try {
      const restConfig = await fetchConfigFromFirestoreREST();
      if (restConfig) return restConfig;
    } catch (e: any) {
      console.log('[ValidateAddressRoutes] getAppConfig REST failed:', e.message);
    }

    // 4. Fallback: Admin SDK Firestore
    try {
      const db = getAdminDb();
      const docSnap = await db.doc('settings/appConfig').get();
      if (docSnap.exists) {
        return docSnap.data();
      }
    } catch (e: any) {
      console.log('[ValidateAddressRoutes] getAppConfig Admin SDK failed:', e.message);
    }
  } catch (error: any) {
    console.error('[ValidateAddressRoutes] Error in getAppConfig:', error);
  }
  return {
    isOrderingOpen: true,
    deliveryBaseFee: 15,
    deliveryFeePerKm: 5,
    deliveryFreeKm: 3,
    defaultDeliveryTime: 25
  };
}

// Helper to fetch service zones from disk backups
function readZonesBackup(): any[] | null {
  try {
    const backupPath1 = '/tmp/serviceZones.json';
    const backupPath2 = path.join(process.cwd(), 'serviceZones_backup.json');
    let fileDataStr = null;
    if (fs.existsSync(backupPath1)) {
      fileDataStr = fs.readFileSync(backupPath1, 'utf8');
    } else if (fs.existsSync(backupPath2)) {
      fileDataStr = fs.readFileSync(backupPath2, 'utf8');
    }
    if (fileDataStr) {
      return JSON.parse(fileDataStr);
    }
  } catch (err) {
    console.warn('[ValidateAddressRoutes] Failed to read backup from files:', err);
  }
  return null;
}

// REST helper
async function fetchZonesFromFirestoreREST(): Promise<any[] | null> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) return null;

  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/service_zones?key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      let displayMessage = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed && parsed.error) {
          displayMessage = `Code ${parsed.error.code || response.status} - ${parsed.error.message || ''} (${parsed.error.status || ''})`;
        }
      } catch (parseErr) {
        displayMessage = errText.replace(/"error":\s*{/g, '"err_info": {');
      }
      console.log(`[ValidateAddressRoutes] REST call non-ok status: ${response.status} ${response.statusText}. Error detail: ${displayMessage}`);
      return null;
    }

    const data = await response.json();
    if (data && data.documents) {
      return data.documents.map((doc: any) => {
        const parts = doc.name.split('/');
        const id = parts[parts.length - 1];
        const parsed = fromFirestoreFields(doc.fields);
        return { id, ...parsed };
      });
    }
    return [];
  } catch (error: any) {
    console.log('[ValidateAddressRoutes] REST call exception:', error.message);
    return null;
  }
}

// Function to fetch all service zones safely
async function getServiceZones(): Promise<any[]> {
  // 0. Try Supabase first (preferred relational database)
  try {
    const { data: sbData, error: sbErr } = await supabase.from('service_zones').select('*');
    if (!sbErr && sbData && sbData.length > 0) {
      return sbData;
    }
  } catch (supabaseErr: any) {
    console.warn('[ValidateAddressRoutes] Supabase service_zones retrieve failed:', supabaseErr.message);
  }

  // 1. Try Firestore REST lookup
  try {
    const restZones = await fetchZonesFromFirestoreREST();
    if (restZones && restZones.length > 0) return restZones;
  } catch (e: any) {
    console.log('[ValidateAddressRoutes] Firestore REST failed:', e.message);
  }

  // 2. Try Firestore Admin SDK with merge fallback
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('service_zones').get();
    if (!snapshot.empty) {
      const listSnap: any[] = [];
      snapshot.forEach(doc => {
        listSnap.push({ id: doc.id, ...doc.data() });
      });
      return listSnap;
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('PERMISSION_DENIED') || e.message.includes('7') || e.message.toLowerCase().includes('permission'))) {
      console.log('[ValidateAddressRoutes] Info: Firestore Admin SDK holds no direct IAM permissions for this custom database in the current ambient workspace. Falling back gracefully to client REST or local backups.');
    } else {
      console.log('[ValidateAddressRoutes] Firestore Admin SDK failed:', e.message);
    }
  }

  // 4. Fallback default presets limit
  return defaultZones;
}

const defaultPincodes = [
  "753001",
  "753002",
  "753003",
  "753004",
  "753005",
  "753006",
  "753007",
  "753008",
  "753009",
  "753010",
  "753011",
  "753012",
  "753013",
  "753014",
  "753015"
];

// Fetch pincodes via REST helper
async function fetchPincodesFromFirestoreREST(): Promise<any[] | null> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) return null;

  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/${firebaseDatabaseId}/documents/service_pincodes?key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Demote warning to a light debug info log so that it does not pollute clean console/tests when fallback is active.
      console.log(`[ValidateAddressRoutes] REST pincodes fetch inactive: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data && data.documents) {
      return data.documents.map((doc: any) => {
        const parts = doc.name.split('/');
        const id = parts[parts.length - 1];
        const parsed = fromFirestoreFields(doc.fields);
        return { id, ...parsed };
      });
    }
    return [];
  } catch (error: any) {
    console.log('[ValidateAddressRoutes] REST pincodes call exception:', error.message);
    return null;
  }
}

// Function to fetch all service pincodes securely
async function getServicePincodes(): Promise<any[]> {
  let list: any[] = [];

  // 0. Try Supabase first (preferred relational database)
  try {
    const { data: sbData, error: sbErr } = await supabase.from('service_pincodes').select('*');
    if (!sbErr && sbData && sbData.length > 0) {
      list = sbData;
    }
  } catch (supabaseErr: any) {
    console.warn('[ValidateAddressRoutes] Supabase service_pincodes retrieve failed:', supabaseErr.message);
  }

  if (list.length === 0) {
    // 1. Try Firestore REST lookup
    try {
      const restPincodes = await fetchPincodesFromFirestoreREST();
      if (restPincodes && restPincodes.length > 0) {
        list = restPincodes;
      }
    } catch (e: any) {
      console.log('[ValidateAddressRoutes] Firestore REST pincodes failed:', e.message);
    }
  }

  // 2. Try Firestore Admin SDK with merge fallback
  if (list.length === 0) {
    try {
      const db = getAdminDb();
      const snapshot = await db.collection('service_pincodes').get();
      if (!snapshot.empty) {
        const listSnap: any[] = [];
        snapshot.forEach(doc => {
          listSnap.push({ id: doc.id, ...doc.data() });
        });
        list = listSnap;
      }
    } catch (e: any) {
      console.log('[ValidateAddressRoutes] Firestore Admin SDK pincodes failed:', e.message);
    }
  }

  // 3. Fallback default presets limit
  if (list.length === 0) {
    list = defaultPincodes.map((pin, index) => ({
      id: `default_${index}`,
      pincode: pin,
      active: true
    }));
  }

  // Map to force all Cuttack (starts with '753') pincodes to be active
  return list.map((item: any) => {
    if (item && item.pincode && String(item.pincode).trim().startsWith('753')) {
      return { ...item, active: true };
    }
    return item;
  }).filter(Boolean);
}

/**
 * POST /api/validate-address
 * Checks if a user's address or coordinates are inside active delivery boundaries.
 */
router.post('/', validate(validateAddressSchema), async (req, res) => {
  try {
    const { address, coordinates, fields } = req.body;

    const appConfig = await getAppConfig();
    const configDeliveryTime = appConfig?.defaultDeliveryTime || 25;

    const zones = await getServiceZones();
    // Enable ultra-safe filtering that supports various database representations
    const activeZones = zones.filter(z => z && (z.is_active === true || z.is_active === 'true' || z.is_active === 1 || String(z.is_active).toLowerCase() === 'true'));
    const activeCityNames = activeZones.map(z => z.city_name || '').filter(Boolean);

    let activeCitiesStr = activeCityNames.join(' and ');
    if (activeCityNames.length > 1) {
      activeCitiesStr = activeCityNames.slice(0, -1).join(', ') + ' and ' + activeCityNames[activeCityNames.length - 1];
    }
    if (activeCityNames.length === 0) {
      activeCitiesStr = "Cuttack"; // Fallback text when nothing is config'd
    }

    // Evaluate Structured Fields (houseNumber, streetName, landmark, city, pincode)
    const normalizedCity = fields && fields.city ? String(fields.city).trim().toLowerCase() : '';
    const normalizedZip = fields && fields.pincode ? String(fields.pincode).trim() : '';
    const fullAddressText = address ? String(address).toLowerCase() : '';

    // LAYER A: Check PINCODE and CITY directly if pincode is specified in structured inputs
    if (normalizedZip) {
      const activePincodes = await getServicePincodes();
      const enabledPincodes = activePincodes
        .filter((p: any) => p && (p.active === true || p.active === 'true' || p.active === 1 || String(p.active).toLowerCase() === 'true'))
        .map((p: any) => String(p.pincode).trim())
        .filter(Boolean);

      const isCityCuttack = normalizedCity === 'cuttack' || fullAddressText.includes('cuttack') || normalizedZip.startsWith('753');
      const isPincodeAllowed = enabledPincodes.includes(normalizedZip) || normalizedZip.startsWith('753');

      if (isCityCuttack && isPincodeAllowed) {
        return res.json({
          success: true,
          deliverable: true,
          message: "📍 Delivery Available",
          estimatedDeliveryMins: configDeliveryTime,
          zone: "Cuttack"
        });
      } else if (!isCityCuttack) {
        return res.status(200).json({
          success: false,
          deliverable: false,
          message: "⚠ Delivery Unavailable\n\nFrosty Bite currently serves selected areas of Cuttack only."
        });
      } else {
        return res.status(200).json({
          success: false,
          deliverable: false,
          message: `⚠ Delivery Unavailable\n\nFrosty Bite currently serves selected areas of Cuttack only.\n(Pincode ${normalizedZip} is outside our active boundaries)`
        });
      }
    }

    // LAYER B: Coordinates check (GPS Geolocation or pinned map coordinates)
    const uLat = coordinates ? (
      typeof coordinates.lat === 'number' ? coordinates.lat :
      (typeof coordinates.lat === 'string' && !isNaN(parseFloat(coordinates.lat)) ? parseFloat(coordinates.lat) :
      (typeof coordinates.latitude === 'number' ? coordinates.latitude :
      (typeof coordinates.latitude === 'string' && !isNaN(parseFloat(coordinates.latitude)) ? parseFloat(coordinates.latitude) : null)))
    ) : null;

    const uLng = coordinates ? (
      typeof coordinates.lng === 'number' ? coordinates.lng :
      (typeof coordinates.lng === 'string' && !isNaN(parseFloat(coordinates.lng)) ? parseFloat(coordinates.lng) :
      (typeof coordinates.longitude === 'number' ? coordinates.longitude :
      (typeof coordinates.longitude === 'string' && !isNaN(parseFloat(coordinates.longitude)) ? parseFloat(coordinates.longitude) : null)))
    ) : null;

    if (uLat !== null && uLng !== null) {
      let matchedZone = null;
      let minDistance = Infinity;

      for (const zone of activeZones) {
        if (!zone || zone.latitude === undefined || zone.longitude === undefined) continue;
        const zoneLat = parseFloat(String(zone.latitude));
        const zoneLng = parseFloat(String(zone.longitude));
        const radiusMeters = parseFloat(String(zone.radius_meters)) || 12000;

        if (isNaN(zoneLat) || isNaN(zoneLng)) continue;

        const dist = calculateDistance(zoneLat, zoneLng, uLat, uLng);
        const radiusKm = radiusMeters / 1000;
        if (dist <= radiusKm) {
          if (dist < minDistance) {
            minDistance = dist;
            matchedZone = zone;
          }
        }
      }

      if (matchedZone) {
        return res.json({
          success: true,
          deliverable: true,
          message: "📍 Delivery Available",
          estimatedDeliveryMins: configDeliveryTime,
          zone: matchedZone.city_name,
          distanceKm: Number(minDistance.toFixed(2))
        });
      } else {
        return res.status(200).json({
          success: false,
          deliverable: false,
          message: `⚠ Delivery Unavailable\n\nFrosty Bite currently delivers only in ${activeCitiesStr}. Your pinned location is outside our service area.`
        });
      }
    }

    // LAYER C: General Text check inside City text fallback
    let matchedCityZone = null;
    for (const zone of activeZones) {
      if (!zone || !zone.city_name) continue;
      const zName = String(zone.city_name).toLowerCase();
      if (normalizedCity === zName || fullAddressText.includes(zName)) {
        matchedCityZone = zone;
        break;
      }
    }

    // If a match is found based on city text alone
    if (matchedCityZone) {
      return res.json({
        success: true,
        deliverable: true,
        message: "📍 Delivery Available",
        estimatedDeliveryMins: configDeliveryTime,
        zone: matchedCityZone.city_name
      });
    }

    // Check if user entered Bhubaneswar or other inactive cities to give proper warning
    const inactiveZones = zones.filter(z => z && !(z.is_active === true || z.is_active === 'true' || z.is_active === 1 || String(z.is_active).toLowerCase() === 'true'));
    for (const zone of inactiveZones) {
      if (!zone || !zone.city_name) continue;
      const zName = String(zone.city_name).toLowerCase();
      if (normalizedCity === zName || fullAddressText.includes(zName)) {
        return res.status(200).json({
          success: false,
          deliverable: false,
          message: `⚠ Delivery Unavailable\n\nFrosty Bite currently delivers only in ${activeCitiesStr}. ${zone.city_name} is not currently active.`
        });
      }
    }

    // General fallback when city did not match anything
    return res.status(200).json({
      success: false,
      deliverable: false,
      message: `⚠ Delivery Unavailable\n\nFrosty Bite currently serves selected areas of Cuttack only.`
    });

  } catch (error: any) {
    console.error('[ValidateAddressRoutes] Error validating address:', error);
    res.status(500).json({
      success: false,
      deliverable: false,
      message: "An internal server error occurred while validating delivery address."
    });
  }
});

/**
 * GET /api/validate-address/check-pincode/:pincode
 * Safely processes checking of pincode availability from the server-side to bypass CORS / direct-client connection blocks.
 */
router.get('/check-pincode/:pincode', async (req, res) => {
  try {
    const { pincode } = req.params;
    const cleanPin = pincode.trim().replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleanPin)) {
      return res.json({ allowed: false, error: 'Invalid pincode format' });
    }

    // 1. Force Cuttack '753' to be active as requested in prior edits
    if (cleanPin.startsWith('753')) {
      return res.json({ allowed: true, source: 'cuttack_override' });
    }

    // 2. Try to check delivery_pincodes in Supabase
    try {
      const { data, error } = await supabase
        .from('delivery_pincodes')
        .select('*')
        .eq('pincode', cleanPin)
        .eq('is_active', true);
      if (!error && data && data.length > 0) {
        return res.json({ allowed: true, source: 'delivery_pincodes' });
      }
    } catch (e: any) {
      console.warn('[Server Pincode Check] Supabase delivery_pincodes query error:', e.message);
    }

    // 3. Try to check service_pincodes in Supabase
    try {
      const { data: pins, error: pinErr } = await supabase
        .from('service_pincodes')
        .select('*')
        .eq('pincode', cleanPin)
        .eq('active', true);
      if (!pinErr && pins && pins.length > 0) {
        return res.json({ allowed: true, source: 'service_pincodes' });
      }
    } catch (e: any) {
      console.warn('[Server Pincode Check] Supabase service_pincodes query error:', e.message);
    }

    return res.json({ allowed: false });
  } catch (err: any) {
    console.error('[Server Pincode Check] Catch block error:', err.message);
    return res.json({ allowed: false, error: err.message });
  }
});

/**
 * POST /api/validate-address/notify
 * Saves out of service notification requests into local backup storage and attempts table insertions into Supabase.
 */
router.post('/notify', validate(notifyRequestSchema), async (req, res) => {
  try {
    const { email, phone, city, coords } = req.body;
    const emailTrimmed = email ? String(email).trim().toLowerCase() : '';
    if (!emailTrimmed) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Prepare record
    const record = {
      id: `notify_${emailTrimmed.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
      email: emailTrimmed,
      phone: phone ? String(phone).trim() : '',
      city: city ? String(city).trim() : '',
      coords: coords || null,
      created_at: new Date().toISOString()
    };

    // 1. Save to local JSON file for absolute persistent safety
    try {
      const backupPath = path.join(process.cwd(), 'notify_requests_backup.json');
      let currentList = [];
      if (fs.existsSync(backupPath)) {
        currentList = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      }
      currentList.push(record);
      fs.writeFileSync(backupPath, JSON.stringify(currentList, null, 2), 'utf8');
      console.log(`[ValidateAddressRoutes] Saved notification request locally for: ${emailTrimmed}`);
    } catch (saveErr: any) {
      console.warn('[ValidateAddressRoutes] Failed to write notification request backup locally:', saveErr.message);
    }

    // 2. Try to insert into Supabase notify_requests / service_notifications table
    try {
      const { error: sbErr1 } = await supabase
        .from('notify_requests')
        .insert(record);
      
      if (sbErr1) {
        console.warn('[ValidateAddressRoutes] Supabase notify_requests insert skipped/failed:', sbErr1.message);
        
        // Try fallback table name: service_notifications
        const { error: sbErr2 } = await supabase
          .from('service_notifications')
          .insert(record);
        if (sbErr2) {
          console.warn('[ValidateAddressRoutes] Supabase service_notifications fallback insert failed too:', sbErr2.message);
        }
      }
    } catch (dbErr: any) {
      console.warn('[ValidateAddressRoutes] Supabase insertion error:', dbErr.message);
    }

    return res.json({ success: true, message: 'Notification request saved successfully' });
  } catch (err: any) {
    console.error('[ValidateAddressRoutes] Catch block error in notify:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
