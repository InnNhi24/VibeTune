import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { RecordingControls } from "./RecordingControls";
import { CheckCircle2, Clock, Mic, MessageCircle, ArrowLeft } from "lucide-react";
import { usePlacementTest } from "../hooks/usePlacementTest";
import { supabase, getCurrentUser } from "../services/supabaseClient";
import { motion } from "motion/react";

interface PlacementTestProps {
  onComplete: (results: { level: string; score: number }) => void;
  onSkip: () => void;
  onBack?: () => void;
}

interface Question {
  id: number;
  type: 'multiple-choice' | 'audio-response' | 'reading';
  topic: string;
  question: string;
  options?: string[];
  correctAnswer?: number;
  expectedResponse?: string;
}

const testQuestions: Question[] = [
  {
    id: 1,
    type: 'multiple-choice',
    topic: 'Basic Greetings',
    question: 'Which response shows the most appropriate stress pattern for "How are you TODAY?"',
    options: [
      'How are YOU today? (stress on YOU)',
      'HOW are you today? (stress on HOW)',
      'How are you TODAY? (stress on TODAY)',
      'How ARE you today? (stress on ARE)'
    ],
    correctAnswer: 2
  },
  {
    id: 2,
    type: 'audio-response',
    topic: 'Pronunciation',
    question: 'Please read this sentence aloud with natural intonation:',
    expectedResponse: 'I really enjoy learning new languages and meeting people from different cultures.'
  },
  {
    id: 3,
    type: 'multiple-choice',
    topic: 'Intonation Patterns',
    question: 'In the question "Are you coming to the party?", the intonation should:',
    options: [
      'Rise at the end (↗)',
      'Fall at the end (↘)',
      'Stay flat (→)',
      'Rise then fall (↗↘)'
    ],
    correctAnswer: 0
  },
  {
    id: 4,
    type: 'audio-response',
    topic: 'Conversational Response',
    question: 'Respond naturally to this question: "What\'s your favorite hobby and why do you enjoy it?"',
    expectedResponse: 'Open-ended response about hobbies'
  },
  {
    id: 5,
    type: 'reading',
    topic: 'Connected Speech',
    question: 'Read this paragraph aloud, focusing on natural rhythm and connected speech:',
    expectedResponse: 'English is a global language that connects people from different backgrounds. When we speak clearly and naturally, we can communicate more effectively and build stronger relationships with others.'
  }
];

