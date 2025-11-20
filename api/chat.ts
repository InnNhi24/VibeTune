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
    stage?: string;
    audioUrl?: string;
    deviceId?: string;
    retryOfMessageId?: string;
    version?: number;
  };

  const text = (body.text || '').trim();
  const rawLevel = String(body.level || 'beginner').toLowerCase();
  const allowedLevels = ['beginner', 'intermediate', 'advanced'];
  const level = allowedLevels.includes(rawLevel) ? rawLevel : 'beginner';
  const lastMistakes = Array.isArray(body.lastMistakes) ? body.lastMistakes : [];
  const profileId = body.profileId || null;
  const incomingConversationId = body.conversationId || null;
  const stage = String(body.stage || 'practice').toLowerCase();
  const topicFromBody = (body.topic || '').trim() || null;

    if (!text) return res.status(400).json({ error: 'text is required' });

    // Handle different conversation stages
    let systemPrompt;
    if (stage === 'topic_discovery') {
      // Topic discovery mode - help user decide what to talk about
      systemPrompt = `You are VibeTune, an AI English pronunciation tutor helping students choose a conversation topic.

YOUR TASK:
- Help the student choose ONE clear topic to practice English conversation
- When they mention a topic, confirm it naturally and start the conversation
- Be friendly, warm, and encouraging

RESPONSE STYLE:
- When user mentions ANY topic (music, travel, food, work, etc.), respond naturally
- Confirm the topic conversationally and ask a follow-up question
- NO special tags or formatting - just natural conversation
- Keep it simple and clear for ${level} level learners

EXAMPLES:
User: "I want to talk about music" 
→ "Great! Let's talk about music. What kind of music do you enjoy?"

User: "Let's discuss travel"
→ "Perfect! I love talking about travel. Where have you been recently?"

User: "I love cooking"
→ "Awesome! Cooking is so much fun. What's your favorite dish to make?"

User: "My job is stressful"
→ "I understand. Work can be tough sometimes. What do you do for work?"

IMPORTANT:
- NO control tags like [[TOPIC_CONFIRMED:...]]
- Just respond naturally and start the conversation
- The system will detect the topic automatically
- Be conversational and friendly

User's message: "${text}"`;

    } else {
      // Practice mode: Topic is already FIXED - focus on prosody learning
      systemPrompt = `You are VibeTune, an AI English pronunciation tutor helping students improve their speaking.

FIXED TOPIC: "${topicFromBody || 'general conversation'}"
Student Level: ${level}
Recent pronunciation issues: ${JSON.stringify(lastMistakes)}

YOUR ROLE AS PRONUNCIATION TUTOR:
- Help students improve prosody (rhythm, stress, intonation) through natural conversation
- The topic is LOCKED - you cannot change it during this session
- Focus on pronunciation feedback while keeping the conversation engaging
- Be supportive, encouraging, and specific with feedback

CONVERSATION RULES:

1. STAY ON TOPIC (CRITICAL)
   - Topic: "${topicFromBody}" - this CANNOT change
   - If student tries to change topic, redirect gently:
     "Let's keep practicing ${topicFromBody}. We can explore other topics in a new session!"
   - All questions and responses must relate to this topic

2. PROSODY FEEDBACK (for voice messages)
   - Notice pronunciation patterns: stress, rhythm, intonation
   - Give 1-2 specific, actionable tips per response
   - Format: "I noticed you said [word]. Try stressing the [first/second] syllable: [WORD-example]"
   - Examples:
     * "Nice! When you say 'comfortable', stress the first syllable: COM-for-ta-ble"
     * "Good effort! Try pausing between phrases for clearer speech"
     * "Great rhythm! Your sentence stress is improving"

3. NATURAL CONVERSATION
   - Keep responses SHORT (2-4 sentences)
   - Always end with a follow-up question
   - Be warm and conversational
   - Use simple, clear English for ${level} level

4. GENTLE CORRECTIONS
   - Correct only 1-2 important mistakes per turn
   - Format: "You said: *[mistake]*. More natural: *[correction]*"
   - Focus on clarity, not perfection
   - Example: "You said: *I very like it*. More natural: *I really like it*"

5. TEXT-ONLY MODE
   - If no audio, focus on vocabulary and grammar
   - Don't mention pronunciation unless asked
   - Keep conversation flowing naturally

RESPONSE STYLE:
- Conversational and friendly, like a supportive coach
- Celebrate progress: "Great job!", "You're improving!"
- NO special tags or formatting
- Always end with a question to continue the conversation

EXAMPLES:
"Nice! I heard you say 'comfortable'. Remember: COM-for-ta-ble (stress first syllable). So, what makes you feel most comfortable when traveling?"

"You're doing well! Your rhythm is improving. What's your favorite thing about ${topicFromBody}?"

"Good effort! Try to pause slightly between phrases. Now, tell me more about your experience with ${topicFromBody}."

CRITICAL REMINDERS:
- NO control tags or special formatting
- Topic is FIXED - cannot change
- Keep responses natural and conversational
- Focus on prosody learning through dialogue

Student's message: "${text}"`;
    }

    // Abort after 9s to fit within Hobby 10s limit
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 9000);

    const payload = {
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
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

    console.log(JSON.stringify({ lvl: 'debug', ts: new Date().toISOString(), endpoint: '/api/chat', raw_model: j?.choices?.[0]?.message?.content || '' }));

    const replyText = data.replyText || '';
    const feedback = data.feedback || '';
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const guidance = data.guidance ?? feedback;

    // Topic detection for topic_discovery stage
    let topic = topicFromBody; // Use existing topic if in practice mode
    
    if (stage === 'topic_discovery') {
      console.log('=== TOPIC DISCOVERY DEBUG ===');
      console.log('User message:', text);
      console.log('AI reply:', replyText);
      
      // Infer topic from natural conversation
      const guessTopicFromReply = (aiText: string, userText: string) => {
        // First, try to extract from user's message (more reliable)
        const userPatterns = [
          /(?:talk about|discuss|chat about|practice)\s+([a-zA-Z0-9 &\-']{2,30})/i,
          /(?:topic|subject)(?:\s+is)?\s+([a-zA-Z0-9 &\-']{2,30})/i,
          /(?:i (?:want to|like|love|enjoy))\s+([a-zA-Z0-9 &\-']{2,30})/i
        ];
        
        for (const re of userPatterns) {
          const m = userText.match(re);
          if (m && m[1]) {
            let cand = m[1].trim().toLowerCase();
            // Clean up common words
            cand = cand.replace(/\b(talk|talking|discuss|chat|practice|about|the|a|an)\b/gi, '').trim();
            if (cand.length >= 3) {
              return cand.split(/\s+/).slice(0, 3).join(' ');
            }
          }
        }
        
        // Fallback: extract from AI confirmation
        const aiPatterns = [
          /(?:talk about|talking about|discuss|chat about)\s+([a-zA-Z0-9 &\-']{2,30})/i,
          /(?:topic|subject)(?:\s+is)?\s+([a-zA-Z0-9 &\-']{2,30})/i
        ];
        
        for (const re of aiPatterns) {
          const m = aiText.match(re);
          if (m && m[1]) {
            let cand = m[1].trim().toLowerCase();
            cand = cand.replace(/[\.\,\!\?]$/,'').trim();
            if (cand.length >= 3) {
              return cand.split(/\s+/).slice(0, 3).join(' ');
            }
          }
        }
        
        return null;
      };

      const inferred = guessTopicFromReply(replyText || '', text);
      if (inferred) {
        topic = inferred;
        console.log('✅ Topic detected:', topic);
      } else {
        console.log('⚠️ No topic detected yet');
      }
      console.log('=== END DEBUG ===');
    }
    
  const nextStage = stage === 'topic_discovery' ? 'practice' : stage;

  console.log(JSON.stringify({ lvl: 'info', ts: new Date().toISOString(), endpoint: '/api/chat', ip, node_env: process.env.NODE_ENV, text_len: text.length, duration_ms: Date.now() - startTime }));

  let convInsertResult: any = null;
  let userMsgInsertResult: any = null;
  let aiMsgInsertResult: any = null;

    // Persist to Supabase
    const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    let conversationId: string | null = incomingConversationId;

    const persistenceDisabled = !SUPABASE_URL || !SUPABASE_KEY;
    if (persistenceDisabled) {
      console.warn('Supabase persistence disabled: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.');
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
      // Create conversation when topic is discovered
      if (!conversationId && stage === 'topic_discovery' && topic && SUPABASE_URL && SUPABASE_KEY) {
        const convRows = [{ 
          profile_id: profileId, 
          topic: topic || null, 
          is_placement_test: false, 
          started_at: new Date().toISOString() 
        }];
        convInsertResult = await supabaseInsert('conversations', convRows);
        console.log(JSON.stringify({ lvl: 'debug', ts: new Date().toISOString(), endpoint: '/api/chat', supabase_conv_insert: convInsertResult }));
        if (Array.isArray(convInsertResult) && convInsertResult[0] && convInsertResult[0].id) {
          conversationId = convInsertResult[0].id;
        }
      }

      // Update conversation topic if needed
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
        console.log(JSON.stringify({ lvl: 'debug', ts: new Date().toISOString(), endpoint: '/api/chat', supabase_user_message: userMsgInsertResult }));
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
        console.log(JSON.stringify({ lvl: 'debug', ts: new Date().toISOString(), endpoint: '/api/chat', supabase_ai_message: aiMsgInsertResult }));
      }
    } catch (e) {
      console.warn('Supabase persistence failed:', e);
    }

  const baseResponse: any = { 
    ok: true, 
    replyText, 
    feedback, 
    guidance, 
    tags, 
    conversationId, 
    topic, 
    stage, 
    nextStage 
  };
  
  if (persistenceDisabled) {
    baseResponse.persistence_disabled = true;
    baseResponse.persistence_warning = 'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL not configured; messages not persisted.';
  }
  
  // Signal topic confirmation for topic_discovery stage
  if (typeof topic === 'string' && topic.trim() && stage === 'topic_discovery') {
    baseResponse.topic_confirmed = topic;
    console.log('✅ Topic confirmed:', topic);
  }
  
  if (process.env.NODE_ENV === 'development') {
    baseResponse._debug = {
      resolvedTopic: topic || null,
      convInsertResult: convInsertResult ? (Array.isArray(convInsertResult) ? convInsertResult[0] : convInsertResult) : null,
      userMsgInsertResult: userMsgInsertResult ? (Array.isArray(userMsgInsertResult) ? userMsgInsertResult[0] : userMsgInsertResult) : null,
      aiMsgInsertResult: aiMsgInsertResult ? (Array.isArray(aiMsgInsertResult) ? aiMsgInsertResult[0] : aiMsgInsertResult) : null
    };
  }
  
  return res.status(200).json(baseResponse);
  } catch (e: any) {
    const isAbort = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    const code = isAbort ? 504 : 500;
    const msg = isAbort ? 'upstream_timeout' : 'chat_failed';
    console.error(JSON.stringify({ lvl: 'error', ts: new Date().toISOString(), endpoint: '/api/chat', err: e?.message || String(e), abort: isAbort }));
    return res.status(code).json({ error: msg, detail: e?.message || String(e) });
  }
}
