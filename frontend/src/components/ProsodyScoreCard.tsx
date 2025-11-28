import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { TrendingUp, TrendingDown, Minus, Award, Volume2, Music, Zap, MessageCircle, Info, BarChart3, MessageSquare, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

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
        getScoreColor={getScoreColor}
        getScoreLabel={getScoreLabel}
      />
    </>
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
          <DialogTitle className="flex items-center gap-2">
            <Award className={`w-6 h-6 ${getScoreColor(overall)}`} />
            Detailed Prosody Analysis
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Overall Score: <span className={`font-bold text-lg ${getScoreColor(overall)}`}>{Math.round(overall)}%</span> 
            <Badge variant="outline" className={getScoreColor(overall)}>
              {getScoreLabel(overall)}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="scores" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scores" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Scores
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Feedback
            </TabsTrigger>
            <TabsTrigger value="words" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Word Analysis
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

          {/* Tab 3: Word Analysis */}
          <TabsContent value="words" className="space-y-4 mt-4">
            {detailedFeedback?.specific_issues && detailedFeedback.specific_issues.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Words that need attention:</p>
                {detailedFeedback.specific_issues.map((issue, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg">{issue.word}</span>
                        <Badge variant={issue.severity === 'high' ? 'destructive' : issue.severity === 'medium' ? 'default' : 'secondary'} className="text-xs">
                          {issue.severity}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">{issue.type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{issue.feedback}</p>
                    <div className="flex items-start gap-2 p-2 rounded bg-primary/5 border border-primary/10">
                      <span className="text-lg">💡</span>
                      <p className="text-sm text-foreground flex-1">{issue.suggestion}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No word-level issues detected</p>
                <p className="text-sm mt-1">Great job! Your pronunciation is clear.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
