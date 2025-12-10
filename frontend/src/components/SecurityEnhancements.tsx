/**
 * Security Enhancement Components
 * Provides client-side security utilities and rate limiting
 */

import React, { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

// Rate limiting utility
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: () => string;
}

class ClientRateLimit {
  private requests: Map<string, number[]> = new Map();
  
  constructor(private config: RateLimitConfig) {}
  
  isAllowed(key?: string): boolean {
    const requestKey = key || this.config.keyGenerator?.() || 'default';
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get existing requests for this key
    const existingRequests = this.requests.get(requestKey) || [];
    
    // Filter out old requests
    const recentRequests = existingRequests.filter(time => time > windowStart);
    
    // Check if under limit
    if (recentRequests.length >= this.config.maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(requestKey, recentRequests);
    
    return true;
  }
  
  getRemainingRequests(key?: string): number {
    const requestKey = key || this.config.keyGenerator?.() || 'default';
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    const existingRequests = this.requests.get(requestKey) || [];
    const recentRequests = existingRequests.filter(time => time > windowStart);
    
    return Math.max(0, this.config.maxRequests - recentRequests.length);
  }
  
  getResetTime(key?: string): number {
    const requestKey = key || this.config.keyGenerator?.() || 'default';
    const existingRequests = this.requests.get(requestKey) || [];
    
    if (existingRequests.length === 0) {
      return 0;
    }
    
    const oldestRequest = Math.min(...existingRequests);
    return oldestRequest + this.config.windowMs;
  }
}

// Create rate limiters for different endpoints
export const apiRateLimiter = new ClientRateLimit({
  maxRequests: 30,
  windowMs: 60000, // 1 minute
  keyGenerator: () => 'api-calls'
});

export const audioRateLimiter = new ClientRateLimit({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  keyGenerator: () => 'audio-uploads'
});

export const chatRateLimiter = new ClientRateLimit({
  maxRequests: 20,
  windowMs: 60000, // 1 minute
  keyGenerator: () => 'chat-messages'
});

// Content Security Policy helper
export const CSPHelper = {
  // Check if inline scripts are allowed (for development)
  isInlineScriptAllowed(): boolean {
    try {
      // Try to create a script element and see if it executes
      const script = document.createElement('script');
      script.textContent = 'window.__csp_test = true;';
      document.head.appendChild(script);
      document.head.removeChild(script);
      
      const result = !!(window as any).__csp_test;
      delete (window as any).__csp_test;
      return result;
    } catch {
      return false;
    }
  },
  
  // Report CSP violations
  reportViolation(violation: any) {
    logger.warn('CSP Violation detected:', violation);
    
    // In production, you might want to send this to your monitoring service
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/security/csp-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violation,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // Silently fail - don't want CSP reporting to break the app
      });
    }
  }
};

// Input sanitization utilities
export const InputSanitizer = {
  // Sanitize text input to prevent XSS
  sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .slice(0, 10000); // Limit length
  },
  
  // Sanitize HTML content
  sanitizeHTML(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  },
  
  // Validate file uploads
  validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }
    
    // Check file type for audio uploads
    const allowedTypes = [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/webm',
      'audio/ogg',
      'audio/mp4'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Only audio files are allowed.' };
    }
    
    // Check file name
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      return { valid: false, error: 'Invalid file name. Only alphanumeric characters, dots, hyphens, and underscores are allowed.' };
    }
    
    return { valid: true };
  }
};

// Secure API request wrapper
interface SecureRequestOptions extends RequestInit {
  rateLimiter?: ClientRateLimit;
  sanitizeBody?: boolean;
  timeout?: number;
}

