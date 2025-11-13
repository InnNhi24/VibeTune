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
  const [srFailures, setSrFailures] = useState(0);
  const [micPermission, setMicPermission] = useState<'granted'|'denied'|'prompt'|'unknown'>('unknown');
  const srFailuresRef = useRef(0);
  const [listeningHint, setListeningHint] = useState<string | null>(null);
  const disableBrowserSRRef = useRef(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Store the last produced audio blob in a ref so consumers can await it without
  // relying on React state (avoids race conditions where state updates are not
  // immediately visible in the current function scope).
  const lastBlobRef = useRef<Blob | null>(null);
  const recognitionRef = useRef<any>(null);
  const usingServiceRef = useRef<boolean>(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  // Hold cumulative final transcript separately from interim
  const finalRef = useRef<string>("");
  const [interim, setInterim] = useState<string>("");
  const [view, setView] = useState<string>("");
  // Track stop reason to avoid unintended restarts/reset on browser timeouts
  const stopReasonRef = useRef<'user' | 'timeout'>('user');
  // limit automatic retries for no-speech
  const noSpeechRetriesRef = useRef<number>(0);
  // maximum retries for no-speech before treating as timeout
  const MAX_NO_SPEECH_RETRIES = 1;

  // Check AI service status (use prop as a hint whether AI features should be shown)
  useEffect(() => {
    setAiReady(showAIFeedback);
  }, [showAIFeedback]);

  // Check microphone permission state where supported
  useEffect(() => {
    const check = async () => {
      try {
        if ((navigator as any).permissions && (navigator as any).permissions.query) {
          const p = await (navigator as any).permissions.query({ name: 'microphone' });
          if (p.state === 'granted') setMicPermission('granted');
          else if (p.state === 'denied') setMicPermission('denied');
          else setMicPermission('prompt');
          p.onchange = () => {
            if (p.state === 'granted') setMicPermission('granted');
            else if (p.state === 'denied') setMicPermission('denied');
            else setMicPermission('prompt');
          };
        } else {
          setMicPermission('unknown');
        }
      } catch (e) {
        setMicPermission('unknown');
      }
    };
    check();
  }, []);

  const handleEnableMicClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // immediately stop tracks — purpose is just to prompt permission
      stream.getTracks().forEach(t => t.stop());
      setMicPermission('granted');
      setTranscribeError(null);
    } catch (e: any) {
      logger.warn('User denied microphone permission or getUserMedia failed', e);
      setMicPermission('denied');
      setTranscribeError('Microphone permission denied');
    }
  };

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
      // reset transient transcript state for a fresh recording
      finalRef.current = "";
      setInterim("");
      setView("");
      setRecordedMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
  activeStreamRef.current = stream;
      
      const chunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        // store both in state (for rendering) and in ref for synchronous access
        lastBlobRef.current = blob;
        setAudioBlob(blob);
        // stop any active tracks
        try { activeStreamRef.current?.getTracks().forEach(track => track.stop()); } catch (e) { /* noop */ }
        activeStreamRef.current = null;
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

          recognition.onstart = () => {
            // reset failure counters when recognition starts
            srFailuresRef.current = 0;
            setSrFailures(0);
            setTranscribeError(null);
            setListeningHint('🎙️ Listening... Please speak clearly.');
            stopReasonRef.current = 'user'; // Mark stopReason as 'user'
            // do not clear finalRef here - preserve previous finalized transcript
          };

          recognition.onresult = (event: any) => {
            let interimText = '';
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i];
              const t = res[0]?.transcript || '';
              if (res.isFinal) finalText += t + ' ';
              else interimText += t;
            }
            // Append finalized text to finalRef (persistent) and set interim separately
            if (finalText.trim()) {
              finalRef.current = (finalRef.current + ' ' + finalText).replace(/\s+/g, ' ').trim();
              setInterim('');
            } else {
              setInterim(interimText);
            }
            // update combined view
            const combinedView = (finalRef.current + ' ' + (interimText || '')).trim();
            setView(combinedView);
            if (!event.isFinal && combinedView) {
              setAnalysisProgress(Math.min(combinedView.length * 2, 90));
            }

            // successful result -> reset failures/hint
            srFailuresRef.current = 0;
            setSrFailures(0);
            setListeningHint(null);
          };

          recognition.onerror = (ev: any) => {
            logger.warn('SpeechRecognition error', ev);
            const err = ev?.error;

            if (err === 'no-speech') {
              // gentle retries but bounded
              noSpeechRetriesRef.current += 1;
              srFailuresRef.current += 1;
              setSrFailures(srFailuresRef.current);
              if (noSpeechRetriesRef.current <= MAX_NO_SPEECH_RETRIES) {
                setListeningHint('🎙️ I didn\'t catch that — please speak again.');
                setTimeout(() => {
                  try { recognitionRef.current?.start(); } catch (e) { /* noop */ }
                }, 800);
              } else {
                // mark as timeout stop — do not clear existing transcript
                stopReasonRef.current = 'timeout';
                setListeningHint('Mic not cooperating — switching to server transcription.');
                setTranscribeError('Using server transcription due to repeated recognition failures.');
                try { recognitionRef.current?.stop(); } catch (e) { /* noop */ }
                recognitionRef.current = null;
                disableBrowserSRRef.current = true;
                usingServiceRef.current = false;
              }
              return;
            }

            // Other errors: surface message and optionally start fallback if configured
            setTranscribeError(ev?.message || err || 'Speech recognition error');
            logger.error('SpeechRecognition error (non no-speech):', ev);

            // If configured to use server ASR chunks, start fallback service
            if (!disableBrowserSRRef.current) {
              try {
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
            }
          };

          recognition.onend = () => {
            // recognition ended (user stopped or browser stopped)
            // Do NOT clear finalRef here. Preserve transcript across browser timeouts.
            // If the end happened and we had prior no-speech retries (or stopReason not 'user'),
            // treat it as a browser timeout rather than a user-initiated stop.
            if (stopReasonRef.current !== 'user' || noSpeechRetriesRef.current > 0) {
              stopReasonRef.current = 'timeout';
            }
            if (stopReasonRef.current === 'timeout') {
              setListeningHint('Session ended automatically. Tap Start to continue.');
            }
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
        try { stopReasonRef.current = 'user'; recognitionRef.current.stop(); } catch(e) { /* noop */ }
        recognitionRef.current = null;
      }

  // Stop server-based service only if we started it
  // Prefer the accumulated finalRef content as the canonical transcript
  let finalTranscript = finalRef.current || recordedMessage;
      if (usingServiceRef.current) {
        try {
          finalTranscript = await liveTranscriptionService.stop();
        } finally {
          usingServiceRef.current = false;
        }
      }

      // Wait briefly for mediaRecorder.onstop to set audioBlob (onstop is async)
      // Wait for the recorder onstop handler to set the blob. We check the
      // lastBlobRef which is written synchronously by onstop so this avoids
      // races caused by React state not being visible immediately.
      const waitForBlobRef = async (timeout = 3000) => {
        const start = Date.now();
        while (!lastBlobRef.current && Date.now() - start < timeout) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 50));
        }
        return lastBlobRef.current;
      };

      const blob = await waitForBlobRef(3000);
      // If we have a final audio blob, try the OpenAI final transcription endpoint
      if (blob) {
        try {
          const final = await liveTranscriptionService.transcribeFinal(blob);
          if (final && final.trim()) {
            finalTranscript = final;
            // update finalRef to reflect the authoritative final transcription
            finalRef.current = finalTranscript;
          }
        } catch (e: any) {
          logger.warn('Final transcription failed:', e?.message || e);
          setTranscribeError(e?.message || String(e));
        }
      }

  // store final transcript in state for legacy UI code
  setRecordedMessage(finalTranscript || recordedMessage);
  setView(finalTranscript || (finalRef.current || '').trim());
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
    // clear persistent final transcript and interim
    finalRef.current = "";
    setInterim("");
    setView("");
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
    const payload = view || recordedMessage;
    if (!payload) return;

    // Defensive: pass a shallow copy of the Blob to avoid race where parent
    // reads the blob after we cleared local state. slice() creates a new Blob
    // referencing the same underlying data but yields a distinct object.
    const blobCopy = audioBlob ? audioBlob.slice(0, audioBlob.size, audioBlob.type) : undefined;

    // Send immediately. Delay clearing local state briefly so parent can
    // capture/store the blob reference without racing with this component
    // clearing it (observed issue: Send required a second press / Play stuck).
    onSendMessage(payload, true, blobCopy);

    // Ensure any active mic/recognition/service is stopped when user sends
    try {
      // stop MediaRecorder if still recording
      if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
        try { mediaRecorderRef.current.stop(); } catch (e) { /* noop */ }
      }

      // stop any active stream tracks
      try { activeStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (e) { /* noop */ }
      activeStreamRef.current = null;

      // stop speech recognition if active
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { /* noop */ }
        recognitionRef.current = null;
      }

      // stop live transcription service if we were using it
      if (usingServiceRef.current) {
        try { void liveTranscriptionService.stop(); } catch (e) { /* noop */ }
        usingServiceRef.current = false;
      }
    } catch (e) {
      logger.warn('Error while cleaning up mic on send', e);
    }

    setTimeout(() => {
      // clear after send
      finalRef.current = "";
      setInterim("");
      setView("");
      setRecordedMessage("");
      setAudioBlob(null);
      // clear the ref as well to avoid leaking the blob reference
      lastBlobRef.current = null;
      setRecordingState('idle');
      setAnalysisProgress(0);
    }, 150);
  };

  const getRecordButtonIcon = () => {
    switch (recordingState) {
      case 'recording':
        return <MicOff className="w-6 h-6" />;
      case 'ready':
        return <Send className="w-6 h-6" />;
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
      case 'ready':
        return `${baseClass} bg-success hover:bg-success/90 text-success-foreground shadow-lg hover:shadow-xl`;
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
          {/* Microphone enable helper - visible when permission not granted */}
          {micPermission !== 'granted' && (
            <div className="ml-3">
              <Button size="sm" variant="outline" onClick={handleEnableMicClick} className="h-6 px-2">
                Enable Microphone
              </Button>
            </div>
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
        {view && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-primary/10 border border-primary/20 rounded-lg p-4 space-y-3"
          >
            <p className="text-sm">"{view}"</p>
            
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
                {/* Send moved to main record button to reduce UI clutter; press the large button to send when ready */}
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
            onClick={
              recordingState === 'recording'
                ? handleStopRecording
                : recordingState === 'ready'
                ? handleSend
                : handleStartRecording
            }
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
      {listeningHint && (
        <div className="text-center mt-2">
          <p className="text-xs text-muted-foreground">{listeningHint}</p>
        </div>
      )}
      {transcribeError && (
        <div className="text-center mt-2">
          <p className="text-xs text-destructive">Transcription: {transcribeError}</p>
        </div>
      )}
    </div>
  );
}