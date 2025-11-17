import React, { useState, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { RotateCcw, Upload } from 'lucide-react';

interface InlineAvatarCropProps {
  onImageChange?: (croppedImageUrl: string, croppedFile: File) => void;
  size?: number;
}

export function InlineAvatarCrop({ onImageChange, size = 120 }: InlineAvatarCropProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setOriginalFile(file);
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setCrop({ x: 0, y: 0, scale: 1 });
      
      // Auto-generate cropped version
      setTimeout(() => generateCroppedImage(), 100);
    }
  };

  // Handle mouse/touch events for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!imageUrl) return;
    e.preventDefault();
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({ 
        x: e.clientX - rect.left - crop.x, 
        y: e.clientY - rect.top - crop.y 
      });
    }
  }, [crop, imageUrl]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    setCrop(prev => ({
      ...prev,
      x: e.clientX - rect.left - dragStart.x,
      y: e.clientY - rect.top - dragStart.y
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Generate cropped image after drag
      setTimeout(() => generateCroppedImage(), 50);
    }
  }, [isDragging]);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!imageUrl) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setCrop(prev => {
      const newScale = Math.max(0.5, Math.min(3, prev.scale + delta));
      return { ...prev, scale: newScale };
    });
    // Generate cropped image after zoom
    setTimeout(() => generateCroppedImage(), 50);
  }, [imageUrl]);

  // Reset crop
  const handleReset = () => {
    setCrop({ x: 0, y: 0, scale: 1 });
    setTimeout(() => generateCroppedImage(), 50);
  };

  // Generate cropped image
  const generateCroppedImage = async () => {
    if (!imageRef.current || !containerRef.current || !originalFile) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to desired output
    canvas.width = size;
    canvas.height = size;

    // Get container and image dimensions
    const container = containerRef.current;
    const img = imageRef.current;
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    // Calculate crop area (center circle)
    const cropRadius = size / 2;
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    // Scale factors
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    // Source coordinates
    const sourceX = (centerX - cropRadius - crop.x) * scaleX / crop.scale;
    const sourceY = (centerY - cropRadius - crop.y) * scaleY / crop.scale;
    const sourceSize = (size * scaleX) / crop.scale;

    // Create circular clip
    ctx.beginPath();
    ctx.arc(cropRadius, cropRadius, cropRadius, 0, 2 * Math.PI);
    ctx.clip();

    // Draw cropped image
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, size, size
    );

    // Convert to blob and notify parent
    canvas.toBlob((blob) => {
      if (blob && onImageChange) {
        const croppedFile = new File([blob], originalFile.name, { type: 'image/jpeg' });
        const croppedUrl = URL.createObjectURL(blob);
        onImageChange(croppedUrl, croppedFile);
      }
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Avatar Circle */}
      <div 
        ref={containerRef}
        className={`relative rounded-full overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/30 cursor-pointer transition-colors hover:border-muted-foreground/50`}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={() => !imageUrl && fileInputRef.current?.click()}
      >
        {imageUrl ? (
          <>
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Avatar preview"
              className="absolute select-none pointer-events-none"
              style={{
                transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale})`,
                transformOrigin: 'top left'
              }}
              draggable={false}
            />
            {/* Drag hint overlay */}
            {!isDragging && (
              <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                <div className="text-white/80 text-xs font-medium opacity-0 hover:opacity-100 transition-opacity">
                  Drag to adjust
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <Upload className="w-6 h-6 mb-1" />
            <span className="text-xs">Upload photo</span>
          </div>
        )}
      </div>

      {/* Controls */}
      {imageUrl && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Zoom:</span>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={crop.scale}
              onChange={(e) => {
                const newScale = parseFloat(e.target.value);
                setCrop(prev => ({ ...prev, scale: newScale }));
                setTimeout(() => generateCroppedImage(), 50);
              }}
              className="w-16 h-1"
            />
            <span className="text-xs text-muted-foreground w-8">
              {Math.round(crop.scale * 100)}%
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-6 px-2 text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      )}

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Upload Button */}
      {!imageUrl && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs"
        >
          <Upload className="w-3 h-3 mr-1" />
          Choose Photo
        </Button>
      )}

      {imageUrl && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs text-muted-foreground"
        >
          Change Photo
        </Button>
      )}
    </div>
  );
}