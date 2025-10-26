import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  const body = (req.body || {}) as {
    text?: string;
    level?: string;
    lastMistakes?: string[];
    profileId?: string;
    conversationId?: string;
    stage?: string; // topic | practice | wrapup
    firstPracticeTurn?: boolean;
    audioUrl?: string;
    deviceId?: string;
    retryOfMessageId?: string;
    version?: number;
  };

  const text = (body.text || '').trim();
  // Normalize level input: accept beginner | intermediate | advanced (case-insensitive)
  const rawLevel = String(body.level || 'beginner').toLowerCase();
  const allowedLevels = ['beginner', 'intermediate', 'advanced'];
  const level = allowedLevels.includes(rawLevel) ? rawLevel : 'beginner';
  const lastMistakes = Array.isArray(body.lastMistakes) ? body.lastMistakes : [];
  const profileId = body.profileId || null;
  const incomingConversationId = body.conversationId || null;
  const stage = String(body.stage || 'practice').toLowerCase();
  const firstPracticeTurn = Boolean(body.firstPracticeTurn);

    if (!text) return res.status(400).json({ error: 'text is required' });

    // ==== Call OpenAI REST API with a hard 9s timeout to avoid Vercel function invocation timeout ====
    const system = `
You are **VibeTune**, an AI pronunciation & prosody coach.

Always return a valid JSON:
{
  "replyText": "...",
  "feedback": "...",
  "tags": ["prosody" | "grammar" | "vocabulary" | "intonation" | "fluency"]
}

The user's selected level is: ${level}.

---

🌱 Beginner Level
Focus: simple stress, clear rhythm, everyday words, short sentences.
Feedback: gentle correction and encouragement ("Good try!", "Focus on stress in *today*").

🎯 Intermediate Level
Focus: sentence stress variety, natural flow, conversational phrases.
Feedback: emphasize rhythm and intonation improvements ("Try rising tone at the end").

🏆 Advanced Level
Focus: subtle nuances, accent refinement, connected speech.
Feedback: concise coaching for native-like sound ("Link words naturally", "Reduce final T").

---

Rules:
- Tailor replyText and feedback to the user level.
- Keep feedback under 30 words.
- Use positive, friendly tone.
- Never repeat the full user text unless correcting pronunciation.
- Keep messages conversational and concise.
`;

    // Abort after 9s to fit within Hobby 10s limit (use AbortController for broad support)
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 9000);

    const payload = {
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 200,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `User: "${text}". Recent mistakes: ${JSON.stringify(lastMistakes)}` }
      ]
    };

    let j: any = {};
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: ac.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        return res.status(502).json({ error: 'openai_failed', detail });
      }

      j = await resp.json();
    } catch (err: any) {
      clearTimeout(timer);
      // Normalize AbortError
      if (err?.name === 'AbortError' || err?.message === 'The user aborted a request.') {
        throw new Error('upstream_timeout');
      }
      throw err;
    }
    let data: any = {};
    try {
      data = JSON.parse(j?.choices?.[0]?.message?.content || '{}');
    } catch {
      data = { replyText: j?.choices?.[0]?.message?.content || '', feedback: '' };
    }

    const replyText = data.replyText || '';
    const feedback = data.feedback || '';
    const tags = Array.isArray(data.tags) ? data.tags : [];
  const guidance = data.guidance ?? feedback;

    console.log(JSON.stringify({ lvl: 'info', ts: new Date().toISOString(), endpoint: '/api/chat', ip, node_env: process.env.NODE_ENV, text_len: text.length, duration_ms: Date.now() - startTime }));

    // ===== Optionally persist conversation + messages to Supabase via REST (service role key) =====
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    let conversationId: string | null = incomingConversationId;

    const supabaseHeaders = SUPABASE_KEY
      ? {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
          Prefer: 'return=representation'
        }
      : null;

    async function supabaseInsert(table: string, rows: any[]) {
      if (!SUPABASE_URL || !SUPABASE_KEY) return null;
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: supabaseHeaders as any,
          body: JSON.stringify(rows)
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => '');
          console.warn('Supabase insert failed', table, r.status, txt);
          return null;
        }
        return await r.json();
      } catch (err) {
        console.warn('Supabase insert error', err);
        return null;
      }
    }

    try {
      // Create conversation row when stage is 'topic' and no incomingConversationId
      if (!conversationId && stage === 'topic' && SUPABASE_URL && SUPABASE_KEY) {
        const convRows = [{ profile_id: profileId, topic: null, is_placement_test: false, started_at: new Date().toISOString() }];
        const inserted = await supabaseInsert('conversations', convRows);
        if (Array.isArray(inserted) && inserted[0] && inserted[0].id) {
          conversationId = inserted[0].id;
        }
      }

      // Insert user message
      if (SUPABASE_URL && SUPABASE_KEY) {
        const userMsg = {
          conversation_id: conversationId,
          sender: 'user',
          type: body.audioUrl ? 'audio' : 'text',
          content: text,
          audio_url: body.audioUrl || null,
          retry_of_message_id: body.retryOfMessageId || null,
          version: body.version || 1,
          device_id: body.deviceId || null,
          profile_id: profileId || null,
          created_at: new Date().toISOString()
        };
        await supabaseInsert('messages', [userMsg]);
      }

      // Insert AI message
      if (SUPABASE_URL && SUPABASE_KEY) {
        const aiMsg = {
          conversation_id: conversationId,
          sender: 'ai',
          type: 'text',
          content: replyText,
          prosody_feedback: data.turn_feedback?.prosody || null,
          vocab_suggestions: data.turn_feedback?.vocab || null,
          guidance: guidance || null,
          scores: data.scores || null,
          device_id: body.deviceId || null,
          profile_id: profileId || null,
          created_at: new Date().toISOString()
        };
        await supabaseInsert('messages', [aiMsg]);
      }

      // If wrapup stage, mark conversation ended
      if (conversationId && stage === 'wrapup' && SUPABASE_URL && SUPABASE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
            method: 'PATCH',
            headers: supabaseHeaders as any,
            body: JSON.stringify({ ended_at: new Date().toISOString() })
          });
        } catch (e) {
          console.warn('Failed to mark conversation ended', e);
        }
      }
    } catch (e) {
      console.warn('Supabase persistence failed:', e);
    }

    return res.status(200).json({ ok: true, replyText, feedback, guidance, tags, conversationId });
  } catch (e: any) {
    const isAbort = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    const code = isAbort ? 504 : 500;
    const msg = isAbort ? 'upstream_timeout' : 'chat_failed';
    console.error(JSON.stringify({ lvl: 'error', ts: new Date().toISOString(), endpoint: '/api/chat', err: e?.message || String(e), abort: isAbort }));
    return res.status(code).json({ error: msg, detail: e?.message || String(e) });
  }
}

