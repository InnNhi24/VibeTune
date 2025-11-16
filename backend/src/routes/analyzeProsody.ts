import { Request, Response } from 'express';
const multer: any = require('multer'); // Use require for multer to avoid TypeScript resolution issues when types aren't installed in all envs
import openai from '../clients/openai';

const upload = multer({ storage: multer.memoryStorage() });

// Helper: simple fallback prosody analysis
function mockProsodyAnalysis(text: string) {
  return {
    scores: { pronunciation: 70, rhythm: 65, intonation: 68 },
    notes: `Short analysis for: ${text.slice(0, 120)}`,
    suggestions: [
      'Slow down slightly at clause boundaries',
      'Raise intonation on questions',
    ],
  };
}

// We'll export middleware compatible handler generator so we can attach multer
const analyzeProsodyHandler = async (req: Request, res: Response) => {
  try {
    // multer has put file on req.file
    const file = (req as any).file;
    const expectedText = req.body?.expected_text || req.body?.expectedText || '';

    if (!file || !file.buffer) {
      // also accept base64 in JSON body: { audioData: 'base64...' }
      const { audioData } = req.body || {};
      if (!audioData) {
        return res.status(400).json({ error: 'Audio file or audioData (base64) is required' });
      }
      // convert base64
      const audioBuffer = Buffer.from(audioData, 'base64');
      // transcribe via OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: new File([audioBuffer], 'audio.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });

      const transcript = {
        transcript: transcription.text,
        confidence: 1.0, // OpenAI doesn't provide confidence scores
        words: transcription.words || []
      };

      // If OpenAI configured, call it for analysis
      const OPENAI_KEY = process.env.OPENAI_API_KEY;
      if (OPENAI_KEY && transcript?.transcript) {
        try {
          const prompt = `Analyze the speech prosody for this transcribed text:\n\n${transcript.transcript}\n\nExpected text: ${expectedText || '[none]'}\n\nReturn JSON with scores (0-100) and short actionable feedback.`;

          const r = await globalThis.fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENAI_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are an expert prosody coach. Provide compact JSON analysis.' },
                { role: 'user', content: prompt },
              ],
              temperature: 0.2,
              max_tokens: 800,
            }),
          });

          if (r.ok) {
            const ai: any = await r.json();
            const analysis = ai.choices?.[0]?.message?.content;
            try {
              const parsed = JSON.parse(analysis);
              return res.json({ data: { ...parsed, transcription: transcript.transcript, confidence: transcript.confidence, word_timing: transcript.words }, powered_by: 'Deepgram + OpenAI' });
            } catch (e) {
              // Fall through to fallback
            }
          }
        } catch (err) {
          console.warn('OpenAI prosody call failed', err);
        }
      }

      return res.json({ data: { ...mockProsodyAnalysis(transcript?.transcript || expectedText || 'N/A'), transcription: transcript?.transcript || null, confidence: transcript?.confidence || 0, word_timing: transcript?.words || [] }, note: 'Fallback prosody analysis' });
    }

    // If we have file.buffer (via multer)
    const audioBuffer = file.buffer as Buffer;

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
      model: 'nova-2',
      smart_format: true,
      language: 'en',
      punctuate: true,
      utterances: true,
    });

    if (error) {
      console.warn('Deepgram prosody transcription error', error);
    }

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0];

    // Use OpenAI to analyze if available
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_KEY && transcript?.transcript) {
      try {
        const prompt = `Analyze the speech prosody for this transcribed text:\n\n${transcript.transcript}\n\nExpected text: ${expectedText || '[none]'}\n\nReturn JSON with scores (0-100) and short actionable feedback.`;

        const r = await globalThis.fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert prosody coach. Provide compact JSON analysis.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 800,
          }),
        });

        if (r.ok) {
          const ai: any = await r.json();
          const analysis = ai.choices?.[0]?.message?.content;
          try {
            const parsed = JSON.parse(analysis);
            return res.json({ data: { ...parsed, transcription: transcript.transcript, confidence: transcript.confidence, word_timing: transcript.words }, powered_by: 'Deepgram + OpenAI' });
          } catch (e) {
            // fallback
          }
        }
      } catch (err) {
        console.warn('OpenAI prosody call failed', err);
      }
    }

    // Fallback response
    return res.json({ data: { ...mockProsodyAnalysis(transcript?.transcript || expectedText || 'N/A'), transcription: transcript?.transcript || null, confidence: transcript?.confidence || 0, word_timing: transcript?.words || [] }, note: 'Fallback prosody analysis' });

  } catch (error: any) {
    console.error('Analyze prosody error:', error);
    res.status(500).json({ error: 'Prosody analysis failed', details: error?.message });
  }
};

// Export middleware wrapper to attach multer single file parsing
export const analyzeProsodyMiddleware = [upload.single('audio'), analyzeProsodyHandler];
export default analyzeProsodyHandler;
