import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Mic, MicOff, RotateCcw, Send, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface RecordingControlsProps {
  onSendMessage: (message: string, isAudio: boolean) => void;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing';

export function RecordingControls({ onSendMessage, disabled }: RecordingControlsProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedMessage, setRecordedMessage] = useState("");

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = () => {
    if (disabled) return;
    setRecordingState('recording');
    setRecordingTime(0);
    // In real app, would start audio recording here
  };

  const handleStopRecording = () => {
    setRecordingState('processing');
    
    // Simulate processing delay
    setTimeout(() => {
      const mockTranscription = "I think learning English prosody is really important for effective communication.";
      setRecordedMessage(mockTranscription);
      setRecordingState('idle');
    }, 2000);
  };

  const handleRetry = () => {
    setRecordedMessage("");
    setRecordingState('idle');
  };

  const handleSend = () => {
    if (recordedMessage) {
      onSendMessage(recordedMessage, true);
      setRecordedMessage("");
    }
  };

  const getRecordButtonIcon = () => {
    switch (recordingState) {
      case 'recording':
        return <MicOff className="w-6 h-6" />;
      case 'processing':
        return <Loader2 className="w-6 h-6 animate-spin" />;
      default:
        return <Mic className="w-6 h-6" />;
    }
  };

  const getRecordButtonClass = () => {
    const baseClass = "h-14 w-14 rounded-full flex items-center justify-center transition-all duration-200";
    switch (recordingState) {
      case 'recording':
        return `${baseClass} bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse`;
      case 'processing':
        return `${baseClass} bg-muted text-muted-foreground cursor-not-allowed`;
      default:
        return `${baseClass} bg-accent hover:bg-accent/90 text-accent-foreground ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
    }
  };

  return (
    <div className="bg-card border-t border-border p-4 space-y-4">
      {/* Recording Status */}
      {recordingState !== 'idle' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2"
        >
          {recordingState === 'recording' && (
            <>
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">Recording</span>
              <Badge variant="outline">{formatTime(recordingTime)}</Badge>
            </>
          )}
          {recordingState === 'processing' && (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Processing speech...</span>
            </>
          )}
        </motion.div>
      )}

      {/* Transcribed Message */}
      {recordedMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/20 rounded-lg p-3"
        >
          <p className="text-sm mb-3">"{recordedMessage}"</p>
          <div className="flex gap-2">
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button
              onClick={handleSend}
              size="sm"
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </motion.div>
      )}

      {/* Recording Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          onClick={recordingState === 'recording' ? handleStopRecording : handleStartRecording}
          className={getRecordButtonClass()}
          disabled={disabled || recordingState === 'processing'}
        >
          {getRecordButtonIcon()}
        </Button>
        
        {recordingState === 'recording' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-sm text-muted-foreground"
          >
            Tap to stop
          </motion.div>
        )}
      </div>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          {recordingState === 'idle' ? 'Tap to record your response' : ''}
          {recordingState === 'recording' ? 'Speak clearly for best results' : ''}
          {recordingState === 'processing' ? 'Analyzing your speech patterns...' : ''}
        </p>
      </div>
    </div>
  );
}