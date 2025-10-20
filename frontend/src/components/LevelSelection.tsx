import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { GraduationCap, TrendingUp, ArrowLeft, CheckCircle2, Lock, AlertCircle, Zap, Star, Info } from "lucide-react";
import { motion } from "motion/react";
import { Profile } from "../services/supabaseClient";

interface LevelSelectionProps {
  onLevelSelect: (level: string) => void;
  onTakePlacementTest: () => void;
  onBack?: () => void;
  user?: Profile | null; // Add user prop to check current level status
}

const levels = [
  {
    value: "Beginner",
    title: "Beginner",
    emoji: "🌱",
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
    selectedColor: "bg-emerald-100 border-emerald-300 ring-emerald-500",
    badges: ["Basic", "Simple", "Guided"],
    description: "Perfect for those new to English pronunciation and prosody",
    detailedFeatures: [
      "Basic stress patterns",
      "Simple intonation practice",
      "Common vocabulary focus", 
      "Step-by-step guided practice",
      "Fundamental rhythm training"
    ],
    recommended: "Choose if you're just starting with English pronunciation or want to build strong foundations"
  },
  {
    value: "Intermediate", 
    title: "Intermediate",
    emoji: "🎯",
    color: "bg-blue-50 border-blue-200 text-blue-800",
    selectedColor: "bg-blue-100 border-blue-300 ring-blue-500",
    badges: ["Complex", "Varied", "Natural"],
    description: "Ideal for learners with some English speaking experience",
    detailedFeatures: [
      "Complex stress patterns",
      "Varied intonation training",
      "Advanced vocabulary practice",
      "Natural conversation flow",
      "Contextual pronunciation"
    ],
    recommended: "Choose if you can speak English conversationally but want to improve pronunciation and sound more natural"
  },
  {
    value: "Advanced",
    title: "Advanced",
    emoji: "🏆", 
    color: "bg-purple-50 border-purple-200 text-purple-800",
    selectedColor: "bg-purple-100 border-purple-300 ring-purple-500",
    badges: ["Nuanced", "Native", "Pro"],
    description: "Designed for proficient speakers refining their prosody",
    detailedFeatures: [
      "Subtle pronunciation nuances",
      "Native-like intonation patterns", 
      "Professional vocabulary mastery",
      "Accent reduction techniques",
      "Advanced prosody refinement"
    ],
    recommended: "Choose if you speak English fluently but want to perfect your prosody and achieve native-like pronunciation"
  }
];

