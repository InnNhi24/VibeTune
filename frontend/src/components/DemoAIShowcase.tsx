import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ProsodyFeedback } from "./ProsodyFeedback";
import { AIConfigDialog } from "./AIConfigDialog";
import { RecordingControls } from "./RecordingControls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { 
  Zap, 
  Mic, 
  MessageCircle, 
  BarChart3, 
  Settings,
  Play,
  CheckCircle2,
  TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import { aiProsodyService, ProsodyAnalysis, ConversationContext } from "../services/aiProsodyService";
import logger from '../utils/logger';

interface DemoAIShowcaseProps {
  isVisible: boolean;
  onClose: () => void;
}

export function DemoAIShowcase({ isVisible, onClose }: DemoAIShowcaseProps) {
  const [currentDemo, setCurrentDemo] = useState<'config' | 'recording' | 'analysis' | 'conversation'>('config');
  const [demoAnalysis, setDemoAnalysis] = useState<ProsodyAnalysis | null>(null);

  const mockAnalysis: ProsodyAnalysis = {
    overall_score: 78,
    pronunciation_score: 82,
    rhythm_score: 75,
    intonation_score: 80,
    fluency_score: 74,
    detailed_feedback: {
      strengths: [
        "Clear consonant pronunciation",
        "Good natural pace",
        "Appropriate sentence stress"
      ],
      improvements: [
        "Work on question intonation",
        "Focus on word linking"
      ],
      specific_issues: [
        {
          type: 'intonation',
          word: 'really',
          severity: 'medium',
          feedback: 'Rising intonation would add more emphasis',
          suggestion: 'Try raising your pitch on "really" for stronger impact'
        },
        {
          type: 'rhythm',
          word: 'communication',
          severity: 'low',
          feedback: 'Good stress on the main syllable',
          suggestion: 'Continue emphasizing the 4th syllable'
        }
      ]
    },
    word_level_analysis: [
      {
        word: 'I',
        start_time: 0,
        end_time: 0.2,
        confidence: 0.95,
        stress_correct: true,
        pronunciation_score: 90,
        issues: []
      },
      {
        word: 'think',
        start_time: 0.2,
        end_time: 0.6,
        confidence: 0.88,
        stress_correct: true,
        pronunciation_score: 85,
        issues: []
      },
      {
        word: 'communication',
        start_time: 0.8,
        end_time: 1.8,
        confidence: 0.92,
        stress_correct: true,
        pronunciation_score: 88,
        issues: []
      }
    ],
    suggestions: [
      "Practice rising intonation for questions",
      "Work on linking words in natural speech",
      "Record yourself to identify rhythm patterns"
    ],
    next_focus_areas: [
      "Question intonation patterns",
      "Connected speech",
      "Emphasis techniques"
    ]
  };

  const mockContext: ConversationContext = {
    user_level: 'Intermediate',
    topic: 'General Conversation',
    conversation_history: [],
    focus_areas: ['intonation', 'rhythm'],
    learning_objectives: ['Improve pronunciation', 'Sound more natural']
  };

  const handleDemo = (type: typeof currentDemo) => {
    setCurrentDemo(type);
    if (type === 'analysis') {
      setDemoAnalysis(mockAnalysis);
    }
  };

  const handleDemoRecording = (message: string, isAudio: boolean) => {
    logger.info('Demo recording:', message, isAudio);
    // Simulate analysis
    setTimeout(() => {
      setDemoAnalysis(mockAnalysis);
      setCurrentDemo('analysis');
    }, 2000);
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                <Zap className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold">VibeTune AI Demo</h2>
                <p className="text-sm text-muted-foreground">
                  Experience advanced prosody analysis and conversation practice
                </p>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>

          {/* Demo Navigation */}
          <Tabs value={currentDemo} onValueChange={(value) => handleDemo(value as typeof currentDemo)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Setup
              </TabsTrigger>
              <TabsTrigger value="recording" className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Recording
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="conversation" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    AI Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure your AI service to enable advanced prosody analysis, 
                    real-time feedback, and adaptive conversation practice.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-semibold">Key Features:</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          Real-time pronunciation analysis
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          Rhythm and intonation feedback
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          Adaptive conversation difficulty
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          Personalized learning suggestions
                        </li>
                      </ul>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-semibold">Supported Services:</h4>
                      <div className="space-y-2">
                        <Badge variant="outline" className="block text-center">
                          OpenAI GPT-4 + Speech Analysis
                        </Badge>
                        <Badge variant="outline" className="block text-center">
                          Custom Prosody API
                        </Badge>
                        <Badge variant="outline" className="block text-center">
                          Azure Cognitive Services
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <AIConfigDialog 
                    trigger={
                      <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure AI Service
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recording" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="w-5 h-5" />
                    Smart Recording Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Try our enhanced recording controls with real-time AI feedback and analysis.
                  </p>
                  
                  <RecordingControls
                    onSendMessage={handleDemoRecording}
                    conversationContext={mockContext}
                    showAIFeedback={true}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              {demoAnalysis ? (
                <ProsodyFeedback
                  analysis={demoAnalysis}
                  originalText="I think communication is really important for success."
                  onRetry={() => setDemoAnalysis(null)}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      AI Prosody Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center py-8">
                    <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Record some audio to see detailed AI analysis
                    </p>
                    <Button onClick={() => setDemoAnalysis(mockAnalysis)}>
                      <Play className="w-4 h-4 mr-2" />
                      View Sample Analysis
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="conversation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    AI Conversation Practice
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Experience adaptive AI conversations that adjust to your level and provide 
                    personalized feedback on your pronunciation and prosody.
                  </p>
                  
                  <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                        <Zap className="w-4 h-4 text-accent-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          "Great job with your pronunciation! I noticed excellent word stress 
                          on 'communication'. Let's practice some question intonation now. 
                          Can you ask me about your favorite hobbies?"
                        </p>
                        <span className="text-xs text-muted-foreground">VibeTune AI • Just now</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Conversation Features:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Level-adaptive responses</li>
                        <li>• Real-time prosody feedback</li>
                        <li>• Topic progression</li>
                        <li>• Conversation history</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Learning Support:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Incremental difficulty</li>
                        <li>• Personalized suggestions</li>
                        <li>• Progress tracking</li>
                        <li>• Offline practice mode</li>
                      </ul>
                    </div>
                  </div>
                  
                  <Button className="w-full" onClick={onClose}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Start AI Conversation Practice
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  );
}