import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Mic, MicOff, RotateCcw, Send, Loader2, Play, Pause, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { aiProsodyService, ConversationContext } from "../services/aiProsodyService";
import { liveTranscriptionService } from "../services/liveTranscriptionService";

interface RecordingControlsProps {
  onSendMessage: (message: string, isAudio: boolean, audioBlob?: Blob) => void;
  conversationContext?: ConversationContext;
  disabled?: boolean;
  showAIFeedback?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'analyzing' | 'ready';

export function RecordingControls({ 
  onSendMessage, 
  conversationContext,
  disabled, 
  showAIFeedback = true 
}: RecordingControlsProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedMessage, setRecordedMessage] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [incrementalFeedback, setIncrementalFeedback] = useState<{suggestions: string[]; encouragement: string} | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [aiReady, setAiReady] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Check AI service status
  useEffect(() => {
    setAiReady(aiProsodyService.isReady());
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState === 'recording') {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
        
        // Get incremental feedback every 3 seconds while recording
        if (aiReady && conversationContext && recordingTime > 0 && recordingTime % 3 === 0) {
          getIncrementalFeedback();
        }
      }, 1000);
    } else {
      setRecordingTime(0);
      setIncrementalFeedback(null);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState, recordingTime, aiReady, conversationContext]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getIncrementalFeedback = async () => {
    if (!aiReady || !conversationContext) return;
    
    try {
      const feedback = await aiProsodyService.getIncrementalFeedback(
        "Recording in progress...",
        conversationContext
      );
      setIncrementalFeedback(feedback);
      
      // Clear feedback after 3 seconds
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setIncrementalFeedback(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to get incremental feedback:', error);
    }
  };

  const handleStartRecording = async () => {
    if (disabled) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      
      await liveTranscriptionService.start(
        (transcript, isFinal) => {
          setRecordedMessage(transcript);
          if (!isFinal && transcript) {
            setAnalysisProgress(Math.min(transcript.length * 2, 90));
          }
        },
        (error) => {
          console.error('Live transcription error:', error);
        }
      );
      
      setRecordingState('recording');
      setRecordingTime(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setRecordingState('processing');
    setAnalysisProgress(50);
    
    try {
      const finalTranscript = await liveTranscriptionService.stop();
      setRecordedMessage(finalTranscript);
      setAnalysisProgress(100);
      
      if (aiReady && showAIFeedback && finalTranscript) {
        setRecordingState('analyzing');
        setTimeout(() => {
          setRecordingState('ready');
        }, 1500);
      } else {
        setRecordingState('ready');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setRecordingState('ready');
    }
  };

  const handlePlayback = () => {
    if (audioBlob && !isPlaying) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      
      audio.play();
      setIsPlaying(true);
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleRetry = () => {
    setRecordedMessage("");
    setAudioBlob(null);
    setRecordingState('idle');
    setAnalysisProgress(0);
    setIncrementalFeedback(null);
    
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSend = () => {
    if (recordedMessage) {
      onSendMessage(recordedMessage, true, audioBlob || undefined);
      setRecordedMessage("");
      setAudioBlob(null);
      setRecordingState('idle');
      setAnalysisProgress(0);
    }
  };

  const getRecordButtonIcon = () => {
    switch (recordingState) {
      case 'recording':
        return <MicOff className="w-6 h-6" />;
      case 'processing':
      case 'analyzing':
        return <Loader2 className="w-6 h-6 animate-spin" />;
      default:
        return <Mic className="w-6 h-6" />;
    }
  };

  const getRecordButtonClass = () => {
    const baseClass = "h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300 relative overflow-hidden";
    switch (recordingState) {
      case 'recording':
        return `${baseClass} bg-destructive hover:bg-destructive/90 text-destructive-foreground`;
      case 'processing':
      case 'analyzing':
        return `${baseClass} bg-muted text-muted-foreground cursor-not-allowed`;
      default:
        return `${baseClass} bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:shadow-xl ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;
    }
  };

  const getStatusMessage = () => {
    switch (recordingState) {
      case 'recording':
        return aiReady ? 'Speak clearly - AI is listening' : 'Recording your speech';
      case 'processing':
        return 'Processing audio...';
      case 'analyzing':
        return 'AI analyzing your pronunciation';
      case 'ready':
        return 'Ready to send!';
      default:
        return aiReady ? 'Tap to record with AI analysis' : 'Tap to record your response';
    }
  };

  return (
    <div className="bg-card border-t border-border p-4 space-y-4">
      {/* AI Status */}
      {showAIFeedback && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${aiReady ? 'bg-success animate-pulse' : 'bg-muted'}`} />
            <span className="text-muted-foreground">
              AI Analysis: {aiReady ? 'Active' : 'Not configured'}
            </span>
          </div>
          {!aiReady && (
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Settings className="w-3 h-3 mr-1" />
              Setup
            </Button>
          )}
        </div>
      )}

      {/* Recording Status */}
      <AnimatePresence mode="wait">
        {recordingState !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {recordingState === 'recording' && (
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm font-medium">Recording</span>
                <Badge variant="outline" className="bg-destructive/10 text-destructive">
                  {formatTime(recordingTime)}
                </Badge>
              </div>
            )}
            
            {(recordingState === 'processing' || recordingState === 'analyzing') && (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span className="text-sm text-muted-foreground">
                    {recordingState === 'processing' ? 'Processing audio...' : 'AI analyzing pronunciation...'}
                  </span>
                </div>
                <Progress value={analysisProgress} className="h-1" />
              </div>
            )}

            {/* Incremental Feedback */}
            {incrementalFeedback && recordingState === 'recording' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-center"
              >
                <p className="text-sm font-medium text-accent mb-1">
                  {incrementalFeedback.encouragement}
                </p>
                {incrementalFeedback.suggestions.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    💡 {incrementalFeedback.suggestions[0]}
                  </p>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcribed Message */}
      <AnimatePresence>
        {recordedMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3"
          >
            <p className="text-sm">"{recordedMessage}"</p>
            
            <div className="flex items-center gap-2">
              {audioBlob && (
                <Button
                  onClick={handlePlayback}
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              )}
              
              <div className="flex gap-2 flex-1">
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
                  disabled={recordingState === 'analyzing'}
                >
                  {recordingState === 'analyzing' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {recordingState === 'analyzing' ? 'Analyzing...' : 'Send'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording Controls */}
      <div className="flex items-center justify-center">
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            onClick={recordingState === 'recording' ? handleStopRecording : handleStartRecording}
            className={getRecordButtonClass()}
            disabled={disabled || recordingState === 'processing' || recordingState === 'analyzing'}
          >
            {/* Pulse animation for recording */}
            {recordingState === 'recording' && (
              <motion.div
                className="absolute inset-0 rounded-full bg-destructive"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.2, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
            {getRecordButtonIcon()}
          </Button>
        </motion.div>
      </div>

      {/* Status Message */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          {getStatusMessage()}
        </p>
      </div>
    </div>
  );
}