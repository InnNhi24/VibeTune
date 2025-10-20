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
  AlertCircle,
  Send,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Profile } from "../services/supabaseClient";
import { SimpleAuthService } from "../services/authServiceSimple";
import { Input } from "./ui/input";

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
    id: 'introduction',
    name: 'Personal Introduction',
    difficulty: 'beginner',
    prompt: "Let's start with a simple introduction. Tell me about yourself - your name, where you're from, and what you do."
  },
  {
    id: 'daily_life',
    name: 'Daily Routines',
    difficulty: 'beginner',
    prompt: "Describe a typical day in your life. What time do you wake up, what do you do for work or study, and how do you spend your evenings?"
  },
  {
    id: 'hobbies',
    name: 'Hobbies & Interests',
    difficulty: 'intermediate',
    prompt: "What are your hobbies and interests? How did you get started with them, and what do you enjoy most about them?"
  },
  {
    id: 'travel',
    name: 'Travel & Culture',
    difficulty: 'intermediate',
    prompt: "Tell me about a place you've visited or would like to visit. What makes it special, and how do you think travel affects people?"
  },
  {
    id: 'future_goals',
    name: 'Goals & Aspirations',
    difficulty: 'advanced',
    prompt: "What are your goals for the future? How do you plan to achieve them, and what challenges do you expect to face?"
  }
];

