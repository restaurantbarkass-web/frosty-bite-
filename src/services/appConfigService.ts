import { supabase } from '../supabase';

export interface AppConfig {
  isOrderingOpen: boolean;
  deliveryBaseFee?: number;
  deliveryFeePerKm?: number;
  deliveryFreeKm?: number;
  updated_at?: any;
}

const CONFIG_KEY = 'app_config';

let channel: any = null;
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

    if (!channel) {
      // First, get initial config
      supabase
        .from('app_settings')
        .select('*')
        .eq('id', CONFIG_KEY)
        .single()
        .then(({ data }) => {
          if (data) {
            const config = data.value as AppConfig;
            currentConfig = config;
            listeners.forEach(l => l(config));
          }
        });

      // Then subscribe to changes
      channel = supabase
        .channel('app_settings_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'app_settings',
          filter: `id=eq.${CONFIG_KEY}` 
        }, (payload) => {
          if (payload.new) {
            const config = (payload.new as any).value as AppConfig;
            currentConfig = config;
            listeners.forEach(l => l(config));
          }
        })
        .subscribe();
    }

    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  },

  /**
   * Toggles the ordering status.
   */
  toggleOrderingStatus: async (currentStatus: boolean) => {
    const newStatus = !currentStatus;
    localStorage.setItem('ordering_status_fallback', String(newStatus));
    
    try {
      const config = { 
        ...currentConfig, 
        isOrderingOpen: newStatus,
        updated_at: new Date().toISOString()
      };
      
      await supabase
        .from('app_settings')
        .upsert({ id: CONFIG_KEY, value: config });
    } catch (error) {
      console.warn('Error toggling status in Supabase:', error);
    }
  },

  /**
   * Updates delivery pricing settings.
   */
  updateDeliveryPricing: async (pricing: { baseFee: number; perKm: number; freeKm: number }) => {
    try {
      const config = { 
        ...currentConfig, 
        deliveryBaseFee: pricing.baseFee,
        deliveryFeePerKm: pricing.perKm,
        deliveryFreeKm: pricing.freeKm,
        updated_at: new Date().toISOString()
      } as AppConfig;

      await supabase
        .from('app_settings')
        .upsert({ id: CONFIG_KEY, value: config });
    } catch (error) {
      console.error('Error updating delivery pricing:', error);
      throw error;
    }
  },

  /**
   * Fetches the current configuration once.
   */
  getConfig: async (): Promise<AppConfig> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', CONFIG_KEY)
        .single();

      if (data) {
        return data.value as AppConfig;
      }
    } catch (error) {
      console.error('Error in getConfig:', error);
    }
    return { isOrderingOpen: true };
  }
};
