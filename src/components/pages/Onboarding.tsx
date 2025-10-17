import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Mic, UserPlus, LogIn, TrendingUp, MessageCircle, Star } from "lucide-react";
import { motion } from "motion/react";

interface OnboardingProps {
  onSignUp: () => void;
  onSignIn: () => void;

}

export function Onboarding({ onSignUp, onSignIn }: OnboardingProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center p-4">
      <div className="max-w-4xl mx-auto w-full">
        {/* Desktop Layout: Side by side */}
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left Side: Main Content */}
          <div className="space-y-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center lg:text-left"
            >
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-16 h-16 bg-accent rounded-full flex items-center justify-center"
                >
                  <Mic className="w-8 h-8 text-accent-foreground" />
                </motion.div>
                <h1 className="text-3xl lg:text-4xl font-bold text-foreground">VibeTune</h1>
              </div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">Master English Prosody with AI</h2>
                <p className="text-lg text-muted-foreground">
                  Perfect your pronunciation, rhythm, and intonation through personalized AI conversations
                </p>
                <div className="flex items-center justify-center lg:justify-start gap-2 pt-2">
                  <Badge className="bg-success text-success-foreground">
                    🤖 AI-Powered
                  </Badge>
                  <Badge variant="outline">
                    No Setup Required
                  </Badge>
                </div>
              </motion.div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-4 max-w-md mx-auto lg:mx-0"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  onClick={() => { console.log('Onboarding: Sign Up clicked'); onSignUp(); }} 
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  size="lg"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Sign Up
                </Button>
              </motion.div>
              
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  onClick={() => { console.log('Onboarding: Sign In clicked'); onSignIn(); }} 
                  variant="outline" 
                  className="w-full"
                  size="lg"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Log In
                </Button>
              </motion.div>
            </motion.div>
            
            {/* Demo Button - Temporary for Testing */}

            
            {/* Info Text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center lg:text-left"
            >
              <p className="text-xs text-muted-foreground max-w-md mx-auto lg:mx-0">
                Sign up required to access features • Placement test takes 10-15 minutes and personalizes your experience
              </p>
            </motion.div>
          </div>

          {/* Right Side: Sample Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 }}
            className="hidden lg:block"
          >
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-center mb-6">See Your Progress</h3>
              
              {/* Progress Card */}
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-success" />
                    Your Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Prosody Score</span>
                      <Badge className="bg-success text-success-foreground">85%</Badge>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Current Level</span>
                      <Badge variant="outline">Intermediate</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Practice Sessions</span>
                      <span className="text-sm font-medium">12 completed</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Feedback Preview */}
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageCircle className="w-5 h-5 text-accent" />
                    AI Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 p-3 rounded-lg mb-3">
                    <p className="text-sm">"I went to the <span className="bg-destructive/20 px-1 rounded">store</span> yesterday."</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <Star className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                      <p className="text-xs">Try emphasizing "store" with rising intonation</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Star className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <p className="text-xs">Great rhythm on "yesterday"!</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

