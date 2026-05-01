import { db } from '../firebase';
import { 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { safeFirestore } from './firestoreService';

export interface AppConfig {
  isOrderingOpen: boolean;
  updated_at?: any;
}

const CONFIG_DOC_PATH = 'settings/appConfig';

let unsubscribe: any = null;
let listeners: ((config: AppConfig) => void)[] = [];
let currentConfig: AppConfig | null = null;

export const appConfigService = {
  /**
   * Subscribes to application configuration changes.
   */
  subscribeToConfig: (callback: (config: AppConfig) => void) => {
    listeners.push(callback);
    
    if (currentConfig) {
      callback(currentConfig);
    }

    if (!unsubscribe) {
      unsubscribe = safeFirestore.listen(doc(db, CONFIG_DOC_PATH), (data) => {
        if (data) {
          const config: AppConfig = {
            isOrderingOpen: data.isOrderingOpen ?? true,
            updated_at: data.updated_at
          };
          currentConfig = config;
          listeners.forEach(l => l(config));
        }
      }, 'app_config_cache');
    }

    return () => {
      listeners = listeners.filter(l => l !== callback);
      // We keep the snapshot listener running as a singleton
    };
  },

  /**
   * Toggles the ordering status.
   */
  toggleOrderingStatus: async (currentStatus: boolean) => {
    const newStatus = !currentStatus;
    localStorage.setItem('ordering_status_fallback', String(newStatus));
    
    try {
      await setDoc(doc(db, CONFIG_DOC_PATH), {
        isOrderingOpen: newStatus,
        updated_at: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('Error toggling status in Firestore:', error);
      const config: AppConfig = { isOrderingOpen: newStatus, updated_at: new Date().toISOString() };
      currentConfig = config;
      listeners.forEach(l => l(config));
    }
  },

  /**
   * Fetches the current configuration once.
   */
  getConfig: async (): Promise<AppConfig> => {
    try {
      const data = await safeFirestore.getDocument<any>(doc(db, CONFIG_DOC_PATH), 'app_config_cache');
      if (data) {
        return {
          isOrderingOpen: data.isOrderingOpen,
          updated_at: data.updated_at
        };
      }
    } catch (error) {
      console.error('Error in getConfig:', error);
    }
    return { isOrderingOpen: true };
  }
};
