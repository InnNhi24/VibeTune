import { useEffect, useRef } from 'react';

interface AudioWaveVisualizerProps {
  isActive: boolean;
  audioStream?: MediaStream | null;
}

export function AudioWaveVisualizer({ isActive, audioStream }: AudioWaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const dataArrayRef = useRef<Uint8Array>();

  useEffect(() => {
    if (!isActive || !audioStream) {
      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    // Setup Web Audio API
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(audioStream);
      
      analyser.fftSize = 32; // Small FFT for 7 bars
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyser);
      
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      
      // Start animation
      animate();
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        source.disconnect();
        audioContext.close();
      };
    } catch (error) {
      console.warn('Web Audio API not available, using CSS animation fallback');
    }
  }, [isActive, audioStream]);

  const animate = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    // Continue animation loop
    animationRef.current = requestAnimationFrame(animate);
  };

  // Simple 7 wave bars with CSS animation
  return (
    <div className="flex items-center justify-center gap-1 h-6">
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  );
}
