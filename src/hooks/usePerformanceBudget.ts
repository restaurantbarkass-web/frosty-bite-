import { useEffect, useState, useCallback, useRef } from 'react';

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
      const existing = prev.find(v => v.metric === name);
      if (existing && Math.abs(existing.value - value) < 0.001 && existing.status === status) {
        return prev;
      }
      const filtered = prev.filter(v => v.metric !== name);
      return [...filtered, { metric: name, value, limit, status }];
    });
  }, []);

  const evaluateBudgetRef = useRef(evaluateBudget);
  evaluateBudgetRef.current = evaluateBudget;

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    // 1. First Contentful Paint & TTFB
    try {
      let fcpVal: number | null = null;
      let ttfbVal: number | null = null;
      let pageLoadVal: number | null = null;

      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        fcpVal = fcpEntry.startTime;
        evaluateBudgetRef.current('fcp', fcpVal);
      }

      const navigationEntries = performance.getEntriesByType('navigation');
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0] as PerformanceNavigationTiming;
        ttfbVal = nav.responseStart - nav.requestStart;
        evaluateBudgetRef.current('ttfb', ttfbVal);
        
        if (nav.loadEventEnd > 0) {
          pageLoadVal = nav.loadEventEnd;
          evaluateBudgetRef.current('pageLoad', pageLoadVal);
        }
      }

      if (fcpVal !== null || ttfbVal !== null || pageLoadVal !== null) {
        setMetrics((prev) => {
          let changed = false;
          const updated = { ...prev };
          if (fcpVal !== null && prev.fcp !== fcpVal) {
            updated.fcp = fcpVal;
            changed = true;
          }
          if (ttfbVal !== null && prev.ttfb !== ttfbVal) {
            updated.ttfb = ttfbVal;
            changed = true;
          }
          if (pageLoadVal !== null && prev.pageLoad !== pageLoadVal) {
            updated.pageLoad = pageLoadVal;
            changed = true;
          }
          return changed ? updated : prev;
        });
      }
    } catch (e) {
      console.warn('[PerformanceBudget] Failed to parse initial static entries:', e);
    }

    // 2. Observer for Largest Contentful Paint (LCP)
    let lcpObserver: PerformanceObserver | null = null;
    try {
      lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          const lastEntry = entries[entries.length - 1];
          const val = lastEntry.startTime;
          setMetrics((prev) => (prev.lcp === val ? prev : { ...prev, lcp: val }));
          evaluateBudgetRef.current('lcp', val);
        }
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
          setMetrics((prev) => (prev.fid === delay ? prev : { ...prev, fid: delay }));
          evaluateBudgetRef.current('fid', delay);
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
        let hasNewShift = false;
        for (const entry of entryList.getEntries()) {
          const layoutShift = entry as any;
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
            hasNewShift = true;
          }
        }
        if (hasNewShift) {
          const finalCls = clsValue;
          setMetrics((prev) => (prev.cls === finalCls ? prev : { ...prev, cls: finalCls }));
          evaluateBudgetRef.current('cls', finalCls);
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
          const val = nav.loadEventEnd;
          setMetrics((prev) => (prev.pageLoad === val ? prev : { ...prev, pageLoad: val }));
          evaluateBudgetRef.current('pageLoad', val);
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
  }, []);

  return {
    metrics,
    violations,
    budgets: BUDGETS
  };
}
