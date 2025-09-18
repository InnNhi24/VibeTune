import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { GraduationCap, TrendingUp, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

interface LevelSelectionProps {
  onLevelSelect: (level: string) => void;
  onTakePlacementTest: () => void;
  onBack?: () => void;
}

const levels = [
  {
    value: "Beginner",
    title: "Beginner",
    description: "New to English pronunciation and prosody",
    features: [
      "Basic stress patterns",
      "Simple intonation",
      "Common vocabulary", 
      "Guided practice"
    ],
    recommended: "I'm just starting with English pronunciation"
  },
  {
    value: "Intermediate", 
    title: "Intermediate",
    description: "Some experience with English speaking",
    features: [
      "Complex stress patterns",
      "Varied intonation",
      "Advanced vocabulary",
      "Natural conversation"
    ],
    recommended: "I can speak English but want to improve my pronunciation"
  },
  {
    value: "Advanced",
    title: "Advanced", 
    description: "Strong English skills, refining prosody",
    features: [
      "Subtle pronunciation nuances",
      "Native-like intonation", 
      "Professional vocabulary",
      "Accent reduction"
    ],
    recommended: "I speak English well but want to perfect my prosody"
  }
];

export function LevelSelection({ onLevelSelect, onTakePlacementTest, onBack }: LevelSelectionProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>("");

  const handleConfirm = () => {
    if (selectedLevel) {
      onLevelSelect(selectedLevel);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold mb-2">Choose Your Learning Level</h1>
            <p className="text-muted-foreground">
              Select the level that best matches your current English speaking ability
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onTakePlacementTest}
            className="text-xs px-2"
          >
            Take Placement Test
          </Button>
        </div>

        {/* Level Selection Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="font-semibold mb-2">Self-Select Your Level</h3>
                <p className="text-sm text-muted-foreground">
                  Choose the level that best describes your current English speaking ability. 
                  You can always adjust this later or take the placement test.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Level Selection */}
        <div className="space-y-4">

          <RadioGroup value={selectedLevel} onValueChange={setSelectedLevel}>
            <div className="grid gap-4 md:grid-cols-3">
              {levels.map((level, index) => (
                <motion.div
                  key={level.value}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedLevel === level.value 
                        ? 'border-accent bg-accent/5' 
                        : 'hover:border-accent/50'
                    }`}
                    onClick={() => setSelectedLevel(level.value)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <GraduationCap className="w-5 h-5" />
                          {level.title}
                        </CardTitle>
                        <RadioGroupItem 
                          value={level.value} 
                          id={level.value}
                          className="mt-1"
                        />
                      </div>
                      <CardDescription>{level.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm font-medium">What you'll practice:</p>
                        <div className="flex flex-wrap gap-1">
                          {level.features.map((feature, featureIndex) => (
                            <Badge 
                              key={featureIndex} 
                              variant="secondary" 
                              className="text-xs"
                            >
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          <strong>Choose this if:</strong> {level.recommended}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Confirm Selection */}
        {selectedLevel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-4"
          >
            <Card className="max-w-md mx-auto bg-success/10 border-success/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span className="font-medium">Level Selected: {selectedLevel}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  You can change your level anytime or retake the placement test.
                </p>
                <Button 
                  onClick={handleConfirm}
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                >
                  Start Learning at {selectedLevel} Level
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}