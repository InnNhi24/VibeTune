import type { VercelRequest, VercelResponse } from '@vercel/node';

// Use OpenAI for final-file transcription. Disable bodyParser to read raw audio stream.
export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

    // Read raw request body
    const chunks: Buffer[] = [];
    for await (const chunk of (req as any)) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);
    if (!buf || buf.length === 0) return res.status(400).json({ error: 'Empty audio buffer' });

    // Determine content type from header (fallback to audio/webm)
    const contentType = String(req.headers['content-type'] || 'audio/webm');

    // Build multipart/form-data using Web FormData / Blob (Node 18+)
    const form = new FormData();
    // Node's global Blob supports constructing from Buffer
    const blob = new Blob([buf], { type: contentType });
    form.append('file', blob, 'speech.webm');
    form.append('model', 'whisper-1');
    form.append('language', 'en'); // Force English transcription only

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
    return res.status(200).json({ text });
  } catch (e: any) {
    console.error('transcribe handler error', e?.message || e);
    return res.status(500).json({ error: 'transcribe failed', detail: e?.message || String(e) });
  }
}
