import { useState, useCallback } from 'react';
import { supabase, Profile } from '../services/supabaseClient';
import { AudioAnalysisService } from '../services/apiAnalyzeAudio';

interface PlacementTestQuestion {
  id: number;
  type: 'multiple-choice' | 'audio-response' | 'reading';
  topic: string;
  question: string;
  options?: string[];
  correctAnswer?: number;
  expectedResponse?: string;
  points: number;
}

interface PlacementTestState {
  questions: PlacementTestQuestion[];
  currentQuestion: number;
  answers: Array<{ questionId: number; answer: string | number; score?: number }>;
  isLoading: boolean;
  error: string | null;
  timeRemaining: number;
  isCompleted: boolean;
  results: {
    score: number;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    breakdown: {
      pronunciation: number;
      intonation: number;
      rhythm: number;
      vocabulary: number;
    };
  } | null;
}

const placementTestQuestions: PlacementTestQuestion[] = [
  {
    id: 1,
    type: 'multiple-choice',
    topic: 'Basic Stress Patterns',
    question: 'Which syllable is stressed in the word "important"?',
    options: ['im-POR-tant', 'IM-por-tant', 'im-por-TANT', 'All syllables equally'],
    correctAnswer: 1,
    points: 10
  },
  {
    id: 2,
    type: 'audio-response',
    topic: 'Sentence Stress',
    question: 'Read this sentence with natural stress: "I REALLY need to finish this project TODAY."',
    expectedResponse: 'I REALLY need to finish this project TODAY.',
    points: 20
  },
  {
    id: 3,
    type: 'multiple-choice',
    topic: 'Intonation Patterns',
    question: 'In yes/no questions, the intonation typically:',
    options: ['Falls at the end', 'Rises at the end', 'Stays flat', 'Varies randomly'],
    correctAnswer: 1,
    points: 10
  },
  {
    id: 4,
    type: 'audio-response',
    topic: 'Question Intonation',
    question: 'Ask this question with proper intonation: "Are you coming to the meeting?"',
    expectedResponse: 'Are you coming to the meeting?',
    points: 20
  },
  {
    id: 5,
    type: 'reading',
    topic: 'Connected Speech',
    question: 'Read this paragraph naturally, paying attention to linking and rhythm:',
    expectedResponse: 'English pronunciation involves more than just individual sounds. The rhythm, stress, and intonation patterns work together to create natural, fluent speech that listeners can easily understand.',
    points: 25
  },
  {
    id: 6,
    type: 'multiple-choice',
    topic: 'Word Stress',
    question: 'Which word has the stress on the FIRST syllable?',
    options: ['photograph', 'photography', 'photographer', 'photographic'],
    correctAnswer: 0,
    points: 10
  },
  {
    id: 7,
    type: 'audio-response',
    topic: 'Emotion and Intonation',
    question: 'Say "That\'s interesting" to express genuine curiosity (not sarcasm).',
    expectedResponse: 'That\'s interesting',
    points: 15
  }
];

