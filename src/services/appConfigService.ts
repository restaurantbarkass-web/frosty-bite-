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
let isUpdatingConfig = false;

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
      if (isUpdatingConfig) {
        console.log('[appConfigService] Ignoring incoming real-time Firestore config update during manual update flow');
        return;
      }
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

let supabaseSubscription: any = null;

const startSupabaseRealtime = async () => {
  if (supabaseSubscription) return;

  try {
    const { supabase } = await import('../supabase');
    console.log('[appConfigService] Starting Supabase Realtime subscription for system settings...');
    
    supabaseSubscription = supabase
      .channel('system_settings_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: 'email=eq.system_settings_v1@frostybite.internal'
      }, (payload: any) => {
        if (isUpdatingConfig) {
          console.log('[appConfigService] Ignoring incoming real-time Supabase config update during manual update flow');
          return;
        }
        console.log('[appConfigService] Real-time config update received from Supabase users row:', payload);
        const newRow = payload.new;
        if (newRow && newRow.address) {
          try {
            const fresh = JSON.parse(newRow.address) as AppConfig;
            
            const changed = !currentConfig || 
              currentConfig.isOrderingOpen !== fresh.isOrderingOpen ||
              currentConfig.deliveryBaseFee !== fresh.deliveryBaseFee ||
              currentConfig.deliveryFeePerKm !== fresh.deliveryFeePerKm ||
              currentConfig.deliveryFreeKm !== fresh.deliveryFreeKm;

            if (changed) {
              currentConfig = fresh;
              localStorage.setItem('app_config_cache', JSON.stringify(fresh));
              localStorage.setItem('admin_config_cache', JSON.stringify(fresh));
              currentListeners.forEach(l => l(fresh));
            }
          } catch (e) {
            console.error('[appConfigService] Error parsing Supabase real-time config payload:', e);
          }
        }
      })
      .subscribe();
  } catch (err) {
    console.warn('[appConfigService] Error starting Supabase Realtime subscription:', err);
  }
};

const stopSupabaseRealtime = async () => {
  if (supabaseSubscription) {
    try {
      const { supabase } = await import('../supabase');
      await supabase.removeChannel(supabaseSubscription);
    } catch (e) {
      console.warn('[appConfigService] Error removing Supabase Realtime subscription:', e);
    }
    supabaseSubscription = null;
  }
};

/**
 * Helper to fetch with retries to gracefully handle transient network drops or server restarts
 */
const fetchWithRetry = async (url: string, options?: RequestInit, retries = 3, delay = 800): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries - 1) {
        throw err;
      }
      console.warn(`[appConfigService] Fetch failed, retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Fetch failed after retries');
};

/**
 * Helper to fetch the current active user authentication token (Firebase or Supabase)
 */
const getAuthToken = async (): Promise<string | null> => {
  let firebaseToken: string | null = null;
  if (auth.currentUser) {
    try {
      firebaseToken = await auth.currentUser.getIdToken();
      if (firebaseToken) return firebaseToken;
    } catch (e) {
      console.warn('[appConfigService] Firebase getIdToken failed:', e);
    }
  }

  try {
    const { supabase } = await import('../supabase');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || null;
    if (token) return token;
  } catch (err) {
    console.warn('[appConfigService] Supabase token lookup failed:', err);
  }

  return firebaseToken;
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

    // Active real-time Firestore + Supabase listeners to keep config dynamically synchronized with zero latency
    startFirebaseRealtime();
    startSupabaseRealtime();

    return () => {
      currentListeners = currentListeners.filter(l => l !== callback);
      if (currentListeners.length === 0) {
        stopFirebaseRealtime();
        stopSupabaseRealtime();
      }
    };
  },

  /**
   * Toggles the ordering status directly in Google Firebase Firestore.
   */
  toggleOrderingStatus: async (currentStatus: boolean) => {
    isUpdatingConfig = true;
    const newStatus = !currentStatus;
    const oldConfig = currentConfig ? { ...currentConfig } : null;
    
    const updatedConfig = {
      ...currentConfig,
      isOrderingOpen: newStatus
    } as AppConfig;
    
    // Perform optimistic local update so the UI changes instantly
    currentConfig = updatedConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(updatedConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(updatedConfig));
    currentListeners.forEach(l => l(updatedConfig));

    let backendSuccess = false;
    let lastError: any = null;

    // 1. Call secure backend API to update configuration across targets (Firestore + Supabase)
    try {
      const token = await getAuthToken();
      const response = await fetchWithRetry('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatedConfig)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned status ${response.status}: ${errorText}`);
      }
      backendSuccess = true;
      console.log('[appConfigService] Order open/close status successfully updated via backend API proxy');
    } catch (error: any) {
      console.warn('[appConfigService] Backend API config sync failed:', error);
      lastError = error;
    }

    if (!backendSuccess) {
      isUpdatingConfig = false;
      // Revert optimistic updates on failure
      currentConfig = oldConfig;
      if (oldConfig) {
        localStorage.setItem('app_config_cache', JSON.stringify(oldConfig));
        localStorage.setItem('admin_config_cache', JSON.stringify(oldConfig));
        currentListeners.forEach(l => l(oldConfig));
      } else {
        localStorage.removeItem('app_config_cache');
        localStorage.removeItem('admin_config_cache');
      }
      throw lastError || new Error("Failed to change store status. Backend secure API rejected the transaction.");
    }

    // Hang on to the lock for 3 seconds to let Firestore & Supabase real-time settles without causing flash-backs
    setTimeout(() => {
      isUpdatingConfig = false;
    }, 3000);
  },

  /**
   * Updates delivery pricing settings in Firebase Firestore and Supabase.
   */
  updateDeliveryPricing: async (pricing: { baseFee: number; perKm: number; freeKm: number }) => {
    isUpdatingConfig = true;
    const oldConfig = currentConfig ? { ...currentConfig } : null;
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

    let backendSuccess = false;
    let lastError: any = null;

    // 1. Call secure backend API to update configuration across targets (Firestore + Supabase)
    try {
      const token = await getAuthToken();
      const response = await fetchWithRetry('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatedConfig)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned status ${response.status}: ${errorText}`);
      }
      backendSuccess = true;
      console.log('[appConfigService] Pricing settings successfully updated via backend API proxy');
    } catch (error: any) {
      console.warn('[appConfigService] Backend API pricing sync failed:', error);
      lastError = error;
    }

    if (!backendSuccess) {
      isUpdatingConfig = false;
      // Revert optimistic updates on failure
      currentConfig = oldConfig;
      if (oldConfig) {
        localStorage.setItem('app_config_cache', JSON.stringify(oldConfig));
        localStorage.setItem('admin_config_cache', JSON.stringify(oldConfig));
        currentListeners.forEach(l => l(oldConfig));
      } else {
        localStorage.removeItem('app_config_cache');
        localStorage.removeItem('admin_config_cache');
      }
      throw lastError || new Error("Failed to change delivery pricing. Backend secure API rejected the transaction.");
    }

    // Let real-time settling complete
    setTimeout(() => {
      isUpdatingConfig = false;
    }, 3000);
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
      const response = await fetchWithRetry('/api/config');
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
