/**
 * Accessibility Enhancement Components
 * Provides reusable accessibility utilities and enhanced components
 */

import React from 'react';
import { clsx } from 'clsx';

// Simple utility function to combine class names
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return clsx(classes);
};

// Screen Reader Only Text Component
export const ScreenReaderOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="sr-only">{children}</span>
);

// Skip Link Component for keyboard navigation
export const SkipLink: React.FC<{ href: string; children: React.ReactNode }> = ({ 
  href, 
  children 
}) => (
  <a
    href={href}
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
  >
    {children}
  </a>
);

// Enhanced Button with better accessibility
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Loading...',
  disabled,
  children,
  className,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
  };
  
  const sizeClasses = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-11 px-8 text-lg'
  };

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-describedby={loading ? 'loading-description' : undefined}
      {...props}
    >
      {loading ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{loadingText}</span>
          <span className="sr-only">
            Please wait while the action is being processed
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

// Enhanced Input with better accessibility
interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
}

export const AccessibleInput: React.FC<AccessibleInputProps> = ({
  label,
  error,
  description,
  required,
  id,
  className,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substring(2, 11)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className="space-y-2">
      <label 
        htmlFor={inputId}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      
      {description && (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      
      <input
        id={inputId}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={cn(descriptionId, errorId)}
        aria-required={required}
        {...props}
      />
      
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

// Enhanced Audio Player with accessibility
interface AccessibleAudioPlayerProps {
  src: string;
  title: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  className?: string;
}

export const AccessibleAudioPlayer: React.FC<AccessibleAudioPlayerProps> = ({
  src,
  title,
  onPlay,
  onPause,
  onEnded,
  className
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
      onPlay?.();
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPause?.();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    onEnded?.();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn('flex items-center space-x-3 p-3 bg-muted rounded-lg', className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
      
      <button
        onClick={isPlaying ? handlePause : handlePlay}
        className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
      >
        {isPlaying ? (
          <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5 mx-auto ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      
      <div className="flex-1 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        
        <div className="relative">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={(e) => {
              const time = parseFloat(e.target.value);
              if (audioRef.current) {
                audioRef.current.currentTime = time;
                setCurrentTime(time);
              }
            }}
            className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
            aria-label={`Seek to position in ${title}`}
          />
        </div>
      </div>
    </div>
  );
};

// Live Region for Screen Reader Announcements
interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
  atomic?: boolean;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({ 
  message, 
  politeness = 'polite',
  atomic = true 
}) => (
  <div
    aria-live={politeness}
    aria-atomic={atomic}
    className="sr-only"
  >
    {message}
  </div>
);

// Focus Trap Component
interface FocusTrapProps {
  children: React.ReactNode;
  active: boolean;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({ children, active }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [active]);

  return (
    <div ref={containerRef}>
      {children}
    </div>
  );
};

// Keyboard Navigation Hook
export const useKeyboardNavigation = (
  items: string[],
  onSelect: (item: string) => void
) => {
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => prev <= 0 ? items.length - 1 : prev - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0) {
          onSelect(items[activeIndex]);
        }
        break;
      case 'Escape':
        setActiveIndex(-1);
        break;
    }
  }, [items, activeIndex, onSelect]);

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown
  };
};