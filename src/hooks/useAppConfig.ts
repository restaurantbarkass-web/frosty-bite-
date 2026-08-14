import { useConfig } from '../context/ConfigContext';
import { useMemo } from 'react';

export const useAppConfig = () => {
  const { config, isLoading } = useConfig();

  return useMemo(() => ({ 
    config, 
    isLoading, 
    isOrderingOpen: config?.isOrderingOpen ?? true,
    isPickupOnly: Boolean(config?.pickup_only ?? config?.isPickupOnly ?? false),
    deliveryBaseFee: config?.deliveryBaseFee ?? 20,
    deliveryFeePerKm: config?.deliveryFeePerKm ?? 8,
    deliveryFreeKm: config?.deliveryFreeKm ?? 5,
    defaultDeliveryTime: config?.defaultDeliveryTime ?? 25,
    geofencingEnabled: config?.geofencingEnabled ?? true,
    geofencingLatitude: config?.geofencingLatitude ?? 20.4625,
    geofencingLongitude: config?.geofencingLongitude ?? 85.8828,
    geofencingRadius: config?.geofencingRadius ?? 12,
    geofencingZones: config?.geofencingZones ?? '[]',
    isInstantDeliveryClosed: config?.isInstantDeliveryClosed ?? false
  }), [config, isLoading]);
};
