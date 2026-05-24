import { auth, db } from '../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestoreService';

export interface AppConfig {
  isOrderingOpen: boolean;
  deliveryBaseFee?: number;
  deliveryFeePerKm?: number;
  deliveryFreeKm?: number;
  updated_at?: any;
}

let currentListeners: ((config: AppConfig) => void)[] = [];
let firebaseUnsubscribe: (() => void) | null = null;

let currentConfig: AppConfig | null = (() => {
  const cached = localStorage.getItem('app_config_cache');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      return null;
    }
  }
  return null;
})();

const startFirebaseRealtime = () => {
  if (firebaseUnsubscribe) return;

  try {
    const configDocRef = doc(db, 'settings', 'appConfig');
    console.log('[appConfigService] Starting Firebase Realtime (onSnapshot) snapshot listener for setting/appConfig...');
    
    firebaseUnsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const fresh = snapshot.data() as AppConfig;
        console.log('[appConfigService] Real-time config update received from Firestore settings/appConfig:', fresh);
        
        let freshUpdatedAt = fresh.updated_at;
        if (freshUpdatedAt && typeof freshUpdatedAt.toDate === 'function') {
          freshUpdatedAt = freshUpdatedAt.toDate().toISOString();
        }

        const normalizedFresh = {
          ...fresh,
          updated_at: freshUpdatedAt
        };

        const changed = !currentConfig || 
          currentConfig.isOrderingOpen !== normalizedFresh.isOrderingOpen ||
          currentConfig.deliveryBaseFee !== normalizedFresh.deliveryBaseFee ||
          currentConfig.deliveryFeePerKm !== normalizedFresh.deliveryFeePerKm ||
          currentConfig.deliveryFreeKm !== normalizedFresh.deliveryFreeKm ||
          JSON.stringify(currentConfig.updated_at) !== JSON.stringify(normalizedFresh.updated_at);

        if (changed) {
          currentConfig = normalizedFresh;
          localStorage.setItem('app_config_cache', JSON.stringify(normalizedFresh));
          localStorage.setItem('admin_config_cache', JSON.stringify(normalizedFresh));
          currentListeners.forEach(l => l(normalizedFresh));
        }
      } else {
        console.warn('[appConfigService] Firestore settings/appConfig document does not exist yet');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/appConfig');
    });
  } catch (err) {
    console.error('[appConfigService] Failed to initialize Firestore real-time config:', err);
  }
};

const stopFirebaseRealtime = () => {
  if (firebaseUnsubscribe) {
    try {
      firebaseUnsubscribe();
    } catch (e) {
      console.warn('[appConfigService] Error unsubscribing from Firestore:', e);
    }
    firebaseUnsubscribe = null;
  }
};

/**
 * Helper to fetch the current active user authentication token (Firebase or Supabase)
 */
const getAuthToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('[appConfigService] Firebase getIdToken failed:', e);
    }
  }

  try {
    const { supabase } = await import('../supabase');
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch (err) {
    console.warn('[appConfigService] Supabase token lookup failed:', err);
    return null;
  }
};