export const secureRequest = async (
  url: string, 
  options: SecureRequestOptions = {}
): Promise<Response> => {
  const {
    rateLimiter,
    sanitizeBody = true,
    timeout = 30000,
    ...fetchOptions
  } = options;
  
  // Check rate limiting
  if (rateLimiter && !rateLimiter.isAllowed()) {
    const resetTime = rateLimiter.getResetTime();
    const waitTime = Math.ceil((resetTime - Date.now()) / 1000);
    throw new Error(`Rate limit exceeded. Try again in ${waitTime} seconds.`);
  }
  
  // Sanitize request body if it's JSON
  if (sanitizeBody && fetchOptions.body && typeof fetchOptions.body === 'string') {
    try {
      const parsed = JSON.parse(fetchOptions.body);
      const sanitized = sanitizeObject(parsed);
      fetchOptions.body = JSON.stringify(sanitized);
    } catch {
      // If not valid JSON, treat as text and sanitize
      fetchOptions.body = InputSanitizer.sanitizeText(fetchOptions.body);
    }
  }
  
  // Add security headers
  const headers = new Headers(fetchOptions.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Check for security-related response headers
    const csp = response.headers.get('Content-Security-Policy');
    if (!csp && process.env.NODE_ENV === 'production') {
      logger.warn('Response missing Content-Security-Policy header');
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    throw error;
  }
};

// Sanitize object recursively
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return InputSanitizer.sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = InputSanitizer.sanitizeText(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Security monitoring hook
export const useSecurityMonitoring = () => {
  const [violations, setViolations] = useState<any[]>([]);
  const [isSecure, setIsSecure] = useState(true);
  
  useEffect(() => {
    // Listen for CSP violations
    const handleCSPViolation = (event: SecurityPolicyViolationEvent) => {
      const violation = {
        blockedURI: event.blockedURI,
        documentURI: event.documentURI,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        referrer: event.referrer,
        violatedDirective: event.violatedDirective,
        timestamp: Date.now()
      };
      
      setViolations(prev => [...prev.slice(-9), violation]); // Keep last 10
      CSPHelper.reportViolation(violation);
    };
    
    document.addEventListener('securitypolicyviolation', handleCSPViolation);
    
    // Check basic security features
    const checkSecurity = () => {
      const secure = 
        window.location.protocol === 'https:' || 
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
      
      setIsSecure(secure);
      
      if (!secure) {
        logger.warn('Application not running over HTTPS in production');
      }
    };
    
    checkSecurity();
    
    return () => {
      document.removeEventListener('securitypolicyviolation', handleCSPViolation);
    };
  }, []);
  
  return {
    violations,
    isSecure,
    clearViolations: () => setViolations([])
  };
};

// Rate limit status component
interface RateLimitStatusProps {
  rateLimiter: ClientRateLimit;
  label: string;
}

export const RateLimitStatus: React.FC<RateLimitStatusProps> = ({ 
  rateLimiter, 
  label 
}) => {
  const [remaining, setRemaining] = useState(0);
  const [resetTime, setResetTime] = useState(0);
  
  useEffect(() => {
    const updateStatus = () => {
      setRemaining(rateLimiter.getRemainingRequests());
      setResetTime(rateLimiter.getResetTime());
    };
    
    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    
    return () => clearInterval(interval);
  }, [rateLimiter]);
  
  const resetIn = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));
  
  if (remaining === 0 && resetIn > 0) {
    return (
      <div className="text-xs text-destructive">
        {label}: Rate limited (reset in {resetIn}s)
      </div>
    );
  }
  
  if (remaining <= 5) {
    return (
      <div className="text-xs text-muted-foreground">
        {label}: {remaining} requests remaining
      </div>
    );
  }
  
  return null;
};

// Secure form wrapper
interface SecureFormProps {
  onSubmit: (data: FormData) => void;
  children: React.ReactNode;
  rateLimiter?: ClientRateLimit;
  className?: string;
}

export const SecureForm: React.FC<SecureFormProps> = ({
  onSubmit,
  children,
  rateLimiter,
  className
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    // Check rate limiting
    if (rateLimiter && !rateLimiter.isAllowed()) {
      const resetTime = rateLimiter.getResetTime();
      const waitTime = Math.ceil((resetTime - Date.now()) / 1000);
      setError(`Please wait ${waitTime} seconds before submitting again.`);
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const formData = new FormData(e.currentTarget);
      
      // Sanitize form data
      const sanitizedData = new FormData();
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') {
          sanitizedData.append(
            InputSanitizer.sanitizeText(key),
            InputSanitizer.sanitizeText(value)
          );
        } else {
          // File upload
          const validation = InputSanitizer.validateFile(value as File);
          if (!validation.valid) {
            throw new Error(validation.error);
          }
          sanitizedData.append(key, value);
        }
      }
      
      await onSubmit(sanitizedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
      {error && (
        <div className="text-sm text-destructive mt-2" role="alert">
          {error}
        </div>
      )}
      {rateLimiter && (
        <RateLimitStatus rateLimiter={rateLimiter} label="Form submissions" />
      )}
    </form>
  );
};

// Security status indicator
export const SecurityStatusIndicator: React.FC = () => {
  const { violations, isSecure } = useSecurityMonitoring();
  
  if (!isSecure) {
    return (
      <div className="flex items-center gap-1 text-xs text-destructive">
        <div className="w-2 h-2 bg-destructive rounded-full" />
        <span>Insecure connection</span>
      </div>
    );
  }
  
  if (violations.length > 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
        <span>{violations.length} security events</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 text-xs text-success">
      <div className="w-2 h-2 bg-success rounded-full" />
      <span>Secure</span>
    </div>
  );
};