export function AIPlacementTest({ user, onComplete, onSkip, onBack }: AIPlacementTestProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [results, setResults] = useState<TestResults | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(900); // 15 minutes
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
        content: `Hello! I'm your AI conversation partner for this placement test. We'll have a natural conversation covering different topics to assess your English prosody skills. This will help us determine the best learning level for you. 

I'll ask you about 5 different topics, and you can respond by typing your answers. Try to be as natural and detailed as possible - imagine we're having a friendly conversation!

Ready to begin?`,
        timestamp: new Date(),
        topic: 'introduction'
      };
      setMessages([initialMessage]);
      
      // After a brief pause, ask the first question
      setTimeout(() => {
        askCurrentQuestion();
      }, 2000);
    };

    startTest();
  }, []);

  const askCurrentQuestion = () => {
    if (currentTopicIndex >= CONVERSATION_TOPICS.length) {
      completeTest();
      return;
    }

    const currentTopic = CONVERSATION_TOPICS[currentTopicIndex];
    
    const questionMessage: ConversationMessage = {
      id: `question-${currentTopicIndex}`,
      role: 'ai',
      content: currentTopic.prompt,
      timestamp: new Date(),
      topic: currentTopic.id
    };

    setMessages(prev => [...prev, questionMessage]);
  };

  const handleUserResponse = async (response: string) => {
    if (!response.trim()) return;

    setIsLoading(true);
    setIsAnalyzing(true);
    setError(null);

    try {
      // Add user message
      const userMessage: ConversationMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: response,
        timestamp: new Date(),
        topic: CONVERSATION_TOPICS[currentTopicIndex].id,
        isAudioResponse: false
      };

      setMessages(prev => [...prev, userMessage]);
      setUserInput('');

      // Analyze response with AI
      const analysis = await analyzeResponseWithAI(response, CONVERSATION_TOPICS[currentTopicIndex]);
      userMessage.score = analysis.score;

      // Generate AI follow-up
      const followUpMessage: ConversationMessage = {
        id: `followup-${Date.now()}`,
        role: 'ai',
        content: analysis.feedback,
        timestamp: new Date(),
        topic: CONVERSATION_TOPICS[currentTopicIndex].id
      };
      
      setTimeout(() => {
        setMessages(prev => [...prev, followUpMessage]);
        
        // Move to next topic after follow-up
        setTimeout(() => {
          setCurrentTopicIndex(prev => prev + 1);
          askCurrentQuestion();
        }, 1500);
      }, 1000);

    } catch (err: any) {
      console.error('Error processing response:', err);
      setError('Failed to process your response. Please try again.');
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const analyzeResponseWithAI = async (response: string, topic: any): Promise<{ score: number; feedback: string }> => {
    try {
      // Use OpenAI API to analyze the response
      const analysisPrompt = `
You are an English language assessment AI specializing in prosody and conversational skills. 

Analyze this student response for a ${topic.difficulty} level topic about "${topic.name}":

Student Response: "${response}"

Provide a JSON response with:
1. score: A number from 0-100 based on:
   - Vocabulary richness and appropriateness
   - Grammar accuracy
   - Response completeness and relevance
   - Natural conversational flow
   - Complexity appropriate for ${topic.difficulty} level

2. feedback: A brief, encouraging response (1-2 sentences) that:
   - Acknowledges their response positively
   - Provides subtle guidance if needed
   - Maintains conversational flow

Format: {"score": number, "feedback": "string"}
`;

      const response_data = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY || 'sk-placeholder'}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert English language assessor. Respond only with valid JSON.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 200
        })
      });

      if (!response_data.ok) {
        throw new Error('AI analysis failed');
      }

      const data = await response_data.json();
      const analysis = JSON.parse(data.choices[0].message.content);
      
      return {
        score: Math.max(0, Math.min(100, analysis.score)),
        feedback: analysis.feedback
      };
    } catch (error) {
      console.warn('AI analysis failed, using fallback:', error);
      
      // Fallback analysis
      const wordCount = response.split(' ').length;
      const responseLength = response.length;
      
      let score = 50; // Base score
      if (wordCount >= 10) score += 20;
      if (wordCount >= 25) score += 15;
      if (responseLength > 100) score += 10;
      
      // Topic difficulty adjustment
      if (topic.difficulty === 'advanced') score = Math.min(score * 0.9, 100);
      if (topic.difficulty === 'beginner') score = Math.min(score * 1.1, 100);
      
      const feedbackOptions = [
        "Thank you for sharing that! Your response shows good understanding.",
        "Great! I can see you're expressing yourself clearly.",
        "That's interesting! You're communicating your thoughts well.",
        "Nice response! You're doing well with this topic."
      ];
      
      return {
        score: Math.round(score),
        feedback: feedbackOptions[Math.floor(Math.random() * feedbackOptions.length)]
      };
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
        totalQuestions: CONVERSATION_TOPICS.length,
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
    if (score >= 70) strengths.push("Clear and coherent communication");
    if (score >= 60) strengths.push("Good conversational engagement");
    if (score >= 80) strengths.push("Rich vocabulary usage");
    
    // Find best topic
    const bestTopic = Object.entries(topicScores).reduce((best, [topic, score]) => 
      score > best.score ? { topic, score } : best, { topic: '', score: 0 });
    
    if (bestTopic.score >= 70) {
      strengths.push(`Excellent performance discussing ${bestTopic.topic.toLowerCase()}`);
    }
    
    return strengths.length > 0 ? strengths : ["Willingness to communicate and engage"];
  };

  const generateImprovements = (score: number, topicScores: Record<string, number>): string[] => {
    const improvements = [];
    if (score < 60) improvements.push("Focus on expanding response detail and complexity");
    if (score < 70) improvements.push("Practice using more varied vocabulary");
    if (score < 50) improvements.push("Work on grammar accuracy and sentence structure");
    
    // Find weakest topic
    const weakestTopic = Object.entries(topicScores).reduce((worst, [topic, score]) => 
      score < worst.score ? { topic, score } : worst, { topic: '', score: 100 });
    
    if (weakestTopic.score < 60 && Object.keys(topicScores).length > 1) {
      improvements.push(`Additional practice with ${weakestTopic.topic.toLowerCase()} discussions`);
    }
    
    return improvements.length > 0 ? improvements : ["Continue practicing to build confidence"];
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
    return Math.min((currentTopicIndex / CONVERSATION_TOPICS.length) * 100, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && userInput.trim() && !isLoading) {
      e.preventDefault();
      handleUserResponse(userInput);
    }
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
          <div className="flex items-center gap-4">
            <div className="text-center">
              <h1 className="text-xl font-bold">AI Placement Test</h1>
              <p className="text-sm text-muted-foreground">
                Topic {currentTopicIndex + 1} of {CONVERSATION_TOPICS.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{formatTime(timeRemaining)}</div>
              <div className="text-xs text-muted-foreground">remaining</div>
            </div>
            <Button variant="outline" size="sm" onClick={onSkip}>
              Skip Test
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(getProgress())}%</span>
          </div>
          <Progress value={getProgress()} className="h-2" />
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Chat Interface */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Conversation
            </CardTitle>
            <CardDescription>
              {currentTopicIndex < CONVERSATION_TOPICS.length 
                ? `Current topic: ${CONVERSATION_TOPICS[currentTopicIndex].name}`
                : "Test completed"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Messages */}
            <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
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
                      <div className={`rounded-lg p-3 ${
                        message.role === 'ai' 
                          ? 'bg-muted text-muted-foreground' 
                          : 'bg-primary text-primary-foreground'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.score && (
                          <div className="mt-2 text-xs opacity-70">
                            Score: {message.score}%
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent text-accent-foreground">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="rounded-lg p-3 bg-muted text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Analyzing your response...</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {currentTopicIndex < CONVERSATION_TOPICS.length && !isCompleted && (
              <div className="flex gap-2">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your response here..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleUserResponse(userInput)}
                  disabled={!userInput.trim() || isLoading}
                  size="icon"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
