import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

async function run() {
  console.log('--- AMBIENT FIREBASE TEST ---');
  try {
    admin.initializeApp();
    console.log('Firebase initialized.');
    const db = getFirestore(admin.apps[0], 'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c');
    console.log('Database initialized.');
    const snap = await db.collection('delivery_areas').limit(1).get();
    console.log('Success! Documents read:', snap.size);
  } catch (err: any) {
    console.error('Ambient Firebase Error:', err.message);
  }
}
run();