export function LevelSelection({ onLevelSelect, onTakePlacementTest, onBack, user }: LevelSelectionProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [showLevelLockWarning, setShowLevelLockWarning] = useState(false);

  // Check if user already has a level and how it was set
  const hasExistingLevel = user?.level;
  const placementTestCompleted = user?.placement_test_completed;
  const isLevelLockedByTest = hasExistingLevel && placementTestCompleted;
  const isLevelLockedManually = hasExistingLevel && !placementTestCompleted;

  // Determine the placement test button text and behavior
  const getPlacementTestButtonText = () => {
    if (isLevelLockedByTest) {
      return "Redo Placement Test";
    } else if (isLevelLockedManually) {
      return "Take Placement Test";
    } else {
      return "Take Placement Test";
    }
  };

  const handleLevelSelect = (level: string) => {
    if (hasExistingLevel) {
      // Show warning if trying to change an existing level
      setShowLevelLockWarning(true);
      return;
    }
    setSelectedLevel(level);
  };

  const handleConfirm = () => {
    if (selectedLevel && !hasExistingLevel) {
      onLevelSelect(selectedLevel);
    }
  };

  const handlePlacementTestClick = () => {
    setShowLevelLockWarning(false);
    onTakePlacementTest();
  };

  // If user already has a level, show different UI
  if (hasExistingLevel) {
    return (
      <div className="min-h-screen bg-background">
        {/* Main Container with Perfect Vertical Distribution */}
        <div className="min-h-screen flex flex-col">
          
          {/* TOP SECTION - Header (20% of screen) */}
          <div className="flex-none px-4 py-6 md:px-6 md:py-8">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-4 mb-4">
                {onBack && (
                  <Button variant="ghost" size="icon" onClick={onBack} className="flex-shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <div className="text-center flex-1">
                  <h1 className="text-2xl md:text-3xl font-bold mb-2">Your Learning Level</h1>
                  <p className="text-sm md:text-base text-muted-foreground">
                    Level locked for consistent progress
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE SECTION - Current Level Display (60% of screen) */}
          <div className="flex-1 px-4 md:px-6 flex items-center">
            <div className="w-full max-w-md mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-accent/10 border-accent/20 shadow-lg">
                  <CardHeader className="text-center pb-4">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center shadow-lg">
                        <GraduationCap className="w-8 h-8 text-accent-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl md:text-3xl font-bold">{user.level} Level</CardTitle>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {isLevelLockedByTest ? "Set by placement test" : "Self-selected"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="text-center space-y-6 pb-6">
                    <p className="text-base text-muted-foreground">
                      {isLevelLockedByTest 
                        ? "Your level was determined by placement test results for optimal learning progress." 
                        : "You selected this level manually. Take the placement test for a personalized assessment."
                      }
                    </p>
                    
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button 
                        onClick={handlePlacementTestClick}
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg"
                        size="lg"
                      >
                        <Zap className="w-5 h-5 mr-2" />
                        {getPlacementTestButtonText()}
                      </Button>
                    </motion.div>

                    {/* Why Locked - Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground">
                          <Info className="w-4 h-4 mr-2" />
                          Why can't I change my level directly?
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md mx-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-3">
                            <Lock className="w-5 h-5 text-accent" />
                            Level Locking System
                          </DialogTitle>
                          <DialogDescription className="text-left">
                            VibeTune locks your level to ensure consistent, progressive learning. This prevents switching between difficulty levels that could disrupt your learning path.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div className="bg-accent/10 p-4 rounded-lg border border-accent/20">
                            <h4 className="font-semibold mb-2 text-accent-foreground">Benefits of Level Locking:</h4>
                            <ul className="text-sm space-y-1 text-muted-foreground">
                              <li>• Consistent difficulty progression</li>
                              <li>• Personalized content at the right level</li>
                              <li>• Prevents skill gaps from level jumping</li>
                              <li>• Accurate progress tracking</li>
                            </ul>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            The placement test provides the most accurate assessment of your current abilities and ensures you get content that matches your skill level.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* BOTTOM SECTION - Warnings/Actions (20% of screen) */}
          <div className="flex-none px-4 py-6 md:px-6 md:py-8">
            <div className="max-w-md mx-auto">
              {showLevelLockWarning && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Alert className="border-accent/30 bg-accent/10 shadow-lg">
                    <AlertCircle className="h-5 w-5 text-accent" />
                    <AlertDescription className="text-base">
                      <strong className="text-accent-foreground">Level is locked.</strong><br />
                      Take the placement test to change your level and get a personalized assessment of your abilities.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // New user flow - allow level selection
  return (
    <div className="min-h-screen bg-background">
      {/* Ultra-Dense Centered Container - Maximum Viewport Usage */}
      <div className="min-h-screen flex items-center justify-center px-3 py-2">
        <div className="w-full max-w-md mx-auto">
          {/* Back Button - Minimal Space Above */}
          {onBack && (
            <div className="flex justify-start mb-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="w-8 h-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Ultra-Compact Content Block */}
          <div className="space-y-4">
            
            {/* GROUPED HEADER SECTION - Tightly Spaced */}
            <div className="text-center space-y-2">
              {/* Main Title */}
              <h1 className="text-xl md:text-2xl font-bold">Choose Your Level</h1>
              
              {/* Instructions */}
              <p className="text-sm text-muted-foreground">
                Level locks after selection. Change by retaking placement test.
              </p>
              
              {/* Placement Test Button */}
              <motion.div 
                whileHover={{ scale: 1.01 }} 
                whileTap={{ scale: 0.99 }}
              >
                <Button 
                  onClick={handlePlacementTestClick}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  size="default"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Take Placement Test (Recommended)
                </Button>
              </motion.div>

              {/* OR Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px bg-border flex-1"></div>
                <span className="text-xs text-muted-foreground px-2">OR SELF-SELECT</span>
                <div className="h-px bg-border flex-1"></div>
              </div>
            </div>

            {/* LEVEL CARDS SECTION - Prominent Cards */}
            <div>
              <RadioGroup value={selectedLevel} onValueChange={setSelectedLevel}>
                <div className="grid grid-cols-3 gap-2">
                  {levels.map((level, index) => (
                    <motion.div
                      key={level.value}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative"
                    >
                      <Card 
                        className={`cursor-pointer transition-all duration-300 h-full min-h-[180px] text-center relative overflow-hidden ${
                          selectedLevel === level.value 
                            ? `${level.selectedColor} shadow-xl scale-[1.03] ring-2 ring-offset-1` 
                            : `${level.color} hover:shadow-lg hover:scale-[1.01] shadow-md`
                        }`}
                        onClick={() => handleLevelSelect(level.value)}
                      >
                        {/* Enhanced Selection Indicator */}
                        {selectedLevel === level.value && (
                          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                        )}

                        {/* Info Button - Top Right */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white shadow-md z-20"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Info className="w-3 h-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm mx-auto">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-3">
                                <span className="text-2xl">{level.emoji}</span>
                                <div className="text-lg">{level.title} Level</div>
                              </DialogTitle>
                              <DialogDescription>
                                {level.description}
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-semibold mb-2">What you'll practice:</h4>
                                <ul className="space-y-1">
                                  {level.detailedFeatures.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm">
                                      <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                                      {feature}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              
                              <div className="bg-accent/10 p-3 rounded-lg border border-accent/20">
                                <p className="text-sm">
                                  <strong className="text-accent-foreground">Choose this level if:</strong><br />
                                  {level.recommended}
                                </p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Radio Button - Top Left */}
                        <div className="absolute top-1 left-1 z-20">
                          <RadioGroupItem 
                            value={level.value} 
                            id={level.value}
                            className="w-4 h-4 border-2 bg-white/90"
                          />
                        </div>

                        <CardContent className="p-2 h-full flex flex-col justify-center pt-6">
                          {/* Emoji & Title */}
                          <div className="space-y-2 mb-3">
                            <div className="text-3xl">{level.emoji}</div>
                            <CardTitle className="text-sm leading-tight font-bold">{level.title}</CardTitle>
                          </div>
                          
                          {/* Compact Feature Badges */}
                          <div className="space-y-1">
                            {level.badges.map((badge, badgeIndex) => (
                              <Badge 
                                key={badgeIndex} 
                                variant="secondary" 
                                className="text-xs px-1 py-0 h-4 rounded-sm block w-full bg-white/80 text-gray-800 border border-gray-300 font-medium"
                              >
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* UNIFIED CONFIRMATION & ACTION SECTION */}
            {selectedLevel && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* Unified Selection Confirmation Card */}
                <div className="bg-success/10 rounded-lg p-4 border border-success/20 space-y-3">
                  {/* Selection Status */}
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <span className="text-base font-bold text-success-foreground">
                        {selectedLevel} Level Selected
                      </span>
                    </div>
                  </div>
                  
                  {/* Lock Warning - Integrated */}
                  <div className="flex items-start gap-2 p-2 bg-primary/15 rounded border border-primary/25">
                    <Lock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-primary-foreground">
                      <strong>Level will be locked after confirmation.</strong> You can only change it by taking the placement test later.
                    </p>
                  </div>
                  
                  {/* Action Button - Integrated */}
                  <motion.div 
                    whileHover={{ scale: 1.01 }} 
                    whileTap={{ scale: 0.99 }}
                  >
                    <Button 
                      onClick={handleConfirm}
                      className="w-full bg-success hover:bg-success/90 text-success-foreground h-11 text-base font-bold shadow-lg"
                      size="lg"
                    >
                      <Zap className="w-5 h-5 mr-2" />
                      Start Learning at {selectedLevel} Level
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* GUIDANCE - When No Selection (Minimal Space) */}
            {!selectedLevel && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  👆 Tap a level card above to continue
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}