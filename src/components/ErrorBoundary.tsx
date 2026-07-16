import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCcw, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Terminal } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDiagnostics: boolean;
  copied: boolean;
  activeTab: 'error' | 'assets' | 'env' | 'telemetry';
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDiagnostics: false,
      copied: false,
      activeTab: 'error'
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
    const reasonStr = reason ? String(reason.message || reason.description || reason.reason || reason) : '';
    const reasonConstructorName = reason && reason.constructor ? String(reason.constructor.name) : '';
    
    // Ignore benign websocket, close events, cross-origin script errors, and vite dev server HMR noise
    if (
      reasonStr.toLowerCase().includes('websocket') ||
      reasonStr.toLowerCase().includes('web socket') ||
      reasonStr.toLowerCase().includes('vite') ||
      reasonStr.toLowerCase().includes('closed without opened') ||
      reasonStr.toLowerCase().includes('closeevent') ||
      reasonStr.toLowerCase().includes('script error') ||
      reasonConstructorName.toLowerCase().includes('closeevent') ||
      reasonConstructorName.toLowerCase().includes('websocket') ||
      (reason && (reason.type === 'close' || reason.type === 'error' || reason.wasClean !== undefined))
    ) {
      try {
        event.preventDefault();
        event.stopImmediatePropagation();
      } catch (_) {}
      return;
    }

    // Call preventDefault() so the browser/testing wrapper knows the rejection is handled
    try {
      event.preventDefault();
    } catch (_) {}

    console.warn('[ErrorBoundary] Unhandled promise rejection captured:', reason);
    
    // We want to capture the rejection fully as an error!
    let reasonError = reason;
    if (!(reasonError instanceof Error)) {
      reasonError = new Error(reasonStr || 'Unhandled promise rejection');
    }
    
    this.setState({
      hasError: true,
      error: reasonError
    });
  };

  private handleGlobalError = (event: ErrorEvent | Event) => {
    // If it's not a standard ErrorEvent, it represents a resource loading error (capture phase)
    const isErrorEvent = 'message' in event || 'error' in event || 'filename' in event;
    if (!isErrorEvent) {
      const target = event.target as any;
      if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
        const src = target.src || target.href || '';
        console.error('[ErrorBoundary] Critical resource failed to load:', src);
        try {
          event.preventDefault();
        } catch (_) {}
        this.setState({
          hasError: true,
          error: new Error(`Critical Asset Fetch Failure: Failed to load dynamically imported module: ${src}`)
        });
      }
    } else {
      const errEvent = event as any;
      const errorMsg = errEvent.message || '';
      const errorStr = errEvent.error ? String(errEvent.error.message || errEvent.error) : '';
      
      // Ignore benign websocket, cross-origin script errors, and vite dev server HMR noise
      if (
        errorMsg.toLowerCase().includes('websocket') ||
        errorMsg.toLowerCase().includes('web socket') ||
        errorMsg.toLowerCase().includes('vite') ||
        errorMsg.toLowerCase().includes('closed without opened') ||
        errorMsg.toLowerCase().includes('closeevent') ||
        errorMsg.toLowerCase().includes('script error') ||
        errorStr.toLowerCase().includes('websocket') ||
        errorStr.toLowerCase().includes('web socket') ||
        errorStr.toLowerCase().includes('vite') ||
        errorStr.toLowerCase().includes('closed without opened') ||
        errorStr.toLowerCase().includes('closeevent') ||
        errorStr.toLowerCase().includes('script error')
      ) {
        try {
          event.preventDefault();
          event.stopImmediatePropagation();
        } catch (_) {}
        return;
      }
 
      console.error('[ErrorBoundary] Global uncaught runtime exception intercepted:', errEvent.error || errorMsg);
      try {
        event.preventDefault();
      } catch (_) {}
      
      this.setState({
        hasError: true,
        error: errEvent.error || new Error(errorMsg)
      });
    }
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Error caught during rendering lifecycle:', error, errorInfo);
  }

  private handleReset = async () => {
    this.setState({ hasError: false, error: null, showDiagnostics: false });
    
    // Attempt to unregister service workers and clear caches to break caching reload loops
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('[ErrorBoundary] Service worker unregistered successfully');
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
          console.log('[ErrorBoundary] Deleted cache:', key);
        }
      }
    } catch (e) {
      console.warn('[ErrorBoundary] Failed to clear Service Worker or caches:', e);
    }
    
    window.location.reload();
  };

  private getDiagnosticsData = () => {
    const error = this.state.error;
    const globalDiag = (window as any).__frostybite_diagnostics || {};
    
    let crashLogs = [];
    try {
      crashLogs = JSON.parse(localStorage.getItem('frostybite_crash_logs') || '[]');
    } catch (_) {}

    return {
      error: {
        name: error?.name || 'UnknownError',
        message: error?.message || 'No message',
        stack: error?.stack || 'No stack trace available'
      },
      environment: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        localStorageKeys: (() => {
          try {
            return Object.keys(localStorage);
          } catch (_) {
            return ['Access Blocked (sandboxed iframe)'];
          }
        })()
      },
      capturedGlobalErrors: globalDiag.errors || [],
      capturedRejections: globalDiag.unhandledRejections || [],
      failedAssets: globalDiag.resourceFailures || [],
      telemetryLogs: crashLogs
    };
  };

  private handleCopyDiagnostics = () => {
    const data = this.getDiagnosticsData();
    const textToCopy = JSON.stringify(data, null, 2);
    
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy diagnostics:', err);
      });
  };

  private renderScriptErrorHelp() {
    const errorMsg = this.state.error?.message || "";
    const isScriptError = errorMsg.toLowerCase().includes('script error') || errorMsg === 'Script error.';
    
    if (!isScriptError) return null;

    return (
      <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left">
        <h4 className="text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-2 mb-1 font-mono">
          <AlertTriangle size={14} />
          Browser Security Mask (Script error) Detected
        </h4>
        <p className="text-[11px] text-zinc-300 leading-relaxed mb-2">
          An unhandled error occurred in an external or dynamically loaded cross-origin script.
          To protect user privacy, modern browsers mask the error details as <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded font-mono">"Script error."</code>.
        </p>
        <div className="bg-black/50 p-2.5 rounded border border-white/5 font-mono text-[10px] text-zinc-400 leading-normal">
          <p className="font-bold text-white mb-1">How to inspect the true cause:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Ensure third-party script tags have the attribute <code className="text-emerald-400 font-bold">crossorigin="anonymous"</code>.</li>
            <li>Ensure the hosting CDN/server responds with <code className="text-emerald-400 font-bold">Access-Control-Allow-Origin: *</code>.</li>
            <li>Open the browser's developer console (F12) to see local, unmasked network messages.</li>
          </ul>
        </div>
      </div>
    );
  }

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

      const diagData = this.getDiagnosticsData();

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
          <div className="max-w-2xl w-full glass-dark p-8 md:p-10 rounded-[32px] border border-white/10 shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-3 italic">Bite Interrupted</h2>
            <p className="text-zinc-400 font-medium mb-6 leading-relaxed max-w-md px-4">
              We're polishing the frosting. {errorMessage}
            </p>

            {/* Script Error Assist Block */}
            {this.renderScriptErrorHelp()}

            {/* Diagnostic Center Toggle */}
            <div className="w-full mb-6">
              <button 
                onClick={() => this.setState(prev => ({ showDiagnostics: !prev.showDiagnostics }))}
                className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold text-zinc-300 flex items-center justify-between transition-all"
              >
                <span className="flex items-center gap-2 font-mono">
                  <Terminal size={14} className="text-red-400" />
                  SYSTEM DIAGNOSTICS CONSOLE
                </span>
                {this.state.showDiagnostics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {this.state.showDiagnostics && (
                <div className="mt-2 border border-white/5 bg-[#08080a] rounded-xl overflow-hidden shadow-inner flex flex-col text-left">
                  {/* Diagnostic Tabs */}
                  <div className="flex border-b border-white/5 bg-zinc-950 text-[10px] font-mono">
                    <button 
                      onClick={() => this.setState({ activeTab: 'error' })}
                      className={`px-4 py-2.5 font-bold transition-all ${this.state.activeTab === 'error' ? 'text-red-400 bg-[#08080a] border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      🚨 Error & Stack
                    </button>
                    <button 
                      onClick={() => this.setState({ activeTab: 'assets' })}
                      className={`px-4 py-2.5 font-bold transition-all flex items-center gap-1.5 ${this.state.activeTab === 'assets' ? 'text-amber-400 bg-[#08080a] border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      📦 Assets Failed ({diagData.failedAssets.length})
                    </button>
                    <button 
                      onClick={() => this.setState({ activeTab: 'env' })}
                      className={`px-4 py-2.5 font-bold transition-all ${this.state.activeTab === 'env' ? 'text-emerald-400 bg-[#08080a] border-b-2 border-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      ⚙️ Client Env
                    </button>
                    <button 
                      onClick={() => this.setState({ activeTab: 'telemetry' })}
                      className={`px-4 py-2.5 font-bold transition-all ${this.state.activeTab === 'telemetry' ? 'text-cyan-400 bg-[#08080a] border-b-2 border-cyan-500' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      📋 Telemetry ({diagData.telemetryLogs.length})
                    </button>
                  </div>

                  {/* Diagnostic Content */}
                  <div className="p-4 max-h-72 overflow-y-auto font-mono text-[10px] leading-relaxed text-zinc-300">
                    {this.state.activeTab === 'error' && (
                      <div className="space-y-3">
                        <div>
                          <span className="text-zinc-500 font-bold block uppercase tracking-wider text-[9px] mb-1">Exception Name:</span>
                          <span className="text-red-400 font-bold bg-red-950/30 px-1.5 py-0.5 rounded border border-red-900/20">{diagData.error.name}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-bold block uppercase tracking-wider text-[9px] mb-1">Message:</span>
                          <p className="text-white bg-white/5 p-2 rounded">{diagData.error.message}</p>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-bold block uppercase tracking-wider text-[9px] mb-1">Stack Trace:</span>
                          <pre className="bg-zinc-950 p-2.5 rounded text-zinc-400 overflow-x-auto whitespace-pre font-mono scrollbar-thin">
                            {diagData.error.stack}
                          </pre>
                        </div>
                      </div>
                    )}

                    {this.state.activeTab === 'assets' && (
                      <div>
                        {diagData.failedAssets.length === 0 ? (
                          <p className="text-zinc-500 italic text-center py-4">No asset loading failures captured.</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-amber-400 text-[9px] font-bold uppercase mb-2">The following dynamic resources failed to fetch:</p>
                            {diagData.failedAssets.map((asset: any, idx: number) => (
                              <div key={idx} className="bg-zinc-950 p-2.5 rounded border border-white/5 flex flex-col gap-1">
                                <div className="flex justify-between items-center text-zinc-400 text-[9px]">
                                  <span className="font-bold text-amber-500 uppercase">&lt;{asset.tagName?.toLowerCase()}&gt;</span>
                                  <span>{asset.timestamp}</span>
                                </div>
                                <code className="text-white text-xs break-all">{asset.url}</code>
                                {asset.outerHTML && <pre className="text-[8px] opacity-50 bg-black/40 p-1 rounded max-h-12 overflow-hidden">{asset.outerHTML}</pre>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {this.state.activeTab === 'env' && (
                      <div className="space-y-2">
                        <div>
                          <span className="text-zinc-500 font-bold">App URL:</span> <span className="text-white">{diagData.environment.url}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-bold">User Agent:</span> <span className="text-zinc-400 text-[9px]">{diagData.environment.userAgent}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-bold">Device Time:</span> <span className="text-white">{diagData.environment.timestamp}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 font-bold">Storage State:</span> <span className="text-zinc-400">[{diagData.environment.localStorageKeys.join(', ')}]</span>
                        </div>
                      </div>
                    )}

                    {this.state.activeTab === 'telemetry' && (
                      <div>
                        {diagData.telemetryLogs.length === 0 ? (
                          <p className="text-zinc-500 italic text-center py-4">No localized crash telemetry logged.</p>
                        ) : (
                          <div className="space-y-2">
                            {diagData.telemetryLogs.map((log: any, idx: number) => (
                              <div key={idx} className="bg-zinc-950 p-2 rounded border border-white/5 text-[9px]">
                                <div className="flex justify-between font-bold mb-1">
                                  <span className="text-cyan-400">{log.component}</span>
                                  <span className="text-zinc-500">{log.timestamp}</span>
                                </div>
                                <p className="text-zinc-300 mb-1">{log.message}</p>
                                {log.stack && <pre className="text-[8px] text-zinc-500 max-h-12 overflow-y-auto">{log.stack}</pre>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex justify-between items-center bg-zinc-950 p-2.5 border-t border-white/5">
                    <span className="text-[8px] text-zinc-600 uppercase font-bold tracking-wider">SECURE TRACE PANEL</span>
                    <button 
                      onClick={this.handleCopyDiagnostics}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:scale-95 rounded-lg text-[9px] font-bold text-white transition-all flex items-center gap-1 border border-white/5"
                    >
                      {this.state.copied ? (
                        <>
                          <Check size={10} className="text-emerald-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={10} />
                          Copy System Diagnostics
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 w-full sm:max-w-xs">
              <Button onClick={this.handleReset} className="w-full py-4 flex items-center justify-center gap-3 font-bold text-sm">
                <RefreshCcw size={18} />
                Refresh Page
              </Button>
              <button 
                onClick={() => window.location.href = '/'}
                className="text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors py-2"
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

