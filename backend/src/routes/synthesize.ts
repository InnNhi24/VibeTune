import { Request, Response } from 'express';

// Simple TTS proxy that forwards text to OpenAI's TTS endpoint and streams audio back.
// Expects JSON body: { text: string, voice?: string, speed?: number, pitch?: number }
const synthesizeRoute = async (req: Request, res: Response) => {
  try {
    const { text, voice, speed, pitch } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    const model = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
    const chosenVoice = voice || process.env.TTS_DEFAULT_VOICE || 'alloy';

    if (!OPENAI_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured on server' });
    }

    // Call OpenAI TTS endpoint
    const endpoint = 'https://api.openai.com/v1/audio/speech';

    const body = {
      model,
      voice: chosenVoice,
      input: text,
      // Optional params; provider-specific
      speed: speed || 1.0,
      pitch: pitch || 0.0,
    } as any;

    const r = await globalThis.fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const textResp = await r.text().catch(() => '');
      return res.status(502).json({ error: 'TTS provider error', details: textResp || r.statusText });
    }

    // Stream audio bytes back to client with appropriate content-type
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');

    // Pipe response body (node-fetch Body) to Express response
    const reader = (r.body as any).getReader?.();
    if (reader) {
      // ReadableStream (web) style
      const stream = new (require('stream').Readable)({ read() {} });
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          stream.push(Buffer.from(value));
        }
        stream.push(null);
      };
      pump().catch(() => {});
      stream.pipe(res);
      return;
    }

    // Fallback: buffer the whole body then send
    const buffer = await (r as any).arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (error: any) {
    console.error('Synthesize error:', error);
    res.status(500).json({ error: 'Synthesis failed', details: error?.message });
  }
};

export default synthesizeRoute;
