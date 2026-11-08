import { AppConfig, BakeryLocation, ClosureDetails } from '../types';
import { safeTrim, safeTrimLowerCase } from '../utils/string';
import { liveAlertService } from './liveAlertService';
export type { AppConfig, BakeryLocation, ClosureDetails };

const defaultParams: AppConfig = { 
  isOrderingOpen: true,
  pickup_only: false,
  isPickupOnly: false,
  deliveryBaseFee: 15,
  deliveryFeePerKm: 5,
  deliveryFreeKm: 3,
  defaultDeliveryTime: 25,
  geofencingEnabled: false,
  geofencingLatitude: 20.4625,
  geofencingLongitude: 85.8828,
  geofencingRadius: 12,
  geofencingZones: '[]',
  isInstantDeliveryClosed: false,
  bakeryName: "Frosty Bite Bakery",
  bakeryAddress: "Frosty Bite Bakery, Main Road, Buxi Bazaar, Cuttack, Odisha - 753001",
  bakeryLatitude: 20.4625,
  bakeryLongitude: 85.8828,
  bakeryMapUrl: "https://www.google.com/maps/search/?api=1&query=20.4625,85.8828",
  bakeryLocationConfirmed: true,
  feedbackUrl: "",
  websiteUrl: "https://frosty-bite.vercel.app",
  closureTitle: "Taking a Little Break! ❤️",
  closureReason: "Our bakery is temporarily closed while we prepare something special for you.",
  storeClosedReason: "Our bakery is temporarily closed while we prepare something special for you.",
  closureMessage: "Thank you for your love and patience. We can't wait to serve you again.",
  reopenDate: "",
  reopenTime: "",
  closureImage: "",
  reopeningMessage: "WE ARE BACK! 🎉 Frosty Bite Bakery is officially OPEN again! Your favourite cakes and desserts are waiting for you."
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
    if (cachedToken && cachedToken !== 'null' && cachedToken !== 'undefined' && safeTrim(cachedToken) !== '') {
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
                const normEmail = safeTrimLowerCase(email);
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
                  liveAlertService.handleConfigTransition(merged);
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

    appConfigService.getConfig().then((fresh) => {
      const changed = JSON.stringify(currentConfig) !== JSON.stringify(fresh);
      if (changed) {
        currentConfig = fresh;
        localStorage.setItem('app_config_cache', JSON.stringify(fresh));
        localStorage.setItem('admin_config_cache', JSON.stringify(fresh));
        liveAlertService.handleConfigTransition(fresh);
        currentListeners.forEach(l => l(fresh));
      }
    }).catch(() => {});

    startSupabaseRealtime();

    if (!pollingInterval) {
      pollingInterval = setInterval(async () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        try {
          const fresh = await appConfigService.getConfig();
          if (fresh) {
            const changed = JSON.stringify(currentConfig) !== JSON.stringify(fresh);
            if (changed) {
              currentConfig = fresh;
              localStorage.setItem('app_config_cache', JSON.stringify(fresh));
              localStorage.setItem('admin_config_cache', JSON.stringify(fresh));
              liveAlertService.handleConfigTransition(fresh);
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

  toggleOrderingStatus: async (currentStatus: boolean, closureData?: string | ClosureDetails, customToken?: string | null) => {
    const newStatus = !currentStatus;
    const token = (customToken && customToken !== 'null' && customToken !== 'undefined') ? customToken : await getAuthToken();

    let closurePayload: ClosureDetails = {};
    if (typeof closureData === 'string') {
      closurePayload = {
        title: 'Taking a Little Break! ❤️',
        reason: closureData.trim() || 'Our bakery is temporarily closed while we prepare something special for you.',
        message: "Thank you for your love and patience. We can't wait to serve you again."
      };
    } else if (closureData && typeof closureData === 'object') {
      closurePayload = closureData;
    }

    const title = closurePayload.title?.trim() || 'Taking a Little Break! ❤️';
    const reason = closurePayload.reason?.trim() || 'Our bakery is temporarily closed while we prepare something special for you.';
    const message = closurePayload.message?.trim() || "Thank you for your love and patience. We can't wait to serve you again.";
    const reopenDate = closurePayload.reopenDate?.trim() || '';
    const reopenTime = closurePayload.reopenTime?.trim() || '';
    const closureImage = closurePayload.closureImage?.trim() || '';
    const reopeningMessage = closurePayload.reopeningMessage?.trim() || 'WE ARE BACK! 🎉 Frosty Bite Bakery is officially OPEN again! Your favourite cakes and desserts are waiting for you.';

    // Fire instant broadcast so all connected mobile devices get the popup immediately in <100ms
    if (newStatus === false) {
      liveAlertService.broadcastLiveEvent({
        type: 'STORE_CLOSED',
        title: title,
        message: message,
        reason: reason,
        reopenDate,
        reopenTime,
        closureTitle: title,
        closureMessage: message,
        closureImage,
        badge: '🔴 Store Temporarily Closed',
        actionText: 'Continue Exploring',
        source: 'admin_toggle'
      });
    } else {
      // When store opens, popup will NOT show!
      liveAlertService.broadcastLiveEvent({
        type: 'STORE_OPEN',
        title: "WE ARE BACK! 🎉",
        message: reopeningMessage,
        reopeningMessage: reopeningMessage,
        badge: "🟢 We're Open & Baking!",
        source: 'admin_toggle'
      });
    }

    const response = await fetchWithRetry('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ 
        isOrderingOpen: newStatus,
        closureTitle: newStatus ? '' : title,
        closureReason: newStatus ? '' : reason,
        storeClosedReason: newStatus ? '' : reason,
        closureMessage: newStatus ? '' : message,
        reopenDate: newStatus ? '' : reopenDate,
        reopenTime: newStatus ? '' : reopenTime,
        closureImage: newStatus ? '' : closureImage,
        reopeningMessage: reopeningMessage,
        closureUpdatedAt: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.message || `Failed to update ordering status (HTTP ${response.status})`);
    }

    const freshResponse = await response.json().catch(() => null);
    const freshConfig: AppConfig = { ...defaultParams, ...(freshResponse?.config || { 
      ...currentConfig, 
      isOrderingOpen: newStatus,
      closureTitle: newStatus ? '' : title,
      closureReason: newStatus ? '' : reason,
      storeClosedReason: newStatus ? '' : reason,
      closureMessage: newStatus ? '' : message,
      reopenDate: newStatus ? '' : reopenDate,
      reopenTime: newStatus ? '' : reopenTime,
      closureImage: newStatus ? '' : closureImage,
      reopeningMessage: reopeningMessage
    }) };

    currentConfig = freshConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
    currentListeners.forEach(l => l(freshConfig));
  },

  updatePickupOnlyStatus: async (isPickupOnly: boolean, customToken?: string | null) => {
    const token = (customToken && customToken !== 'null' && customToken !== 'undefined') ? customToken : await getAuthToken();

    // Fire instant broadcast for pickup only changes
    if (isPickupOnly) {
      liveAlertService.broadcastLiveEvent({
        type: 'PICKUP_ONLY',
        title: 'Switched to Bakery Pickup Only 🛍️',
        message: 'Due to kitchen capacity or high demand, online orders are currently accepting In-Store Pickup only. Place your order and collect fresh from our counter!',
        badge: '🛍️ Pickup Only Active',
        actionText: 'Got It, View Pickup Menu',
        source: 'admin_toggle'
      });
    } else {
      liveAlertService.broadcastLiveEvent({
        type: 'DELIVERY_RESTORED',
        title: 'Doorstep Delivery Is Back! 🚀',
        message: 'Delivery service is now fully active! Order your favorite bakery delights delivered directly to your doorstep.',
        badge: '🚀 Home Delivery Restored',
        actionText: 'Order for Delivery',
        source: 'admin_toggle'
      });
    }

    const response = await fetchWithRetry('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ pickup_only: isPickupOnly, isPickupOnly: isPickupOnly })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.message || `Failed to update pickup status (HTTP ${response.status})`);
    }

    const freshResponse = await response.json().catch(() => null);
    const freshConfig: AppConfig = { ...defaultParams, ...(freshResponse?.config || { ...currentConfig, pickup_only: isPickupOnly, isPickupOnly: isPickupOnly }) };

    currentConfig = freshConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
    currentListeners.forEach(l => l(freshConfig));
  },

  updateDeliveryPricing: async (pricing: { baseFee: number; perKm: number; freeKm: number; defaultDeliveryTime: number; isInstantDeliveryClosed?: boolean }, customToken?: string | null) => {
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
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.message || `Failed to update delivery pricing (HTTP ${response.status})`);
    }

    const freshResponse = await response.json().catch(() => null);
    const freshConfig: AppConfig = { ...defaultParams, ...(freshResponse?.config || {
      ...currentConfig,
      deliveryBaseFee: pricing.baseFee,
      deliveryFeePerKm: pricing.perKm,
      deliveryFreeKm: pricing.freeKm,
      defaultDeliveryTime: pricing.defaultDeliveryTime,
      isInstantDeliveryClosed: pricing.isInstantDeliveryClosed ?? false
    }) };

    currentConfig = freshConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
    currentListeners.forEach(l => l(freshConfig));
  },

  updateGeofencingSettings: async (settings: { 
    geofencingEnabled: boolean; 
    geofencingLatitude: number; 
    geofencingLongitude: number; 
    geofencingRadius: number; 
    geofencingZones?: string;
  }, customToken?: string | null) => {
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
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.message || `Failed to update geofencing settings (HTTP ${response.status})`);
    }

    const freshResponse = await response.json().catch(() => null);
    const freshConfig: AppConfig = { ...defaultParams, ...(freshResponse?.config || {
      ...currentConfig,
      geofencingEnabled: settings.geofencingEnabled,
      geofencingLatitude: settings.geofencingLatitude,
      geofencingLongitude: settings.geofencingLongitude,
      geofencingRadius: settings.geofencingRadius,
      geofencingZones: settings.geofencingZones ?? '[]'
    }) };

    currentConfig = freshConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
    currentListeners.forEach(l => l(freshConfig));
  },

  updateBakeryLocation: async (location: BakeryLocation, customToken?: string | null) => {
    const token = (customToken && customToken !== 'null' && customToken !== 'undefined') ? customToken : await getAuthToken();

    const response = await fetchWithRetry('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        bakeryName: location.bakeryName,
        bakeryAddress: location.bakeryAddress,
        bakeryLatitude: location.bakeryLatitude,
        bakeryLongitude: location.bakeryLongitude,
        bakeryMapUrl: location.bakeryMapUrl,
        bakeryLocationConfirmed: true,
        bakeryLocationUpdatedAt: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.message || `Failed to update bakery location (HTTP ${response.status})`);
    }

    const freshResponse = await response.json().catch(() => null);
    const freshConfig: AppConfig = { ...defaultParams, ...(freshResponse?.config || {
      ...currentConfig,
      bakeryName: location.bakeryName ?? currentConfig.bakeryName,
      bakeryAddress: location.bakeryAddress ?? currentConfig.bakeryAddress,
      bakeryLatitude: location.bakeryLatitude ?? currentConfig.bakeryLatitude,
      bakeryLongitude: location.bakeryLongitude ?? currentConfig.bakeryLongitude,
      bakeryMapUrl: location.bakeryMapUrl ?? currentConfig.bakeryMapUrl,
      bakeryLocationConfirmed: true,
      bakeryLocationUpdatedAt: new Date().toISOString()
    }) };

    currentConfig = freshConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
    currentListeners.forEach(l => l(freshConfig));
  },

  updateCustomerLinks: async (links: { feedbackUrl?: string; websiteUrl?: string }, customToken?: string | null) => {
    const token = (customToken && customToken !== 'null' && customToken !== 'undefined') ? customToken : await getAuthToken();

    const response = await fetchWithRetry('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        feedbackUrl: links.feedbackUrl !== undefined ? links.feedbackUrl.trim() : (currentConfig.feedbackUrl || ''),
        websiteUrl: links.websiteUrl !== undefined ? links.websiteUrl.trim() : (currentConfig.websiteUrl || '')
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.message || `Failed to update customer links (HTTP ${response.status})`);
    }

    const freshResponse = await response.json().catch(() => null);
    const freshConfig: AppConfig = { ...defaultParams, ...(freshResponse?.config || {
      ...currentConfig,
      feedbackUrl: links.feedbackUrl !== undefined ? links.feedbackUrl.trim() : currentConfig.feedbackUrl,
      websiteUrl: links.websiteUrl !== undefined ? links.websiteUrl.trim() : currentConfig.websiteUrl
    }) };

    currentConfig = freshConfig;
    localStorage.setItem('app_config_cache', JSON.stringify(freshConfig));
    localStorage.setItem('admin_config_cache', JSON.stringify(freshConfig));
    currentListeners.forEach(l => l(freshConfig));
  },

  getConfig: async (): Promise<AppConfig> => {
    let backendConfig: AppConfig | null = null;

    try {
      const response = await fetchWithRetry('/api/config');
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data) {
          backendConfig = data.config || data;
        }
      }
    } catch (error) {
      console.warn('[appConfigService] Error in getConfig backend fetch:', error);
    }

    if (!backendConfig) {
      try {
        const { supabase } = await import('../supabase');
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('id', '1')
          .maybeSingle();
        if (!error && data && data.value) {
          const val = data.value;
          backendConfig = typeof val === 'string' ? JSON.parse(val) : val;
          console.log('[appConfigService] Direct Supabase config read fallback successful:', backendConfig);
        }
      } catch (err) {
        console.warn('[appConfigService] Direct Supabase config read fallback failed:', err);
      }
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

// Reliable status refresh when application returns to foreground (Capacitor Android and web browsers)
if (typeof document !== 'undefined') {
  const handleForegroundStatusRefresh = async () => {
    if (document.visibilityState === 'visible') {
      try {
        const fresh = await appConfigService.getConfig();
        if (fresh) {
          const changed = JSON.stringify(currentConfig) !== JSON.stringify(fresh);
          if (changed) {
            currentConfig = fresh;
            localStorage.setItem('app_config_cache', JSON.stringify(fresh));
            localStorage.setItem('admin_config_cache', JSON.stringify(fresh));
            liveAlertService.handleConfigTransition(fresh);
            currentListeners.forEach(l => l(fresh));
          }
        }
      } catch (e) {
        console.warn('[appConfigService] Foreground status refresh failed:', e);
      }
    }
  };

  document.addEventListener('visibilitychange', handleForegroundStatusRefresh);
  window.addEventListener('focus', handleForegroundStatusRefresh);
}
