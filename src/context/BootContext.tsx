import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useConfig } from './ConfigContext';
import { supabase } from '../supabase';
import { FoodItem } from '../types';

export enum BootState {
  BOOTING = 'BOOTING',
  CHECKING_AUTH = 'CHECKING_AUTH',
  CHECKING_PROFILE = 'CHECKING_PROFILE',
  CHECKING_SETTINGS = 'CHECKING_SETTINGS',
  CHECKING_CACHE = 'CHECKING_CACHE',
  READY = 'READY',
  ERROR = 'ERROR'
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
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { isLoading: configLoading, config } = useConfig();
  
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
    setRetryTrigger(prev => prev + 1);
  };

  useEffect(() => {
    let active = true;
    
    // Core Boot Process
    const initializeApp = async () => {
      try {
        console.log('[BootManager] Starting startup sequence in parallel...');
        
        // --- STEP 1: BOOTING & CORE ASSETS PRELOAD ---
        if (!active) return;
        setBootState(BootState.BOOTING);
        setProgress(15);

        // Preload splash background and critical images
        const criticalImages = [
          'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=1600'
        ];
        criticalImages.forEach(src => {
          const img = new Image();
          img.src = src;
        });

        // Fast race for auth and config initialization (max 200ms wait)
        let authWait = 0;
        while (authLoading && authWait < 200) {
          await new Promise(resolve => setTimeout(resolve, 20));
          authWait += 20;
        }

        if (user) {
          // Fire profile refresh in background without blocking boot
          refreshProfile().catch(err => {
            console.warn('[BootManager] Silent profile refresh warning:', err);
          });
        }

        let configWait = 0;
        while ((configLoading || !config) && configWait < 200) {
          await new Promise(resolve => setTimeout(resolve, 20));
          configWait += 20;
        }

        // Fire product/coupon/banner prefetch in background without blocking READY
        Promise.all([
          supabase.from('products').select('*').limit(100),
          supabase.from('coupons').select('*').eq('status', 'active').limit(10),
          supabase.from('banners').select('*').limit(10)
        ]).then(([productsRes, couponsRes, bannersRes]) => {
          if (!active) return;
          if (productsRes.data) {
            localStorage.setItem('menu_cache', JSON.stringify(productsRes.data));
            setCachedProducts(productsRes.data);
          }
          if (couponsRes.data) {
            setCachedOffers(Array.isArray(couponsRes.data) ? couponsRes.data : [couponsRes.data]);
          }
          if (bannersRes.data) {
            setCachedBanners(bannersRes.data);
          }
        }).catch(cacheErr => {
          console.warn('[BootManager] Non-blocking cache prefetch warning:', cacheErr);
        });

        // Step READY immediately!
        if (!active) return;
        setProgress(100);
        setBootState(BootState.READY);
        console.log('[BootManager] Instant startup complete. Modules ready.');

      } catch (err: any) {
        console.error('[BootManager] Fatality in startup pipeline:', err);
        if (active) {
          setBootState(BootState.ERROR);
          setErrorMessage(err?.message || 'Unexpected initialization failure');
        }
      }
    };

    initializeApp();

    return () => {
      active = false;
    };
  }, [authLoading, configLoading, config, retryTrigger]);

  const value = useMemo(() => ({
    bootState,
    progress,
    errorMessage,
    cachedProducts,
    cachedOffers,
    cachedBanners,
    retryBoot
  }), [bootState, progress, errorMessage, cachedProducts, cachedOffers, cachedBanners]);

  return (
    <BootContext.Provider value={value}>
      {children}
    </BootContext.Provider>
  );
};

export const useBoot = () => {
  const context = useContext(BootContext);
  if (!context) throw new Error('useBoot must be used within a BootProvider');
  return context;
};