export const appConfigService = {
  /**
   * Subscribes to application configuration changes using Google Firebase Firestore Realtime.
   */
  subscribeToConfig: (callback: (config: AppConfig) => void) => {
    currentListeners.push(callback);
    
    // Immediately emit whatever is current (or cached) to avoid blank screens
    if (currentConfig) {
      callback(currentConfig);
    } else {
      const defaultConfig: AppConfig = { isOrderingOpen: true };
      callback(defaultConfig);
    }

    // Trigger immediate configuration fetch to get accurate state instantly
    appConfigService.getConfig().then(fresh => {
      if (fresh) {
        const changed = !currentConfig || JSON.stringify(currentConfig) !== JSON.stringify(fresh);
        if (changed) {
          currentConfig = fresh;
          localStorage.setItem('app_config_cache', JSON.stringify(fresh));
          localStorage.setItem('admin_config_cache', JSON.stringify(fresh));
          currentListeners.forEach(l => l(fresh));
        }
      }
    }).catch(() => {});

    // Active real-time Firestore listener to keep config dynamically synchronized with zero latency
    startFirebaseRealtime();

    return () => {
      currentListeners = currentListeners.filter(l => l !== callback);
      if (currentListeners.length === 0) {
        stopFirebaseRealtime();
      }
    };
  },

  /**
   * Toggles the ordering status directly in Google Firebase Firestore.
   */
  toggleOrderingStatus: async (currentStatus: boolean) => {
    const newStatus = !currentStatus;
    
    const updatedConfig = {
      ...currentConfig,
      isOrderingOpen: newStatus
    } as AppConfig;
    
    // Perform optimistic local update so the UI changes instantly
    currentConfig = updatedConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(updatedConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(updatedConfig));
    currentListeners.forEach(l => l(updatedConfig));

    // 1. Write directly to Firestore (primary master switch managed directly by Firebase)
    try {
      const configDocRef = doc(db, 'settings', 'appConfig');
      await setDoc(configDocRef, {
        isOrderingOpen: newStatus,
        updated_at: serverTimestamp()
      }, { merge: true });
      console.log('[appConfigService] Order open/close status updated directly in Firestore');
    } catch (fsError) {
      console.warn('[appConfigService] Direct Firestore open/close update failed:', fsError);
    }
    
    // 2. Call backend secure API to synchronize in the Supabase REST endpoint in background
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatedConfig)
      });
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error) {
      console.warn('[appConfigService] Backend API config sync failed:', error);
    }
  },

  /**
   * Updates delivery pricing settings in Firebase Firestore and Supabase.
   */
  updateDeliveryPricing: async (pricing: { baseFee: number; perKm: number; freeKm: number }) => {
    const updatedConfig = {
      ...currentConfig, 
      isOrderingOpen: currentConfig?.isOrderingOpen ?? true,
      deliveryBaseFee: pricing.baseFee,
      deliveryFeePerKm: pricing.perKm,
      deliveryFreeKm: pricing.freeKm
    } as AppConfig;

    // Perform optimistic local update so the UI changes instantly
    currentConfig = updatedConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(updatedConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(updatedConfig));
    currentListeners.forEach(l => l(updatedConfig));

    // 1. Write directly to Firestore (primary master settings update managed directly by Firebase)
    try {
      const configDocRef = doc(db, 'settings', 'appConfig');
      await setDoc(configDocRef, {
        deliveryBaseFee: pricing.baseFee,
        deliveryFeePerKm: pricing.perKm,
        deliveryFreeKm: pricing.freeKm,
        updated_at: serverTimestamp()
      }, { merge: true });
      console.log('[appConfigService] Pricing settings updated directly in Firestore');
    } catch (fsError) {
      console.warn('[appConfigService] Direct Firestore settings update failed:', fsError);
    }

    // 2. Call backend secure API to synchronize in the Supabase REST endpoint in background
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatedConfig)
      });
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error) {
      console.warn('[appConfigService] Backend API pricing sync failed:', error);
    }
  },

  /**
   * Fetches the current configuration once from the secure database.
   * Leverages real-time strict Firestore fetching first to ensure 100% accurate up-to-the-second access.
   */
  getConfig: async (): Promise<AppConfig> => {
    // 1. Try Firestore direct read for absolute strict verification
    try {
      const configDocRef = doc(db, 'settings', 'appConfig');
      const docSnap = await getDoc(configDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as AppConfig;
        
        let freshUpdatedAt = data.updated_at;
        if (freshUpdatedAt && typeof freshUpdatedAt.toDate === 'function') {
          freshUpdatedAt = freshUpdatedAt.toDate().toISOString();
        }

        const normalized: AppConfig = {
          ...data,
          updated_at: freshUpdatedAt
        };

        currentConfig = normalized;
        localStorage.setItem('app_config_cache', JSON.stringify(normalized));
        return normalized;
      }
    } catch (fbErr) {
      console.warn('[appConfigService] Direct Firestore fetch failed or blocked. Trying secure API proxy fallback:', fbErr);
    }

    // 2. Fall back to secure backend proxy if offline, restricted or doesn't exist
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          currentConfig = data;
          localStorage.setItem('app_config_cache', JSON.stringify(data));
          return data;
        }
      } else {
        console.warn(`[appConfigService] Backend configuration sync returned non-OK status: ${response.status}`);
      }
    } catch (error) {
      console.warn('[appConfigService] Error in getConfig backend fetch (active localStorage fallback is being used):', error);
    }
    
    // Return cached or default (with standard pricing fallbacks if needed)
    return currentConfig || { 
      isOrderingOpen: true,
      deliveryBaseFee: 15,
      deliveryFeePerKm: 5,
      deliveryFreeKm: 3
    };
  }
};
