import express from 'express';
import fs from 'fs';
import path from 'path';
import { getAdminDb } from '../lib/firebase-admin';
import { supabase } from '../lib/supabase';
import { validate } from '../middleware/validate';
import { validateAddressSchema, notifyRequestSchema } from '../validators/validateaddress.schema';
import { V2GeofencingService } from '../services/v2Geofencing.service';

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


/**
 * POST /api/validate-address
 * Checks if a user's address or coordinates are inside active delivery boundaries.
 */
router.post('/', validate(validateAddressSchema), async (req, res) => {
  try {
    const { address, coordinates, fields } = req.body;

    const appConfig = await getAppConfig();
    const configDeliveryTime = appConfig?.defaultDeliveryTime || 25;

    // Get active cities list for friendly output messages
    let activeCitiesStr = "Cuttack";
    try {
      const v2Cities = await V2GeofencingService.getCities();
      const activeCityNames = v2Cities.filter(c => c.is_active).map(c => c.name);
      if (activeCityNames.length > 1) {
        activeCitiesStr = activeCityNames.slice(0, -1).join(', ') + ' and ' + activeCityNames[activeCityNames.length - 1];
      } else if (activeCityNames.length === 1) {
        activeCitiesStr = activeCityNames[0];
      }
    } catch (e) {
      console.warn('[ValidateAddressRoutes] Failed to fetch active cities for display message:', e);
    }

    const normalizedCity = fields && fields.city ? String(fields.city).trim().toLowerCase() : '';
    const normalizedZip = fields && fields.pincode ? String(fields.pincode).trim() : '';
    const fullAddressText = address ? String(address).toLowerCase() : '';

    // LAYER A: Check PINCODE and CITY directly if pincode is specified in structured inputs
    if (normalizedZip) {
      let isPincodeAllowed = false;
      try {
        const v2Pincodes = await V2GeofencingService.getPincodes();
        isPincodeAllowed = v2Pincodes.some(p => p.pincode === normalizedZip && p.is_active);
      } catch (err: any) {
        console.warn('[ValidateAddressRoutes] Failed to fetch V2 pincodes:', err.message);
      }

      // Check if city matches any active V2 city
      let isCityActive = false;
      let matchedCityName = "Cuttack";
      try {
        const v2Cities = await V2GeofencingService.getCities();
        const activeCities = v2Cities.filter(c => c.is_active);
        const cityMatch = activeCities.find(c => 
          normalizedCity === c.name.toLowerCase() || 
          fullAddressText.includes(c.name.toLowerCase())
        );
        if (cityMatch) {
          isCityActive = true;
          matchedCityName = cityMatch.name;
        }
      } catch (err: any) {
        console.warn('[ValidateAddressRoutes] Failed to fetch V2 cities:', err.message);
      }

      if (isCityActive && isPincodeAllowed) {
        return res.json({
          success: true,
          deliverable: true,
          message: "📍 Delivery Available",
          estimatedDeliveryMins: configDeliveryTime,
          zone: matchedCityName
        });
      } else if (!isCityActive) {
        return res.status(200).json({
          success: false,
          deliverable: false,
          message: `⚠ Delivery Unavailable\n\nFrosty Bite currently serves selected areas of ${activeCitiesStr} only.`
        });
      } else {
        return res.status(200).json({
          success: false,
          deliverable: false,
          message: `⚠ Delivery Unavailable\n\nFrosty Bite currently serves selected areas of ${activeCitiesStr} only.\n(Pincode ${normalizedZip} is outside our active boundaries)`
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
      try {
        const checkResult = await V2GeofencingService.checkServiceability({ latitude: uLat, longitude: uLng });
        if (checkResult.data.serviceable) {
          return res.json({
            success: true,
            deliverable: true,
            message: "📍 Delivery Available",
            estimatedDeliveryMins: checkResult.data.estimatedDeliveryMinutes || configDeliveryTime,
            zone: checkResult.data.city?.name || "Cuttack",
            distanceKm: checkResult.data.distanceMeters ? Number((checkResult.data.distanceMeters / 1000).toFixed(2)) : 0
          });
        } else if (checkResult.data.reason === 'SERVICEABILITY_UNAVAILABLE') {
          return res.status(503).json({
            success: false,
            deliverable: false,
            serviceable: false,
            reason: "SERVICEABILITY_UNAVAILABLE",
            message: "⚠ Serviceability Temporarily Unavailable\n\nWe are experiencing server database connectivity issues. Please click retry to validate again."
          });
        } else {
          return res.status(200).json({
            success: false,
            deliverable: false,
            message: `⚠ Delivery Unavailable\n\nFrosty Bite currently delivers only in ${activeCitiesStr}. Your pinned location is outside our service area.`
          });
        }
      } catch (err: any) {
        console.warn('[ValidateAddressRoutes] V2 geofencing check failed due to exception:', err.message);
        return res.status(503).json({
          success: false,
          deliverable: false,
          serviceable: false,
          reason: "SERVICEABILITY_UNAVAILABLE",
          message: "⚠ Serviceability Temporarily Unavailable\n\nWe are experiencing server database connectivity issues. Please click retry to validate again."
        });
      }
    }

    // LAYER C: General Text check inside City text fallback
    let matchedCityName = null;
    try {
      const v2Cities = await V2GeofencingService.getCities();
      const activeCities = v2Cities.filter(c => c.is_active);
      const matched = activeCities.find(c => 
        normalizedCity === c.name.toLowerCase() || 
        fullAddressText.includes(c.name.toLowerCase())
      );
      if (matched) {
        matchedCityName = matched.name;
      }
    } catch (e) {
      console.warn('[ValidateAddressRoutes] V2 cities check failed in general text Layer C:', e);
    }

    if (matchedCityName) {
      return res.json({
        success: true,
        deliverable: true,
        message: "📍 Delivery Available",
        estimatedDeliveryMins: configDeliveryTime,
        zone: matchedCityName
      });
    }

    // General fallback when city did not match anything
    return res.status(200).json({
      success: false,
      deliverable: false,
      message: `⚠ Delivery Unavailable\n\nFrosty Bite currently serves selected areas of ${activeCitiesStr} only.`
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
    if (!pincode) {
        return res.json({ allowed: false, error: 'Pincode is required' });
    }
    const cleanPin = pincode.trim().replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleanPin)) {
      return res.json({ allowed: false, error: 'Invalid pincode format' });
    }

    // 2. Try to check via V2GeofencingService
    try {
      const v2Pincodes = await V2GeofencingService.getPincodes();
      const foundPin = v2Pincodes.find(p => p.pincode === cleanPin && p.is_active);
      if (foundPin) {
        return res.json({ allowed: true, source: 'v2_geofencing' });
      }
    } catch (err: any) {
      console.warn('[Server Pincode Check] V2GeofencingService getPincodes failed:', err.message);
    }

    // 3. Try to check delivery_pincodes in Supabase (legacy fallback)
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

    // 4. Try to check service_pincodes in Supabase (legacy fallback)
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
