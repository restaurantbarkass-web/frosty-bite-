import React, { useState } from 'react';
import { usePerformanceBudget } from '../hooks/usePerformanceBudget';
import { motion, AnimatePresence } from 'motion/react';
import { Gauge, ChevronUp, ChevronDown, CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';

export const PerformanceBudgetHUD: React.FC = () => {
  const { metrics, violations, budgets } = usePerformanceBudget();
  const [isOpen, setIsOpen] = useState(false);

  // Helper to get color and icon for status
  const getStatusDetails = (name: string, value: number | null) => {
    if (value === null) return { text: 'Measuring...', color: 'text-zinc-400 bg-zinc-400/10 border-zinc-500/20', bg: 'bg-zinc-500/20', icon: <Activity size={12} className="animate-pulse" /> };
    
    const limit = (budgets as any)[name];
    if (limit === undefined) return { text: 'N/A', color: 'text-zinc-500', bg: 'bg-zinc-500/10', icon: null };

    if (name === 'cls') {
      if (value <= 0.1) return { text: 'Good', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', bg: 'bg-emerald-500', icon: <CheckCircle size={12} /> };
      if (value <= 0.25) return { text: 'Warning', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', bg: 'bg-amber-500', icon: <AlertTriangle size={12} /> };
      return { text: 'Poor', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20', bg: 'bg-rose-500', icon: <XCircle size={12} /> };
    }

    if (value <= limit) {
      return { text: 'Good', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', bg: 'bg-emerald-500', icon: <CheckCircle size={12} /> };
    }
    if (value <= limit * 1.5) {
      return { text: 'Warning', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', bg: 'bg-amber-500', icon: <AlertTriangle size={12} /> };
    }
    return { text: 'Poor', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20', bg: 'bg-rose-500', icon: <XCircle size={12} /> };
  };

  const formatValue = (name: string, value: number | null) => {
    if (value === null) return 'N/A';
    if (name === 'cls') return value.toFixed(3);
    if (value < 1000) return `${Math.round(value)}ms`;
    return `${(value / 1000).toFixed(2)}s`;
  };

  const renderMetricRow = (label: string, name: string, description: string) => {
    const value = (metrics as any)[name];
    const limit = (budgets as any)[name];
    const details = getStatusDetails(name, value);

    return (
      <div className="space-y-1.5 border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              {label}
            </h4>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-black text-white">{formatValue(name, value)}</span>
            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border flex items-center gap-1 ${details.color}`}>
              {details.icon}
              {details.text}
            </span>
          </div>
        </div>
        
        {/* Progress Bar comparison with budget */}
        {value !== null && (
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${details.bg}`}
              style={{ width: `${Math.min((value / limit) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed bottom-24 right-4 z-[999] md:bottom-6 md:right-24 font-sans select-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="w-72 bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-4 mb-3 overflow-hidden relative"
          >
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.05] pointer-events-none" />
            
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Gauge size={16} className="text-primary animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Performance HUD</h3>
              </div>
              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md">
                Budget Active
              </span>
            </div>

            <div className="space-y-3">
              {renderMetricRow('Largest Contentful Paint', 'lcp', 'Core Web Vital - Target < 2.5s')}
              {renderMetricRow('First Input Delay', 'fid', 'Core Web Vital - Target < 100ms')}
              {renderMetricRow('Cumulative Layout Shift', 'cls', 'Core Web Vital - Target < 0.10')}
              {renderMetricRow('First Contentful Paint', 'fcp', 'Visual Feedback - Target < 1.8s')}
              {renderMetricRow('Time to First Byte', 'ttfb', 'Server Response - Target < 800ms')}
              {renderMetricRow('Total Page Load', 'pageLoad', 'Window Loaded - Target < 3.5s')}
            </div>
            
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <p className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest">
                Measured via PerformanceObserver
              </p>
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Good" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Warning" />
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Poor" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md border border-white/10 hover:border-white/20 text-white px-3.5 py-2.5 rounded-2xl shadow-xl hover:shadow-primary/5 transition-all text-xs font-black uppercase tracking-widest"
      >
        <Gauge size={14} className={isOpen ? 'text-primary' : 'text-zinc-400'} />
        <span>Performance</span>
        {isOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </motion.button>
    </div>
  );
};
