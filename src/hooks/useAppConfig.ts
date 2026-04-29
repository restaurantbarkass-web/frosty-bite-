import { useState, useEffect } from 'react';
import { appConfigService, AppConfig } from '../services/appConfigService';

export const useAppConfig = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = appConfigService.subscribeToConfig((data) => {
      setConfig(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { config, isLoading, isOrderingOpen: config?.isOrderingOpen ?? true };
};
