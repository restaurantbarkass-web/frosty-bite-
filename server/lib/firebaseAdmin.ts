import * as adminNamespace from 'firebase-admin';
const admin = (adminNamespace as any).default || adminNamespace;
import firebaseConfig from '../../firebase-applet-config.json' assert { type: 'json' };

let isInitialized = false;

export function getAdminApp() {
  if (!isInitialized) {
    try {
      if (!admin.apps || admin.apps.length === 0) {
        try {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: `https://${firebaseConfig.projectId || 'frostybite07'}.firebaseio.com`,
          });
        } catch (credErr) {
          // Fallback initialization without explicit service account key if running in sandboxed container
          admin.initializeApp({
            projectId: firebaseConfig.projectId || 'frostybite07',
          });
        }
      }
      isInitialized = true;
    } catch (err) {
      console.warn('[FirebaseAdmin] Initialization notice:', err);
    }
  }
  return admin;
}

export const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '';
export default admin;

