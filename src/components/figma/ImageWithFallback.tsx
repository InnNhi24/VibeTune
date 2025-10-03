import React, { useState, useCallback } from 'react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallback?: string;
  alt: string;
}

export function ImageWithFallback({ 
  src, 
  fallback, 
  alt, 
  className,
  onError,
  ...props 
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback((event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError && fallback) {
      setHasError(true);
      setImgSrc(fallback);
    } else {
      // If fallback also fails or no fallback provided, show default placeholder
      setHasError(true);
    }
    
    // Call original onError if provided
    if (onError) {
      onError(event);
    }
  }, [hasError, fallback, onError]);

  // If both image and fallback failed, show placeholder
  if (hasError && (!fallback || imgSrc === fallback)) {
    return (
      <div 
        className={`bg-muted flex items-center justify-center text-muted-foreground ${className || ''}`}
        style={{ minHeight: '100px', ...props.style }}
      >
        <svg 
          className="w-8 h-8" 
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path 
            fillRule="evenodd" 
            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" 
            clipRule="evenodd" 
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      loading="lazy"
    />
  );
}