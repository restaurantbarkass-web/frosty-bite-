import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useConfig } from './ConfigContext';
import { AppBootstrap } from '../core/bootstrap/AppBootstrap';
import { FoodItem } from '../types';

export enum BootState {
  BOOTING = 'BOOTING',
  CHECKING_AUTH = 'CHECKING_AUTH',
  CHECKING_PROFILE = 'CHECKING_PROFILE',
  CHECKING_SETTINGS = 'CHECKING_SETTINGS',
  CHECKING_CACHE = 'CHECKING_CACHE',
  READY = 'READY',
  ERROR = 'ERROR',
}

interface BootContextType {
  bootState: BootState;
  progress: number; // 0 to 100
  errorMessage: string | null;
  cachedProducts: FoodItem[];
  cachedOffers: any[];
  cachedBanners: any[];
  retryBoot: () => void;
}

const BootContext = createContext<BootContextType | undefined>(undefined);

export const BootProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshProfile } = useAuth();
  const { config } = useConfig();

  const [bootState, setBootState] = useState<BootState>(BootState.READY);
  const [progress, setProgress] = useState(100);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [cachedProducts, setCachedProducts] = useState<FoodItem[]>([]);
  const [cachedOffers, setCachedOffers] = useState<any[]>([]);
  const [cachedBanners, setCachedBanners] = useState<any[]>([]);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const retryBoot = () => {
    setBootState(BootState.BOOTING);
    setProgress(0);
    setErrorMessage(null);
    setRetryTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let active = true;

    const initializeApp = async () => {
      try {
        console.log('[BootManager] Triggering AppBootstrap master cache pipeline...');

        const result = await AppBootstrap.init();

        if (!active) return;
        if (result.cachedProducts) setCachedProducts(result.cachedProducts);
        if (result.cachedBanners) setCachedBanners(result.cachedBanners);

        if (user) {
          refreshProfile().catch(() => {});
        }

        setProgress(100);
        setBootState(BootState.READY);
      } catch (err: any) {
        console.error('[BootManager] Startup pipeline warning:', err);
        if (active) {
          setBootState(BootState.READY); // Fallback to ready to prevent app blocking
        }
      }
    };

    initializeApp();

    return () => {
      active = false;
    };
  }, [retryTrigger]);

  const value = useMemo(
    () => ({
      bootState,
      progress,
      errorMessage,
      cachedProducts,
      cachedOffers,
      cachedBanners,
      retryBoot,
    }),
    [bootState, progress, errorMessage, cachedProducts, cachedOffers, cachedBanners]
  );

  return <BootContext.Provider value={value}>{children}</BootContext.Provider>;
};

export const useBoot = () => {
  const context = useContext(BootContext);
  if (!context) {
    throw new Error('useBoot must be used within a BootProvider');
  }
  return context;
};
