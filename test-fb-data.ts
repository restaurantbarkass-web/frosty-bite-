import { getAdminDb } from './server/lib/firebase-admin';

async function run() {
  try {
    const db = getAdminDb();
    const doc = await db.collection('delivery_areas').doc('area_1').get();
    if (doc.exists) {
      console.log('Document area_1 exists!');
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('Document area_1 does not exist in Firestore!');
    }
  } catch (err) {
    console.error('Failed code:', err);
  }
}

run();
