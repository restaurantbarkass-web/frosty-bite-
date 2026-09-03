import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { appConfigService, AppConfig, BakeryLocation } from '../services/appConfigService';

interface ConfigContextType {
  config: AppConfig | null;
  isLoading: boolean;
  toggleOrderingStatus: (customToken?: string | null) => Promise<void>;
  updatePickupOnlyStatus: (isPickupOnly: boolean, customToken?: string | null) => Promise<void>;
  updateDeliveryPricing: (pricing: any, customToken?: string | null) => Promise<void>;
  updateGeofencingSettings: (settings: any, customToken?: string | null) => Promise<void>;
  updateBakeryLocation: (location: BakeryLocation, customToken?: string | null) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = appConfigService.subscribeToConfig((data) => {
      if (mounted) {
        setConfig(data);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const toggleOrderingStatus = useCallback(async (customToken?: string | null) => {
    if (!config) return;
    await appConfigService.toggleOrderingStatus(config.isOrderingOpen, customToken);
  }, [config]);

  const updatePickupOnlyStatus = useCallback(async (isPickupOnly: boolean, customToken?: string | null) => {
    await appConfigService.updatePickupOnlyStatus(isPickupOnly, customToken);
  }, []);

  const updateDeliveryPricing = useCallback(async (pricing: any, customToken?: string | null) => {
    await appConfigService.updateDeliveryPricing(pricing, customToken);
  }, []);

  const updateGeofencingSettings = useCallback(async (settings: any, customToken?: string | null) => {
    await appConfigService.updateGeofencingSettings(settings, customToken);
  }, []);

  const updateBakeryLocation = useCallback(async (location: BakeryLocation, customToken?: string | null) => {
    await appConfigService.updateBakeryLocation(location, customToken);
  }, []);

  const value = useMemo(() => ({
    config,
    isLoading,
    toggleOrderingStatus,
    updatePickupOnlyStatus,
    updateDeliveryPricing,
    updateGeofencingSettings,
    updateBakeryLocation
  }), [config, isLoading, toggleOrderingStatus, updatePickupOnlyStatus, updateDeliveryPricing, updateGeofencingSettings, updateBakeryLocation]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
};

