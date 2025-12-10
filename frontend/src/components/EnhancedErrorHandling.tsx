/**
 * Enhanced Error Handling Components
 * Provides comprehensive error boundaries, retry mechanisms, and user-friendly error displays
 */

import React, { Component, ErrorInfo, ReactNode, useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, Bug, Home } from 'lucide-react';
import { logger } from '../utils/logger';

// Error types
export type ErrorType = 
  | 'network'
  | 'validation' 
  | 'authentication'
  | 'permission'
  | 'rate_limit'
  | 'server'
  | 'client'
  | 'unknown';

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp: number;
  stack?: string;
  recoverable: boolean;
  retryable: boolean;
}

// Error boundary state
interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorId: string | null;
  retryCount: number;
}

// Enhanced Error Boundary Props
interface EnhancedErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: AppError, retry: () => void) => ReactNode;
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

// Enhanced Error Boundary Component
export class EnhancedErrorBoundary extends Component<
  EnhancedErrorBoundaryProps,
  ErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const appError = ErrorHandler.createAppError(error, 'client');
    const errorId = ErrorHandler.generateErrorId();
    
    return {
      hasError: true,
      error: appError,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = this.state.error!;
    
    // Log error details
    logger.error('Error Boundary caught error:', {
      error: appError,
      errorInfo,
      errorId: this.state.errorId
    });

    // Report to error tracking service
    ErrorHandler.reportError(appError, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    });

    // Call custom error handler
    this.props.onError?.(appError, errorInfo);
  }

  componentDidUpdate(prevProps: EnhancedErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetOnPropsChange) {
        this.resetErrorBoundary();
      } else if (resetKeys) {
        const hasResetKeyChanged = resetKeys.some(
          (key, index) => prevProps.resetKeys?.[index] !== key
        );
        if (hasResetKeyChanged) {
          this.resetErrorBoundary();
        }
      }
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0
    });
  };

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorId: null,
        retryCount: prevState.retryCount + 1
      }));

      // Auto-reset after a delay if retry fails
      this.resetTimeoutId = window.setTimeout(() => {
        if (this.state.hasError) {
          this.resetErrorBoundary();
        }
      }, 5000);
    }
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, maxRetries = 3 } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.handleRetry);
      }

      return (
        <ErrorFallback
          error={error}
          onRetry={this.handleRetry}
          canRetry={retryCount < maxRetries}
          retryCount={retryCount}
          maxRetries={maxRetries}
        />
      );
    }

    return children;
  }
}

// Default error fallback component
interface ErrorFallbackProps {
  error: AppError;
  onRetry: () => void;
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onRetry,
  canRetry,
  retryCount,
  maxRetries
}) => {
  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return <WifiOff className="w-8 h-8 text-destructive" />;
      case 'authentication':
      case 'permission':
        return <AlertTriangle className="w-8 h-8 text-destructive" />;
      default:
        return <Bug className="w-8 h-8 text-destructive" />;
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'network':
        return 'Connection Problem';
      case 'authentication':
        return 'Authentication Required';
      case 'permission':
        return 'Access Denied';
      case 'rate_limit':
        return 'Too Many Requests';
      case 'server':
        return 'Server Error';
      default:
        return 'Something Went Wrong';
    }
  };

  const getErrorDescription = () => {
    switch (error.type) {
      case 'network':
        return 'Please check your internet connection and try again.';
      case 'authentication':
        return 'Please log in again to continue.';
      case 'permission':
        return 'You don\'t have permission to access this resource.';
      case 'rate_limit':
        return 'Please wait a moment before trying again.';
      case 'server':
        return 'Our servers are experiencing issues. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred.';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="mb-6">
        {getErrorIcon()}
      </div>
      
      <h2 className="text-2xl font-semibold mb-4">
        {getErrorTitle()}
      </h2>
      
      <p className="text-muted-foreground mb-6 max-w-md">
        {getErrorDescription()}
      </p>

      {process.env.NODE_ENV === 'development' && (
        <details className="mb-6 text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Error Details (Development)
          </summary>
          <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto max-w-md">
            {JSON.stringify(error, null, 2)}
          </pre>
        </details>
      )}

      <div className="flex gap-4">
        {canRetry && error.retryable && (
          <Button onClick={onRetry} variant="default">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again ({retryCount}/{maxRetries})
          </Button>
        )}
        
        <Button 
          onClick={() => window.location.href = '/'} 
          variant="outline"
        >
          <Home className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    </div>
  );
};

