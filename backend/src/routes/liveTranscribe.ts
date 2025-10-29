import { Request, Response } from 'express';

// Migrate live transcribe to OpenAI (accept raw binary body from frontend blobs)
const liveTranscribeRoute = async (req: Request, res: Response) => {
  try {
    // Read raw request body into a single Buffer (works for audio/* POSTs)
    const chunks: Buffer[] = [];
    for await (const chunk of (req as any)) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);

    if (!buf || buf.length === 0) {
      return res.status(400).json({ error: 'Empty audio buffer' });
    }

    const contentType = String(req.headers['content-type'] || 'audio/webm');

    // Build multipart/form-data using global FormData/Blob (Node 18+ / undici)
    const form = new FormData();
    const blob = new Blob([buf], { type: contentType });
    form.append('file', blob, 'chunk.webm');
    form.append('model', 'gpt-4o-mini-transcribe');

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      console.error('OPENAI_API_KEY not configured');
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`
        // note: do not set Content-Type; fetch will add correct multipart boundary header for FormData
      } as any,
      body: form as any
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error('OpenAI transcribe error', resp.status, detail);
      return res.status(502).json({ error: 'OpenAI transcription failed', detail });
    }

    const json = await resp.json();
    const text = json?.text || json?.transcript || '';

    return res.status(200).json({ transcript: text, is_final: true });
  } catch (error: any) {
    console.error('Live transcribe error:', error?.message || error);
    return res.status(500).json({ error: 'Transcription failed', details: error?.message || String(error) });
  }
};

export default liveTranscribeRoute;
