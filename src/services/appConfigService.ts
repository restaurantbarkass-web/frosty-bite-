import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';

export interface AppConfig {
  isOrderingOpen: boolean;
  updatedAt?: any;
}

const CONFIG_DOC_PATH = 'settings/appConfig';

export const appConfigService = {
  /**
   * Subscribes to application configuration changes.
   */
  subscribeToConfig: (callback: (config: AppConfig) => void) => {
    const docRef = doc(db, CONFIG_DOC_PATH);
    
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as AppConfig);
      } else {
        const initialConfig: AppConfig = { isOrderingOpen: true };
        callback(initialConfig);
      }
    }, (error) => {
      const isQuota = error.message.toLowerCase().includes('quota') || error.message.toLowerCase().includes('limit exceeded');
      if (!isQuota) {
        console.error('Error in subscribeToConfig:', error);
      }
      callback({ isOrderingOpen: true });
    });
    return unsubscribe;
  },

  /**
   * Toggles the ordering status.
   */
  toggleOrderingStatus: async (currentStatus: boolean) => {
    const docRef = doc(db, CONFIG_DOC_PATH);
    await updateDoc(docRef, {
      isOrderingOpen: !currentStatus,
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Fetches the current configuration once.
   */
  getConfig: async (): Promise<AppConfig> => {
    try {
      const docRef = doc(db, CONFIG_DOC_PATH);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as AppConfig;
      }
    } catch (error: any) {
      const isQuota = error?.message?.toLowerCase().includes('quota') || error?.message?.toLowerCase().includes('limit exceeded');
      if (!isQuota) {
        console.error('Error in getConfig:', error);
      }
    }
    return { isOrderingOpen: true };
  }
};
