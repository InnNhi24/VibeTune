import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Fail-fast in production if key missing
if (process.env.NODE_ENV === 'production' && !process.env.OPENAI_API_KEY) {
  console.error('CRITICAL: OPENAI_API_KEY not set in production!');
}

const UP_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
async function rateLimit(ip: string, key = 'chat', limit = 60, windowSec = 60) {
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
  const startTime = Date.now();
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (process.env.NODE_ENV === 'production' && !(process.env.ALLOWED_ORIGINS || '').trim()) {
    return res.status(403).json({ error: 'CORS not configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.socket as any)?.remoteAddress ||
      'unknown';
    const rl = await rateLimit(ip, 'chat', 60, 60);
    if (!rl.ok) return res.status(429).json({ error: 'Too many requests' });

    const body = (req.body || {}) as { text?: string; level?: string; lastMistakes?: string[]; profileId?: string };
    const text = (body.text || '').trim();
    const level = body.level || 'A2';
    const lastMistakes = Array.isArray(body.lastMistakes) ? body.lastMistakes : [];

    if (!text) return res.status(400).json({ error: 'text is required' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `You are VibeTune. Return JSON: {replyText, feedback, tags}. CEFR=${level}. Keep feedback <=30 words.`;

    const task = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `User: "${text}". Recent mistakes: ${JSON.stringify(lastMistakes)}` }
      ]
    });

    const completion: any = await Promise.race([
      task,
      new Promise((_, rej) => setTimeout(() => rej(new Error('OpenAI timeout')), 25000))
    ]);

    let data: any = {};
    try {
      data = JSON.parse(completion?.choices?.[0]?.message?.content || '{}');
    } catch {
      data = { replyText: completion?.choices?.[0]?.message?.content || '', feedback: '' };
    }

    const replyText = data.replyText || '';
    const feedback = data.feedback || '';
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const guidance = data.guidance ?? feedback;

    console.log(JSON.stringify({ lvl: 'info', ts: new Date().toISOString(), endpoint: '/api/chat', ip, node_env: process.env.NODE_ENV, text_len: text.length, duration_ms: Date.now() - startTime }));

    return res.status(200).json({ ok: true, replyText, feedback, guidance, tags });
  } catch (e: any) {
    console.error(JSON.stringify({ lvl: 'error', ts: new Date().toISOString(), endpoint: '/api/chat', err: e?.message }));
    return res.status(500).json({ error: 'chat failed', detail: e?.message });
  }
}
import serverless from 'serverless-http';
import app from '../backend/src/index';

// Vercel only accepts 'nodejs' | 'edge' | 'experimental-edge'
export const config = { runtime: 'nodejs' };
export default serverless(app);

