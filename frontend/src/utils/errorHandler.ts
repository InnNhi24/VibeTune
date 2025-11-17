/**
 * Comprehensive Error Handling System for VibeTune
 * Provides centralized error management, logging, and user feedback
 */
import logger from './logger';

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  AI_SERVICE = 'AI_SERVICE',
  AUDIO_PROCESSING = 'AUDIO_PROCESSING',
  DATABASE = 'DATABASE',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  context?: Record<string, any>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  private maxLogSize = 100;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Create a structured error object
   */
  createError(
    type: ErrorType,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    details?: any,
    context?: Record<string, any>
  ): AppError {
    return {
      type,
      severity,
      message,
      timestamp: new Date(),
      details,
      context,
      code: this.generateErrorCode(type)
    };
  }

  /**
   * Handle and log an error
   */
  handleError(
    error: Error | AppError,
    context?: Record<string, any>,
    userId?: string
  ): AppError {
    let appError: AppError;

    if (this.isAppError(error)) {
      appError = error;
    } else {
      appError = this.createError(
        this.categorizeError(error),
        error.message,
        this.determineSeverity(error),
        error.stack,
        context
      );
    }

    appError.userId = userId;
    this.logError(appError);
    this.notifyUser(appError);
    
    return appError;
  }

  /**
   * Log error to console and storage
   */
  private logError(error: AppError): void {
    // Add to in-memory log
    this.errorLog.unshift(error);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.pop();
    }

    // Console logging based on severity
    const logMethod = this.getLogMethod(error.severity);
    logMethod(`[${error.type}] ${error.message}`, {
      error,
      context: error.context,
      timestamp: error.timestamp
    });

    // Store in localStorage for debugging
    if (typeof window !== 'undefined') {
      try {
        const storedErrors = JSON.parse(
          localStorage.getItem('vibetune-errors') || '[]'
        );
        storedErrors.unshift({
          ...error,
          timestamp: error.timestamp.toISOString()
        });
        
        // Keep only last 50 errors
        const recentErrors = storedErrors.slice(0, 50);
        localStorage.setItem('vibetune-errors', JSON.stringify(recentErrors));
      } catch (e) {
        logger.warn('Failed to store error in localStorage:', e);
      }
    }
  }

  /**
   * Notify user about the error
   */
  private notifyUser(error: AppError): void {
    // Only show user notifications for medium+ severity errors
    if (error.severity === ErrorSeverity.LOW) return;

    // Dispatch custom event for UI components to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vibetune-error', {
        detail: error
      }));
    }
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 10): AppError[] {
    return this.errorLog.slice(0, limit);
  }

  /**
   * Clear error log
   */
  clearErrors(): void {
    this.errorLog = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vibetune-errors');
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: AppError): string {
    const messages = {
      [ErrorType.NETWORK]: 'Connection error',
      [ErrorType.AUTHENTICATION]: 'Please sign in',
      [ErrorType.VALIDATION]: 'Invalid input',
      [ErrorType.AI_SERVICE]: 'AI service unavailable',
      [ErrorType.AUDIO_PROCESSING]: 'Audio processing failed',
      [ErrorType.DATABASE]: 'Database error',
      [ErrorType.UNKNOWN]: 'Something went wrong'
    };

    return messages[error.type] || messages[ErrorType.UNKNOWN];
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(error: AppError): boolean {
    return error.type === ErrorType.NETWORK || 
           error.type === ErrorType.AI_SERVICE ||
           error.type === ErrorType.DATABASE;
  }

  /**
   * Get retry delay in milliseconds
   */
  getRetryDelay(error: AppError, attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  // Helper methods
  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'severity' in error;
  }

  private categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorType.AUTHENTICATION;
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ErrorType.VALIDATION;
    }
    if (message.includes('openai') || message.includes('ai')) {
      return ErrorType.AI_SERVICE;
    }
    if (message.includes('audio') || message.includes('recording') || message.includes('microphone')) {
      return ErrorType.AUDIO_PROCESSING;
    }
    if (message.includes('database') || message.includes('supabase') || message.includes('sql')) {
      return ErrorType.DATABASE;
    }
    
    return ErrorType.UNKNOWN;
  }

  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('error') || message.includes('failed')) {
      return ErrorSeverity.HIGH;
    }
    if (message.includes('warning') || message.includes('timeout')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  private generateErrorCode(type: ErrorType): string {
    const codes = {
      [ErrorType.NETWORK]: 'NET',
      [ErrorType.AUTHENTICATION]: 'AUTH',
      [ErrorType.VALIDATION]: 'VAL',
      [ErrorType.AI_SERVICE]: 'AI',
      [ErrorType.AUDIO_PROCESSING]: 'AUD',
      [ErrorType.DATABASE]: 'DB',
      [ErrorType.UNKNOWN]: 'UNK'
    };
    
    const prefix = codes[type];
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }

  private getLogMethod(severity: ErrorSeverity) {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return logger.error;
      case ErrorSeverity.MEDIUM:
        return logger.warn;
      default:
        return logger.info;
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export convenience functions
export const handleError = (error: Error | AppError, context?: Record<string, any>, userId?: string) => 
  errorHandler.handleError(error, context, userId);

export const createError = (
  type: ErrorType,
  message: string,
  severity?: ErrorSeverity,
  details?: any,
  context?: Record<string, any>
) => errorHandler.createError(type, message, severity, details, context);

// React hook for error handling
export const useErrorHandler = () => {
  return {
    handleError: (error: Error | AppError, context?: Record<string, any>, userId?: string) =>
      errorHandler.handleError(error, context, userId),
    createError: (
      type: ErrorType,
      message: string,
      severity?: ErrorSeverity,
      details?: any,
      context?: Record<string, any>
    ) => errorHandler.createError(type, message, severity, details, context),
    getUserMessage: (error: AppError) => errorHandler.getUserMessage(error),
    shouldRetry: (error: AppError) => errorHandler.shouldRetry(error),
    getRetryDelay: (error: AppError, attempt: number) => errorHandler.getRetryDelay(error, attempt)
  };
};
