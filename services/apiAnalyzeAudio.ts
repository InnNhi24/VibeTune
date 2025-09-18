// Import supabase for auth token
import { supabase } from './supabaseClient';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface ProsodyAnalysis {
  prosodyErrors: Array<{
    type: 'intonation' | 'stress' | 'rhythm';
    score: number;
    location?: string;
    suggestion?: string;
  }>;
  vocabSuggestions: string[];
  guidance: string;
  overallScore: number;
  transcript?: string;
}

interface AnalyzeAudioRequest {
  audioBlob?: Blob;
  text?: string;
  level: string;
  context?: string;
}

export class AudioAnalysisService {
  private static readonly API_ENDPOINT = `https://${projectId}.supabase.co/functions/v1/make-server-b2083953/analyze-audio`;
  private static readonly RATE_LIMIT_KEY = 'audio_analysis_rate_limit';
  private static readonly MAX_REQUESTS_PER_MINUTE = 20;

  static async analyzeAudio({
    audioBlob,
    text,
    level,
    context
  }: AnalyzeAudioRequest): Promise<{ data: ProsodyAnalysis | null; error: any }> {
    try {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw new Error('Rate limit exceeded. Please wait before making another request.');
      }

      const formData = new FormData();
      
      if (audioBlob) {
        formData.append('audio', audioBlob, 'recording.wav');
      }
      
      if (text) {
        formData.append('text', text);
      }
      
      formData.append('level', level);
      formData.append('context', context || 'general');

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('API rate limit exceeded. Please try again later.');
        }
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update rate limit tracking
      this.updateRateLimit();
      
      return { data, error: null };
    } catch (error) {
      console.error('Audio analysis error:', error);
      
      // Return mock data for development/fallback
      const mockData = this.generateMockAnalysis(text || '', level);
      return { data: mockData, error };
    }
  }

  static async streamTranscription(
    audioStream: MediaStream,
    onTranscript: (transcript: { text: string; isFinal: boolean; confidence: number }) => void,
    onError: (error: any) => void
  ) {
    try {
      // This would typically use WebRTC or Socket.IO for real-time transcription
      // For now, we'll simulate with mock data
      let mockText = '';
      const words = ['I', 'think', 'learning', 'English', 'pronunciation', 'is', 'very', 'important'];
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        mockText += (i > 0 ? ' ' : '') + words[i];
        
        onTranscript({
          text: mockText,
          isFinal: i === words.length - 1,
          confidence: 0.85 + Math.random() * 0.15
        });
      }
    } catch (error) {
      onError(error);
    }
  }

  private static checkRateLimit(): boolean {
    const now = Date.now();
    const rateData = localStorage.getItem(this.RATE_LIMIT_KEY);
    
    if (!rateData) return true;
    
    const { count, windowStart } = JSON.parse(rateData);
    const windowDuration = 60 * 1000; // 1 minute
    
    if (now - windowStart > windowDuration) {
      return true; // Reset window
    }
    
    return count < this.MAX_REQUESTS_PER_MINUTE;
  }

  private static updateRateLimit() {
    const now = Date.now();
    const rateData = localStorage.getItem(this.RATE_LIMIT_KEY);
    
    if (!rateData) {
      localStorage.setItem(this.RATE_LIMIT_KEY, JSON.stringify({
        count: 1,
        windowStart: now
      }));
      return;
    }
    
    const { count, windowStart } = JSON.parse(rateData);
    const windowDuration = 60 * 1000; // 1 minute
    
    if (now - windowStart > windowDuration) {
      localStorage.setItem(this.RATE_LIMIT_KEY, JSON.stringify({
        count: 1,
        windowStart: now
      }));
    } else {
      localStorage.setItem(this.RATE_LIMIT_KEY, JSON.stringify({
        count: count + 1,
        windowStart
      }));
    }
  }

  private static async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || publicAnonKey;
  }

  private static generateMockAnalysis(text: string, level: string): ProsodyAnalysis {
    const words = text.toLowerCase().split(' ');
    const score = Math.floor(Math.random() * 30) + 70; // 70-100%
    
    const prosodyErrors = [];
    const vocabSuggestions = [];
    
    // Mock prosody analysis based on level and content
    if (level === 'Beginner') {
      if (words.includes('really') || words.includes('very')) {
        prosodyErrors.push({
          type: 'stress' as const,
          score: 0.6,
          location: 'really',
          suggestion: 'Emphasize this word with rising stress'
        });
      }
    } else if (level === 'Intermediate') {
      prosodyErrors.push({
        type: 'intonation' as const,
        score: 0.75,
        suggestion: 'Try varying your pitch more throughout the sentence'
      });
    }
    
    // Add vocabulary suggestions for complex words
    words.forEach(word => {
      if (word.length > 8) {
        vocabSuggestions.push(word);
      }
    });
    
    return {
      prosodyErrors,
      vocabSuggestions: vocabSuggestions.slice(0, 3),
      guidance: this.generateGuidance(score, level),
      overallScore: score,
      transcript: text
    };
  }

  private static generateGuidance(score: number, level: string): string {
    const guidanceOptions = {
      high: [
        "Excellent prosody! Your rhythm and intonation are very natural.",
        "Great job with word stress patterns. Keep practicing!",
        "Your speech sounds very confident and clear."
      ],
      medium: [
        "Good effort! Try to focus more on sentence-level intonation.",
        "Your pronunciation is clear. Work on varying your pitch more.",
        "Nice rhythm! Pay attention to stressed syllables in longer words."
      ],
      low: [
        "Keep practicing! Focus on one aspect at a time - start with word stress.",
        "Take your time with pronunciation. Slow, clear speech is better than fast, unclear speech.",
        "Listen to native speakers and try to mimic their intonation patterns."
      ]
    };
    
    const category = score >= 85 ? 'high' : score >= 70 ? 'medium' : 'low';
    const options = guidanceOptions[category];
    return options[Math.floor(Math.random() * options.length)];
  }
}