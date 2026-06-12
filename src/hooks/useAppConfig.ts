import { useState, useEffect } from 'react';
import { appConfigService, AppConfig } from '../services/appConfigService';

export const useAppConfig = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = appConfigService.subscribeToConfig((data) => {
        if (mounted) {
          setConfig(data);
          setIsLoading(false);
        }
      });
    } catch (err) {
      console.warn('Failed to subscribe to app config:', err);
      if (mounted) setIsLoading(false);
    }

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { 
    config, 
    isLoading, 
    isOrderingOpen: config?.isOrderingOpen ?? true,
    deliveryBaseFee: config?.deliveryBaseFee ?? 20,
    deliveryFeePerKm: config?.deliveryFeePerKm ?? 8,
    deliveryFreeKm: config?.deliveryFreeKm ?? 5,
    defaultDeliveryTime: config?.defaultDeliveryTime ?? 25,
    geofencingEnabled: config?.geofencingEnabled ?? true,
    geofencingLatitude: config?.geofencingLatitude ?? 20.4625,
    geofencingLongitude: config?.geofencingLongitude ?? 85.8828,
    geofencingRadius: config?.geofencingRadius ?? 12,
    geofencingZones: config?.geofencingZones ?? '[]'
  };
};
