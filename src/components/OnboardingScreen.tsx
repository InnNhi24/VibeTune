import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Mic, MessageCircle, TrendingUp, Star } from "lucide-react";

interface OnboardingScreenProps {
  onStartPlacementTest: () => void;
  onSkipToConversation: () => void;
}

export function OnboardingScreen({ onStartPlacementTest, onSkipToConversation }: OnboardingScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col p-4">
      {/* Header */}
      <div className="text-center pt-8 pb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Mic className="w-8 h-8 text-accent" />
          <h1 className="text-3xl font-bold text-foreground">SpeakPro</h1>
        </div>
        <p className="text-lg text-muted-foreground">Master English Prosody with AI</p>
      </div>

      {/* Preview Dashboard */}
      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Your Progress Preview
            </CardTitle>
            <CardDescription>See what you'll track with SpeakPro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Prosody Score</span>
              <Badge variant="secondary" className="bg-success text-success-foreground">85%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Current Level</span>
              <Badge variant="outline">Intermediate</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Conversations</span>
              <span className="text-sm">12 sessions</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              AI Feedback Sample
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-3 rounded-lg mb-3">
              <p className="text-sm">"I went to the <span className="bg-destructive/20 px-1 rounded">store</span> yesterday."</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Star className="w-4 h-4 text-accent mt-0.5" />
                <p className="text-sm">Try emphasizing "store" with rising intonation</p>
              </div>
              <div className="flex items-start gap-2">
                <Star className="w-4 h-4 text-accent mt-0.5" />
                <p className="text-sm">Great rhythm on "yesterday"!</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 pt-4">
          <h3 className="text-center">Ready to start your prosody journey?</h3>
          
          <div className="space-y-3">
            <Button 
              onClick={onStartPlacementTest} 
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              size="lg"
            >
              Start Placement Test
            </Button>
            
            <Button 
              onClick={onSkipToConversation} 
              variant="outline" 
              className="w-full"
              size="lg"
            >
              Skip to Free Conversation
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            The placement test helps us customize your learning experience
          </p>
        </div>
      </div>
    </div>
  );
}