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
let isSubscribingSupabase = false;

const startSupabaseRealtime = async () => {
  if (supabaseSubscription || isSubscribingSupabase) return;
  isSubscribingSupabase = true;

  try {
    const { supabase } = await import('../supabase');
    console.log('[appConfigService] Starting Supabase Realtime subscription for system settings...');
    
    // Generate a unique channel ID to prevent "cannot add postgres_changes callbacks... after subscribe"
    const channelId = `system_settings_unique_${Math.random().toString(36).substring(2, 11)}`;
    const channel = supabase
      .channel(channelId)
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
      });

    await channel.subscribe();
    supabaseSubscription = channel;
  } catch (err) {
    console.warn('[appConfigService] Error starting Supabase Realtime subscription:', err);
  } finally {
    isSubscribingSupabase = false;
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
/**
 * Helper to fetch the current active user authentication token (Firebase or Supabase)
 */
const getAuthToken = async (): Promise<string | null> => {
  // 1. Resilient primary fallback: check specific cached token key
  try {
    const cachedToken = localStorage.getItem('latest_admin_auth_token');
    if (cachedToken) {
      console.log('[appConfigService] Found token in latest_admin_auth_token fallback store');
      return cachedToken;
    }
  } catch (err) {}

  let firebaseToken: string | null = null;
  if (auth.currentUser) {
    try {
      firebaseToken = await auth.currentUser.getIdToken();
      if (firebaseToken) {
        localStorage.setItem('latest_admin_auth_token', firebaseToken);
        return firebaseToken;
      }
    } catch (e) {
      console.warn('[appConfigService] Firebase getIdToken failed:', e);
    }
  }

  try {
    const { supabase } = await import('../supabase');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || null;
    if (token) {
      localStorage.setItem('latest_admin_auth_token', token);
      return token;
    }
  } catch (err) {
    console.warn('[appConfigService] Supabase token lookup failed:', err);
  }

  // Backup fallback: scan localStorage if other methods temporarily failed
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && parsed.access_token) {
            localStorage.setItem('latest_admin_auth_token', parsed.access_token);
            return parsed.access_token;
          }
        }
      }
    }
  } catch (lsErr) {
    console.warn('[appConfigService] Error scanning localStorage for auth fallback:', lsErr);
  }

  // 2. Self-healing token scanner: scan all localStorage values for valid admin JWT
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (!val || typeof val !== 'string') continue;

      let candidates = [val];
      try {
        const parsed = JSON.parse(val);
        if (parsed) {
          if (typeof parsed === 'string') {
            candidates.push(parsed);
          } else {
            if (parsed.access_token) candidates.push(parsed.access_token);
            if (parsed.idToken) candidates.push(parsed.idToken);
            if (parsed.token) candidates.push(parsed.token);
            if (parsed.session?.access_token) candidates.push(parsed.session.access_token);
          }
        }
      } catch (_) {}

      for (const candidate of candidates) {
        if (typeof candidate !== 'string') continue;
        const parts = candidate.split('.');
        if (parts.length === 3) {
          try {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payloadStr = atob(base64);
            const payload = JSON.parse(payloadStr);
            if (payload) {
              const email = payload.email || payload.user_metadata?.email || payload.user?.email;
              if (email) {
                const normEmail = email.trim().toLowerCase();
                const ADMIN_EMAILS = [
                  "restaurantbarkass@gmail.com",
                  "wasifmd924@gmail.com",
                  "sayedazainab216@gmail.com",
                  "sayedazainabali76@gmail.com"
                ];
                if (ADMIN_EMAILS.includes(normEmail)) {
                  console.log(`[appConfigService] Self-healed active admin token from localStorage for: ${normEmail}`);
                  localStorage.setItem('latest_admin_auth_token', candidate);
                  return candidate;
                }
              }
            }
          } catch (_) {}
        }
      }
    }
  } catch (scannerErr) {
    console.warn('[appConfigService] Scanner search failed:', scannerErr);
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
  toggleOrderingStatus: async (currentStatus: boolean, customToken?: string | null) => {
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

    let firestoreSuccess = false;
    let backendSuccess = false;
    let lastError: any = null;

    // 1. Dual-Write: Attempt direct Firestore client write (only if authenticated on Firebase client)
    if (auth.currentUser) {
      try {
        console.log('[appConfigService] Attempting direct Firestore client write for open/close state...');
        const configDocRef = doc(db, 'settings', 'appConfig');
        await setDoc(configDocRef, {
          isOrderingOpen: newStatus,
          updated_at: serverTimestamp()
        }, { merge: true }); // fallback merge
        console.log('[appConfigService] Direct Firestore open/close update succeeded!');
        firestoreSuccess = true;
      } catch (fsError: any) {
        console.log('[appConfigService] Direct Firestore client update not permitted (delegating to secure backend proxy):', fsError.message || fsError);
        lastError = fsError;
      }
    } else {
      console.log('[appConfigService] Direct client-side Firestore write skipped (using secure API proxy fallback.)');
    }

    // 2. Dual-Write: Call secure backend API to update configuration across targets (Firestore + Supabase)
    try {
      const token = customToken || await getAuthToken();
      const response = await fetchWithRetry('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatedConfig)
      });
      if (response.ok) {
        backendSuccess = true;
        console.log('[appConfigService] Order open/close status successfully updated via backend API proxy');
      } else {
        const errorText = await response.text();
        console.warn(`[appConfigService] Backend API config sync failed (status ${response.status}): ${errorText}`);
        if (!firestoreSuccess) {
          lastError = new Error(`API returned status ${response.status}: ${errorText}`);
        }
      }
    } catch (error: any) {
      console.warn('[appConfigService] Backend API config sync failed with network/unexpected error:', error);
      if (!firestoreSuccess) {
        lastError = error;
      }
    }

    // If both failed, then we revert optimistic updates on failure
    if (!firestoreSuccess && !backendSuccess) {
      isUpdatingConfig = false;
      currentConfig = oldConfig;
      if (oldConfig) {
        localStorage.setItem('app_config_cache', JSON.stringify(oldConfig));
        localStorage.setItem('admin_config_cache', JSON.stringify(oldConfig));
        currentListeners.forEach(l => l(oldConfig));
      } else {
        localStorage.removeItem('app_config_cache');
        localStorage.removeItem('admin_config_cache');
      }
      throw lastError || new Error("Failed to change store status. Both client-side direct update and backend API proxy failed.");
    }

    // Hang on to the lock for 3 seconds to let Firestore & Supabase real-time settles without causing flash-backs
    setTimeout(() => {
      isUpdatingConfig = false;
    }, 3000);
  },

  /**
   * Updates delivery pricing settings in Firebase Firestore and Supabase.
   */
  updateDeliveryPricing: async (pricing: { baseFee: number; perKm: number; freeKm: number }, customToken?: string | null) => {
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

    let firestoreSuccess = false;
    let backendSuccess = false;
    let lastError: any = null;

    // 1. Dual-Write: Attempt direct Firestore client write (only if authenticated on Firebase client)
    if (auth.currentUser) {
      try {
        console.log('[appConfigService] Attempting direct Firestore client write for delivery settings...');
        const configDocRef = doc(db, 'settings', 'appConfig');
        await setDoc(configDocRef, {
          deliveryBaseFee: pricing.baseFee,
          deliveryFeePerKm: pricing.perKm,
          deliveryFreeKm: pricing.freeKm,
          updated_at: serverTimestamp()
        }, { merge: true }); // fallback merge
        console.log('[appConfigService] Direct Firestore delivery update succeeded!');
        firestoreSuccess = true;
      } catch (fsError: any) {
        console.log('[appConfigService] Direct Firestore client update not permitted (delegating to secure backend proxy):', fsError.message || fsError);
        lastError = fsError;
      }
    } else {
      console.log('[appConfigService] Direct client-side Firestore write skipped (using secure API proxy fallback.)');
    }

    // 2. Dual-Write: Call secure backend API to update configuration across targets (Firestore + Supabase)
    try {
      const token = customToken || await getAuthToken();
      const response = await fetchWithRetry('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatedConfig)
      });
      if (response.ok) {
        backendSuccess = true;
        console.log('[appConfigService] Pricing settings successfully updated via backend API proxy');
      } else {
        const errorText = await response.text();
        console.warn(`[appConfigService] Backend API pricing sync failed (status ${response.status}): ${errorText}`);
        if (!firestoreSuccess) {
          lastError = new Error(`API returned status ${response.status}: ${errorText}`);
        }
      }
    } catch (error: any) {
      console.warn('[appConfigService] Backend API pricing sync failed with network/unexpected error:', error);
      if (!firestoreSuccess) {
        lastError = error;
      }
    }

    // If both failed, then we revert optimistic updates on failure
    if (!firestoreSuccess && !backendSuccess) {
      isUpdatingConfig = false;
      currentConfig = oldConfig;
      if (oldConfig) {
        localStorage.setItem('app_config_cache', JSON.stringify(oldConfig));
        localStorage.setItem('admin_config_cache', JSON.stringify(oldConfig));
        currentListeners.forEach(l => l(oldConfig));
      } else {
        localStorage.removeItem('app_config_cache');
        localStorage.removeItem('admin_config_cache');
      }
      throw lastError || new Error("Failed to change delivery pricing. Both client-side direct update and backend API proxy failed.");
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
      console.log('[appConfigService] Direct Firestore fetch not available or blocked. Trying secure API proxy fallback...');
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
