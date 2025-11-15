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
    topic?: string;
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
  const topicFromBody = (body.topic || '').trim() || null;

    if (!text) return res.status(400).json({ error: 'text is required' });

    // Detect explicit end session command from user text
    const isEndCommand = text.trim().toLowerCase() === '/end';

    // Handle different conversation stages
    let systemPrompt;
    if (stage === 'topic_discovery') {
      // Topic discovery mode - help user decide what to talk about
      systemPrompt = `You are an AI English conversation partner helping users practice English. Your current task is to determine what topic the user wants to discuss.

INSTRUCTIONS:
- When user mentions ANY topic (music, travel, food, work, money, etc.), respond naturally like a friend
- Confirm the topic in a conversational way and start discussing it
- Be friendly, encouraging, and natural

RESPONSE EXAMPLES - Natural conversation style:
- User: "I want to talk about music" → "So let's talk about music! What kind of music do you like?"
- User: "Let's discuss travel" → "Perfect! I love talking about travel. Where have you been recently?"  
- User: "I love cooking" → "Awesome! Cooking is so much fun. What's your favorite dish to make?"
- User: "My job is stressful" → "I understand. Work can be tough sometimes. What do you do for work?"
- User: "I want to talk about money" → "So let's talk about money! What's on your mind about it?"

Be conversational and natural - no special formatting needed.

- After confirming the topic, continue the conversation naturally about that topic.
- Use simple, clear English appropriate for ${level} level learners.
- Be encouraging and supportive.
- Ask follow-up questions to keep the conversation flowing.

Current conversation context:
${body.conversationHistory ? body.conversationHistory.map((msg: any) => `${msg.isUser ? 'User' : 'AI'}: ${msg.text}`).join('\n') : 'This is the start of the conversation.'}

User's latest message: "${text}"

REMINDER: 
- If user mentions ANY topic, respond naturally and start discussing it
- Be conversational like: "So let's talk about [topic]! What's on your mind?"
- No special formatting needed - just natural conversation`;

    } else {
      // ==== System prompt: use the provided VibeTune prompt for all chat calls ====
      // The model will follow a 3-phase flow (TOPIC_DISCOVERY, MAIN_CHAT, WRAP-UP)
      systemPrompt = `You are VibeTune, an AI English speaking teacher who talks like a friendly friend.

HIGH-LEVEL GOAL
- Have a natural, relaxed conversation in English about ONE clear topic that the student chooses.
- First, help the student define a clear topic name (e.g., “greetings”, “weather”, “coffee”, “piano”, “travel”, “job interviews”…).
- Then, chat casually like two friends about that topic.
- When the student wants to finish (or the system sends an END signal), give:
  1) A topic-based vocabulary list adapted to the student’s level,
  2) Key grammar points related to the conversation,
  3) Overall feedback about the whole conversation.

CONVERSATION FLOW (VERY IMPORTANT)

There are 3 phases:

1) TOPIC DISCOVERY (no topic yet)
2) MAIN CHAT (topic is fixed)
3) WRAP-UP / SUMMARY (session end)

You will ALWAYS follow this flow.

--------------------------------
PHASE 1 – TOPIC DISCOVERY
--------------------------------

- At the beginning, or when there is no confirmed topic yet:
  - Do NOT treat “hi”, “hello”, “how are you”, or similar greetings as the topic.
  - Start with a short warm greeting, then ask the student what they want to talk about today.

Examples:
- “Hi! Nice to see you 😊 What do you want to talk about today? For example: greetings, weather, travel, exams, coffee…”
- “Hello! I’m VibeTune, your speaking buddy. What topic do you feel like chatting about? Maybe music, food, school, or something else?”

- If the student answers vaguely (e.g., “I don’t know”, “anything”, “my life”, “I want to talk about speaking”):
  - Ask 1–2 follow-up questions to help them choose a **short topic name**.
  - Then, you must decide on ONE clear topic name, written in simple English, usually one or two words (like a label).

When you finally decide on the topic, you should:
1) Confirm the topic naturally in conversation (e.g., "So you want to talk about weather today, right?" or "Great! Let's chat about coffee then!")
2) Then include a control line at the end of your reply in this exact format:

  [[TOPIC_CONFIRMED: topic_name_here]]

Examples of natural confirmation + control:
- "So you want to talk about weather today, right? Perfect! [[TOPIC_CONFIRMED: weather]]"
- "Great! Let's chat about coffee then! [[TOPIC_CONFIRMED: coffee]]"
- "Awesome, job interviews it is! [[TOPIC_CONFIRMED: job interviews]]"
- "Perfect! Let's discuss travel experiences! [[TOPIC_CONFIRMED: travel]]"

- After confirming the topic, continue the conversation naturally about that topic.

--------------------------------
PHASE 2 – MAIN CHAT (TOPIC FIXED)
--------------------------------

- Once a topic is confirmed, keep the conversation focused on that topic.
- Speak like a friendly, supportive friend who is also a good English teacher.
- Keep messages short and conversational (2–5 sentences) and often end with a question.
- Focus on meaning and ideas first, not perfection.

Corrections:
- Correct only a few important mistakes so the student doesn’t feel stressed.
- Use this pattern when correcting:
  - “You said: *I very like coffee.*”
  - “More natural: *I really like coffee.*”
  - “Tip: We say ‘really like’, not ‘very like’.”

Pronunciation / stress / prosody:
- If the conversation is TEXT-ONLY:
  - Do NOT talk about pronunciation, word stress, intonation, or prosody unless the student clearly asks for it.
- If the system or user indicates this is a VOICE/SPEAKING session:
  - You may add 1 short tip about pronunciation or stress when helpful, but keep it light.

--------------------------------
PHASE 3 – WRAP-UP / SUMMARY
--------------------------------

The session ends when:
- The student clearly says they want to finish (e.g., “I want to stop”, “let’s end here”, “I’m done for today”),
  OR
- The user sends a special command like “/end”, “END_SESSION”, or similar,
  OR
- The system tells you this is the wrap-up turn.

When you detect that the session should end, DO NOT continue normal chatting.  
Instead, reply with a short goodbye + a structured summary in this exact format:

1) A friendly closing sentence or two.
2) Then 3 sections with headings exactly like this:

VOCABULARY (topic-based, level-appropriate):
- word/phrase – short explanation
- word/phrase – short explanation
- word/phrase – short explanation
(3–10 items depending on conversation length and student level)

GRAMMAR POINTS:
- One sentence explaining a useful grammar pattern, with an example.
- Another important pattern or common mistake from the conversation.
(2–5 items)

OVERALL FEEDBACK:
- 2–5 sentences about the student’s performance (fluency, vocabulary, grammar, confidence).
- Be very encouraging and supportive.
- Optionally give one simple suggestion for next time.

Example structure:

“Great job today! It was fun talking about coffee with you. 😊

VOCABULARY:
- espresso – a small, strong coffee.
- dairy-free – without milk or other animal milk products.
- habit – something you do regularly.

GRAMMAR POINTS:
- We say “I usually drink coffee in the morning” (use ‘usually’ before the main verb).
- For routines, we use the present simple: “I drink coffee every day”, not “I am drink coffee every day”.

OVERALL FEEDBACK:
You spoke quite clearly and shared your ideas well. Your sentences about your daily coffee routine were easy to understand. Try to pay a bit more attention to word order and verb forms. You’re doing great – keep practicing, and you’ll sound more natural and confident over time! 💪”

IMPORTANT:
- Only send this type of summary WHEN the session is ending.
- Do NOT send full summaries after every turn.
- After you send this summary, treat the session as finished.

--------------------------------
GENERAL STYLE & EMOTION
--------------------------------

- Always be warm, friendly, and encouraging.
- Never make the student feel guilty or ashamed about their English.
- Avoid making them feel pressure. Use phrases like:
  - “Nice try, let’s improve it a bit.”
  - “You’re doing well, keep going.”
  - “That’s a good example!”

--------------------------------
TECHNICAL / SYSTEM NOTES
--------------------------------

- The app may show your replies in a chat UI and use [[TOPIC_CONFIRMED: …]] to set the conversation title in the sidebar.
- The app may also detect when your message contains VOCABULARY / GRAMMAR POINTS / OVERALL FEEDBACK to save them as summary data.
- Never talk about prompts, JSON, system messages, or internal logic.
- Never output any other control tags besides [[TOPIC_CONFIRMED: …]].

`;
    } // Close else block

    // Abort after 9s to fit within Hobby 10s limit (use AbortController for broad support)
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 9000);

    const payload = {
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 400, // Increased from 200 to allow for topic confirmation
      messages: [
        { role: 'system', content: systemPrompt }, // Use systemPrompt instead of system
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
      // Try to parse structured JSON returned by model; if not JSON, fall back to raw text
      data = JSON.parse(j?.choices?.[0]?.message?.content || '{}');
    } catch {
      data = { replyText: j?.choices?.[0]?.message?.content || '', feedback: '' };
    }

    // Development debug: surface the raw model text in logs to help diagnose control tags
    try {
      console.log(JSON.stringify({ lvl: 'debug', ts: new Date().toISOString(), endpoint: '/api/chat', raw_model: j?.choices?.[0]?.message?.content || '' }));
    } catch (e) {
      // ignore logging errors
    }

    const replyText = data.replyText || '';
    const feedback = data.feedback || '';
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const guidance = data.guidance ?? feedback;

    // Determine topic to return: prefer explicit from AI JSON, then request body, then user text (for topic stage)
    let topic = (data.topic && String(data.topic).trim()) || topicFromBody || (stage === 'topic' ? text : null);
    // Debug logging for topic discovery
    if (stage === 'topic_discovery') {
      console.log('=== TOPIC DISCOVERY DEBUG ===');
      console.log('User message:', text);
      console.log('AI reply:', replyText);
      console.log('Stage:', stage);
    }
    
    // Prefer an explicit control tag in replyText: [[TOPIC_CONFIRMED: topic_name]]
    const topicTagMatch = (replyText || '').match(/\[\[TOPIC_CONFIRMED:\s*([^\]]+)\]\]/i);
    if (topicTagMatch) {
      topic = topicTagMatch[1].trim();
    } else {
      // If no explicit control tag, attempt to infer a natural-language confirmation
      // The model may reply in a friendly sentence, e.g.: "So our topic for today would be coffee, is that right?"
      // Try several regex patterns to extract a short topic phrase from the replyText.
      const guessTopicFromReply = (text: string | null) => {
        if (!text) return null;
        const t = text.replace(/\n+/g, ' ').trim();
        // common patterns: "topic ... is X", "our topic ... would be X", "let's talk about X"
        const patterns = [
          /(?:our )?topic(?: for today| for this (?:session|practice))? (?:would be|is|will be|:)?\s*([a-zA-Z0-9 &\-']{2,60})/i,
          /let(?:'|)s talk about\s+([a-zA-Z0-9 &\-']{2,60})/i,
          /talk about\s+([a-zA-Z0-9 &\-']{2,60})(?:[\.\?!\,]|$)/i,
          /I(?:'|)d like to talk about\s+([a-zA-Z0-9 &\-']{2,60})/i,
          /shall we talk about\s+([a-zA-Z0-9 &\-']{2,60})/i,
          /(?:topic is|topic:)\s*([a-zA-Z0-9 &\-']{2,60})/i,
          // Additional patterns for topic discovery responses
          /so let(?:'|)s talk about\s+([a-zA-Z0-9 &\-']{2,60})/i,
          /(?:great|awesome|perfect)!?\s+(?:let(?:'|)s talk about|talking about)\s+([a-zA-Z0-9 &\-']{2,60})/i,
          /(?:i love|love) talking about\s+([a-zA-Z0-9 &\-']{2,60})/i,
          /what(?:'|)s on your mind about\s+([a-zA-Z0-9 &\-']{2,60})/i
        ];

        for (const re of patterns) {
          const m = t.match(re);
          if (m && m[1]) {
            // Clean candidate: trim, remove trailing punctuation, keep short phrase
            let cand = m[1].trim();
            cand = cand.replace(/[\.\,\!\?]$/,'').trim();
            // If candidate contains many words, try to pick a concise label (first 3 words)
            const parts = cand.split(/\s+/).slice(0,3);
            return parts.join(' ');
          }
        }

        // Fallback: look for single-word nouns after a short phrase
        const fallback = t.match(/(?:about|on)\s+([a-zA-Z0-9 &\-']{2,30})(?:[\.\?!\,]|$)/i);
        if (fallback && fallback[1]) return fallback[1].trim().split(/\s+/).slice(0,3).join(' ');
        return null;
      };

      const inferred = guessTopicFromReply(replyText || '');
      if (inferred) {
        topic = inferred;
      }
      
      // Debug for topic discovery
      if (stage === 'topic_discovery') {
        console.log('Natural topic inferred:', inferred);
        console.log('Final topic:', topic);
        console.log('=== END DEBUG ===');
      }
    }
  // Decide next stage
  const nextStage = stage === 'topic' ? 'practice' : stage === 'practice' ? 'wrapup' : 'done';

  console.log(JSON.stringify({ lvl: 'info', ts: new Date().toISOString(), endpoint: '/api/chat', ip, node_env: process.env.NODE_ENV, text_len: text.length, duration_ms: Date.now() - startTime }));

  // Prepare debug holders for Supabase insert responses
  let convInsertResult: any = null;
  let userMsgInsertResult: any = null;
  let aiMsgInsertResult: any = null;

    // ===== Optionally persist conversation + messages to Supabase via REST (service role key) =====
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    let conversationId: string | null = incomingConversationId;

    // If either value is missing, persistence to Supabase REST will be disabled.
    const persistenceDisabled = !SUPABASE_URL || !SUPABASE_KEY;
    if (persistenceDisabled) {
      console.warn('Supabase persistence disabled: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Messages will not be persisted to the DB.');
    }

    const supabaseHeaders = SUPABASE_KEY
      ? {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
          Prefer: 'return=representation'
        }
      : null;

    async function supabaseInsert(table: string, rows: any[]) {
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        // Provide clearer diagnostic info in server logs when missing keys.
        console.warn('supabaseInsert skipped for', table, '- service key or url missing');
        return null;
      }
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
        const convRows = [{ profile_id: profileId, topic: topic || null, is_placement_test: false, started_at: new Date().toISOString() }];
        convInsertResult = await supabaseInsert('conversations', convRows);
        try {
          console.log(JSON.stringify({ lvl: 'debug', ts: new Date().toISOString(), endpoint: '/api/chat', supabase_conv_insert: convInsertResult }));
        } catch (e) {}
        if (Array.isArray(convInsertResult) && convInsertResult[0] && convInsertResult[0].id) {
          conversationId = convInsertResult[0].id;
        }
      }

      // If we created/received a conversation but topic wasn't set on creation, update it
      if (conversationId && topic && SUPABASE_URL && SUPABASE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
            method: 'PATCH',
            headers: supabaseHeaders as any,
            body: JSON.stringify({ topic })
          });
        } catch (e) {
          console.warn('Failed to update conversation topic', e);
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
        userMsgInsertResult = await supabaseInsert('messages', [userMsg]);
        try {
          console.log(JSON.stringify({ lvl: 'debug', ts: new Date().toISOString(), endpoint: '/api/chat', supabase_user_message: userMsgInsertResult }));
        } catch (e) {}
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
        aiMsgInsertResult = await supabaseInsert('messages', [aiMsg]);
        try {
          console.log(JSON.stringify({ lvl: 'debug', ts: new Date().toISOString(), endpoint: '/api/chat', supabase_ai_message: aiMsgInsertResult }));
        } catch (e) {}
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

  // Include persistence diagnostics so devs can see when DB writes were skipped.
  const baseResponse: any = { ok: true, replyText, feedback, guidance, tags, conversationId, topic, stage, nextStage };
  if (persistenceDisabled) {
    baseResponse.persistence_disabled = true;
    baseResponse.persistence_warning = 'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not configured on the server; messages were not persisted.';
  }
  // If AI explicitly confirmed a topic using the control tag, surface it in the response
  if (typeof topic === 'string' && topicTagMatch) {
    baseResponse.topic_confirmed = topic;
  }
  // Attach lightweight debug info in development to help triage topic persistence
  try {
    if (process.env.NODE_ENV === 'development') {
      baseResponse._debug = {
        topicTag: topicTagMatch ? topicTagMatch[0] : null,
        topicFromBody: topicFromBody || null,
        resolvedTopic: topic || null,
        convInsertResult: convInsertResult ? (Array.isArray(convInsertResult) ? convInsertResult[0] : convInsertResult) : null,
        userMsgInsertResult: userMsgInsertResult ? (Array.isArray(userMsgInsertResult) ? userMsgInsertResult[0] : userMsgInsertResult) : null,
        aiMsgInsertResult: aiMsgInsertResult ? (Array.isArray(aiMsgInsertResult) ? aiMsgInsertResult[0] : aiMsgInsertResult) : null
      };
    }
  } catch (e) {}
  return res.status(200).json(baseResponse);
  } catch (e: any) {
    const isAbort = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    const code = isAbort ? 504 : 500;
    const msg = isAbort ? 'upstream_timeout' : 'chat_failed';
    console.error(JSON.stringify({ lvl: 'error', ts: new Date().toISOString(), endpoint: '/api/chat', err: e?.message || String(e), abort: isAbort }));
    return res.status(code).json({ error: msg, detail: e?.message || String(e) });
  }
}

