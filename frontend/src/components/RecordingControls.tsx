import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Mic, MicOff, RotateCcw, Send, Loader2, Play, Pause, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConversationContext } from "../services/aiProsodyService";
import { liveTranscriptionService } from "../services/liveTranscriptionService";
import { logger } from '../utils/logger';

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
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [aiReady, setAiReady] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const usingServiceRef = useRef<boolean>(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // Check AI service status (use prop as a hint whether AI features should be shown)
  useEffect(() => {
    setAiReady(showAIFeedback);
  }, [showAIFeedback]);

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
  }, [recordingState, recordingTime, aiReady, conversationContext]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // NOTE: incremental AI feedback during recording was removed to avoid
  // frequent/interrupting AI calls. AI analysis should only be requested
  // once the user has finished speaking (on Stop & Send).

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
      // Prefer browser Web Speech API for interim live transcripts when available
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognition) {
        try {
          setTranscribeError(null);
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;
          recognition.interimResults = true;
          recognition.continuous = true;

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) final += res[0].transcript + ' ';
              else interim += res[0].transcript;
            }
            // prefer showing final+interim combined
            const combined = (final + interim).trim();
            if (combined) setRecordedMessage(combined);
            if (!event.isFinal && combined) {
              setAnalysisProgress(Math.min(combined.length * 2, 90));
            }
          };

          recognition.onerror = (ev: any) => {
            logger.error('SpeechRecognition error', ev);
            setTranscribeError(ev?.error || 'Speech recognition error');
            // On recoverable errors, fall back to server ASR
            try {
              // start server-based fallback
              usingServiceRef.current = true;
              liveTranscriptionService.start(
                (transcript, isFinal) => {
                  setRecordedMessage(transcript);
                  if (!isFinal && transcript) {
                    setAnalysisProgress(Math.min(transcript.length * 2, 90));
                  }
                },
                (error) => {
                  logger.error('Live transcription error (fallback):', error);
                  setTranscribeError(error);
                }
              );
            } catch (e) {
              logger.error('Failed to start fallback liveTranscriptionService', e);
            }
          };

          recognition.onend = () => {
            // recognition ended (user stopped or browser stopped) — leave recordedMessage as-is
          };

          recognition.start();
        } catch (e) {
          logger.error('Failed to initialize SpeechRecognition, falling back to server ASR', e);
          // fallback to server ASR
          usingServiceRef.current = true;
          await liveTranscriptionService.start(
            (transcript, isFinal) => {
              setRecordedMessage(transcript);
              if (!isFinal && transcript) {
                setAnalysisProgress(Math.min(transcript.length * 2, 90));
              }
            },
            (error) => {
              logger.error('Live transcription error:', error);
              setTranscribeError(error);
            }
          );
        }
      } else {
        // No SpeechRecognition support — use server ASR
        usingServiceRef.current = true;
        await liveTranscriptionService.start(
          (transcript, isFinal) => {
            setRecordedMessage(transcript);
            if (!isFinal && transcript) {
              setAnalysisProgress(Math.min(transcript.length * 2, 90));
            }
          },
          (error) => {
            logger.error('Live transcription error:', error);
            setTranscribeError(error);
          }
        );
      }
      
      setRecordingState('recording');
      setRecordingTime(0);
    } catch (error) {
      logger.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setRecordingState('processing');
    setAnalysisProgress(50);
    
    try {
      // Stop SpeechRecognition if active
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) { /* noop */ }
        recognitionRef.current = null;
      }

      // Stop server-based service only if we started it
      let finalTranscript = recordedMessage;
      if (usingServiceRef.current) {
        try {
          finalTranscript = await liveTranscriptionService.stop();
        } finally {
          usingServiceRef.current = false;
        }
      }

      // Wait briefly for mediaRecorder.onstop to set audioBlob (onstop is async)
      const waitForBlob = async (timeout = 2000) => {
        const start = Date.now();
        while (!audioBlob && Date.now() - start < timeout) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 50));
        }
        return audioBlob;
      };

      const blob = await waitForBlob(3000);
      // If we have a final audio blob, try the OpenAI final transcription endpoint
      if (blob) {
        try {
          const final = await liveTranscriptionService.transcribeFinal(blob);
          if (final && final.trim()) {
            finalTranscript = final;
          }
        } catch (e: any) {
          logger.warn('Final transcription failed:', e?.message || e);
          setTranscribeError(e?.message || String(e));
        }
      }

      setRecordedMessage(finalTranscript || recordedMessage);
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
      logger.error('Failed to stop recording:', error);
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

            {/* Incremental feedback removed to avoid AI calls while recording. */}
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
      {transcribeError && (
        <div className="text-center mt-2">
          <p className="text-xs text-destructive">Transcription: {transcribeError}</p>
        </div>
      )}
    </div>
  );
}