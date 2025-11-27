import { useEffect, useRef, useState } from 'react';

interface AudioWaveVisualizerProps {
  isActive: boolean;
  audioStream?: MediaStream | null;
}

export function AudioWaveVisualizer({ isActive, audioStream }: AudioWaveVisualizerProps) {
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const dataArrayRef = useRef<Uint8Array>();
  const [barHeights, setBarHeights] = useState<number[]>([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]);

  useEffect(() => {
    if (!isActive || !audioStream) {
      // Stop animation and reset bars to minimum height
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setBarHeights([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]);
      return;
    }

    // Setup Web Audio API
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(audioStream);
      
      analyser.fftSize = 64; // Larger FFT for better frequency resolution
      analyser.smoothingTimeConstant = 0.8; // Smooth out the data
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyser);
      
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      
      // Start animation
      const animate = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as Uint8Array);
        
        // Calculate heights for 7 bars based on frequency data
        const dataArray = dataArrayRef.current;
        const newHeights = [0, 1, 2, 3, 4, 5, 6].map(i => {
          // Sample different frequency ranges for each bar
          const index = Math.floor((i / 7) * dataArray.length);
          const value = dataArray[index];
          // Normalize to 0.3 - 1.0 range (minimum 30% height)
          return Math.max(0.3, Math.min(1.0, value / 255));
        });
        
        setBarHeights(newHeights);
        
        // Continue animation loop
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animate();
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        source.disconnect();
        audioContext.close();
      };
    } catch (error) {
      console.warn('Web Audio API not available');
      // Set static heights as fallback
      setBarHeights([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]);
    }
  }, [isActive, audioStream]);

  // Wave bars controlled by audio input only
  return (
    <div className="flex items-center justify-center gap-1 h-6">
      {barHeights.map((height, i) => (
        <div
          key={i}
          className="w-[3px] bg-white rounded-sm transition-all duration-100"
          style={{
            height: '24px',
            transform: `scaleY(${height})`,
            transformOrigin: 'center'
          }}
        />
      ))}
    </div>
  );
}
