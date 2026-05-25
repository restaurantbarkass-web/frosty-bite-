import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.addEventListener('error', this.handleGlobalError, true); // Intercept in capturing phase
  }

  public componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.removeEventListener('error', this.handleGlobalError, true);
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const reasonStr = reason ? String(reason.message || reason) : '';
    console.warn('[ErrorBoundary] Unhandled promise rejection captured:', reason);
    
    // Only crash if it is indeed a chunk/dynamic import load failure
    const isChunkError = 
      reasonStr.toLowerCase().includes('dynamically imported') || 
      reasonStr.toLowerCase().includes('failed to fetch dynamically') ||
      reasonStr.toLowerCase().includes('chunk') ||
      reasonStr.toLowerCase().includes('loading css chunk') ||
      reasonStr.toLowerCase().includes('loading chunk');

    if (isChunkError) {
      console.error('[ErrorBoundary] Chunk/Dynamic import rejection. Transitioning to Update Available screen.');
      let reasonError = reason;
      if (!(reasonError instanceof Error)) {
        reasonError = new Error(reasonStr || 'Unhandled promise rejection');
      }
      this.setState({
        hasError: true,
        error: reasonError
      });
    } else {
      console.log('[ErrorBoundary] Ignored background unhandled rejection to prevent unwanted crashing.');
    }
  };

  private handleGlobalError = (event: ErrorEvent | Event) => {
    // If it's not a standard ErrorEvent, it represents a resource loading error (capture phase)
    if (!(event instanceof ErrorEvent)) {
      const target = event.target as any;
      if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        const src = target.src || target.href || '';
        if (src.includes('assets/')) {
          console.error('[ErrorBoundary] Critical asset resource loading failure:', src);
          this.setState({
            hasError: true,
            error: new Error(`Failed to fetch dynamically imported module: ${src}`)
          });
        }
      }
    } else {
      const errorMsg = event.message || '';
      const isChunkError = 
        errorMsg.toLowerCase().includes('dynamically imported') || 
        errorMsg.toLowerCase().includes('failed to fetch dynamically') ||
        errorMsg.toLowerCase().includes('chunk') ||
        errorMsg.toLowerCase().includes('loading css chunk') ||
        errorMsg.toLowerCase().includes('loading chunk');

      if (isChunkError) {
        console.error('[ErrorBoundary] Global chunk error. Transitioning to Update Available screen.');
        this.setState({
          hasError: true,
          error: event.error || new Error(errorMsg)
        });
      } else {
        console.warn('[ErrorBoundary] Ignored non-chunk global error to guarantee smooth session:', event);
      }
    }
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "";
      const errorStr = this.state.error?.toString() || "";
      
      const isDynamicImportError = 
        errorMsg.toLowerCase().includes('dynamically imported') || 
        errorMsg.toLowerCase().includes('failed to fetch dynamically') ||
        errorMsg.toLowerCase().includes('chunk') ||
        errorStr.toLowerCase().includes('dynamically imported') ||
        errorStr.toLowerCase().includes('failed to fetch dynamically') ||
        errorStr.toLowerCase().includes('chunk');

      if (isDynamicImportError) {
        return (
          <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
            <div className="max-w-md w-full glass-dark p-10 rounded-[32px] border border-white/10 shadow-2xl">
              <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-8 animate-pulse">
                <RefreshCcw size={40} className="animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-4 italic">Update Available</h2>
              <p className="text-zinc-400 font-medium mb-8 leading-relaxed px-4">
                We've added beautiful new features and updates to Frosty Bite! Let's refresh to load the latest improvements instantly.
              </p>
              <div className="flex flex-col gap-4">
                <Button onClick={this.handleReset} className="w-full py-4 flex items-center justify-center gap-3 text-base font-bold">
                  <RefreshCcw size={18} />
                  Update Now
                </Button>
                <button 
                  onClick={() => window.location.href = '/'}
                  className="text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        );
      }

      let errorMessage = "We've encountered an unexpected issue. Our team has been notified.";
      
      if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
        errorMessage = "You don't have permission to access this resource. Please make sure you're logged in with the correct account.";
      } else if (errorMsg.includes('quota') || errorMsg.includes('limit')) {
        errorMessage = "We're currently experiencing high traffic. Please try again in a few moments.";
      }

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full glass-dark p-10 rounded-[32px] border border-white/10 shadow-2xl">
            <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-8">
              <RefreshCcw size={40} />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-4 italic">Bite Interrupted</h2>
            <p className="text-zinc-500 font-medium mb-4 leading-relaxed px-4">
              We're polishing the frosting. {errorMessage}
            </p>
            {this.state.error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-left overflow-auto max-h-32">
                <p className="text-[10px] font-mono text-red-400 break-words">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <span className="block mt-2 opacity-50 text-[8px]">
                      {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                    </span>
                  )}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-4">
              <Button onClick={this.handleReset} className="w-full py-4 flex items-center justify-center gap-3">
                <RefreshCcw size={18} />
                Refresh Page
              </Button>
              <button 
                onClick={() => window.location.href = '/'}
                className="text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
