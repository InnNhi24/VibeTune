import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { RecordingControls } from "./RecordingControls";
import { 
  CheckCircle2, 
  Clock, 
  Mic, 
  MessageCircle, 
  ArrowLeft, 
  Bot,
  User as UserIcon,
  Zap,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Profile } from "../services/supabaseClient";
import { SimpleAuthService } from "../services/authServiceSimple";

interface AIPlacementTestProps {
  user: Profile;
  onComplete: (results: { level: string; score: number }) => void;
  onSkip: () => void;
  onBack?: () => void;
}

interface ConversationMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
  topic?: string;
  isAudioResponse?: boolean;
  score?: number;
}

interface TestResults {
  overallScore: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  topicScores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  totalQuestions: number;
  completedQuestions: number;
}

const CONVERSATION_TOPICS = [
  {
    id: 'greetings',
    name: 'Basic Greetings',
    difficulty: 'beginner',
    questions: [
      "Hi there! How are you doing today?",
      "What's your name and where are you from?",
      "Tell me a bit about yourself."
    ]
  },
  {
    id: 'daily_life',
    name: 'Daily Routines',
    difficulty: 'beginner',
    questions: [
      "What does a typical day look like for you?",
      "What time do you usually wake up and go to bed?",
      "What's your favorite meal of the day and why?"
    ]
  },
  {
    id: 'hobbies',
    name: 'Hobbies & Interests',
    difficulty: 'intermediate',
    questions: [
      "What do you like to do in your free time?",
      "Have you picked up any new hobbies recently?",
      "If you could learn any new skill, what would it be?"
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Culture',
    difficulty: 'intermediate',
    questions: [
      "What's the most interesting place you've ever visited?",
      "How do you think travel changes a person?",
      "What cultural differences have you noticed between countries?"
    ]
  },
  {
    id: 'future_plans',
    name: 'Goals & Aspirations',
    difficulty: 'advanced',
    questions: [
      "Where do you see yourself in five years?",
      "What's the biggest challenge you're facing right now?",
      "How do you think technology will change our lives in the future?"
    ]
  }
];

export function AIPlacementTest({ user, onComplete, onSkip, onBack }: AIPlacementTestProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(900); // 15 minutes
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Timer effect
  useEffect(() => {
    if (timeRemaining > 0 && !isCompleted) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && !isCompleted) {
      handleTimeUp();
    }
  }, [timeRemaining, isCompleted]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start the test with initial greeting
  useEffect(() => {
    const startTest = () => {
      const initialMessage: ConversationMessage = {
        id: 'initial',
        role: 'ai',
        content: `Hello! I'm your AI conversation partner for this placement test. We'll have a natural conversation covering different topics to assess your English prosody skills. This will help us determine the best learning level for you. Ready to begin?`,
        timestamp: new Date(),
        topic: 'introduction'
      };
      setMessages([initialMessage]);
      
      // After a brief pause, ask the first question
      setTimeout(() => {
        askNextQuestion();
      }, 2000);
    };

    startTest();
  }, []);

  const askNextQuestion = () => {
    const currentTopic = CONVERSATION_TOPICS[currentTopicIndex];
    const currentQuestion = currentTopic.questions[currentQuestionIndex];

    if (!currentQuestion) {
      // Move to next topic or complete test
      if (currentTopicIndex < CONVERSATION_TOPICS.length - 1) {
        setCurrentTopicIndex(prev => prev + 1);
        setCurrentQuestionIndex(0);
        return;
      } else {
        completeTest();
        return;
      }
    }

    const questionMessage: ConversationMessage = {
      id: `question-${currentTopicIndex}-${currentQuestionIndex}`,
      role: 'ai',
      content: currentQuestion,
      timestamp: new Date(),
      topic: currentTopic.id
    };

    setMessages(prev => [...prev, questionMessage]);
  };

  const handleUserResponse = async (response: string, isAudio: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      // Add user message
      const userMessage: ConversationMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: response,
        timestamp: new Date(),
        topic: CONVERSATION_TOPICS[currentTopicIndex].id,
        isAudioResponse: isAudio
      };

      setMessages(prev => [...prev, userMessage]);

      // Simulate AI analysis and scoring
      const score = await analyzeResponse(response, CONVERSATION_TOPICS[currentTopicIndex]);
      userMessage.score = score;

      // Generate AI follow-up or move to next question
      const followUp = generateFollowUp(response, score);
      
      if (followUp) {
        const followUpMessage: ConversationMessage = {
          id: `followup-${Date.now()}`,
          role: 'ai',
          content: followUp,
          timestamp: new Date(),
          topic: CONVERSATION_TOPICS[currentTopicIndex].id
        };
        
        setTimeout(() => {
          setMessages(prev => [...prev, followUpMessage]);
          
          // Move to next question after follow-up
          setTimeout(() => {
            setCurrentQuestionIndex(prev => prev + 1);
            askNextQuestion();
          }, 1500);
        }, 1000);
      } else {
        // Move directly to next question
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev + 1);
          askNextQuestion();
        }, 1000);
      }

    } catch (err: any) {
      console.error('Error processing response:', err);
      setError('Failed to process your response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeResponse = async (response: string, topic: any): Promise<number> => {
    // Simulate AI analysis - in a real app, this would call an AI service
    const responseLength = response.length;
    const wordCount = response.split(' ').length;
    
    // Basic scoring based on response quality indicators
    let score = 50; // Base score
    
    // Length and complexity bonus
    if (wordCount >= 10) score += 20;
    if (wordCount >= 20) score += 10;
    if (responseLength > 100) score += 10;
    
    // Topic difficulty adjustment
    if (topic.difficulty === 'advanced') score = Math.min(score * 0.9, 100);
    if (topic.difficulty === 'beginner') score = Math.min(score * 1.1, 100);
    
    // Add some randomness to simulate real AI analysis
    score += Math.random() * 20 - 10;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const generateFollowUp = (response: string, score: number): string | null => {
    if (score >= 80) {
      const positiveFollowUps = [
        "Great answer! I can hear the confidence in your response.",
        "Excellent! Your pronunciation is very clear.",
        "That's a thoughtful response with good intonation.",
        "Perfect! You're expressing yourself very naturally."
      ];
      return positiveFollowUps[Math.floor(Math.random() * positiveFollowUps.length)];
    } else if (score >= 60) {
      const neutralFollowUps = [
        "Good! Let's continue with the next topic.",
        "Nice! I can understand you clearly.",
        "That's helpful information, thank you."
      ];
      return neutralFollowUps[Math.floor(Math.random() * neutralFollowUps.length)];
    } else {
      const encouragingFollowUps = [
        "Thank you for sharing. Let's try another topic.",
        "I appreciate your response. Let's continue.",
        "Thanks! Let's move on to something different."
      ];
      return encouragingFollowUps[Math.floor(Math.random() * encouragingFollowUps.length)];
    }
  };

  const completeTest = async () => {
    setIsLoading(true);
    
    try {
      // Calculate results
      const userMessages = messages.filter(m => m.role === 'user' && m.score !== undefined);
      const totalScore = userMessages.reduce((sum, msg) => sum + (msg.score || 0), 0);
      const averageScore = userMessages.length > 0 ? totalScore / userMessages.length : 0;
      
      // Determine level based on average score
      let level: 'Beginner' | 'Intermediate' | 'Advanced' = 'Beginner';
      if (averageScore >= 75) level = 'Advanced';
      else if (averageScore >= 55) level = 'Intermediate';
      
      // Calculate topic scores
      const topicScores: Record<string, number> = {};
      CONVERSATION_TOPICS.forEach(topic => {
        const topicMessages = userMessages.filter(m => m.topic === topic.id);
        if (topicMessages.length > 0) {
          const topicTotal = topicMessages.reduce((sum, msg) => sum + (msg.score || 0), 0);
          topicScores[topic.name] = topicTotal / topicMessages.length;
        }
      });
      
      const testResults: TestResults = {
        overallScore: Math.round(averageScore),
        level,
        topicScores,
        strengths: generateStrengths(averageScore, topicScores),
        improvements: generateImprovements(averageScore, topicScores),
        totalQuestions: CONVERSATION_TOPICS.reduce((sum, topic) => sum + topic.questions.length, 0),
        completedQuestions: userMessages.length
      };
      
      setResults(testResults);
      setIsCompleted(true);
      
      // Update user profile
      await SimpleAuthService.updateProfile(user.id, {
        level: level,
        placement_test_completed: true,
        placement_test_score: testResults.overallScore
      }, user);
      
    } catch (err: any) {
      console.error('Error completing test:', err);
      setError('Failed to complete the test. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateStrengths = (score: number, topicScores: Record<string, number>): string[] => {
    const strengths = [];
    if (score >= 70) strengths.push("Clear pronunciation");
    if (score >= 60) strengths.push("Good conversational flow");
    
    // Find best topic
    const bestTopic = Object.entries(topicScores).reduce((best, [topic, score]) => 
      score > best.score ? { topic, score } : best, { topic: '', score: 0 });
    
    if (bestTopic.score >= 70) {
      strengths.push(`Strong performance in ${bestTopic.topic.toLowerCase()}`);
    }
    
    return strengths.length > 0 ? strengths : ["Willingness to communicate"];
  };

  const generateImprovements = (score: number, topicScores: Record<string, number>): string[] => {
    const improvements = [];
    if (score < 60) improvements.push("Focus on pronunciation clarity");
    if (score < 70) improvements.push("Practice natural intonation patterns");
    
    // Find weakest topic
    const weakestTopic = Object.entries(topicScores).reduce((worst, [topic, score]) => 
      score < worst.score ? { topic, score } : worst, { topic: '', score: 100 });
    
    if (weakestTopic.score < 60) {
      improvements.push(`More practice with ${weakestTopic.topic.toLowerCase()}`);
    }
    
    return improvements.length > 0 ? improvements : ["Continue practicing regularly"];
  };

  const handleTimeUp = () => {
    setError("Time's up! Completing test with current responses...");
    setTimeout(() => {
      completeTest();
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const totalQuestions = CONVERSATION_TOPICS.reduce((sum, topic) => sum + topic.questions.length, 0);
    const currentProgress = (currentTopicIndex * 3) + currentQuestionIndex;
    return Math.min((currentProgress / totalQuestions) * 100, 100);
  };

  // Completion screen
  if (isCompleted && results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl"
        >
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
              <div className="space-y-4">
                <h2 className="text-3xl font-bold">Placement Test Complete!</h2>
                <div className="bg-accent/10 p-6 rounded-lg space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    <Badge className="text-lg px-4 py-2 bg-accent text-accent-foreground">
                      {results.level} Level
                    </Badge>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      {results.overallScore}% Score
                    </Badge>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 text-left">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-success">Your Strengths:</h4>
                      <ul className="text-sm space-y-1">
                        {results.strengths.map((strength, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-semibold text-primary">Areas to Improve:</h4>
                      <ul className="text-sm space-y-1">
                        {results.improvements.map((improvement, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            {improvement}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={() => onComplete({ level: results.level, score: results.overallScore })}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6"
                  size="lg"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Start Learning at {results.level} Level
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold">AI Conversation Placement Test</h1>
            <p className="text-muted-foreground">
              Topic: {CONVERSATION_TOPICS[currentTopicIndex]?.name}
            </p>
          </div>
          <div className="w-10" />
        </div>

        {/* Progress and Timer */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Progress</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{formatTime(timeRemaining)}</span>
              </div>
            </div>
            <Progress value={getProgress()} className="w-full" />
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Conversation */}
        <Card className="h-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Conversation
            </CardTitle>
            <CardDescription>
              Have a natural conversation with the AI to assess your English prosody skills
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 overflow-y-auto space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'ai' ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
                    }`}>
                      {message.role === 'ai' ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                    </div>
                    <div className={`p-3 rounded-lg ${
                      message.role === 'ai' 
                        ? 'bg-muted text-muted-foreground' 
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      {message.score && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          Score: {message.score}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </CardContent>
        </Card>

        {/* Recording Controls */}
        <Card>
          <CardContent className="p-4">
            <RecordingControls
              onSendMessage={(message) => handleUserResponse(message, true)}
              disabled={isLoading || isCompleted}
              placeholder="Speak your response or type it here..."
            />
          </CardContent>
        </Card>

        {/* Skip Option */}
        <div className="text-center">
          <Button variant="link" onClick={onSkip} disabled={isLoading}>
            Skip placement test and start with Beginner level
          </Button>
        </div>
      </div>
    </div>
  );
}
