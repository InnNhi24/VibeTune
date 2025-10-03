/**
 * VibeTune Speech Service
 * 
 * Integrates Deepgram API for high-quality speech-to-text transcription
 * with prosody analysis capabilities for English learning
 */

import { projectId, publicAnonKey } from '../utils/supabase/info';

interface TranscriptionResult {
  text: string;
  confidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
  prosody_hints?: {
    pace: 'slow' | 'normal' | 'fast';
    volume: 'quiet' | 'normal' | 'loud';
    clarity: 'poor' | 'fair' | 'good' | 'excellent';
  };
}

interface SpeechServiceError {
  error: string;
  code?: string;
  details?: string;
}

export class SpeechService {
  private static readonly API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b2083953`;

  /**
   * Transcribe audio using Deepgram API
   */
  static async transcribeAudio(
    audioBlob: Blob,
    options: {
      language?: string;
      model?: 'nova-2' | 'nova' | 'enhanced' | 'base';
      smart_format?: boolean;
      punctuate?: boolean;
      profanity_filter?: boolean;
      redact?: string[];
    } = {}
  ): Promise<{ data: TranscriptionResult; error?: string }> {
    try {
      // Get auth token for authenticated requests
      const authToken = await this.getAuthToken();
      
      // Prepare form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('options', JSON.stringify({
        language: options.language || 'en',
        model: options.model || 'nova-2',
        smart_format: options.smart_format !== false,
        punctuate: options.punctuate !== false,
        profanity_filter: options.profanity_filter || false,
        redact: options.redact || [],
        // Prosody-specific options
        diarize: false, // Single speaker for language learning
        utterances: true, // Get timing information
        detect_language: false // We know it's English learning
      }));

      const response = await fetch(`${this.API_BASE}/api/speech/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Transcription failed: ${response.status}`);
      }

      const result = await response.json();
      return { data: result.data };

    } catch (error) {
      console.error('Speech transcription error:', error);
      return { 
        data: { text: '', confidence: 0, words: [] }, 
        error: error instanceof Error ? error.message : 'Transcription failed'
      };
    }
  }

  /**
   * Convert text to speech (for AI responses)
   */
  static async synthesizeSpeech(
    text: string,
    options: {
      voice?: string;
      speed?: number;
      pitch?: number;
    } = {}
  ): Promise<{ data: Blob | null; error?: string }> {
    try {
      const authToken = await this.getAuthToken();

      const response = await fetch(`${this.API_BASE}/api/speech/synthesize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice: options.voice || 'en-US-Standard-A',
          speed: options.speed || 1.0,
          pitch: options.pitch || 0.0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Speech synthesis failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      return { data: audioBlob };

    } catch (error) {
      console.error('Speech synthesis error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Speech synthesis failed'
      };
    }
  }

  /**
   * Analyze speech prosody patterns
   */
  static async analyzeSpeechProsody(
    audioBlob: Blob,
    expectedText?: string
  ): Promise<{ data: any; error?: string }> {
    try {
      const authToken = await this.getAuthToken();
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      if (expectedText) {
        formData.append('expected_text', expectedText);
      }

      const response = await fetch(`${this.API_BASE}/api/speech/analyze-prosody`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Prosody analysis failed: ${response.status}`);
      }

      const result = await response.json();
      return { data: result.data };

    } catch (error) {
      console.error('Prosody analysis error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Prosody analysis failed'
      };
    }
  }

  /**
   * Get current auth token (helper method)
   */
  private static async getAuthToken(): Promise<string> {
    // Try to get session token from local auth
    try {
      const session = await this.getCurrentSession();
      return session?.access_token || publicAnonKey;
    } catch {
      return publicAnonKey;
    }
  }

  /**
   * Get current session (helper method)
   */
  private static async getCurrentSession(): Promise<any> {
    // This would integrate with your auth service
    // For now, return public anon key
    return { access_token: publicAnonKey };
  }

  /**
   * Check if speech services are available
   */
  static async checkServiceHealth(): Promise<{
    available: boolean;
    services: {
      transcription: boolean;
      synthesis: boolean;
      prosody_analysis: boolean;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.API_BASE}/api/speech/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      console.error('Speech service health check failed:', error);
      return {
        available: false,
        services: {
          transcription: false,
          synthesis: false,
          prosody_analysis: false
        },
        error: error instanceof Error ? error.message : 'Service unavailable'
      };
    }
  }
}

export default SpeechService;