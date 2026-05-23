import { auth } from '../firebase';

export interface AppConfig {
  isOrderingOpen: boolean;
  deliveryBaseFee?: number;
  deliveryFeePerKm?: number;
  deliveryFreeKm?: number;
  updated_at?: any;
}

let currentListeners: ((config: AppConfig) => void)[] = [];
let pollInterval: any = null;

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

const startPolling = () => {
  if (pollInterval) return;
  // Poll every 5 seconds to ensure changes reflect instantly across other users and admins
  pollInterval = setInterval(async () => {
    if (currentListeners.length === 0) {
      stopPolling();
      return;
    }
    try {
      const fresh = await appConfigService.getConfig();
      if (fresh) {
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
      }
    } catch (e) {
      // Suppressed
    }
  }, 5000);
};

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
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
   * Subscribes to application configuration changes using standard Supabase REST and polling.
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

    // Active polling to keep config dynamically synchronized without Firestore overhead
    startPolling();

    return () => {
      currentListeners = currentListeners.filter(l => l !== callback);
      if (currentListeners.length === 0) {
        stopPolling();
      }
    };
  },

  /**
   * Toggles the ordering status in the Supabase DB via our secure backend API.
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
    
    // Call backend secure API to synchronize in the Supabase REST endpoint
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
      console.error('[appConfigService] Backend API config sync failed:', error);
    }
  },

  /**
   * Updates delivery pricing settings in Supabase via secure backend API.
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

    // Call backend secure API to synchronize in the Supabase REST endpoint
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
      console.error('[appConfigService] Backend API pricing sync failed:', error);
    }
  },

  /**
   * Fetches the current configuration once from the secure backend.
   */
  getConfig: async (): Promise<AppConfig> => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          currentConfig = data;
          localStorage.setItem('app_config_cache', JSON.stringify(data));
          return data;
        }
      }
    } catch (error) {
      console.error('Error in getConfig backend fetch:', error);
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
