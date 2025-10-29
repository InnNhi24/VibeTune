/**
 * Live Transcription Service
 * Records audio in small chunks and sends them to backend for real-time transcription
 */
import logger from '../utils/logger';

export type TranscriptionCallback = (text: string, isFinal: boolean) => void;
export type ErrorCallback = (error: string) => void;

export class LiveTranscriptionService {
  private mediaRecorder: MediaRecorder | null = null;
  private isRecording = false;
  private chunkInterval: number = 2000; // Send chunks every 2 seconds
  private mediaMimeType: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onTranscription: TranscriptionCallback | null = null;
  private onError: ErrorCallback | null = null;
  private currentTranscript: string = '';
  // Track pending transcribe promises so stop() can wait for them
  private pendingTranscribes: Set<Promise<void>> = new Set();

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

      // Create MediaRecorder with mimeType fallbacks and use timeslice-based chunks
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        '' // let browser choose
      ];

      let mr: MediaRecorder | null = null;
      let lastErr: any = null;
      for (const c of candidates) {
        try {
          mr = c ? new MediaRecorder(stream, { mimeType: c }) : new MediaRecorder(stream);
          // record which mimeType succeeded (strip any codecs when sending header later)
          this.mediaMimeType = c || null;
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!mr) throw lastErr || new Error('MediaRecorder not supported');

      this.mediaRecorder = mr;
      this.isRecording = true;

      // Handle data available by sending each chunk immediately
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          // send chunk immediately for transcription and track the promise
          const p = this.transcribeChunk(event.data)
            .catch((e) => {
              logger.error('transcribeChunk error (ondataavailable)', e);
              if (this.onError) this.onError(e instanceof Error ? e.message : String(e));
            })
            .then(() => {
              // remove from pending set when done
              this.pendingTranscribes.delete(p);
            });

          this.pendingTranscribes.add(p);
        }
      };

      this.mediaRecorder.onerror = (e: any) => {
        logger.error('MediaRecorder error', e);
        if (this.onError) this.onError(e?.error || e?.message || 'MediaRecorder error');
      };

  // prefer smaller chunks to avoid large uploads; 1s chunks are reasonable
  this.chunkInterval = 1000;
  // start with a timeslice so ondataavailable fires periodically
  this.mediaRecorder.start(this.chunkInterval);

    } catch (error) {
      logger.error('Failed to start live transcription:', error);
      if (this.onError) {
        this.onError(error instanceof Error ? error.message : 'Failed to start recording');
      }
    }
  }

  // (processChunk was removed; timeslice ondataavailable sends chunks directly)

  /**
   * Send audio chunk to backend for transcription
   */
  private async transcribeChunk(audioBlob: Blob): Promise<void> {
    try {
      // Send raw blob to backend (prefer raw binary over base64)
      // Use the detected mime type (including codecs) so the server/Deepgram
      // knows the correct container and codec. Stripping codecs can make
      // the audio appear corrupt/unsupported to the ASR service.
      const detectedMime = this.mediaMimeType || audioBlob.type || 'audio/webm';
      const contentTypeHeader = String(detectedMime);

      // Helpful debug: log the outgoing chunk size and content-type
      try {
        // eslint-disable-next-line no-console
        console.debug('transcribeChunk: size=', audioBlob.size, 'content-type=', contentTypeHeader);
      } catch (e) {}

      const response = await fetch('/api/live-transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': contentTypeHeader,
        },
        body: audioBlob,
      });

      if (!response.ok) {
        // read response body (may contain Deepgram/server error details) to help debugging
        let detail = '';
        try {
          detail = await response.text();
        } catch {}
        throw new Error(`Transcription failed: ${response.status}${detail ? ' - ' + detail : ''}`);
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
  // blobToBase64 removed: service now sends raw blobs to the server for efficiency

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

    // Stop media recorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }

    // Wait for any in-flight transcribeChunk requests to finish
    if (this.pendingTranscribes.size > 0) {
      try {
        await Promise.all(Array.from(this.pendingTranscribes));
      } catch (e) {
        // individual errors were already handled per-promise; swallow here
      }
      this.pendingTranscribes.clear();
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
