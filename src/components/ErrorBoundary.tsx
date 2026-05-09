import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

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
      // Check if it's a Firestore permission error
      const isFirestoreError = this.state.error?.message.includes('authInfo');
      let errorMessage = "We've encountered an unexpected issue. Our team has been notified.";
      
      if (isFirestoreError) {
        try {
          const parsed = JSON.parse(this.state.error!.message);
          if (parsed.error === 'DATABASE_QUOTA_EXCEEDED') {
            errorMessage = "Our kitchen is a bit overloaded right now (Daily limit reached). Please try again later today or tomorrow when the ovens cool down!";
          } else {
            errorMessage = "You don't have permission to access this resource. Please make sure you're logged in with the correct account.";
          }
        } catch (e) {
          errorMessage = "You don't have permission to access this resource. Please make sure you're logged in with the correct account.";
        }
      }

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full glass-dark p-10 rounded-[32px] border border-white/10 shadow-2xl">
            <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-8">
              <RefreshCcw size={40} />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white mb-4 italic">Bite Interrupted</h2>
            <p className="text-zinc-500 font-medium mb-10 leading-relaxed px-4">
              We're polishing the frosting. {errorMessage}
            </p>
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
