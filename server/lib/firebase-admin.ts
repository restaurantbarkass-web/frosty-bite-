import { supabase } from './supabase';

class MockDocRef {
  private _docPath: string;
  constructor(docPath: string) {
    this._docPath = docPath;
  }
  async get() {
    return {
      exists: false,
      data: () => null
    };
  }
  async set(data: any, options?: any) {
    console.log(`[MockAdminDb] set called for ${this._docPath}`);
  }
  async update(data: any) {
    console.log(`[MockAdminDb] update called for ${this._docPath}`);
  }
  async delete() {
    console.log(`[MockAdminDb] delete called for ${this._docPath}`);
  }
}

class MockCollectionRef {
  private _colName: string;
  constructor(colName: string) {
    this._colName = colName;
  }
  limit(n: number) {
    return this;
  }
  doc(docId: string) {
    return new MockDocRef(`${this._colName}/${docId}`);
  }
  async get() {
    return {
      empty: true,
      size: 0,
      forEach: (callback: any) => {}
    };
  }
}

class MockFirestore {
  collection(colName: string) {
    return new MockCollectionRef(colName);
  }
  doc(docPath: string) {
    return new MockDocRef(docPath);
  }
}

export const getAdminDb = () => {
  return new MockFirestore();
};

export const getAdminAuth = () => {
  return {
    verifyIdToken: async (token: string) => {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          return {
            uid: payload.sub || payload.id || 'mock-uid',
            email: payload.email || payload.user_metadata?.email || 'mock@admin.com',
            email_verified: true,
            name: payload.name || payload.user_metadata?.full_name || 'Mock Admin'
          };
        }
      } catch (e) {
        console.warn('[MockAdminAuth] Token parse fallback:', e);
      }
      return {
        uid: 'mock-uid',
        email: 'mock@admin.com',
        email_verified: true,
        name: 'Mock Admin'
      };
    },
    createUser: async (properties: any) => {
      return { uid: 'mock-uid', ...properties };
    },
    getUserByEmail: async (email: string) => {
      return { uid: 'mock-uid', email, emailVerified: true };
    },
    updateUser: async (uid: string, properties: any) => {
      return { uid, ...properties };
    },
    createCustomToken: async (uid: string, claims?: any) => {
      return 'mock-custom-token';
    }
  };
};

const admin: any = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => new Date().toISOString()
    }
  }
};

export default admin;
