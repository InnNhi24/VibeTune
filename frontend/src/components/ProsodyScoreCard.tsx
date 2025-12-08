import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { TrendingUp, TrendingDown, Minus, Award, Volume2, Music, Zap, MessageCircle, Info, BarChart3, MessageSquare, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import * as React from "react";
import { supabase } from "../services/supabaseClient";
import { useAppStore } from "../store/appStore";

interface ProsodyScoreCardProps {
  overall: number;
  pronunciation: number;
  rhythm: number;
  intonation: number;
  fluency: number;
  compact?: boolean;
  detailedFeedback?: {
    strengths?: string[];
    improvements?: string[];
    specific_issues?: Array<{
      type: string;
      word: string;
      severity: string;
      feedback: string;
      suggestion: string;
    }>;
  };
  suggestions?: string[];
  messageId?: string; // For saving feedback rating
  // External modal control (optional)
  showModalOnly?: boolean; // If true, only show modal, no card
  isModalOpen?: boolean;
  onModalClose?: () => void;
}

export function ProsodyScoreCard({
  overall,
  pronunciation,
  rhythm,
  intonation,
  fluency,
  compact = false,
  detailedFeedback,
  suggestions,
  messageId,
  showModalOnly = false,
  isModalOpen,
  onModalClose
}: ProsodyScoreCardProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Use external control if provided, otherwise use internal state
  const modalOpen = isModalOpen !== undefined ? isModalOpen : showDetailModal;
  const handleModalClose = () => {
    if (onModalClose) {
      onModalClose();
    } else {
      setShowDetailModal(false);
    }
  };
  
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 dark:text-green-500";
    if (score >= 70) return "text-blue-600 dark:text-blue-400";
    if (score >= 60) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 85) return "bg-success/10 border-success/20";
    if (score >= 70) return "bg-primary/10 border-primary/20";
    if (score >= 60) return "bg-accent/10 border-accent/20";
    return "bg-destructive/10 border-destructive/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 60) return "Fair";
    return "Needs Work";
  };

  const getTrendIcon = (score: number) => {
    if (score >= 85) return TrendingUp;
    if (score >= 60) return Minus;
    return TrendingDown;
  };

  const scores = [
    { label: "Pronunciation", value: pronunciation, icon: Volume2, color: "text-blue-500" },
    { label: "Rhythm", value: rhythm, icon: Music, color: "text-purple-500" },
    { label: "Intonation", value: intonation, icon: Zap, color: "text-yellow-500" },
    { label: "Fluency", value: fluency, icon: MessageCircle, color: "text-green-500" }
  ];

  // If showModalOnly, only render the modal
  if (showModalOnly) {
    return (
      <ProsodyDetailModal
        open={modalOpen}
        onClose={handleModalClose}
        overall={overall}
        scores={scores}
        detailedFeedback={detailedFeedback}
        suggestions={suggestions}
        messageId={messageId}
        getScoreColor={getScoreColor}
        getScoreLabel={getScoreLabel}
      />
    );
  }

  if (compact) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-2"
        >
          {/* Overall Score - Compact */}
          <div 
            className={`flex items-center justify-between p-3 rounded-lg border ${getScoreBgColor(overall)} cursor-pointer hover:opacity-80 transition-opacity`}
            onClick={() => setShowDetailModal(true)}
          >
            <div className="flex items-center gap-2">
              <Award className={`w-5 h-5 ${getScoreColor(overall)}`} />
              <span className="font-semibold">Overall</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${getScoreColor(overall)}`}>
                {Math.round(overall)}%
              </span>
              <Badge variant="outline" className={getScoreColor(overall)}>
                {getScoreLabel(overall)}
              </Badge>
              <Info className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Individual Scores - Compact */}
          <div className="grid grid-cols-2 gap-2">
            {scores.map((score) => {
              const Icon = score.icon;
              return (
                <div
                  key={score.label}
                  className={`p-2 rounded-lg border ${getScoreBgColor(score.value)} cursor-pointer hover:opacity-80 transition-opacity`}
                  onClick={() => setShowDetailModal(true)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${score.color}`} />
                    <span className="text-xs font-medium">{score.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={score.value} className="h-1 flex-1" />
                    <span className={`text-sm font-bold ${getScoreColor(score.value)}`}>
                      {Math.round(score.value)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Detail Modal */}
        <ProsodyDetailModal
          open={modalOpen}
          onClose={handleModalClose}
          overall={overall}
          scores={scores}
          detailedFeedback={detailedFeedback}
          suggestions={suggestions}
          messageId={messageId}
          getScoreColor={getScoreColor}
          getScoreLabel={getScoreLabel}
        />
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowDetailModal(true)}>
          <CardHeader className={`pb-3 ${getScoreBgColor(overall)} border-b`}>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className={`w-6 h-6 ${getScoreColor(overall)}`} />
                <span>Pronunciation Score</span>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="flex items-center gap-2"
              >
                <span className={`text-4xl font-bold ${getScoreColor(overall)}`}>
                  {Math.round(overall)}%
                </span>
                <Badge variant="outline" className={`${getScoreColor(overall)} text-base px-3 py-1`}>
                  {getScoreLabel(overall)}
                </Badge>
                <Info className="w-5 h-5 text-muted-foreground" />
              </motion.div>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="pt-6 space-y-4">
            {scores.map((score, index) => {
              const Icon = score.icon;
              const TrendIcon = getTrendIcon(score.value);
              
              return (
                <motion.div
                  key={score.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${score.color}`} />
                      <span className="font-medium">{score.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendIcon className={`w-4 h-4 ${getScoreColor(score.value)}`} />
                      <span className={`text-xl font-bold ${getScoreColor(score.value)}`}>
                        {Math.round(score.value)}%
                      </span>
                    </div>
                  </div>
                  <Progress value={score.value} className="h-2" />
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail Modal */}
      <ProsodyDetailModal
        open={modalOpen}
        onClose={handleModalClose}
        overall={overall}
        scores={scores}
        detailedFeedback={detailedFeedback}
        suggestions={suggestions}
        messageId={messageId}
        getScoreColor={getScoreColor}
        getScoreLabel={getScoreLabel}
      />
    </>
  );
}

// Feedback Rating Component
function FeedbackRating({ messageId }: { messageId?: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const user = useAppStore((state) => state.user);

  // Load existing rating on mount
  React.useEffect(() => {
    const loadRating = async () => {
      if (messageId && user?.id) {
        try {
          const { data } = await supabase
            .from('feedback_rating')
            .select('rating')
            .eq('message_id', messageId)
            .eq('profile_id', user.id)
            .single();
          
          if (data) {
            setRating(data.rating);
          }
        } catch {
          // No existing rating found - this is normal
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    
    loadRating();
  }, [messageId, user?.id]);

  const handleRating = async (value: number) => {
    if (!messageId || !user?.id) return;
    if (rating !== null) return; // Already rated

    setRating(value);
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('feedback_rating')
        .insert({
          message_id: messageId,
          profile_id: user.id,
          rating: value
        });

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error: any) {
      // Failed to save rating - reset state
      setRating(null);
    } finally {
      setIsSaving(false);
    }
  };

  if (!messageId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-1">
        <div className="text-xs text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <Button
            key={value}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-transparent disabled:opacity-50"
            disabled={isSaving || rating !== null}
            onClick={() => handleRating(value)}
            onMouseEnter={() => !rating && setHoveredRating(value)}
            onMouseLeave={() => setHoveredRating(null)}
            title={rating !== null ? 'Already rated' : `Rate ${value} stars`}
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                (hoveredRating !== null ? value <= hoveredRating : value <= (rating || 0))
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              }`}
            />
          </Button>
        ))}
      </div>
      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-xs text-green-600 dark:text-green-400"
        >
          ✓ Thank you for your feedback!
        </motion.div>
      )}
      {rating !== null && !showSuccess && (
        <div className="text-xs text-muted-foreground">
          You rated {rating} star{rating > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// Prosody Detail Modal Component
function ProsodyDetailModal({
  open,
  onClose,
  overall,
  scores,
  detailedFeedback,
  suggestions,
  messageId,
  getScoreColor,
  getScoreLabel
}: {
  open: boolean;
  onClose: () => void;
  overall: number;
  scores: Array<{ label: string; value: number; icon: any; color: string }>;
  detailedFeedback?: {
    strengths?: string[];
    improvements?: string[];
    specific_issues?: Array<{
      type: string;
      word: string;
      severity: string;
      feedback: string;
      suggestion: string;
    }>;
  };
  suggestions?: string[];
  messageId?: string;
  getScoreColor: (score: number) => string;
  getScoreLabel: (score: number) => string;
}) {
  // Merge improvements and suggestions into one list, removing duplicates
  const allImprovements = Array.from(new Set([
    ...(detailedFeedback?.improvements || []),
    ...(suggestions || [])
  ]));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Award className={`w-6 h-6 ${getScoreColor(overall)}`} />
                Detailed Prosody Analysis
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                Overall Score: <span className={`font-bold text-lg ${getScoreColor(overall)}`}>{Math.round(overall)}%</span> 
                <Badge variant="outline" className={getScoreColor(overall)}>
                  {getScoreLabel(overall)}
                </Badge>
              </DialogDescription>
            </div>
            <FeedbackRating messageId={messageId} />
          </div>
        </DialogHeader>

        <Tabs defaultValue="scores" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scores" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Scores
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Feedback
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Score Breakdown */}
          <TabsContent value="scores" className="space-y-4 mt-4">
            <div className="space-y-4">
              {scores.map((score) => {
                const Icon = score.icon;
                return (
                  <div key={score.label} className="p-3 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`w-5 h-5 ${score.color}`} />
                      <span className="font-medium flex-1">{score.label}</span>
                      <span className={`text-xl font-bold ${getScoreColor(score.value)}`}>
                        {Math.round(score.value)}%
                      </span>
                    </div>
                    <Progress value={score.value} className="h-2" />
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab 2: Detailed Feedback (Strengths + Improvements merged) */}
          <TabsContent value="feedback" className="space-y-6 mt-4">
            {/* Strengths */}
            {detailedFeedback?.strengths && detailedFeedback.strengths.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-success flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Strengths
                </h3>
                <ul className="space-y-1 ml-7">
                  {detailedFeedback.strengths.map((strength, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">• {strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Improvements (merged with suggestions) */}
            {allImprovements.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-accent flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Areas for Improvement & Practice Suggestions
                </h3>
                <ul className="space-y-1 ml-7">
                  {allImprovements.map((improvement, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">• {improvement}</li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>


        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
