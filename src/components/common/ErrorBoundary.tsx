import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check, ChevronDown, ChevronUp, LifeBuoy } from 'lucide-react';
import { Button } from '../shared/Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] UI component error caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/patient';
  };

  handleCopyDiagnostics = () => {
    const errorText = `[MediQueue Error Report]
Timestamp: ${new Date().toISOString()}
Error: ${this.state.error?.message || String(this.state.error)}
ComponentStack: ${this.state.errorInfo?.componentStack || 'N/A'}`;

    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div 
          role="alert" 
          aria-live="assertive"
          className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans"
        >
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {this.props.fallbackTitle || 'Application Error Encountered'}
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                An unexpected interface exception occurred. The system safely isolated the failure to protect your session and queue data.
              </p>
            </div>

            {/* Error message snippet */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 text-left text-[11px] font-mono text-red-300 break-words">
              {this.state.error.message || String(this.state.error)}
            </div>

            {/* Collapsible Technical Details */}
            <div className="text-left space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="text-[11px] text-slate-400 hover:text-slate-200 h-auto p-0 hover:bg-transparent"
                rightIcon={this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              >
                Technical Diagnostics
              </Button>

              {this.state.showDetails && (
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-[10px] font-mono text-slate-400 max-h-36 overflow-y-auto space-y-2">
                  <p className="text-slate-300">Stack Trace:</p>
                  <pre className="whitespace-pre-wrap">{this.state.error.stack || 'No stack trace available'}</pre>
                  {this.state.errorInfo?.componentStack && (
                    <>
                      <p className="text-slate-300 pt-1">Component Hierarchy:</p>
                      <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="Primary"
                size="md"
                className="flex-1"
                onClick={this.handleReload}
                leftIcon={<RefreshCw className="w-4 h-4" />}
              >
                Reload App
              </Button>

              <Button
                variant="Secondary"
                size="md"
                onClick={this.handleReset}
                leftIcon={<Home className="w-4 h-4" />}
              >
                Patient Portal
              </Button>

              <Button
                variant="Secondary"
                size="icon"
                onClick={this.handleCopyDiagnostics}
                title="Copy Error Report"
                aria-label="Copy Error Report"
              >
                {this.state.copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
