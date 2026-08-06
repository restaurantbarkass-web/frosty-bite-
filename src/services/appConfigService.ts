import { AppConfig } from '../types';
export type { AppConfig };

const defaultParams: AppConfig = { 
  isOrderingOpen: true,
  pickup_only: false,
  isPickupOnly: false,
  deliveryBaseFee: 15,
  deliveryFeePerKm: 5,
  deliveryFreeKm: 3,
  defaultDeliveryTime: 25,
  geofencingEnabled: true,
  geofencingLatitude: 20.4625,
  geofencingLongitude: 85.8828,
  geofencingRadius: 12,
  geofencingZones: '[]',
  isInstantDeliveryClosed: false
};

let currentConfig: AppConfig = (() => {
  try {
    const cached = localStorage.getItem('app_config_cache') || localStorage.getItem('admin_config_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object') {
        return { ...defaultParams, ...parsed };
      }
    }
  } catch (e) {}
  return defaultParams;
})();

let currentListeners: Array<(config: AppConfig) => void> = [];
let pollingInterval: any = null;
let supabaseSubscription: any = null;
let isSubscribingSupabase = false;

// Fetch current active user authentication token from active Supabase session
const getAuthToken = async (): Promise<string | null> => {
  try {
    const { supabase } = await import('../supabase');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || null;
    if (token && token !== 'null' && token !== 'undefined') {
      localStorage.setItem('latest_admin_auth_token', token);
      return token;
    }
  } catch (err) {
    console.warn('[appConfigService] Supabase token retrieval failed:', err);
  }

  // Fallback to cached token
  try {
    const cachedToken = localStorage.getItem('latest_admin_auth_token');
    if (cachedToken && cachedToken !== 'null' && cachedToken !== 'undefined' && cachedToken.trim() !== '') {
      return cachedToken;
    }
  } catch (err) {}

  // Self-healing scanner for any stored token
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
            if (parsed.token) candidates.push(parsed.token);
            if (parsed.session?.access_token) candidates.push(parsed.session.access_token);
          }
        }
      } catch (_) {}

      for (const candidate of candidates) {
        if (typeof candidate !== 'string' || candidate === 'null' || candidate === 'undefined') continue;
        const parts = candidate.split('.');
        if (parts.length === 3) {
          try {
            const base64Url = parts[1];
            let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) {
              base64 += '=';
            }
            const payload = JSON.parse(atob(base64));
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

  return null;
};

// Start Supabase Realtime subscription on the app_settings table system settings row
const startSupabaseRealtime = async () => {
  if (supabaseSubscription || isSubscribingSupabase) return;
  isSubscribingSupabase = true;

  try {
    const { supabase } = await import('../supabase');
    
    const channel = supabase.channel('app-settings-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_settings'
      }, (payload: any) => {
        const row = payload.new;
        if (row && row.id === '1') {
          const value = row.value;
          if (value) {
            try {
              const fresh = typeof value === 'string' ? JSON.parse(value) : value;
              if (fresh) {
                const merged = { ...defaultParams, ...fresh };
                const changed = JSON.stringify(currentConfig) !== JSON.stringify(merged);
                if (changed) {
                  currentConfig = merged;
                  localStorage.setItem('app_config_cache', JSON.stringify(merged));
                  localStorage.setItem('admin_config_cache', JSON.stringify(merged));
                  console.log('[appConfigService] Real-time settings update received:', merged);
                  currentListeners.forEach(l => l(merged));
                }
              }
            } catch (e) {
              console.error('[appConfigService] Error parsing Supabase real-time config:', e);
            }
          }
        }
      });

    await channel.subscribe((status) => {
      console.log('[appConfigService] Supabase Realtime subscription status:', status);
    });
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

const fetchWithRetry = async (url: string, options?: RequestInit, retries = 3, delay = 800): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Fetch failed after retries');
};

export const appConfigService = {
  subscribeToConfig: (callback: (config: AppConfig) => void) => {
    currentListeners.push(callback);
    callback(currentConfig);

    appConfigService.getConfig().then(fresh => {
      const changed = JSON.stringify(currentConfig) !== JSON.stringify(fresh);
      if (changed) {
        currentConfig = fresh;
        localStorage.setItem('app_config_cache', JSON.stringify(fresh));
        localStorage.setItem('admin_config_cache', JSON.stringify(fresh));
        currentListeners.forEach(l => l(fresh));
      }
    }).catch(() => {});

    startSupabaseRealtime();

    if (!pollingInterval) {
      pollingInterval = setInterval(async () => {
        try {
          const fresh = await appConfigService.getConfig();
          if (fresh) {
            const changed = JSON.stringify(currentConfig) !== JSON.stringify(fresh);
            if (changed) {
              currentConfig = fresh;
              localStorage.setItem('app_config_cache', JSON.stringify(fresh));
              localStorage.setItem('admin_config_cache', JSON.stringify(fresh));
              currentListeners.forEach(l => l(fresh));
            }
          }
        } catch (err) {}
      }, 20000); // 20s gentle polling fallback for production-grade efficiency
    }

    return () => {
      currentListeners = currentListeners.filter(l => l !== callback);
      if (currentListeners.length === 0) {
        stopSupabaseRealtime();
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
      }
    };
  },

  toggleOrderingStatus: async (currentStatus: boolean, customToken?: string | null) => {
    const newStatus = !currentStatus;
    const updatedConfig = {
      ...currentConfig,
      isOrderingOpen: newStatus,
      updated_at: new Date().toISOString()
    } as AppConfig;

    try {
      const token = (customToken && customToken !== 'null' && customToken !== 'undefined') ? customToken : await getAuthToken();
      const response = await fetchWithRetry('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ isOrderingOpen: newStatus })
      });
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const freshResponse = await response.json();
      const freshConfig = { ...defaultParams, ...(freshResponse.config || updatedConfig) };

      currentConfig = freshConfig;
      localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
      localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
      currentListeners.forEach(l => l(freshConfig));
    } catch (error) {
      throw error;
    }
  },

  updatePickupOnlyStatus: async (isPickupOnly: boolean, customToken?: string | null) => {
    const updatedConfig = {
      ...currentConfig,
      pickup_only: isPickupOnly,
      isPickupOnly: isPickupOnly,
      updated_at: new Date().toISOString()
    } as AppConfig;

    try {
      const token = (customToken && customToken !== 'null' && customToken !== 'undefined') ? customToken : await getAuthToken();
      const response = await fetchWithRetry('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ pickup_only: isPickupOnly, isPickupOnly: isPickupOnly })
      });
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const freshResponse = await response.json();
      const freshConfig = { ...defaultParams, ...(freshResponse.config || updatedConfig) };

      currentConfig = freshConfig;
      localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
      localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
      currentListeners.forEach(l => l(freshConfig));
    } catch (error) {
      throw error;
    }
  },

  updateDeliveryPricing: async (pricing: { baseFee: number; perKm: number; freeKm: number; defaultDeliveryTime: number; isInstantDeliveryClosed?: boolean }, customToken?: string | null) => {
    const updatedConfig = {
      ...currentConfig,
      deliveryBaseFee: pricing.baseFee,
      deliveryFeePerKm: pricing.perKm,
      deliveryFreeKm: pricing.freeKm,
      defaultDeliveryTime: pricing.defaultDeliveryTime,
      isInstantDeliveryClosed: pricing.isInstantDeliveryClosed ?? false,
      updated_at: new Date().toISOString()
    } as AppConfig;

    try {
      const token = (customToken && customToken !== 'null' && customToken !== 'undefined') ? customToken : await getAuthToken();
      const response = await fetchWithRetry('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          deliveryBaseFee: pricing.baseFee,
          deliveryFeePerKm: pricing.perKm,
          deliveryFreeKm: pricing.freeKm,
          defaultDeliveryTime: pricing.defaultDeliveryTime,
          isInstantDeliveryClosed: pricing.isInstantDeliveryClosed ?? false
        })
      });
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const freshResponse = await response.json();
      const freshConfig = { ...defaultParams, ...(freshResponse.config || updatedConfig) };

      currentConfig = freshConfig;
      localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
      localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
      currentListeners.forEach(l => l(freshConfig));
    } catch (error) {
      throw error;
    }
  },

  updateGeofencingSettings: async (settings: { 
    geofencingEnabled: boolean; 
    geofencingLatitude: number; 
    geofencingLongitude: number; 
    geofencingRadius: number; 
    geofencingZones?: string;
  }, customToken?: string | null) => {
    const updatedConfig = {
      ...currentConfig,
      geofencingEnabled: settings.geofencingEnabled,
      geofencingLatitude: settings.geofencingLatitude,
      geofencingLongitude: settings.geofencingLongitude,
      geofencingRadius: settings.geofencingRadius,
      geofencingZones: settings.geofencingZones ?? '[]',
      updated_at: new Date().toISOString()
    } as AppConfig;

    try {
      const token = (customToken && customToken !== 'null' && customToken !== 'undefined') ? customToken : await getAuthToken();
      const response = await fetchWithRetry('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          geofencingEnabled: settings.geofencingEnabled,
          geofencingLatitude: settings.geofencingLatitude,
          geofencingLongitude: settings.geofencingLongitude,
          geofencingRadius: settings.geofencingRadius,
          geofencingZones: settings.geofencingZones ?? '[]'
        })
      });
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const freshResponse = await response.json();
      const freshConfig = { ...defaultParams, ...(freshResponse.config || updatedConfig) };

      currentConfig = freshConfig;
      localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
      localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
      currentListeners.forEach(l => l(freshConfig));
    } catch (error) {
      throw error;
    }
  },

  getConfig: async (): Promise<AppConfig> => {
    let backendConfig: AppConfig | null = null;

    try {
      const response = await fetchWithRetry('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          backendConfig = data.config || data;
        }
      }
    } catch (error) {
      console.warn('[appConfigService] Error in getConfig backend fetch:', error);
    }

    let latestConfig: AppConfig;
    if (backendConfig) {
      latestConfig = { ...defaultParams, ...backendConfig };
    } else {
      latestConfig = { ...defaultParams, ...currentConfig };
    }

    currentConfig = latestConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(latestConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(latestConfig));
    return latestConfig;
  }
};
