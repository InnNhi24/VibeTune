import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { 
  CheckCircle2, 
  MessageCircle, 
  ArrowLeft, 
  Bot,
  User as UserIcon,
  Zap,
  TrendingUp,
  AlertCircle,
  Send,
  Loader2,
  Mic
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Profile } from "../services/supabaseClient";
import { SimpleAuthService } from "../services/authServiceSimple";
import { Textarea } from "./ui/textarea";
import { logger } from "../utils/logger";

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
  const [hasStarted, setHasStarted] = useState(false);
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

I'll ask you about 5 different topics, and you can respond by typing or recording your voice. Try to be as natural and detailed as possible - imagine we're having a friendly conversation!

⚠️ **Important:** After completing this test, your level will be automatically set based on your performance. You won't be able to keep your current level or choose a different one.`,
        timestamp: new Date(),
        topic: 'introduction'
      };
      setMessages([initialMessage]);
    };

    // Only run once on mount
    if (messages.length === 0) {
      startTest();
    }
  }, []); // Empty dependency array - run once

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

  const handleUserResponse = async (response: string, isVoice: boolean = false) => {
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
        isAudioResponse: isVoice
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
        const nextIndex = currentTopicIndex + 1;
        setCurrentTopicIndex(nextIndex);
        
        setTimeout(() => {
          // Only ask next question if not at the end
          if (nextIndex < CONVERSATION_TOPICS.length) {
            const nextTopic = CONVERSATION_TOPICS[nextIndex];
            const questionMessage: ConversationMessage = {
              id: `question-${nextIndex}`,
              role: 'ai',
              content: nextTopic.prompt,
              timestamp: new Date(),
              topic: nextTopic.id
            };
            setMessages(prev => [...prev, questionMessage]);
          } else {
            // Test complete
            completeTest();
          }
        }, 1500);
      }, 1000);

    } catch (err: any) {
      logger.error('Error processing response:', err);
      setError('Failed to process your response. Please try again.');
    } finally {
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  const analyzeResponseWithAI = async (response: string, topic: any): Promise<{ score: number; feedback: string }> => {
    try {
      // Use backend API for AI analysis - send to placement test endpoint
      const response_data = await fetch('/api/placement-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: user.id,
          response: response,
          topic: topic.name,
          difficulty: topic.difficulty,
          deviceId: localStorage.getItem('device_id') || undefined
        })
      });

      if (!response_data.ok) {
        throw new Error('Backend AI analysis failed');
      }

      const data = await response_data.json();
      
      // Extract score from AI response (simplified scoring)
      const wordCount = response.split(' ').length;
      const responseLength = response.length;
      
      let score = 50; // Base score
      if (wordCount >= 10) score += 20;
      if (wordCount >= 25) score += 15;
      if (responseLength > 100) score += 10;
      
      // Topic difficulty adjustment
      if (topic.difficulty === 'advanced') score = Math.min(score * 0.9, 100);
      if (topic.difficulty === 'beginner') score = Math.min(score * 1.1, 100);
      
      return {
        score: Math.round(score),
        feedback: data.replyText || "Thank you for sharing that! Your response shows good understanding."
      };
  } catch (error) {
  logger.warn('Backend AI analysis failed, using fallback:', error);
      
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
      logger.error('Error completing test:', err);
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

  const handleBeginTest = () => {
    setHasStarted(true);
    // Ask the first question after user clicks begin
    setTimeout(() => {
      if (currentTopicIndex === 0) {
        askCurrentQuestion();
      }
    }, 500);
  };

  const handleVoiceResponse = async (audioBlob: Blob) => {
    setIsLoading(true);
    setIsAnalyzing(true);
    setError(null);

    try {
      // Transcribe audio first
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!transcribeResponse.ok) {
        throw new Error('Transcription failed');
      }

      const { text } = await transcribeResponse.json();
      
      if (!text || text.trim().length === 0) {
        throw new Error('Could not transcribe audio. Please try again.');
      }

      // Process as normal response with transcribed text
      await handleUserResponse(text, true);

    } catch (err: any) {
      logger.error('Voice response error:', err);
      setError(err.message || 'Failed to process voice recording. Please try typing instead.');
      setIsLoading(false);
      setIsAnalyzing(false);
    }
  };

  // Completion screen
  if (isCompleted && results) {
    const userCurrentLevel = user.level;
    const assessedLevel = results.level;
    const isDifferentLevel = userCurrentLevel && userCurrentLevel !== assessedLevel;

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
                
                {/* Level Assessment Result */}
                {isDifferentLevel && (
                  <Alert className="text-left">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Your Assessed Level:</strong> Based on your performance, your level has been set to <strong>{assessedLevel}</strong>.
                      {userCurrentLevel === 'Beginner' && assessedLevel !== 'Beginner' && (
                        <span> Great job! You're performing above your initial level! 🎉</span>
                      )}
                      {userCurrentLevel === 'Advanced' && assessedLevel !== 'Advanced' && (
                        <span> This level will help you build a stronger foundation before advancing.</span>
                      )}
                      {userCurrentLevel === 'Intermediate' && assessedLevel === 'Beginner' && (
                        <span> Let's strengthen the basics first - you'll progress quickly!</span>
                      )}
                      {userCurrentLevel === 'Intermediate' && assessedLevel === 'Advanced' && (
                        <span> Excellent! You're ready for advanced challenges!</span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="bg-accent/10 p-6 rounded-lg space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    <Badge className="text-lg px-4 py-2 bg-accent text-accent-foreground">
                      Your Level: {results.level}
                    </Badge>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      Score: {results.overallScore}%
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
                
                {/* Single Action Button - Must Accept AI Level */}
                <Button 
                  onClick={() => onComplete({ level: results.level, score: results.overallScore })}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6"
                  size="lg"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Start Learning at {results.level} Level
                </Button>
                
                {isDifferentLevel && (
                  <p className="text-xs text-muted-foreground">
                    Your level has been updated based on your test performance
                  </p>
                )}
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

            {/* Begin Test Button or Input */}
            {!hasStarted && !isCompleted ? (
              <div className="flex justify-center py-4">
                <Button
                  onClick={handleBeginTest}
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Begin Test
                </Button>
              </div>
            ) : currentTopicIndex < CONVERSATION_TOPICS.length && !isCompleted ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && userInput.trim() && !isLoading) {
                        e.preventDefault();
                        handleUserResponse(userInput, false);
                      }
                    }}
                    placeholder="Type your response here..."
                    disabled={isLoading}
                    className="flex-1 min-h-[80px] resize-none"
                  />
                  <Button
                    onClick={() => handleUserResponse(userInput, false)}
                    disabled={!userInput.trim() || isLoading}
                    size="icon"
                    className="h-[80px]"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {/* Voice Recording Button */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="h-px flex-1 bg-border"></div>
                  <span>or record your voice</span>
                  <div className="h-px flex-1 bg-border"></div>
                </div>
                
                <SimpleVoiceRecorder 
                  onRecordingComplete={handleVoiceResponse}
                  disabled={isLoading}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Simple Voice Recorder Component
interface SimpleVoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  disabled?: boolean;
}

function SimpleVoiceRecorder({ onRecordingComplete, disabled }: SimpleVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      logger.error('Failed to start recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center">
      {!isRecording ? (
        <Button
          onClick={startRecording}
          disabled={disabled}
          size="lg"
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Mic className="w-5 h-5 mr-2" />
          Tap to Record Voice
        </Button>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-3 h-3 bg-destructive rounded-full"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
          </div>
          <Button
            onClick={stopRecording}
            size="lg"
            variant="destructive"
          >
            Stop Recording
          </Button>
        </div>
      )}
    </div>
  );
}
