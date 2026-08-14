import * as adminNamespace from 'firebase-admin';
const admin = (adminNamespace as any).default || adminNamespace;
import firebaseConfig from '../../firebase-applet-config.json' assert { type: 'json' };

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`,
  });
}

export const db = admin.firestore();
export const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId;
