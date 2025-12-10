import type { VercelRequest, VercelResponse } from '@vercel/node';

// Use OpenAI for final-file transcription. Disable bodyParser to read raw audio stream.
export const config = { api: { bodyParser: false } };

// Rate limiting setup
const UP_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function rateLimit(ip: string, limit = 100, windowSec = 60) {
  if (!UP_URL || !UP_TOKEN) return { ok: true, remaining: -1 };
  const rk = `rl:transcribe:${ip}`;
  try {
    const incr = await fetch(`${UP_URL}/incr/${encodeURIComponent(rk)}`, {
      headers: { Authorization: `Bearer ${UP_TOKEN}` }
    });
    const count = Number(await incr.text());
    if (count === 1) {
      await fetch(`${UP_URL}/expire/${encodeURIComponent(rk)}/${windowSec}`, {
        headers: { Authorization: `Bearer ${UP_TOKEN}` }
      });
    }
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return { ok: true, remaining: -1 };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limiting
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
  const rl = await rateLimit(ip, 100, 60);
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', rl.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000 + 60).toString());
  
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests' });

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
