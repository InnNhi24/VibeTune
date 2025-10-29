import type { VercelRequest, VercelResponse } from '@vercel/node';

// Disable Vercel body parser so we can accept raw audio binary uploads
// and parse JSON manually when needed.
export const config = {
  api: {
    bodyParser: false
  }
};

const UP_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
async function rateLimit(ip: string, key = 'transcribe', limit = 60, windowSec = 60) {
  if (!UP_URL || !UP_TOKEN) return { ok: true, remaining: -1 };
  const rk = `rl:${key}:${ip}`;
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

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = String(req.headers.origin || '');
  const allow = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (!allow.length) {
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  } else if (allow.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (process.env.NODE_ENV === 'production' && !(process.env.ALLOWED_ORIGINS || '').trim()) {
    return res.status(403).json({ error: 'CORS not configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.DEEPGRAM_API_KEY) {
      return res.status(500).json({ error: 'DEEPGRAM_API_KEY not set' });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.socket as any)?.remoteAddress ||
      'unknown';
    const rl = await rateLimit(ip, 'transcribe', 60, 60);
    if (!rl.ok) return res.status(429).json({ error: 'Too many requests' });

    // Read raw request body (we disabled bodyParser above)
    const getRawBody = async (r: VercelRequest) => {
      const chunks: Buffer[] = [];
      for await (const chunk of (r as any)) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    };

    const raw = await getRawBody(req);

    // Determine content type
    const ctype = String(req.headers['content-type'] || '').toLowerCase();

    let audioBuffer: Buffer | null = null;
    let audioUrl: string | undefined = undefined;

    if (ctype.includes('application/json')) {
      // parse JSON body manually
      try {
        const parsed = JSON.parse(raw.toString('utf8') || '{}');
        // accept either audioBase64 or audioData (older client used audioData)
        const audioBase64 = parsed.audioBase64 || parsed.audioData || parsed.audio;
        audioUrl = parsed.audioUrl || parsed.url;
        if (audioBase64) {
          const base = String(audioBase64).split('base64,').pop() || audioBase64;
          audioBuffer = Buffer.from(base, 'base64');
        }
      } catch (e) {
        console.warn('Failed to parse JSON body for transcribe:', e);
      }
    } else if (ctype.startsWith('audio/') || ctype === 'application/octet-stream') {
      // raw audio bytes
      audioBuffer = raw;
    } else if (raw && raw.length > 0) {
      // Try to interpret as JSON fallback
      try {
        const parsed = JSON.parse(raw.toString('utf8'));
        const audioBase64 = parsed.audioBase64 || parsed.audioData || parsed.audio;
        audioUrl = parsed.audioUrl || parsed.url;
        if (audioBase64) audioBuffer = Buffer.from(String(audioBase64).split('base64,').pop() || audioBase64, 'base64');
      } catch (e) {
        // no-op
      }
    }

    if (!audioUrl && !audioBuffer) return res.status(400).json({ error: 'audioUrl or audioBase64/audioData (base64) or raw audio body is required' });

    const endpoint = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=en';
    const headers: Record<string, string> = { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` };

    let resp: Response;
    if (audioBuffer) {
      // send raw audio bytes to Deepgram
      const contentType = req.headers['content-type'] || 'audio/webm';
      resp = await fetch(endpoint, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': String(contentType) },
        body: audioBuffer as unknown as BodyInit
      });
    } else {
      // url-based upload
      resp = await fetch(endpoint, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: audioUrl })
      });
    }

    if (!resp.ok) return res.status(502).json({ error: 'Deepgram failed', detail: await resp.text() });

    const json: any = await resp.json();
    const transcript = json?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    return res.status(200).json({ ok: true, transcript });
  } catch (e: any) {
    console.error(JSON.stringify({ lvl: 'error', ts: new Date().toISOString(), endpoint: '/api/transcribe', err: e?.message }));
    return res.status(500).json({ error: 'transcribe failed', detail: e?.message });
  }
}
