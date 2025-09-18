import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('VibeTune Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Track error for analytics (non-blocking)
    setTimeout(() => {
      try {
        import('../utils/helpers').then(({ trackEvent }) => {
          trackEvent('app_error_boundary', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
          });
        });
      } catch (trackError) {
        console.warn('Failed to track error boundary event:', trackError);
      }
    }, 0);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            {/* VibeTune Logo */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-foreground" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-foreground">VibeTune</h1>
            </div>

            {/* Error Message */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-destructive mb-2">
                Oops! Something went wrong
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                We encountered an unexpected error. Don't worry, your data is safe.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm font-medium text-destructive">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded text-xs font-mono overflow-auto">
                    <div className="text-destructive font-semibold">
                      {this.state.error.name}: {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Refresh Page
              </button>

              <button
                onClick={() => {
                  // Clear local storage and reload
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch (error) {
                    console.warn('Failed to clear storage:', error);
                  }
                  window.location.reload();
                }}
                className="w-full border border-border hover:bg-muted px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                Reset App Data
              </button>
            </div>

            {/* Support Info */}
            <div className="text-xs text-muted-foreground">
              <p>If this problem persists, please contact support.</p>
              <p className="mt-1">Error ID: {Date.now().toString(36)}</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Hook for error reporting in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    console.error('VibeTune Error:', error);
    
    // Track error for analytics (non-blocking)
    setTimeout(() => {
      try {
        import('../utils/helpers').then(({ trackEvent }) => {
          trackEvent('app_error_handled', {
            error: error.message,
            stack: error.stack,
            context: errorInfo
          });
        });
      } catch (trackError) {
        console.warn('Failed to track error event:', trackError);
      }
    }, 0);
    
    // Store error in localStorage for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('vibetune_errors') || '[]');
      errors.push({
        error: error.message,
        stack: error.stack,
        context: errorInfo,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
      
      // Keep only last 10 errors
      if (errors.length > 10) {
        errors.splice(0, errors.length - 10);
      }
      
      localStorage.setItem('vibetune_errors', JSON.stringify(errors));
    } catch (storageError) {
      console.warn('Failed to store error in localStorage:', storageError);
    }
  };
}