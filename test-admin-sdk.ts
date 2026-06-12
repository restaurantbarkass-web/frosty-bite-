import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

const projectId = 'frostybite07';
if (!admin.apps || admin.apps.length === 0) {
  const svcAcc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svcAcc) {
    try {
      const parsed = JSON.parse(svcAcc);
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
        projectId: projectId
      });
      console.log('Admin SDK initialized via FIREBASE_SERVICE_ACCOUNT');
    } catch (e: any) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT, falling back to applicationDefault()', e.message);
      admin.initializeApp();
    }
  } else {
    admin.initializeApp();
    console.log('Admin SDK initialized via default applicationDefault()');
  }
}

async function run() {
  try {
    const snap = await admin.firestore().collection('service_pincodes').get();
    console.log('Query completed on default Firestore database. Empty:', snap.empty);
    if (!snap.empty) {
      snap.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
      });
    }
  } catch (err: any) {
    console.error('Firestore Admin SDK Error:', err.message);
  }
}

run();
