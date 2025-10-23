import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Target, 
  BookOpen, 
  Lightbulb, 
  ChevronDown,
  RotateCcw,
  Play,
  Volume2,
  Award,
  AlertTriangle
} from "lucide-react";
import { motion } from "framer-motion";
import { ProsodyAnalysis, ProsodyIssue } from "../services/aiProsodyService";

interface ProsodyFeedbackProps {
  analysis: ProsodyAnalysis;
  originalText: string;
  onRetry?: () => void;
  onPlayback?: () => void;
  className?: string;
}

export function ProsodyFeedback({ 
  analysis, 
  originalText, 
  onRetry, 
  onPlayback,
  className = "" 
}: ProsodyFeedbackProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-success";
    if (score >= 70) return "text-accent";
    if (score >= 60) return "text-secondary";
    return "text-destructive";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 85) return <TrendingUp className="w-4 h-4" />;
    if (score >= 60) return <Minus className="w-4 h-4" />;
    return <TrendingDown className="w-4 h-4" />;
  };

  const getIssueIcon = (type: ProsodyIssue['type']) => {
    switch (type) {
      case 'pronunciation': return "🗣️";
      case 'rhythm': return "🎵";
      case 'intonation': return "📈";
      case 'stress': return "💪";
      case 'pace': return "⏱️";
      default: return "🎯";
    }
  };

  const getSeverityColor = (severity: ProsodyIssue['severity']) => {
    switch (severity) {
      case 'high': return 'border-destructive/20 bg-destructive/5';
      case 'medium': return 'border-secondary/20 bg-secondary/5';
      case 'low': return 'border-accent/20 bg-accent/5';
      default: return 'border-muted/20 bg-muted/5';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`space-y-4 ${className}`}
    >
      {/* Overall Score Card */}
      <Card className="bg-gradient-to-r from-accent/5 to-primary/5 border-accent/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-accent" />
              Prosody Analysis
            </CardTitle>
            <div className="flex gap-2">
              {onPlayback && (
                <Button variant="ghost" size="sm" onClick={onPlayback}>
                  <Volume2 className="w-4 h-4" />
                </Button>
              )}
              {onRetry && (
                <Button variant="ghost" size="sm" onClick={onRetry}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Score */}
          <div className="text-center">
            <div className={`text-3xl font-bold ${getScoreColor(analysis.overall_score)}`}>
              {Math.round(analysis.overall_score)}%
            </div>
            <p className="text-sm text-muted-foreground">Overall Score</p>
            <Progress 
              value={analysis.overall_score} 
              className="mt-2 h-2"
            />
          </div>

          {/* Quick Scores */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Pronunciation", score: analysis.pronunciation_score },
              { label: "Rhythm", score: analysis.rhythm_score },
              { label: "Intonation", score: analysis.intonation_score },
              { label: "Fluency", score: analysis.fluency_score }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                <span className="text-sm font-medium">{item.label}</span>
                <div className={`flex items-center gap-1 ${getScoreColor(item.score)}`}>
                  {getScoreIcon(item.score)}
                  <span className="text-sm font-semibold">{Math.round(item.score)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Expand Button */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full mt-2">
                <span>Detailed Analysis</span>
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="mt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="issues">Issues</TabsTrigger>
                  <TabsTrigger value="words">Words</TabsTrigger>
                  <TabsTrigger value="practice">Practice</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Strengths */}
                  <div>
                    <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Strengths
                    </h4>
                    <div className="space-y-1">
                      {analysis.detailed_feedback.strengths.map((strength, index) => (
                        <Badge key={index} variant="secondary" className="bg-success/10 text-success-foreground">
                          {strength}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Areas for Improvement */}
                  <div>
                    <h4 className="font-semibold text-accent mb-2 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Areas for Improvement
                    </h4>
                    <div className="space-y-1">
                      {analysis.detailed_feedback.improvements.map((improvement, index) => (
                        <Badge key={index} variant="outline" className="bg-accent/10">
                          {improvement}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Suggestions
                    </h4>
                    <ul className="space-y-2">
                      {analysis.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-accent mt-1">•</span>
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="issues" className="space-y-3 mt-4">
                  {analysis.detailed_feedback.specific_issues.length > 0 ? (
                    analysis.detailed_feedback.specific_issues.map((issue, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-lg">{getIssueIcon(issue.type)}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{issue.word}</span>
                              <Badge variant="outline" size="sm">
                                {issue.type}
                              </Badge>
                              <Badge 
                                variant={issue.severity === 'high' ? 'destructive' : 'secondary'} 
                                size="sm"
                              >
                                {issue.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{issue.feedback}</p>
                            <p className="text-sm font-medium text-accent">{issue.suggestion}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <TrendingUp className="w-12 h-12 text-success mx-auto mb-2" />
                      <p className="text-success font-medium">No issues detected!</p>
                      <p className="text-sm text-muted-foreground">Your pronunciation was excellent.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="words" className="space-y-3 mt-4">
                  <div className="grid gap-2">
                    {analysis.word_level_analysis.map((word, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{word.word}</span>
                          {!word.stress_correct && (
                            <AlertTriangle className="w-3 h-3 text-destructive" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${getScoreColor(word.pronunciation_score)}`}>
                            {Math.round(word.pronunciation_score)}%
                          </span>
                          <div className="w-12 h-1 bg-muted rounded">
                            <div 
                              className={`h-full rounded transition-all duration-500 ${
                                word.pronunciation_score >= 85 ? 'bg-success' :
                                word.pronunciation_score >= 70 ? 'bg-accent' :
                                word.pronunciation_score >= 60 ? 'bg-secondary' : 'bg-destructive'
                              }`}
                              style={{ width: `${word.pronunciation_score}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="practice" className="space-y-4 mt-4">
                  {/* Next Focus Areas */}
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Next Focus Areas
                    </h4>
                    <div className="space-y-2">
                      {analysis.next_focus_areas.map((area, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="text-sm">{area}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Practice Actions */}
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" onClick={onRetry}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Play className="w-4 h-4 mr-2" />
                      Practice Similar Phrases
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <BookOpen className="w-4 h-4 mr-2" />
                      View Learning Resources
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </motion.div>
  );
}