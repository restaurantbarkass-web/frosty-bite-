import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class LocalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[LocalErrorBoundary] Error caught in: ${this.props.fallbackName || 'Component'}:`, error, errorInfo);
    
    // Log failures for telemetry/monitoring
    try {
      const logs = JSON.parse(localStorage.getItem('frostybite_crash_logs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        component: this.props.fallbackName || 'UnknownComponent',
        message: error.message,
        stack: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : ''
      });
      localStorage.setItem('frostybite_crash_logs', JSON.stringify(logs.slice(-20))); // Keep last 20 logs
    } catch (_) {}

    // Auto-recovery: If we haven't retried yet, try to self-heal in 5 seconds
    if (this.state.retryCount < 1) {
      setTimeout(() => {
        if (this.state.hasError) {
          console.log('[LocalErrorBoundary] Attempting localized automatic recovery...');
          this.handleRetry();
        }
      }, 5000);
    }
  }

  private handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  private handleFullReset = () => {
    try {
      sessionStorage.clear();
      // Keep onboarding status so they don't have to re-watch the tutorial
      const completedOnboarding = localStorage.getItem('onboarding_completed');
      localStorage.clear();
      if (completedOnboarding) {
        localStorage.setItem('onboarding_completed', completedOnboarding);
      }
    } catch (_) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center p-6 text-center bg-card/5 backdrop-blur-sm rounded-3xl border border-white/5 my-4">
          <div className="max-w-md w-full p-6">
            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-4 animate-pulse">
              <AlertTriangle size={24} />
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
              Failed to load {this.props.fallbackName || "section"}
            </h3>
            
            <p className="text-zinc-400 text-xs font-medium mb-6 leading-relaxed max-w-sm mx-auto">
              Something went wrong while drawing this component. This usually happens on slow connections or low-memory devices.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button 
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10 active:scale-95"
              >
                <RefreshCcw size={14} />
                Try Re-rendering
              </button>

              <button 
                onClick={this.handleFullReset}
                className="text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
              >
                Reset App & Reload
              </button>
            </div>

            {this.state.error && (
              <div className="mt-4 p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-left">
                <span className="block text-[8px] font-mono text-zinc-500 max-h-12 overflow-y-auto whitespace-pre-wrap select-all">
                  ERROR: {this.state.error.message}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
