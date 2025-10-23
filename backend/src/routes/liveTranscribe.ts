import { Request, Response } from 'express';
import deepgram from '../clients/deepgram';
import { Readable } from 'stream';

const liveTranscribeRoute = async (req: Request, res: Response) => {
  try {
    // Expect audio data in the request body (as base64 or buffer)
    const { audioData, format = 'webm' } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Missing audio data' });
    }

    // Convert base64 to buffer if needed
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Create a readable stream from the buffer
    const audioStream = Readable.from(audioBuffer);

    // Use Deepgram prerecorded API with low latency settings
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        smart_format: true,
        language: 'en',
        punctuate: true,
        interim_results: false,
      }
    );

    if (error) {
      console.error('Deepgram transcription error:', error);
      return res.status(502).json({ error: 'Transcription failed', details: error.message });
    }

    const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';
    const confidence = result.results?.channels[0]?.alternatives[0]?.confidence || 0;

    res.json({
      transcript,
      confidence,
      is_final: true
    });

  } catch (error) {
    console.error('Live transcribe error:', error);
    res.status(500).json({ 
      error: 'Transcription failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export default liveTranscribeRoute;