export function usePlacementTest(user: Profile | null) {
  const [state, setState] = useState<PlacementTestState>({
    questions: placementTestQuestions,
    currentQuestion: 0,
    answers: [],
    isLoading: false,
    error: null,
    timeRemaining: 900, // 15 minutes
    isCompleted: false,
    results: null
  });

  // Start placement test
  const startTest = useCallback(async () => {
    if (!user) return;

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      currentQuestion: 0,
      answers: [],
      isCompleted: false,
      results: null,
      timeRemaining: 900
    }));

    try {
      // Record test start in analytics
      await supabase.from('analytics_events').insert({
        profile_id: user.id,
        event_type: 'placement_test_started',
        metadata: {
          question_count: placementTestQuestions.length,
          timestamp: new Date().toISOString()
        }
      });

      setState(prev => ({ ...prev, isLoading: false }));

      // Start timer
      const timer = setInterval(() => {
        setState(prev => {
          if (prev.timeRemaining <= 1) {
            clearInterval(timer);
            completeTest();
            return { ...prev, timeRemaining: 0 };
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting placement test:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to start placement test',
        isLoading: false
      }));
    }
  }, [user]);

  // Answer multiple choice question
  const answerMultipleChoice = useCallback((questionId: number, answerIndex: number) => {
    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;

    const isCorrect = question.correctAnswer === answerIndex;
    const score = isCorrect ? question.points : 0;

    setState(prev => ({
      ...prev,
      answers: [
        ...prev.answers.filter(a => a.questionId !== questionId),
        { questionId, answer: answerIndex, score }
      ]
    }));
  }, [state.questions]);

  // Answer audio response question
  const answerAudioResponse = useCallback(async (questionId: number, audioResponse: string) => {
    if (!user) return;

    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Analyze audio response
      const { data: analysis } = await AudioAnalysisService.analyzeAudio({
        text: audioResponse,
        level: 'Assessment', // Special level for placement test
        context: question.topic
      });

      let score = 0;
      if (analysis) {
        // Calculate score based on prosody analysis
        score = Math.round((analysis.overallScore / 100) * question.points);
      }

      setState(prev => ({
        ...prev,
        answers: [
          ...prev.answers.filter(a => a.questionId !== questionId),
          { questionId, answer: audioResponse, score }
        ],
        isLoading: false
      }));

    } catch (error) {
      console.error('Error analyzing audio response:', error);
      // Give partial credit for attempt
      setState(prev => ({
        ...prev,
        answers: [
          ...prev.answers.filter(a => a.questionId !== questionId),
          { questionId, answer: audioResponse, score: Math.round(question.points * 0.5) }
        ],
        isLoading: false
      }));
    }
  }, [user, state.questions]);

  // Go to next question
  const nextQuestion = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentQuestion: Math.min(prev.currentQuestion + 1, prev.questions.length - 1)
    }));
  }, []);

  // Go to previous question
  const previousQuestion = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentQuestion: Math.max(prev.currentQuestion - 1, 0)
    }));
  }, []);

  // Complete test
  const completeTest = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Calculate results
      const totalScore = state.answers.reduce((sum, answer) => sum + (answer.score || 0), 0);
      const maxScore = state.questions.reduce((sum, question) => sum + question.points, 0);
      const percentage = Math.round((totalScore / maxScore) * 100);

      // Determine level
      let level: 'Beginner' | 'Intermediate' | 'Advanced' = 'Beginner';
      if (percentage >= 80) level = 'Advanced';
      else if (percentage >= 60) level = 'Intermediate';

      // Calculate breakdown scores (mock implementation)
      const breakdown = {
        pronunciation: Math.min(100, percentage + Math.random() * 10 - 5),
        intonation: Math.min(100, percentage + Math.random() * 10 - 5),
        rhythm: Math.min(100, percentage + Math.random() * 10 - 5),
        vocabulary: Math.min(100, percentage + Math.random() * 10 - 5)
      };

      const results = {
        score: percentage,
        level,
        breakdown
      };

      // Update user profile with new level
      await supabase
        .from('profiles')
        .update({ level })
        .eq('id', user.id);

      // Record test completion
      await supabase.from('analytics_events').insert({
        profile_id: user.id,
        event_type: 'placement_test_completed',
        metadata: {
          score: percentage,
          level,
          answers: state.answers,
          time_taken: 900 - state.timeRemaining,
          breakdown,
          timestamp: new Date().toISOString()
        }
      });

      setState(prev => ({
        ...prev,
        isCompleted: true,
        results,
        isLoading: false
      }));

    } catch (error) {
      console.error('Error completing placement test:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to save test results',
        isLoading: false
      }));
    }
  }, [user, state.answers, state.questions, state.timeRemaining]);

  // Skip test
  const skipTest = useCallback(async () => {
    if (!user) return;

    try {
      // Record test skip
      await supabase.from('analytics_events').insert({
        profile_id: user.id,
        event_type: 'placement_test_skipped',
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

      setState(prev => ({
        ...prev,
        isCompleted: true,
        results: {
          score: 0,
          level: 'Beginner',
          breakdown: {
            pronunciation: 0,
            intonation: 0,
            rhythm: 0,
            vocabulary: 0
          }
        }
      }));

    } catch (error) {
      console.error('Error recording test skip:', error);
    }
  }, [user]);

  // Get current question
  const getCurrentQuestion = useCallback(() => {
    return state.questions[state.currentQuestion];
  }, [state.questions, state.currentQuestion]);

  // Get answer for current question
  const getCurrentAnswer = useCallback(() => {
    const currentQ = getCurrentQuestion();
    return state.answers.find(a => a.questionId === currentQ?.id);
  }, [state.answers, getCurrentQuestion]);

  // Calculate progress
  const getProgress = useCallback(() => {
    return Math.round(((state.currentQuestion + 1) / state.questions.length) * 100);
  }, [state.currentQuestion, state.questions.length]);

  return {
    ...state,
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
    clearError: () => setState(prev => ({ ...prev, error: null }))
  };
}