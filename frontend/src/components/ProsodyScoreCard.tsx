import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { TrendingUp, TrendingDown, Minus, Award, Volume2, Music, Zap, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

interface ProsodyScoreCardProps {
  overall: number;
  pronunciation: number;
  rhythm: number;
  intonation: number;
  fluency: number;
  compact?: boolean;
}

export function ProsodyScoreCard({
  overall,
  pronunciation,
  rhythm,
  intonation,
  fluency,
  compact = false
}: ProsodyScoreCardProps) {
  
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-success";
    if (score >= 70) return "text-primary";
    if (score >= 60) return "text-accent";
    return "text-destructive";
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

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-2"
      >
        {/* Overall Score - Compact */}
        <div className={`flex items-center justify-between p-3 rounded-lg border ${getScoreBgColor(overall)}`}>
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
          </div>
        </div>

        {/* Individual Scores - Compact */}
        <div className="grid grid-cols-2 gap-2">
          {scores.map((score, index) => {
            const Icon = score.icon;
            return (
              <div
                key={score.label}
                className={`p-2 rounded-lg border ${getScoreBgColor(score.value)}`}
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
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden">
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
  );
}
