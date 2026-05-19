import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

let adminInitialized = false;

function initializeFirebase() {
  if (adminInitialized) return true;

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID || 'frostybite07';
    
    if (serviceAccount && serviceAccount.trim() !== '') {
      if (serviceAccount.trim().startsWith('{')) {
        try {
          const config = JSON.parse(serviceAccount);
          admin.initializeApp({
            credential: admin.credential.cert(config),
            projectId: config.project_id || projectId
          });
          console.log(`[Firebase Admin] Initialized with Service Account JSON`);
          adminInitialized = true;
        } catch (parseError: any) {
          console.error('[Firebase Admin] Error parsing FIREBASE_SERVICE_ACCOUNT JSON:', parseError.message);
        }
      } else {
        console.log(`[Firebase Admin] FIREBASE_SERVICE_ACCOUNT is a string, assuming project ID override: ${serviceAccount}`);
        try {
          admin.initializeApp({
            projectId: serviceAccount.trim()
          });
          adminInitialized = true;
        } catch (err: any) {
          console.error('[Firebase Admin] Error initializing with project ID string:', err.message);
        }
      }
    }

    if (!adminInitialized) {
      // Try to initialize with default credentials (ADCs)
      try {
        admin.initializeApp({
          projectId: projectId
        });
        console.log(`[Firebase Admin] Initialized for project ${projectId} with Default Credentials`);
        adminInitialized = true;
      } catch (adcError: any) {
        console.error('[Firebase Admin] ADC Initialization failed:', adcError.message);
        // Fallback to simple initialization
        if (admin.apps.length === 0) {
           admin.initializeApp();
           adminInitialized = true;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('[Firebase Admin] FATAL Initialization error:', error);
    return false;
  }
}

// Lazy getters to avoid crashing during module load
export const getAdminAuth = () => {
  initializeFirebase();
  return admin.auth();
};

export const getAdminDb = () => {
  initializeFirebase();
  const databaseId = process.env.FIREBASE_DATABASE_ID || 'ai-studio-5220f74d-5467-4ae2-a84f-6cf35908747c';
  const app = admin.apps[0];
  if (!app) {
    throw new Error('[Firebase Admin] App not initialized before getting DB');
  }
  
  try {
    console.log(`[Firebase Admin] Accessing Firestore database: ${databaseId}`);
    return getFirestore(app, databaseId);
  } catch (dbError: any) {
    console.warn(`[Firebase Admin] Could not connect to database ${databaseId}, falling back to (default):`, dbError.message);
    return getFirestore(app);
  }
};

export default admin;
