import { useEffect, useState, useCallback } from 'react';

export interface PerformanceMetrics {
  lcp: number | null; // Largest Contentful Paint (ms)
  fid: number | null; // First Input Delay (ms)
  cls: number;        // Cumulative Layout Shift
  fcp: number | null; // First Contentful Paint (ms)
  ttfb: number | null;// Time to First Byte (ms)
  pageLoad: number | null; // Total Page Load Time (ms)
}

export interface BudgetStatus {
  metric: keyof PerformanceMetrics;
  value: number;
  limit: number;
  status: 'good' | 'needs-improvement' | 'poor';
}

const BUDGETS = {
  lcp: 2500, // ms
  fid: 100,  // ms
  cls: 0.1,  // fractional
  fcp: 1800, // ms
  ttfb: 800, // ms
  pageLoad: 3500 // ms
};

export function usePerformanceBudget() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    lcp: null,
    fid: null,
    cls: 0,
    fcp: null,
    ttfb: null,
    pageLoad: null
  });

  const [violations, setViolations] = useState<BudgetStatus[]>([]);

  const evaluateBudget = useCallback((name: keyof PerformanceMetrics, value: number) => {
    const limit = BUDGETS[name];
    if (limit === undefined) return;

    let status: 'good' | 'needs-improvement' | 'poor' = 'good';
    if (name === 'cls') {
      if (value > 0.25) status = 'poor';
      else if (value > 0.1) status = 'needs-improvement';
    } else {
      if (value > limit * 1.5) status = 'poor';
      else if (value > limit) status = 'needs-improvement';
    }

    setViolations((prev) => {
      // Remove previous entry for this metric
      const filtered = prev.filter(v => v.metric !== name);
      return [...filtered, { metric: name, value, limit, status }];
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    const newMetrics = { ...metrics };

    // 1. First Contentful Paint & TTFB
    try {
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        newMetrics.fcp = fcpEntry.startTime;
        evaluateBudget('fcp', fcpEntry.startTime);
      }

      const navigationEntries = performance.getEntriesByType('navigation');
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0] as PerformanceNavigationTiming;
        newMetrics.ttfb = nav.responseStart - nav.requestStart;
        evaluateBudget('ttfb', newMetrics.ttfb);
        
        newMetrics.pageLoad = nav.loadEventEnd;
        if (nav.loadEventEnd > 0) {
          evaluateBudget('pageLoad', nav.loadEventEnd);
        }
      }
      setMetrics({ ...newMetrics });
    } catch (e) {
      console.warn('[PerformanceBudget] Failed to parse initial static entries:', e);
    }

    // 2. Observer for Largest Contentful Paint (LCP)
    let lcpObserver: PerformanceObserver | null = null;
    try {
      lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        setMetrics((prev) => {
          const updated = { ...prev, lcp: lastEntry.startTime };
          evaluateBudget('lcp', lastEntry.startTime);
          return updated;
        });
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // Browser may not support LCP observer
    }

    // 3. Observer for First Input Delay (FID)
    let fidObserver: PerformanceObserver | null = null;
    try {
      fidObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          const firstInput = entries[0] as any;
          const delay = firstInput.processingStart - firstInput.startTime;
          setMetrics((prev) => {
            const updated = { ...prev, fid: delay };
            evaluateBudget('fid', delay);
            return updated;
          });
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      // Browser may not support FID observer
    }

    // 4. Observer for Cumulative Layout Shift (CLS)
    let clsObserver: PerformanceObserver | null = null;
    try {
      let clsValue = 0;
      clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          const layoutShift = entry as any;
          // Only count shifts without recent user input
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
            setMetrics((prev) => {
              const updated = { ...prev, cls: clsValue };
              evaluateBudget('cls', clsValue);
              return updated;
            });
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // Browser may not support CLS observer
    }

    // 5. Load Event listener fallback for page load time if not fired yet
    const handleLoad = () => {
      setTimeout(() => {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0) {
          const nav = navEntries[0] as PerformanceNavigationTiming;
          setMetrics((prev) => {
            const updated = { ...prev, pageLoad: nav.loadEventEnd };
            evaluateBudget('pageLoad', nav.loadEventEnd);
            return updated;
          });
        }
      }, 0);
    };

    window.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('load', handleLoad);
      if (lcpObserver) lcpObserver.disconnect();
      if (fidObserver) fidObserver.disconnect();
      if (clsObserver) clsObserver.disconnect();
    };
  }, [evaluateBudget]);

  return {
    metrics,
    violations,
    budgets: BUDGETS
  };
}