// Error Handler utility class
export class ErrorHandler {
  private static errorQueue: AppError[] = [];
  private static isOnline = navigator.onLine;

  static {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processErrorQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  static createAppError(
    error: Error | string | any,
    type: ErrorType = 'unknown',
    recoverable = true,
    retryable = true
  ): AppError {
    let message: string;
    let stack: string | undefined;
    let code: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
      code = (error as any).code;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = error?.message || 'An unknown error occurred';
      code = error?.code;
    }

    // Determine error type from message/code if not specified
    if (type === 'unknown') {
      type = this.inferErrorType(message, code);
    }

    return {
      type,
      message,
      code,
      details: error,
      timestamp: Date.now(),
      stack,
      recoverable,
      retryable: retryable && this.isRetryableError(type)
    };
  }

  static inferErrorType(message: string, code?: string): ErrorType {
    const lowerMessage = message.toLowerCase();
    
    if (code === 'NETWORK_ERROR' || lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'network';
    }
    if (code === '401' || lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
      return 'authentication';
    }
    if (code === '403' || lowerMessage.includes('forbidden') || lowerMessage.includes('permission')) {
      return 'permission';
    }
    if (code === '429' || lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
      return 'rate_limit';
    }
    if (code?.startsWith('5') || lowerMessage.includes('server error') || lowerMessage.includes('internal')) {
      return 'server';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return 'validation';
    }
    
    return 'client';
  }

  static isRetryableError(type: ErrorType): boolean {
    return ['network', 'server', 'rate_limit'].includes(type);
  }

  static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static reportError(error: AppError, context?: any) {
    // Log locally
    logger.error('Application Error:', { error, context });

    // Queue for reporting if offline
    if (!this.isOnline) {
      this.errorQueue.push(error);
      return;
    }

    // Report to error tracking service (implement based on your service)
    this.sendErrorReport(error, context).catch(reportError => {
      logger.warn('Failed to report error:', reportError);
      this.errorQueue.push(error);
    });
  }

  private static async sendErrorReport(error: AppError, context?: any) {
    // Implement your error reporting service here
    // Example: Sentry, LogRocket, Bugsnag, etc.
    
    if (process.env.NODE_ENV === 'development') {
      console.group('🐛 Error Report');
      console.error('Error:', error);
      console.log('Context:', context);
      console.groupEnd();
      return;
    }

    // Example implementation for a custom error reporting endpoint
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error,
          context,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      // Silently fail - don't want error reporting to break the app
    }
  }

  private static processErrorQueue() {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    errors.forEach(error => {
      this.sendErrorReport(error).catch(() => {
        // Re-queue if still failing
        this.errorQueue.push(error);
      });
    });
  }
}

// Network status hook
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
        // Could trigger a sync or retry failed requests here
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
};

// Retry hook for failed operations
export const useRetry = (maxRetries = 3, delay = 1000) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (retryCount >= maxRetries) {
      throw new Error(`Max retries (${maxRetries}) exceeded`);
    }

    setIsRetrying(true);
    
    try {
      const result = await operation();
      setRetryCount(0); // Reset on success
      return result;
    } catch (error) {
      setRetryCount(prev => prev + 1);
      
      if (retryCount + 1 < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, retryCount)));
        return retry(operation);
      } else {
        throw error;
      }
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, maxRetries, delay]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    retry,
    reset,
    retryCount,
    isRetrying,
    canRetry: retryCount < maxRetries
  };
};

// Error toast component
interface ErrorToastProps {
  error: AppError;
  onDismiss: () => void;
  onRetry?: () => void;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  error,
  onDismiss,
  onRetry
}) => {
  useEffect(() => {
    // Auto-dismiss after 5 seconds for non-critical errors
    if (error.type !== 'authentication' && error.type !== 'permission') {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [error.type, onDismiss]);

  return (
    <Alert className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error.message}</span>
        <div className="flex gap-2 ml-4">
          {error.retryable && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

// Network status indicator
export const NetworkStatusIndicator: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) {
    return null; // Don't show anything when online normally
  }

  return (
    <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
      isOnline ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
    }`}>
      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      <span>
        {isOnline 
          ? wasOffline ? 'Back online' : 'Online'
          : 'Offline'
        }
      </span>
    </div>
  );
};