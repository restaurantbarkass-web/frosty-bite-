import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp as initializeWebClientApp, getApps as getWebClientApps } from 'firebase/app';
import { 
  getFirestore as getWebFirestore,
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  setDoc as firestoreSetDoc, 
  deleteDoc as firestoreDeleteDoc, 
  collection as firestoreCollection, 
  getDocs as firestoreGetDocs,
  query as firestoreQuery,
  limit as firestoreLimit,
  serverTimestamp as firestoreServerTimestamp,
  deleteField as firestoreDeleteField
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

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

class WebDocSnapshot {
  private _exists: boolean;
  private _data: any;
  public id: string;

  constructor(id: string, exists: boolean, data: any) {
    this.id = id;
    this._exists = exists;
    this._data = data;
  }

  get exists() {
    return this._exists;
  }

  data() {
    return this._data;
  }
}

class WebQuerySnapshot {
  public docs: WebDocSnapshot[];
  public size: number;
  public empty: boolean;

  constructor(docs: WebDocSnapshot[]) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(callback: (doc: WebDocSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

function normalizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(item => normalizeData(item));
  }
  if (typeof data === 'object') {
    if (data.constructor && (
      data.constructor.name === 'ServerTimestampTransform' ||
      data.constructor.name === 'ServerTimestamp'
    )) {
      return firestoreServerTimestamp();
    }
    if (data.constructor && (
      data.constructor.name === 'DeleteTransform' ||
      data.constructor.name === 'Delete'
    )) {
      return firestoreDeleteField();
    }
    const result: any = {};
    for (const key of Object.keys(data)) {
      result[key] = normalizeData(data[key]);
    }
    return result;
  }
  return data;
}

class WebDocRef {
  private _db: any;
  private _colName: string;
  private _docId: string;

  constructor(db: any, colName: string, docId: string) {
    this._db = db;
    this._colName = colName;
    this._docId = docId;
  }

  async get() {
    const dRef = firestoreDoc(this._db, this._colName, this._docId);
    const snap = await firestoreGetDoc(dRef);
    return new WebDocSnapshot(this._docId, snap.exists(), snap.data());
  }

  async set(data: any, options?: any) {
    const dRef = firestoreDoc(this._db, this._colName, this._docId);
    const normalized = normalizeData(data);
    if (options) {
      await firestoreSetDoc(dRef, normalized, options);
    } else {
      await firestoreSetDoc(dRef, normalized);
    }
  }

  async delete() {
    const dRef = firestoreDoc(this._db, this._colName, this._docId);
    await firestoreDeleteDoc(dRef);
  }
}

class WebQuery {
  private _db: any;
  private _colName: string;
  private _limitVal: number | null = null;

  constructor(db: any, colName: string) {
    this._db = db;
    this._colName = colName;
  }

  limit(val: number) {
    this._limitVal = val;
    return this;
  }

  async get() {
    const cRef = firestoreCollection(this._db, this._colName);
    let q: any = cRef;
    if (this._limitVal !== null) {
      q = firestoreQuery(cRef, firestoreLimit(this._limitVal));
    }
    const snap = await firestoreGetDocs(q);
    const docs = snap.docs.map(d => new WebDocSnapshot(d.id, true, d.data()));
    return new WebQuerySnapshot(docs);
  }
}

class WebCollectionRef {
  private _db: any;
  private _colName: string;

  constructor(db: any, colName: string) {
    this._db = db;
    this._colName = colName;
  }

  doc(docId: string) {
    return new WebDocRef(this._db, this._colName, docId);
  }

  limit(val: number) {
    return new WebQuery(this._db, this._colName).limit(val);
  }

  async get() {
    return new WebQuery(this._db, this._colName).get();
  }
}

class WebFirestoreWrapper {
  private _db: any;

  constructor(db: any) {
    this._db = db;
  }

  collection(colName: string) {
    return new WebCollectionRef(this._db, colName);
  }
}

// Fallback Firestore using Web SDK with API key to bypass cross-project Admin SDK IAM errors
let cachedWebFirestore: any = null;

function getWebFirestoreInstance() {
  if (cachedWebFirestore) return cachedWebFirestore;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found at ${configPath}`);
    }
    const webConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const firebaseWebConfig = {
      apiKey: webConfig.apiKey,
      authDomain: webConfig.authDomain,
      projectId: webConfig.projectId,
      storageBucket: webConfig.storageBucket,
      messagingSenderId: webConfig.messagingSenderId,
      appId: webConfig.appId,
    };

    const apps = getWebClientApps();
    const webApp = apps.length > 0 ? apps[0] : initializeWebClientApp(firebaseWebConfig);
    const db = getWebFirestore(webApp, webConfig.firestoreDatabaseId || webConfig.databaseId);
    
    console.log(`[Firebase Web Fallback] Successfully initialized Firestore client: ${webConfig.firestoreDatabaseId}`);
    cachedWebFirestore = new WebFirestoreWrapper(db);
    return cachedWebFirestore;
  } catch (error: any) {
    console.error(`[Firebase Web Fallback] Failed to initialize client fallback:`, error.message);
    return null;
  }
}

export const getAdminDb = () => {
  // If we don't have JSON service account configurations, ALWAYS use the Web Client SDK as a fallback
  // This completely prevents GCP IAM cross-project permission constraints.
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const hasServiceJson = serviceAccount && serviceAccount.trim().startsWith('{');
  
  if (!hasServiceJson) {
    console.log(`[Firebase Admin] No JSON Service Account cert found. Shifting to Web JS Client SDK proxy fallback...`);
    const webDb = getWebFirestoreInstance();
    if (webDb) return webDb;
  }

  // Fallback to standard admin SDK
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
