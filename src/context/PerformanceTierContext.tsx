import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type PerformanceTier = 'high' | 'balanced' | 'low';

export interface DeviceSpecs {
  memory?: number; // GB
  cores?: number; // CPU logic cores
  connectionType?: string; // wifi, cellular, etc.
  effectiveType?: string; // '4g', '3g', '2g', etc.
  saveData?: boolean;
  prefersReducedMotion: boolean;
  isTouchDevice: boolean;
  screenRefreshRate?: number; // Estimated
}

interface PerformanceTierContextType {
  tier: PerformanceTier;
  specs: DeviceSpecs;
  reduceMotion: boolean;
  disableHeavyEffects: boolean; // blurs, heavy animations, infinite particles
  isOptimizedRendering: boolean; // whether to drop high-cost decorative renders
  setManualTier: (tier: PerformanceTier | 'auto') => void;
  manualTier: PerformanceTier | 'auto';
}

const PerformanceTierContext = createContext<PerformanceTierContextType | undefined>(undefined);

const STORAGE_KEY = 'frosty_bite_perf_tier';

export const PerformanceTierProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [manualTier, setManualTierState] = useState<PerformanceTier | 'auto'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'high' || saved === 'balanced' || saved === 'low' || saved === 'auto') {
        return saved;
      }
    } catch {}
    return 'auto';
  });

  const [specs, setSpecs] = useState<DeviceSpecs>(() => {
    const prefersReducedMotion = typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false;

    const isTouchDevice = typeof window !== 'undefined'
      ? ('ontouchstart' in window || navigator.maxTouchPoints > 0)
      : false;

    return {
      prefersReducedMotion,
      isTouchDevice,
    };
  });

  // Calculate hardware specs on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    const memory = nav.deviceMemory; // in GB
    const cores = nav.hardwareConcurrency; // logical cores
    const saveData = conn?.saveData;
    const effectiveType = conn?.effectiveType;
    const connectionType = conn?.type;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setSpecs(prev => ({ ...prev, prefersReducedMotion: e.matches }));
    };

    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', handleMotionChange);
    } else {
      motionQuery.addListener(handleMotionChange);
    }

    // Estimate refresh rate (optional heuristic, keep it lightweight)
    let frameTimes: number[] = [];
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let refreshRate = 60; // default

    const checkRefreshRate = (time: number) => {
      const delta = time - lastFrameTime;
      lastFrameTime = time;
      frameTimes.push(delta);
      frameCount++;

      if (frameCount < 10) {
        requestAnimationFrame(checkRefreshRate);
      } else {
        const avgDelta = frameTimes.slice(2).reduce((sum, val) => sum + val, 0) / (frameTimes.length - 2);
        if (avgDelta > 0) {
          const estimatedHz = Math.round(1000 / avgDelta);
          // Standardize to common rates: 30, 60, 90, 120, 144
          if (estimatedHz > 110) refreshRate = 120;
          else if (estimatedHz > 80) refreshRate = 90;
          else if (estimatedHz > 50) refreshRate = 60;
          else refreshRate = 30;
        }
        
        setSpecs(prev => ({
          ...prev,
          memory,
          cores,
          connectionType,
          effectiveType,
          saveData,
          screenRefreshRate: refreshRate
        }));
      }
    };

    requestAnimationFrame(checkRefreshRate);

    // Dynamic Connection Change Listener
    const handleConnectionChange = () => {
      setSpecs(prev => ({
        ...prev,
        effectiveType: conn?.effectiveType,
        saveData: conn?.saveData
      }));
    };

    if (conn) {
      conn.addEventListener('change', handleConnectionChange);
    }

    return () => {
      if (motionQuery.removeEventListener) {
        motionQuery.removeEventListener('change', handleMotionChange);
      } else {
        motionQuery.removeListener(handleMotionChange);
      }
      if (conn) {
        conn.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  // Compute calculated Tier based on device capabilities
  const calculatedTier = useMemo<PerformanceTier>(() => {
    // If user set a specific tier, respect it immediately
    if (manualTier !== 'auto') {
      return manualTier;
    }

    // 1. Extreme Constrained Check -> Tier 3 (LOW)
    if (specs.prefersReducedMotion) return 'low';
    if (specs.saveData) return 'low';
    if (specs.effectiveType === '2g' || specs.effectiveType === '3g') return 'low';
    
    // RAM constraint (< 3GB is definitely low end)
    if (specs.memory !== undefined && specs.memory < 3) return 'low';
    
    // CPU constraint (Dual core or single core)
    if (specs.cores !== undefined && specs.cores <= 2) return 'low';

    // 2. High-end Check -> Tier 1 (HIGH)
    // Needs 6GB+ RAM and 6+ CPU cores, plus strong 4G/5g/Wifi, and non-low screen refresh rate
    const hasGreatRAM = specs.memory === undefined || specs.memory >= 6;
    const hasGreatCPU = specs.cores === undefined || specs.cores >= 6;
    const hasGreatNetwork = specs.effectiveType === undefined || specs.effectiveType === '4g';
    const isBatteryConstrained = specs.saveData === true;

    if (hasGreatRAM && hasGreatCPU && hasGreatNetwork && !isBatteryConstrained) {
      return 'high';
    }

    // 3. Middle range -> Tier 2 (BALANCED)
    return 'balanced';
  }, [manualTier, specs]);

  // Derived properties based on computed tier
  const reduceMotion = useMemo(() => {
    return calculatedTier === 'low' || specs.prefersReducedMotion;
  }, [calculatedTier, specs.prefersReducedMotion]);

  const disableHeavyEffects = useMemo(() => {
    return calculatedTier === 'low' || calculatedTier === 'balanced';
  }, [calculatedTier]);

  const isOptimizedRendering = useMemo(() => {
    return calculatedTier === 'low';
  }, [calculatedTier]);

  const setManualTier = (tier: PerformanceTier | 'auto') => {
    setManualTierState(tier);
    try {
      localStorage.setItem(STORAGE_KEY, tier);
    } catch {}
  };

  // Dynamic root element class application
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('perf-tier-high', 'perf-tier-balanced', 'perf-tier-low');
    root.classList.add(`perf-tier-${calculatedTier}`);
  }, [calculatedTier]);

  const value = useMemo<PerformanceTierContextType>(() => ({
    tier: calculatedTier,
    specs,
    reduceMotion,
    disableHeavyEffects,
    isOptimizedRendering,
    manualTier,
    setManualTier,
  }), [calculatedTier, specs, reduceMotion, disableHeavyEffects, isOptimizedRendering, manualTier]);

  return (
    <PerformanceTierContext.Provider value={value}>
      {children}
    </PerformanceTierContext.Provider>
  );
};

export const usePerformanceTier = () => {
  const context = useContext(PerformanceTierContext);
  if (context === undefined) {
    throw new Error('usePerformanceTier must be used within a PerformanceTierProvider');
  }
  return context;
};
