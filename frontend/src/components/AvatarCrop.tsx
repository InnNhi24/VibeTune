import React, { useState, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Crop, RotateCcw, Check, X } from 'lucide-react';

interface AvatarCropProps {
  imageFile: File;
  onCropComplete: (croppedImageUrl: string, croppedFile: File) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function AvatarCrop({ imageFile, onCropComplete, onCancel, isOpen }: AvatarCropProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load image when file changes
  React.useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  // Handle mouse/touch events for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  }, [crop]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setCrop(prev => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setCrop(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale + delta))
    }));
  }, []);

  // Reset crop
  const handleReset = () => {
    setCrop({ x: 0, y: 0, scale: 1 });
  };

  // Create cropped image
  const handleCropComplete = async () => {
    if (!imageRef.current || !containerRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to desired output (e.g., 200x200)
    const outputSize = 200;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Get container dimensions
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const cropSize = Math.min(containerRect.width, containerRect.height) - 40; // 40px padding

    // Calculate crop area
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    const cropX = centerX - cropSize / 2;
    const cropY = centerY - cropSize / 2;

    // Calculate source coordinates on the actual image
    const img = imageRef.current;
    const imgRect = img.getBoundingClientRect();
    
    // Scale factors
    const scaleX = img.naturalWidth / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;

    // Source crop coordinates
    const sourceX = (cropX - imgRect.left + containerRect.left - crop.x) * scaleX;
    const sourceY = (cropY - imgRect.top + containerRect.top - crop.y) * scaleY;
    const sourceSize = (cropSize / crop.scale) * scaleX;

    // Draw cropped image
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, outputSize, outputSize
    );

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], imageFile.name, { type: 'image/jpeg' });
        const croppedUrl = URL.createObjectURL(blob);
        onCropComplete(croppedUrl, croppedFile);
      }
    }, 'image/jpeg', 0.9);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="w-5 h-5" />
            Adjust Your Photo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crop Area */}
          <div 
            ref={containerRef}
            className="relative w-full h-80 bg-black rounded-lg overflow-hidden cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {imageUrl && (
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Crop preview"
                className="absolute select-none pointer-events-none"
                style={{
                  transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.scale})`,
                  transformOrigin: 'top left'
                }}
                draggable={false}
              />
            )}
            
            {/* Crop Circle Overlay */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-black/50" />
              
              {/* Circle cutout */}
              <div 
                className="absolute border-2 border-white rounded-full bg-transparent"
                style={{
                  width: '200px',
                  height: '200px',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                }}
              />
              
              {/* Grid lines */}
              <div 
                className="absolute border border-white/30 rounded-full pointer-events-none"
                style={{
                  width: '200px',
                  height: '200px',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="absolute w-full h-px bg-white/30 top-1/3" />
                <div className="absolute w-full h-px bg-white/30 top-2/3" />
                <div className="absolute h-full w-px bg-white/30 left-1/3" />
                <div className="absolute h-full w-px bg-white/30 left-2/3" />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Zoom:</span>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={crop.scale}
                onChange={(e) => setCrop(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">{Math.round(crop.scale * 100)}%</span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Drag to move • Scroll to zoom • Adjust to fit the circle
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleCropComplete}>
            <Check className="w-4 h-4 mr-1" />
            Use Photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}