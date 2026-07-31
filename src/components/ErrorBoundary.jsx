import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Game Render Error Caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center p-6 font-sans text-center z-[999] relative">
          <div className="bg-stone-900 border-2 border-red-500/50 rounded-2xl p-6 max-w-xl w-full shadow-2xl flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3 border-b border-stone-800 pb-3">
              <span className="text-3xl">⚠️</span>
              <h2 className="text-xl font-bold text-red-400">Something went wrong rendering the game</h2>
            </div>
            
            {this.state.error && (
              <div className="bg-stone-950 p-3 rounded-lg border border-stone-800 font-mono text-xs text-red-300 overflow-x-auto">
                <strong>Error:</strong> {this.state.error.toString()}
              </div>
            )}

            {this.state.errorInfo?.componentStack && (
              <details className="bg-stone-950 p-3 rounded-lg border border-stone-800 font-mono text-[11px] text-stone-400 overflow-x-auto">
                <summary className="cursor-pointer font-bold text-stone-300 mb-1">Component Stack Trace</summary>
                <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
              </details>
            )}

            <p className="text-xs text-stone-400">
              Check the browser developer console (F12 or Right Click &gt; Inspect &gt; Console) for additional debug logs.
            </p>

            <button 
              onClick={this.handleReset} 
              className="mt-2 w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-xl transition-colors text-center"
            >
              Try Again / Reset View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
