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
  
  const [bootState, setBootState] = useState<BootState>(BootState.BOOTING);
  const [progress, setProgress] = useState(0);
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

        // --- STEP 2: CHECKING AUTH & SESSION RESTORATION ---
        if (!active) return;
        setBootState(BootState.CHECKING_AUTH);
        setProgress(35);

        // We wait for authLoading to resolve (which is already parallelized in AuthProvider)
        // If it takes too long, we fall back gracefully or wait
        while (authLoading) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // --- STEP 3: CHECKING PROFILE & ROLES ---
        if (!active) return;
        setBootState(BootState.CHECKING_PROFILE);
        setProgress(55);

        if (user) {
          console.log('[BootManager] Authenticated user detected. Syncing profile, rewards, and favorites...');
          // Refresh / Sync profile just to make sure we have the latest roles/privileges
          await refreshProfile().catch(err => {
            console.warn('[BootManager] Silent profile refresh warning:', err);
          });
        } else {
          console.log('[BootManager] No active user session. Initializing guest sandbox.');
        }

        // --- STEP 4: CHECKING SETTINGS & CONFIGS ---
        if (!active) return;
        setBootState(BootState.CHECKING_SETTINGS);
        setProgress(75);

        // Ensure remote settings are loaded
        while (configLoading || !config) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // --- STEP 5: WARMING UP LOCAL CACHE & API RESPONSES ---
        if (!active) return;
        setBootState(BootState.CHECKING_CACHE);
        setProgress(90);

        // Concurrently prefetch Products, Active Offers, and Banner Images from Supabase
        try {
          const [productsRes, offersRes, bannersRes] = await Promise.all([
            supabase.from('products').select('*').limit(100),
            supabase.from('offers').select('*').eq('active', true).limit(10).maybeSingle(), // Use maybeSingle or let it fail gracefully
            supabase.from('banners').select('*').limit(10)
          ]);

          if (productsRes.data) {
            // Write to localStorage cache for instant next mount
            localStorage.setItem('menu_cache', JSON.stringify(productsRes.data));
            setCachedProducts(productsRes.data);
          }

          if (offersRes.data) {
            setCachedOffers(Array.isArray(offersRes.data) ? offersRes.data : [offersRes.data]);
          }

          if (bannersRes.data) {
            setCachedBanners(bannersRes.data);
          }
        } catch (cacheErr) {
          console.warn('[BootManager] Non-blocking cache prefetch warning:', cacheErr);
        }

        // --- STEP 6: READY ---
        if (!active) return;
        setProgress(100);
        setBootState(BootState.READY);
        console.log('[BootManager] Startup complete. All modules operational and responsive.');

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
