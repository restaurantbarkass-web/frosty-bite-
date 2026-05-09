import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { safeFirestore } from './firestoreService';

export interface AppConfig {
  isOrderingOpen: boolean;
  deliveryBaseFee?: number;
  deliveryFeePerKm?: number;
  deliveryFreeKm?: number;
  updated_at?: any;
}

const CONFIG_DOC_PATH = 'settings/appConfig';

let unsubscribe: (() => void) | null = null;
let currentListeners: ((config: AppConfig) => void)[] = [];
let currentConfig: AppConfig | null = null;

export const appConfigService = {
  /**
   * Subscribes to application configuration changes using Firestore.
   */
  subscribeToConfig: (callback: (config: AppConfig) => void) => {
    currentListeners.push(callback);
    
    if (currentConfig) {
      callback(currentConfig);
    }

    if (!unsubscribe) {
      const configRef = doc(db, CONFIG_DOC_PATH);
      unsubscribe = safeFirestore.subscribe<AppConfig>(configRef, (data) => {
        const config = Array.isArray(data) ? data[0] : data;
        if (config) {
          currentConfig = config;
          currentListeners.forEach(l => l(config));
        } else {
          // Initialize with default if document doesn't exist
          const defaultConfig: AppConfig = { isOrderingOpen: true };
          safeFirestore.set(configRef, defaultConfig);
        }
      });
    }

    return () => {
      currentListeners = currentListeners.filter(l => l !== callback);
      // We don't necessarily want to unsubscribe from Firestore just because one UI listener left,
      // but if all are gone we could. For simplicity in this app, we'll keep the singleton subscription.
    };
  },

  /**
   * Toggles the ordering status in Firestore.
   */
  toggleOrderingStatus: async (currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const configRef = doc(db, CONFIG_DOC_PATH);
    
    try {
      await safeFirestore.set(configRef, { 
        ...currentConfig, 
        isOrderingOpen: newStatus 
      });
    } catch (error) {
      console.error('Error toggling status in Firestore:', error);
      throw error;
    }
  },

  /**
   * Updates delivery pricing settings in Firestore.
   */
  updateDeliveryPricing: async (pricing: { baseFee: number; perKm: number; freeKm: number }) => {
    const configRef = doc(db, CONFIG_DOC_PATH);
    try {
      await safeFirestore.set(configRef, { 
        ...currentConfig, 
        deliveryBaseFee: pricing.baseFee,
        deliveryFeePerKm: pricing.perKm,
        deliveryFreeKm: pricing.freeKm
      });
    } catch (error) {
      console.error('Error updating delivery pricing:', error);
      throw error;
    }
  },

  /**
   * Fetches the current configuration once from Firestore.
   */
  getConfig: async (): Promise<AppConfig> => {
    try {
      const configRef = doc(db, CONFIG_DOC_PATH);
      const data = await safeFirestore.get<AppConfig>(configRef);
      if (data) return data;
    } catch (error) {
      console.error('Error in getConfig:', error);
    }
    return { isOrderingOpen: true };
  }
};
