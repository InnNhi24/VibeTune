import { useState } from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { 
  User, 
  Bot, 
  Volume2, 
  TrendingUp, 
  BookOpen, 
  Star, 
  AlertCircle,
  Play,
  Pause,
  Download,
  Eye,
  RotateCcw,
  ThumbsUp,
  Loader2,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  onRetry?: () => void;
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
  onRetry,
  onPlayback
}: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullFeedback, setShowFullFeedback] = useState(false);
  
  // Debug logging
  if (isAudio && isUser) {
    console.log('MessageBubble Audio Debug:', {
      hasAudio: isAudio,
      isUser,
      hasProsodyFeedback: !!prosodyFeedback,
      prosodyScore: prosodyFeedback?.score,
      hasOnAnalysisView: !!onAnalysisView,
      isProcessing
    });
  }

  const handlePlayAudio = () => {
    if (audioBlob && !isPlaying) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
      
      audio.onpause = () => {
        setIsPlaying(false);
      };
      
      audio.play();
      setIsPlaying(true);
    } else if (onPlayback) {
      onPlayback();
    } else {
      // Fallback to mock playback
      setIsPlaying(true);
      setTimeout(() => setIsPlaying(false), 2000);
    }
  };

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

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-success";
    if (score >= 70) return "text-accent";
    if (score >= 55) return "text-secondary";
    return "text-destructive";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 85) return "bg-success/10 border-success/20";
    if (score >= 70) return "bg-accent/10 border-accent/20";
    if (score >= 55) return "bg-secondary/10 border-secondary/20";
    return "bg-destructive/10 border-destructive/20";
  };

  const getHighlightStyle = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'good':
        return 'bg-success/10 text-success border-success/20';
      case 'suggestion':
        return 'bg-accent/10 text-accent border-accent/20';
      default:
        return 'bg-muted/50 text-muted-foreground border-muted/20';
    }
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
                              Play your recorded audio
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