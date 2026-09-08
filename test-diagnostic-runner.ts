import express from 'express';
import fs from 'fs';
import path from 'path';
import { getAdminDb } from './server/lib/firebase-admin';
import { supabase } from './server/lib/supabase';

// Mock a fake minimal admin lookup test
const ADMIN_EMAILS = [
  "restaurantbarkass@gmail.com",
  "wasifmd924@gmail.com",
  "sayedazainab216@gmail.com",
  "sayedazainabali76@gmail.com"
];

async function runDiagnostics() {
  console.log('--- STARTING DIAGNOSTIC RUN ---');
  
  // 1. Verify Firestore access & setup
  try {
    const db = getAdminDb();
    console.log('✅ Firestore Admin SDK Initialized.');
    const snapshot = await db.collection('delivery_areas').limit(1).get();
    console.log(`✅ successfully queried Firestore. Documents found: ${snapshot.size}`);

    // Try verifying a write to mobile_otps with serverTimestamp
    console.log('Testing a write to mobile_otps with serverTimestamp...');
    const adminInst = (await import('./server/lib/firebase-admin')).default;
    const ts = adminInst.firestore.FieldValue.serverTimestamp();
    await db.collection('mobile_otps').doc('testphone123').set({
      otp: '123hgs1',
      expires_at: Date.now() + 60000,
      email: 'test@frostybite.internal',
      updated_at: ts
    });
    console.log('✅ successfully wrote to mobile_otps with serverTimestamp');
  } catch (err: any) {
    console.log('❌ Firestore Admin SDK access failed:', err.message);
  }

  // 2. Load delivery areas backup JSON to ensure file access works
  const backupPath1 = '/tmp/deliveryAreas.json';
  const backupPath2 = path.join(process.cwd(), 'deliveryAreas_backup.json');
  console.log(`Checking path 1: ${backupPath1} exists? ${fs.existsSync(backupPath1)}`);
  console.log(`Checking path 2: ${backupPath2} exists? ${fs.existsSync(backupPath2)}`);

  console.log('--- DIAGNOSTIC RUN COMPLETE ---');
}

runDiagnostics().then(() => {
  process.exit(0);
}).catch(e => {
  console.error('Diagnostic crashed:', e);
  process.exit(1);
});
