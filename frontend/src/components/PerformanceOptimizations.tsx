/**
 * Performance Optimization Components
 * Provides image optimization, virtual scrolling, and performance monitoring
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { logger } from '../utils/logger';

// Image optimization component
interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className,
  loading = 'lazy',
  priority = false,
  placeholder,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholder || '');
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate responsive image sources
  const generateSrcSet = useCallback((baseSrc: string) => {
    if (!baseSrc || baseSrc.startsWith('data:')) return '';
    
    const sizes = [320, 640, 768, 1024, 1280, 1920];
    return sizes
      .map(size => `${baseSrc}?w=${size}&q=75 ${size}w`)
      .join(', ');
  }, []);

  // Preload critical images
  useEffect(() => {
    if (priority && src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
      
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [src, priority]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (loading === 'lazy' && imgRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isLoaded && !hasError) {
              setCurrentSrc(src);
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '50px' }
      );

      observer.observe(imgRef.current);
      
      return () => observer.disconnect();
    } else if (loading === 'eager') {
      setCurrentSrc(src);
    }
  }, [src, loading, isLoaded, hasError]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    setCurrentSrc(placeholder || '');
    onError?.();
  }, [placeholder, onError]);

  return (
    <img
      ref={imgRef}
      src={currentSrc}
      srcSet={currentSrc ? generateSrcSet(currentSrc) : undefined}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      alt={alt}
      width={width}
      height={height}
      className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      loading={loading}
      onLoad={handleLoad}
      onError={handleError}
      style={{
        aspectRatio: width && height ? `${width}/${height}` : undefined
      }}
    />
  );
};

// Virtual scrolling component for large lists
interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

export function VirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, startIndex, endIndex]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: index * itemHeight,
              height: itemHeight,
              width: '100%'
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Performance monitoring hook
interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  loadTime: number;
  renderTime: number;
  isSlowDevice: boolean;
}

export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    loadTime: 0,
    renderTime: 0,
    isSlowDevice: false
  });

  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const animationFrame = useRef<number>();

  useEffect(() => {
    // Measure FPS
    const measureFPS = () => {
      frameCount.current++;
      const now = performance.now();
      
      if (now - lastTime.current >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current));
        
        setMetrics(prev => ({
          ...prev,
          fps,
          isSlowDevice: fps < 30
        }));
        
        frameCount.current = 0;
        lastTime.current = now;
      }
      
      animationFrame.current = requestAnimationFrame(measureFPS);
    };

    animationFrame.current = requestAnimationFrame(measureFPS);

    // Measure memory usage (if available)
    const measureMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024) // MB
        }));
      }
    };

    const memoryInterval = setInterval(measureMemory, 5000);

    // Measure load time
    if (performance.timing) {
      const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
      setMetrics(prev => ({ ...prev, loadTime }));
    }

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      clearInterval(memoryInterval);
    };
  }, []);

  return metrics;
};

// Debounced input component for performance
interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  delay?: number;
  placeholder?: string;
  className?: string;
}

export const DebouncedInput: React.FC<DebouncedInputProps> = ({
  value,
  onChange,
  delay = 300,
  placeholder,
  className
}) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, delay);
  }, [onChange, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
};

// Memoized component wrapper
export function memo<P extends object>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean
) {
  return React.memo(Component, propsAreEqual);
}

// Lazy loading wrapper for components
interface LazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
}

export const LazyComponent: React.FC<LazyComponentProps> = ({
  children,
  fallback = <div>Loading...</div>,
  threshold = 0.1
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
};

// Performance-optimized list component
interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  className?: string;
  maxItems?: number;
  loadMoreThreshold?: number;
  onLoadMore?: () => void;
}

export function OptimizedList<T>({
  items,
  renderItem,
  keyExtractor,
  className,
  maxItems = 100,
  loadMoreThreshold = 10,
  onLoadMore
}: OptimizedListProps<T>) {
  const [visibleItems, setVisibleItems] = useState(
    items.slice(0, Math.min(maxItems, items.length))
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Update visible items when items change
  useEffect(() => {
    setVisibleItems(items.slice(0, Math.min(maxItems, items.length)));
  }, [items, maxItems]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !onLoadMore) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage > 0.9 && visibleItems.length < items.length) {
      const nextBatch = items.slice(
        visibleItems.length,
        Math.min(visibleItems.length + loadMoreThreshold, items.length)
      );
      setVisibleItems(prev => [...prev, ...nextBatch]);
      
      if (visibleItems.length + nextBatch.length >= items.length) {
        onLoadMore();
      }
    }
  }, [items, visibleItems.length, loadMoreThreshold, onLoadMore]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  return (
    <div ref={containerRef} className={`overflow-auto ${className}`}>
      {visibleItems.map((item, index) => (
        <div key={keyExtractor(item, index)}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

// Performance status indicator
export const PerformanceStatusIndicator: React.FC = () => {
  const metrics = usePerformanceMonitoring();

  const getStatusColor = () => {
    if (metrics.fps < 30 || metrics.memoryUsage > 100) {
      return 'text-destructive';
    }
    if (metrics.fps < 50 || metrics.memoryUsage > 50) {
      return 'text-muted-foreground';
    }
    return 'text-success';
  };

  const getStatusText = () => {
    if (metrics.isSlowDevice) {
      return 'Performance: Low';
    }
    if (metrics.fps >= 50) {
      return 'Performance: Good';
    }
    return 'Performance: Fair';
  };

  return (
    <div className={`text-xs ${getStatusColor()}`} title={`FPS: ${metrics.fps}, Memory: ${metrics.memoryUsage}MB`}>
      {getStatusText()}
    </div>
  );
};

// Resource preloader
export const ResourcePreloader = {
  preloadImage(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  },

  preloadImages(sources: string[]): Promise<void[]> {
    return Promise.all(sources.map(src => this.preloadImage(src)));
  },

  preloadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.onload = () => resolve();
      script.onerror = reject;
      script.src = src;
      document.head.appendChild(script);
    });
  },

  preloadStylesheet(href: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.onload = () => resolve();
      link.onerror = reject;
      link.href = href;
      document.head.appendChild(link);
    });
  }
};

// Bundle size analyzer (development only)
export const BundleAnalyzer = {
  logBundleSize() {
    if (process.env.NODE_ENV === 'development') {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      
      logger.info('Bundle Analysis:', {
        scriptCount: scripts.length,
        styleCount: styles.length,
        scripts: scripts.map(s => (s as HTMLScriptElement).src),
        styles: styles.map(s => (s as HTMLLinkElement).href)
      });
    }
  },

  measureComponentRenderTime<P>(
    Component: React.ComponentType<P>,
    name: string
  ): React.ComponentType<P> {
    return (props: P) => {
      const startTime = useRef<number>();
      
      useEffect(() => {
        startTime.current = performance.now();
      });
      
      useEffect(() => {
        if (startTime.current) {
          const renderTime = performance.now() - startTime.current;
          if (renderTime > 16) { // More than one frame
            logger.warn(`Slow render detected: ${name} took ${renderTime.toFixed(2)}ms`);
          }
        }
      });
      
      return React.createElement(Component, props);
    };
  }
};