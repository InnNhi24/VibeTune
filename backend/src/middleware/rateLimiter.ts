/**
 * Rate Limiting Middleware for VibeTune Backend
 * Implements sliding window rate limiting with Redis-like in-memory storage
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Create rate limiting middleware
   */
  create(config: RateLimitConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req);
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Get or create rate limit entry
      let entry = this.store.get(key);
      
      if (!entry || entry.resetTime <= windowStart) {
        // Create new entry or reset expired one
        entry = {
          count: 0,
          resetTime: now + config.windowMs
        };
        this.store.set(key, entry);
      }

      // Increment counter
      entry.count++;

      // Check if limit exceeded
      if (entry.count > config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        
        res.set({
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
        });

        return res.status(429).json({
          error: 'Too Many Requests',
          message: config.message || 'Rate limit exceeded. Please try again later.',
          retryAfter,
          limit: config.maxRequests,
          remaining: 0,
          resetTime: new Date(entry.resetTime).toISOString()
        });
      }

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': (config.maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
      });

      next();
    };
  }

  /**
   * Get default key for rate limiting
   */
  private getDefaultKey(req: Request): string {
    // Use IP address as default key
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `rate_limit:${ip}`;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(key: string): { count: number; remaining: number; resetTime: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (entry.resetTime <= now) return null;

    return {
      count: entry.count,
      remaining: Math.max(0, 100 - entry.count), // Assuming max 100 requests
      resetTime: entry.resetTime
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const rateLimits = {
  // General API rate limiting
  general: rateLimiter.create({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests. Please try again later.'
  }),

  // Strict rate limiting for auth endpoints
  auth: rateLimiter.create({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
    keyGenerator: (req) => `auth:${req.ip}`
  }),

  // Rate limiting for AI endpoints (more expensive)
  ai: rateLimiter.create({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'AI service rate limit exceeded. Please wait before making another request.',
    keyGenerator: (req) => `ai:${req.ip}`
  }),

  // Rate limiting for audio processing
  audio: rateLimiter.create({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Audio processing rate limit exceeded. Please wait before uploading another file.',
    keyGenerator: (req) => `audio:${req.ip}`
  }),

  // Rate limiting for analytics events
  analytics: rateLimiter.create({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    message: 'Analytics rate limit exceeded. Some events may not be tracked.',
    keyGenerator: (req) => `analytics:${req.ip}`
  })
};

// Export the rate limiter instance for advanced usage
export { rateLimiter };

// Export cleanup function for graceful shutdown
export const cleanupRateLimiter = () => {
  rateLimiter.destroy();
};
