/**
 * Live Transcription Service
 * Records audio in small chunks and sends them to backend for real-time transcription
 */
import logger from '../utils/logger';

export type TranscriptionCallback = (text: string, isFinal: boolean) => void;
export type ErrorCallback = (error: string) => void;

export class LiveTranscriptionService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private chunkInterval: number = 2000; // Send chunks every 2 seconds
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onTranscription: TranscriptionCallback | null = null;
  private onError: ErrorCallback | null = null;
  private currentTranscript: string = '';

  /**
   * Start live transcription
   */
  async start(
    onTranscription: TranscriptionCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    this.onTranscription = onTranscription;
    this.onError = onError || null;
    this.currentTranscript = '';

    try {
      // Get microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      this.audioChunks = [];
      this.isRecording = true;

      // Handle data available event
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start();

      // Set up interval to process chunks
      this.intervalId = setInterval(() => {
        this.processChunk();
      }, this.chunkInterval);

    } catch (error) {
      logger.error('Failed to start live transcription:', error);
      if (this.onError) {
        this.onError(error instanceof Error ? error.message : 'Failed to start recording');
      }
    }
  }

  /**
   * Process and send current audio chunk for transcription
   */
  private async processChunk(): Promise<void> {
    if (!this.mediaRecorder || this.audioChunks.length === 0) {
      return;
    }

    // Stop and restart to get a chunk
    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();

      // Wait a bit for the data to be available
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create blob from chunks
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      this.audioChunks = [];

      // Send for transcription
      this.transcribeChunk(audioBlob);

      // Restart recording if still in recording mode
      if (this.isRecording) {
        this.mediaRecorder.start();
      }
    }
  }

  /**
   * Send audio chunk to backend for transcription
   */
  private async transcribeChunk(audioBlob: Blob): Promise<void> {
    try {
      // Convert blob to base64
      const base64Audio = await this.blobToBase64(audioBlob);

      // Send to backend
      const response = await fetch('/api/live-transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: base64Audio.split(',')[1], // Remove data:audio/webm;base64, prefix
          format: 'webm'
        })
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.transcript && data.transcript.trim()) {
        // Append to current transcript
        this.currentTranscript += (this.currentTranscript ? ' ' : '') + data.transcript;
        
        // Call callback with updated transcript
        if (this.onTranscription) {
          this.onTranscription(this.currentTranscript, data.is_final || false);
        }
      }

    } catch (error) {
      logger.error('Transcription error:', error);
      if (this.onError) {
        this.onError(error instanceof Error ? error.message : 'Transcription failed');
      }
    }
  }

  /**
   * Convert Blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Stop live transcription
   */
  async stop(): Promise<string> {
    this.isRecording = false;

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Process remaining chunks
    await this.processChunk();

    // Stop media recorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }

    const finalTranscript = this.currentTranscript;
    this.currentTranscript = '';

    return finalTranscript;
  }

  /**
   * Check if currently recording
   */
  isActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get current transcript
   */
  getCurrentTranscript(): string {
    return this.currentTranscript;
  }
}

// Export singleton instance
export const liveTranscriptionService = new LiveTranscriptionService();
