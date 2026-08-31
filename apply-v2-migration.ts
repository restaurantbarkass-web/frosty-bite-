import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
url = url.replace(/https?:\/\/https?:\/\//g, 'https://').replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!url || !serviceKey) {
  console.error('SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function applyMigration() {
  console.log('Reading migration file...');
  const sqlContent = fs.readFileSync(path.join(process.cwd(), 'v2_geofencing_postgis.sql'), 'utf-8');
  
  // Test querying V2 tables if they already exist
  const { data: cities, error: cErr } = await supabase.from('cities').select('*');
  console.log('Current cities query:', { cities, cErr });

  const { data: pincodes, error: pErr } = await supabase.from('pincodes').select('*');
  console.log('Current pincodes query:', { pincodes, pErr });

  const { data: localities, error: lErr } = await supabase.from('localities').select('*');
  console.log('Current localities query:', { localities, lErr });

  const { data: serviceAreas, error: sErr } = await supabase.from('service_areas').select('*');
  console.log('Current service_areas query:', { serviceAreas, sErr });
}

applyMigration();
