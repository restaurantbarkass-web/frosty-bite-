import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const url = (process.env.VITE_SUPABASE_URL || 'https://wilsmmashfpgrxkknmle.supabase.co').replace(/\/rest\/v1\/?$/, '');
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHNtbWFzaGZwZ3J4a2tubWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDYwMDMsImV4cCI6MjA5MzEyMjAwM30.TXi4Zbh7hCWhmCyDIbx80ognSgnSF8BMu3MWHqZ0hyM';

const client = createClient(url, anonKey);

const STORE_FILE = path.join(process.cwd(), 'v2_geofencing_store.json');

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');         // Replace multiple - with single -
}

async function migrate() {
  console.log('=== STARTING GEOFENCING V1 TO V2 DATA MIGRATION ===');

  // Load existing store
  let store: any = { service_areas: [], cities: [], pincodes: [], localities: [] };
  if (fs.existsSync(STORE_FILE)) {
    store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    console.log(`Loaded existing V2 store: ${store.cities.length} cities, ${store.pincodes.length} pincodes, ${store.localities.length} localities.`);
  }

  // Fetch V1 Tables
  console.log('Fetching V1 tables from Supabase...');
  const { data: v1Zones, error: zErr } = await client.from('service_zones').select('*');
  const { data: v1Pincodes, error: pErr } = await client.from('service_pincodes').select('*');
  const { data: v1Areas, error: aErr } = await client.from('delivery_areas').select('*');

  if (zErr || pErr || aErr) {
    console.error('Failed to fetch some V1 data:', { zErr, pErr, aErr });
    process.exit(1);
  }

  console.log(`Fetched V1 data: ${v1Zones?.length || 0} zones, ${v1Pincodes?.length || 0} pincodes, ${v1Areas?.length || 0} areas.`);

  // Reporting variables
  const report = {
    v1RecordsMigrated: 0,
    v2RecordsCreated: 0,
    v2RecordsUpdated: 0,
    duplicatesFound: 0,
    missingValues: 0,
    invalidRecords: 0,
    manualBoundaryRequired: [] as string[],
    adminVerificationRequired: [] as string[]
  };

  // 1. MIGRATE CITIES (from service_zones)
  console.log('\n--- Migrating Cities ---');
  const processedCityNames = new Set<string>();

  for (const zone of v1Zones || []) {
    const cityName = zone.city_name;
    if (!cityName) {
      report.invalidRecords++;
      continue;
    }

    const slug = slugify(cityName);
    
    // Check if this city is a duplicate in V1
    if (processedCityNames.has(cityName)) {
      console.log(`[Duplicate] City '${cityName}' already processed from V1.`);
      report.duplicatesFound++;
      continue;
    }
    processedCityNames.add(cityName);

    // Look for existing city in V2
    let existingCity = store.cities.find((c: any) => c.slug === slug || c.name.toLowerCase() === cityName.toLowerCase());

    if (existingCity) {
      console.log(`[Update] Existing V2 city found for '${cityName}': updating active state.`);
      existingCity.is_active = zone.is_active ?? true;
      existingCity.updated_at = new Date().toISOString();
      report.v2RecordsUpdated++;
    } else {
      console.log(`[Create] Creating new V2 city: '${cityName}'`);
      const newCity = {
        id: `city-${slug}-${Date.now().toString().slice(-4)}`,
        name: cityName,
        slug: slug,
        state: cityName === 'Bhubaneswar' || cityName === 'Cuttack' ? 'Odisha' : undefined,
        country: 'India',
        is_active: zone.is_active ?? true,
        boundary: null, // Treat circular radius as legacy metadata, don't invent polygon
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.cities.push(newCity);
      report.v2RecordsCreated++;
      report.manualBoundaryRequired.push(`City: ${cityName} (No polygon available)`);
    }
    report.v1RecordsMigrated++;
  }

  // 2. MIGRATE PINCODES (from service_pincodes)
  console.log('\n--- Migrating Pincodes ---');
  for (const pin of v1Pincodes || []) {
    const pincodeStr = String(pin.pincode).trim();
    if (!/^\d{6}$/.test(pincodeStr)) {
      console.warn(`[Invalid] Skipping invalid pincode format: '${pincodeStr}'`);
      report.invalidRecords++;
      continue;
    }

    // Determine city based on pincode prefix
    let cityId = 'city-cuttack-001'; // Default to Cuttack
    let cityName = 'Cuttack';
    if (pincodeStr.startsWith('751')) {
      const bbsr = store.cities.find((c: any) => c.slug === 'bhubaneswar');
      if (bbsr) {
        cityId = bbsr.id;
        cityName = 'Bhubaneswar';
      }
    }

    // Check if already in V2 store
    let existingPin = store.pincodes.find((p: any) => p.pincode === pincodeStr);

    if (existingPin) {
      console.log(`[Update] Updating active status of pincode ${pincodeStr} to ${pin.active}`);
      existingPin.is_active = pin.active ?? true;
      existingPin.city_id = cityId; // Ensure correctly linked
      existingPin.updated_at = new Date().toISOString();
      report.v2RecordsUpdated++;
    } else {
      console.log(`[Create] Creating new V2 pincode: ${pincodeStr} linked to ${cityName}`);
      const newPin = {
        id: `pin-${pincodeStr}`,
        city_id: cityId,
        pincode: pincodeStr,
        is_active: pin.active ?? true,
        boundary: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.pincodes.push(newPin);
      report.v2RecordsCreated++;
      report.manualBoundaryRequired.push(`Pincode: ${pincodeStr} (No polygon available)`);
    }
    report.v1RecordsMigrated++;
  }

  // 3. MIGRATE LOCALITIES (from delivery_areas)
  console.log('\n--- Migrating Localities ---');
  for (const area of v1Areas || []) {
    const name = area.area_name;
    const pincode = String(area.pincode).trim();

    if (!name) {
      report.invalidRecords++;
      continue;
    }

    const slug = slugify(name);
    const pincodeId = `pin-${pincode}`;

    // Verify if we have the pincode linked
    const pincodeExists = store.pincodes.some((p: any) => p.id === pincodeId || p.pincode === pincode);
    if (!pincodeExists) {
      report.missingValues++;
      console.warn(`[Missing] Locality '${name}' has pincode '${pincode}' which was not found in pincodes table.`);
    }

    // Determine city based on pincode
    let cityId = 'city-cuttack-001';
    if (pincode.startsWith('751')) {
      const bbsr = store.cities.find((c: any) => c.slug === 'bhubaneswar');
      if (bbsr) cityId = bbsr.id;
    }

    // Check if exists in V2 store
    let existingLoc = store.localities.find((l: any) => l.slug === slug || l.name.toLowerCase() === name.toLowerCase());

    if (existingLoc) {
      console.log(`[Update] Updating existing V2 locality '${name}': setting is_active to ${area.is_deliverable ?? true}`);
      existingLoc.is_active = area.is_deliverable ?? true;
      existingLoc.pincode_id = pincodeExists ? pincodeId : existingLoc.pincode_id;
      existingLoc.city_id = cityId;
      existingLoc.updated_at = new Date().toISOString();
      report.v2RecordsUpdated++;
    } else {
      console.log(`[Create] Creating new V2 locality: '${name}' under pincode ${pincode}`);
      const newLoc = {
        id: `loc-${slug}-${pincode}`,
        city_id: cityId,
        pincode_id: pincodeExists ? pincodeId : null,
        name: name,
        slug: slug,
        is_active: area.is_deliverable ?? true,
        delivery_fee: 0, // V2 database schema default
        minimum_order: 0, // V2 database schema default
        estimated_delivery_minutes: null, // V2 database schema default
        boundary: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      store.localities.push(newLoc);
      report.v2RecordsCreated++;
      report.manualBoundaryRequired.push(`Locality: ${name} (${pincode}) (Needs manual polygon)`);
    }
    report.v1RecordsMigrated++;
  }

  // Collect records requiring verification
  store.cities.forEach((c: any) => {
    if (!c.boundary) report.adminVerificationRequired.push(`City: ${c.name}`);
  });
  store.pincodes.forEach((p: any) => {
    if (!p.boundary) report.adminVerificationRequired.push(`Pincode: ${p.pincode}`);
  });
  store.localities.forEach((l: any) => {
    if (!l.boundary) report.adminVerificationRequired.push(`Locality: ${l.name}`);
  });

  // Save back to JSON store
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  console.log(`\nSuccessfully updated local JSON store: ${STORE_FILE}`);

  // Print Report
  console.log('\n==================================================');
  console.log('MIGRATION REPORT SUMMARY');
  console.log('==================================================');
  console.log(`V1 records analyzed and processed: ${report.v1RecordsMigrated}`);
  console.log(`V2 records created: ${report.v2RecordsCreated}`);
  console.log(`V2 records updated: ${report.v2RecordsUpdated}`);
  console.log(`Duplicates found & ignored: ${report.duplicatesFound}`);
  console.log(`Missing references (e.g. orphan pincode links): ${report.missingValues}`);
  console.log(`Invalid records (malformed): ${report.invalidRecords}`);
  console.log(`Total V2 cities now in store: ${store.cities.length}`);
  console.log(`Total V2 pincodes now in store: ${store.pincodes.length}`);
  console.log(`Total V2 localities now in store: ${store.localities.length}`);
  console.log(`\nRecords requiring manual boundary drawing: ${report.manualBoundaryRequired.length}`);
  console.log(`Records requiring admin verification (boundary = null): ${report.adminVerificationRequired.length}`);
  console.log('==================================================\n');
}

migrate();