export function PlacementTest({ onComplete, onSkip, onBack }: PlacementTestProps) {
  const [user, setUser] = useState(null);
  const [selectedOption, setSelectedOption] = useState<string>("");

  // Initialize user
  useEffect(() => {
    const initUser = async () => {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        setUser(data);
      }
    };
    initUser();
  }, []);

  const {
    questions,
    currentQuestion,
    answers,
    isLoading,
    error,
    timeRemaining,
    isCompleted,
    results,
    startTest,
    answerMultipleChoice,
    answerAudioResponse,
    nextQuestion,
    previousQuestion,
    completeTest,
    skipTest,
    getCurrentQuestion,
    getCurrentAnswer,
    getProgress,
    clearError
  } = usePlacementTest(user);

  // Start test when component mounts
  useEffect(() => {
    if (user && questions.length > 0) {
      startTest();
    }
  }, [user, startTest, questions]);

  const handleMultipleChoiceNext = () => {
    if (selectedOption) {
      const question = getCurrentQuestion();
      if (question) {
        answerMultipleChoice(question.id, parseInt(selectedOption));
        setSelectedOption("");
        nextQuestion();
      }
    }
  };

  const handleAudioResponse = (response: string) => {
    const question = getCurrentQuestion();
    if (question) {
      answerAudioResponse(question.id, response);
      nextQuestion();
    }
  };

  const handleComplete = async () => {
    await completeTest();
    if (results) {
      onComplete({ level: results.level, score: results.score });
    }
  };

  const handleSkip = async () => {
    await skipTest();
    onSkip();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (!user || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-semibold">Preparing your test...</h2>
            <p className="text-muted-foreground">
              Setting up personalized questions
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completion state
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Test Complete!</h2>
                {results ? (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Your English prosody level: <span className="font-semibold text-foreground">{results.level}</span>
                    </p>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span>Overall Score:</span>
                        <Badge variant="secondary" className="bg-success text-success-foreground">
                          {results.score}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span>Pronunciation:</span>
                          <span>{Math.round(results.breakdown.pronunciation)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Intonation:</span>
                          <span>{Math.round(results.breakdown.intonation)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rhythm:</span>
                          <span>{Math.round(results.breakdown.rhythm)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Vocabulary:</span>
                          <span>{Math.round(results.breakdown.vocabulary)}%</span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => onComplete({ level: results.level, score: results.score })}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      Start Learning at {results.level} Level
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Processing your results and determining your level...
                    </p>
                    <div className="animate-pulse">
                      <Progress value={100} className="w-full" />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const currentQ = getCurrentQuestion();
  const currentAnswer = getCurrentAnswer();
  
  if (!currentQ) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold">English Prosody Placement Test</h1>
            <p className="text-muted-foreground">
              Question {currentQuestion + 1} of {questions.length}
            </p>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
                <p className="text-destructive text-sm">{error}</p>
                <Button variant="outline" size="sm" onClick={clearError} className="mt-2">
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

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

        {/* Question Card */}
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {currentQ.type === 'multiple-choice' && <MessageCircle className="w-5 h-5 inline mr-2" />}
                  {currentQ.type === 'audio-response' && <Mic className="w-5 h-5 inline mr-2" />}
                  {currentQ.type === 'reading' && <Mic className="w-5 h-5 inline mr-2" />}
                  {currentQ.question}
                </CardTitle>
                <Badge variant="outline">{currentQ.topic}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentQ.type === 'multiple-choice' && currentQ.options && (
                <>
                  <RadioGroup 
                    value={currentAnswer ? currentAnswer.answer.toString() : selectedOption} 
                    onValueChange={setSelectedOption}
                    disabled={isLoading}
                  >
                    {currentQ.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  
                  <div className="flex gap-2">
                    {currentQuestion > 0 && (
                      <Button
                        onClick={previousQuestion}
                        variant="outline"
                        className="flex-1"
                        disabled={isLoading}
                      >
                        Previous
                      </Button>
                    )}
                    
                    <Button
                      onClick={currentQuestion === questions.length - 1 ? handleComplete : handleMultipleChoiceNext}
                      disabled={!selectedOption && !currentAnswer}
                      className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" />
                      ) : currentQuestion === questions.length - 1 ? (
                        'Complete Test'
                      ) : (
                        'Next Question'
                      )}
                    </Button>
                  </div>
                </>
              )}

              {(currentQ.type === 'audio-response' || currentQ.type === 'reading') && (
                <div className="space-y-4">
                  {currentQ.expectedResponse && currentQ.type === 'reading' && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium mb-2">Text to read:</p>
                      <p className="italic">"{currentQ.expectedResponse}"</p>
                    </div>
                  )}
                  
                  <RecordingControls
                    onSendMessage={(message) => handleAudioResponse(message)}
                    disabled={isLoading}
                  />
                  
                  <div className="flex gap-2">
                    {currentQuestion > 0 && (
                      <Button
                        onClick={previousQuestion}
                        variant="outline"
                        className="flex-1"
                        disabled={isLoading}
                      >
                        Previous
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      onClick={() => handleAudioResponse("Skipped audio response")}
                      className="flex-1"
                      disabled={isLoading}
                    >
                      Skip This Question
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Skip Test Option */}
        <div className="text-center">
          <Button variant="link" onClick={handleSkip} disabled={isLoading}>
            Skip placement test and start with Beginner level
          </Button>
        </div>
      </div>
    </div>
  );
}