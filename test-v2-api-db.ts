import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
url = url.replace(/https?:\/\/https?:\/\//g, 'https://').replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!url || !serviceKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function testCrud() {
  console.log('--- Testing Service Area ---');
  // Check service_areas
  const { data: existingSa, error: saErr } = await supabase.from('service_areas').select('*');
  console.log('Existing service_areas:', { existingSa, saErr });

  if (!existingSa || existingSa.length === 0) {
    const { data: newSa, error: insertSaErr } = await supabase.from('service_areas').insert([
      { name: 'Global Service Boundary', is_active: true }
    ]).select();
    console.log('Inserted service_area:', { newSa, insertSaErr });
  }

  console.log('--- Testing Cities ---');
  const { data: cities, error: cErr } = await supabase.from('cities').select('*');
  console.log('Existing cities:', { cities, cErr });

  let cuttackId = cities?.[0]?.id;
  if (!cuttackId) {
    const { data: newCity, error: ncErr } = await supabase.from('cities').insert([
      { name: 'Cuttack', slug: 'cuttack', state: 'Odisha', country: 'India', is_active: true }
    ]).select();
    console.log('Inserted city:', { newCity, ncErr });
    cuttackId = newCity?.[0]?.id;
  }

  console.log('--- Testing Pincodes ---');
  const { data: pincodes, error: pErr } = await supabase.from('pincodes').select('*');
  console.log('Existing pincodes:', { pincodes, pErr });

  console.log('--- Testing Localities ---');
  const { data: localities, error: lErr } = await supabase.from('localities').select('*');
  console.log('Existing localities:', { localities, lErr });
}

testCrud();
