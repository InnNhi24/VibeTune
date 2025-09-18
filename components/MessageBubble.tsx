import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { User, Bot, Volume2, TrendingUp, BookOpen, Star, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

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
  prosodyFeedback?: ProsodyFeedback;
  timestamp: string;
}

export function MessageBubble({ 
  message, 
  isUser, 
  isAudio = false, 
  prosodyFeedback, 
  timestamp 
}: MessageBubbleProps) {
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
              {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
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
                  <div className="flex items-center gap-2">
                    {isAudio && <Volume2 className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{timestamp}</span>
                  </div>
                  
                  <p className="text-sm">
                    {prosodyFeedback?.highlights 
                      ? renderHighlightedText(message, prosodyFeedback.highlights)
                      : message
                    }
                  </p>
                </div>

                {/* Prosody Feedback for User Messages */}
                {isUser && prosodyFeedback && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 pt-3 border-t border-border/50 space-y-3"
                  >
                    {/* Prosody Score */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-accent" />
                        <span className="text-sm">Prosody Score</span>
                      </div>
                      <Badge 
                        variant={prosodyFeedback.score >= 80 ? "default" : "outline"}
                        className={prosodyFeedback.score >= 80 ? "bg-success text-success-foreground" : ""}
                      >
                        {prosodyFeedback.score}%
                      </Badge>
                    </div>

                    {/* Feedback Highlights */}
                    {prosodyFeedback.highlights.length > 0 && (
                      <div className="space-y-2">
                        {prosodyFeedback.highlights.map((highlight, index) => (
                          <div key={index} className="flex items-start gap-2">
                            {highlight.type === 'error' && <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />}
                            {highlight.type === 'good' && <Star className="w-4 h-4 text-success mt-0.5" />}
                            {highlight.type === 'suggestion' && <BookOpen className="w-4 h-4 text-accent mt-0.5" />}
                            <p className="text-xs text-muted-foreground">{highlight.feedback}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggestions */}
                    {prosodyFeedback.suggestions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Suggestions:</p>
                        {prosodyFeedback.suggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <Star className="w-3 h-3 text-accent mt-1" />
                            <p className="text-xs text-muted-foreground">{suggestion}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Vocabulary Help */}
                    {prosodyFeedback.vocabulary && prosodyFeedback.vocabulary.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Vocabulary:</p>
                        {prosodyFeedback.vocabulary.map((vocab, index) => (
                          <div key={index} className="bg-muted/50 p-2 rounded text-xs space-y-1">
                            <p><span className="font-medium">{vocab.word}:</span> {vocab.definition}</p>
                            <p className="text-muted-foreground italic">"{vocab.example}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );
}