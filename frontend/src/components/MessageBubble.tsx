import { useState } from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { 
  User, 
  Volume2, 
  TrendingUp, 
  Pause,
  Download,
  Loader2,
  Zap,
  Star
} from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";

interface ProsodyFeedback {
  score: number;
  highlights: Array<{
    text: string;
    type: 'error' | 'good' | 'suggestion';
    feedback: string;
  }>;
  suggestions: string[];
  vocabulary?: Array<{
    word: string;
    definition: string;
    example: string;
  }>;
}

interface MessageBubbleProps {
  message: string;
  isUser: boolean;
  isAudio?: boolean;
  audioBlob?: Blob;
  prosodyFeedback?: ProsodyFeedback;
  timestamp: string;
  isProcessing?: boolean;
  onAnalysisView?: () => void;
  onPlayback?: () => void;
}

export function MessageBubble({ 
  message, 
  isUser, 
  isAudio = false,
  audioBlob,
  prosodyFeedback, 
  timestamp,
  isProcessing = false,
  onAnalysisView,
  onPlayback
}: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handlePlayAudio = async () => {
    // If already playing, stop it
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }

    if (audioBlob) {
      try {
        // Stop any existing audio first
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audioRef.current = audio;
        
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };
        
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };
        
        audio.onpause = () => {
          setIsPlaying(false);
        };
        
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        setIsPlaying(false);
        audioRef.current = null;
      }
    } else if (onPlayback) {
      onPlayback();
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleDownloadAudio = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 85) return "bg-success/10 border-success/20";
    if (score >= 70) return "bg-accent/10 border-accent/20";
    if (score >= 55) return "bg-secondary/10 border-secondary/20";
    return "bg-destructive/10 border-destructive/20";
  };

  const renderHighlightedText = (text: string, highlights: ProsodyFeedback['highlights']) => {
    if (!highlights || highlights.length === 0) return text;
    
    let result = text;
    highlights.forEach(({ text: highlightText, type }) => {
      const className = type === 'error' 
        ? 'bg-destructive/20 text-destructive px-1 rounded' 
        : type === 'good'
        ? 'bg-success/20 text-success-foreground px-1 rounded'
        : 'bg-accent/20 text-accent-foreground px-1 rounded';
      
      result = result.replace(
        highlightText, 
        `<span class="${className}">${highlightText}</span>`
      );
    });
    
    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div className="flex items-start gap-2">
          {/* Avatar */}
          <div className={`flex-shrink-0 ${isUser ? 'order-2' : 'order-1'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isUser ? 'bg-secondary' : 'bg-accent'
            }`}>
              {isUser ? <User className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            </div>
          </div>

          {/* Message Content */}
          <div className={`flex-1 ${isUser ? 'order-1' : 'order-2'}`}>
            <Card className={`${
              isUser 
                ? 'bg-secondary border-secondary/20' 
                : 'bg-card border-border'
            }`}>
              <CardContent className="p-3">
                {/* Message Text */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isAudio && <Volume2 className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground">{timestamp}</span>
                    </div>
                    
                    {/* Processing indicator */}
                    {isProcessing && (
                      <div className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-accent" />
                        <span className="text-xs text-muted-foreground">Analyzing...</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {prosodyFeedback?.highlights 
                      ? renderHighlightedText(message, prosodyFeedback.highlights)
                      : message
                    }
                  </p>
                </div>

                {/* Audio Controls */}
                {isAudio && (
                  <div className="mt-3 pt-2 border-t border-border/50 space-y-2">
                    {/* Row 1: Overall Score - Always show if prosodyFeedback exists */}
                    {prosodyFeedback && (
                      <div className="flex items-center">
                        <div className="w-px h-4 bg-border mr-2"></div>
                        <Badge 
                          className={`text-xs transition-all ${getScoreBgColor(prosodyFeedback.score)}`}
                        >
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Overall: {Math.round(prosodyFeedback.score)}%
                        </Badge>
                      </div>
                    )}
                    
                    {/* Row 2: Play/Download controls and Star button */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handlePlayAudio}
                                className="h-7 px-2 text-xs"
                                disabled={isProcessing}
                              >
                                {isPlaying ? (
                                  <Pause className="w-3 h-3 mr-1" />
                                ) : (
                                  <Volume2 className="w-3 h-3 mr-1" />
                                )}
                                {isPlaying ? 'Pause' : 'Play'}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-center">
                                <div>Play your recorded audio</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  (Available in current session only)
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {audioBlob && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleDownloadAudio}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Download audio file
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        
                        <div className="w-px h-4 bg-border"></div>
                      </div>

                      {/* Star button for detailed analysis - Always show if prosodyFeedback exists */}
                      {prosodyFeedback && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={onAnalysisView}
                                disabled={!onAnalysisView}
                                className="h-7 w-7 p-0 hover:bg-primary/10"
                              >
                                <Star className="w-4 h-4 text-primary fill-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              View detailed analysis
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                )}

                {/* Enhanced Prosody Feedback - Moved to star button popup */}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );
}