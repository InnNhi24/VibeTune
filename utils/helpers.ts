// Time formatting utilities
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return time.toLocaleDateString();
  }
};

// Audio utilities
export const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const createAudioBlob = (base64: string, mimeType: string = 'audio/wav'): Blob => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

// Device and environment utilities
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  
  return {
    isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    isTablet: /iPad|Android.*(?!.*Mobile)|Silk/i.test(userAgent),
    isDesktop: !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
    platform: navigator.platform,
    userAgent: userAgent,
    language: navigator.language,
    onLine: navigator.onLine
  };
};

export const isCapacitorApp = (): boolean => {
  return !!(window as any).Capacitor;
};

// Storage utilities
export const safeJsonParse = <T,>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

export const getStorageItem = <T,>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
};

export const setStorageItem = (key: string, value: any): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
};

// Validation utilities
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Text processing utilities
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

export const highlightText = (text: string, searchTerm: string): string => {
  if (!searchTerm) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};

export const extractKeywords = (text: string): string[] => {
  // Simple keyword extraction - remove common words and short words
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
    'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours'
  ]);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word))
    .filter((word, index, array) => array.indexOf(word) === index) // Remove duplicates
    .slice(0, 10); // Limit to 10 keywords
};

// Network utilities
export const checkNetworkConnection = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!navigator.onLine) {
      resolve(false);
      return;
    }

    // Try to fetch a small resource to verify actual connectivity
    const timeoutId = setTimeout(() => resolve(false), 3000);
    
    fetch('/favicon.ico', { 
      method: 'HEAD',
      cache: 'no-cache'
    })
      .then(() => {
        clearTimeout(timeoutId);
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        resolve(false);
      });
  });
};

// Analytics utilities - Non-blocking event tracking
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  // Always non-blocking - use setTimeout to prevent any blocking
  setTimeout(async () => {
    try {
      // Import analytics service dynamically to avoid circular dependencies
      const { AnalyticsService } = await import('../services/analyticsService');
      AnalyticsService.track(eventName, {
        ...properties,
        deviceInfo: getDeviceInfo()
      });
    } catch (error) {
      console.warn('Failed to track event:', error);
      
      // Fallback to localStorage (also non-blocking)
      try {
        const events = getStorageItem('vibetune_analytics_fallback', []);
        events.push({
          name: eventName,
          properties,
          timestamp: new Date().toISOString(),
          deviceInfo: getDeviceInfo()
        });
        
        // Keep only last 100 events
        if (events.length > 100) {
          events.splice(0, events.length - 100);
        }
        
        setStorageItem('vibetune_analytics_fallback', events);
      } catch (fallbackError) {
        console.warn('Analytics fallback also failed:', fallbackError);
      }
    }
  }, 0);
};

// Error handling utilities
export const createErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error_description) return error.error_description;
  return 'An unexpected error occurred';
};

export const logError = (error: any, context?: string) => {
  console.error(`Error${context ? ` in ${context}` : ''}:`, error);
  
  // Store error for debugging
  const errors = getStorageItem('app_errors', []);
  errors.push({
    error: createErrorMessage(error),
    context,
    timestamp: new Date().toISOString(),
    stack: error?.stack,
    userAgent: navigator.userAgent
  });
  
  // Keep only last 50 errors
  if (errors.length > 50) {
    errors.splice(0, errors.length - 50);
  }
  
  setStorageItem('app_errors', errors);
};

// Rate limiting utilities
export const createRateLimiter = (maxRequests: number, windowMs: number) => {
  const requests: number[] = [];
  
  return {
    canMakeRequest: (): boolean => {
      const now = Date.now();
      
      // Remove old requests outside the window
      while (requests.length > 0 && requests[0] <= now - windowMs) {
        requests.shift();
      }
      
      // Check if we can make a new request
      if (requests.length < maxRequests) {
        requests.push(now);
        return true;
      }
      
      return false;
    },
    
    getTimeUntilNextRequest: (): number => {
      if (requests.length < maxRequests) return 0;
      return Math.max(0, requests[0] + windowMs - Date.now());
    }
  };
};

// Performance utilities
export const debounce = <T extends (...args: any[]) => any,>(
  func: T,
  waitMs: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), waitMs);
  };
};

export const throttle = <T extends (...args: any[]) => any,>(
  func: T,
  limitMs: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limitMs);
    }
  };
};