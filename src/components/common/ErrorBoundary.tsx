import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Copy, Check, ChevronDown, ChevronUp, LifeBuoy } from 'lucide-react';

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
              <button
                type="button"
                onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <span>Technical Diagnostics</span>
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

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
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-teal-700/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload App</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                <Home className="w-4 h-4" />
                <span>Patient Portal</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700 flex items-center justify-center"
                title="Copy Error Report"
              >
                {this.state.copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
