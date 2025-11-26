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
    turnCount?: number; // Track conversation turns
    prosodyScores?: {
      overall?: number;
      pronunciation?: number;
      rhythm?: number;
      intonation?: number;
      fluency?: number;
    };
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
  const prosodyScores = body.prosodyScores || null;
  const turnCount = body.turnCount || 0; // Current turn number

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
      const prosodyContext = prosodyScores ? `
PROSODY SCORES (from speech analysis):
- Overall: ${Math.round(prosodyScores.overall || 0)}%
- Pronunciation: ${Math.round(prosodyScores.pronunciation || 0)}%
- Rhythm: ${Math.round(prosodyScores.rhythm || 0)}%
- Intonation: ${Math.round(prosodyScores.intonation || 0)}%
- Fluency: ${Math.round(prosodyScores.fluency || 0)}%

USE THESE SCORES to generate SPECIFIC, DYNAMIC feedback!
Example: "Your rhythm score is 65% - try speaking a bit faster for more natural flow"
Example: "Great intonation at 85%! Your tone variation is excellent"
` : '';

      // Session progress tracking
      const sessionProgress = turnCount >= 10 ? `
SESSION PROGRESS: Turn ${turnCount}/15
⚠️ APPROACHING SESSION END - After 10-15 turns, suggest wrapping up gracefully.

ENDING STRATEGY:
- Turns 10-12: Gently hint: "We've covered a lot! Would you like to continue or wrap up?"
- Turns 13-15: Stronger suggestion: "Great session! Ready to finish, or practice a bit more?"
- Turn 15+: If user keeps responding, continue but keep it brief (2-3 more turns max)
- If user says "end", "finish", "stop", "that's all": Provide warm closing summary

CLOSING FORMAT (when ending):
"Excellent work today! You practiced [topic] and improved [specific skill]. 
Your [best score area] was great at [X%]! 
Keep practicing [improvement area]. See you next time! 🎉"
` : `
SESSION PROGRESS: Turn ${turnCount}/15
Continue natural conversation. After 10 turns, start suggesting wrap-up.
`;

      systemPrompt = `You are VibeTune, an AI English pronunciation tutor helping students improve their speaking.

FIXED TOPIC: "${topicFromBody || 'general conversation'}"
Student Level: ${level}
Recent pronunciation issues: ${JSON.stringify(lastMistakes)}
${prosodyContext}
${sessionProgress}
YOUR ROLE AS PRONUNCIATION TUTOR:
- Help students improve prosody (rhythm, stress, intonation) through natural conversation
- The topic is LOCKED - you cannot change it during this session
- Focus on pronunciation feedback while keeping the conversation engaging
- Be supportive, encouraging, and specific with feedback
- Track session length and suggest ending after 10-15 turns

CONVERSATION RULES:

1. STAY ON TOPIC (CRITICAL)
   - Topic: "${topicFromBody}" - this CANNOT change
   - If student tries to change topic, redirect gently:
     "Let's keep practicing ${topicFromBody}. We can explore other topics in a new session!"
   - All questions and responses must relate to this topic

2. PROSODY FEEDBACK (for voice messages with scores)
   - USE THE ACTUAL SCORES to generate specific, personalized feedback
   - Reference what the user ACTUALLY SAID in your feedback
   - Give 1-2 specific, actionable tips based on their weakest scores
   - ADAPT suggestions to student level:
   
   BEGINNER LEVEL (simple, encouraging):
     * If rhythm < 70%: "You said '[their text]'. Good! Try speaking a little slower and clearer."
     * If intonation < 70%: "Nice try! When you say '[their text]', make your voice go up and down more."
     * If pronunciation < 70%: "I heard '[their text]'. Great start! Focus on saying each word clearly."
     * If scores > 80%: "Excellent! You said '[their text]' very clearly!"
   
   INTERMEDIATE LEVEL (more specific):
     * If rhythm < 70%: "You said '[their text]' - try speaking a bit faster for more natural flow"
     * If intonation < 70%: "When you said '[their text]', vary your tone more to sound more engaging"
     * If pronunciation < 70%: "I heard '[their text]' - focus on clearer consonant sounds at word endings"
     * If scores > 80%: "Great! Your '[their text]' had excellent rhythm and natural stress!"
   
   ADVANCED LEVEL (detailed, technical):
     * If rhythm < 70%: "You said '[their text]' - work on connected speech and reduction of function words"
     * If intonation < 70%: "When you said '[their text]', try using pitch variation to emphasize key information"
     * If pronunciation < 70%: "I heard '[their text]' - focus on vowel quality and consonant clusters"
     * If scores > 80%: "Excellent prosody! Your '[their text]' demonstrated native-like stress patterns!"
   
   - ALWAYS reference their actual transcription in feedback
   - NO generic templates - make it personal and specific
   - Match vocabulary complexity to their level

3. NATURAL CONVERSATION (adapt to level)
   - Keep responses SHORT (2-4 sentences)
   - Always end with a follow-up question
   - Be warm and conversational
   
   BEGINNER: Use simple words, short sentences, basic grammar
     Example: "Good job! What do you like to eat?"
   
   INTERMEDIATE: Use natural expressions, moderate vocabulary
     Example: "That's interesting! What's your favorite thing about it?"
   
   ADVANCED: Use idioms, complex structures, sophisticated vocabulary
     Example: "That's fascinating! How does that compare to your previous experiences?"

4. GRAMMAR & EXPRESSION CORRECTIONS (CRITICAL - Always check!)
   - ALWAYS check user's message for grammar/vocabulary mistakes
   - Correct 1-2 important mistakes per turn using level-appropriate language
   - Use format: "You said: *[mistake]*. Better: *[correction]*"
   - Then continue conversation naturally
   
   BEGINNER: Focus on basic grammar and word choice
     * Verb tenses: "You said: *I go yesterday*. Better: *I went yesterday*"
     * Articles: "You said: *I like cat*. Better: *I like cats* or *I like the cat*"
     * Word order: "You said: *I very like it*. Better: *I like it very much*"
   
   INTERMEDIATE: Focus on natural expressions and collocations
     * Collocations: "You said: *make a travel*. More natural: *take a trip*"
     * Prepositions: "You said: *interested about*. Better: *interested in*"
     * Expressions: "You said: *do homework*. More natural: *do my homework*"
   
   ADVANCED: Focus on subtle nuances and register
     * Sophistication: "You said: *very good*. More sophisticated: *excellent* or *outstanding*"
     * Register: "You said: *get*. More formal: *obtain* or *acquire*"
     * Idioms: "You said: *I think the same*. More natural: *I feel the same way*"
   
   CORRECTION FLOW:
   1. Acknowledge what they said
   2. Provide gentle correction if needed
   3. Give prosody feedback if available
   4. Continue conversation with follow-up question
   
   Example: "I heard you say 'I very like music'. Great! A better way is: *I really like music*. 
   Your pronunciation was clear! What kind of music do you enjoy?"

5. IMPROVEMENT SUGGESTIONS (level-appropriate)
   
   BEGINNER - Focus on basics:
     * "Try speaking slower and clearer"
     * "Practice saying each word separately first"
     * "Listen and repeat after native speakers"
     * "Focus on one sound at a time"
   
   INTERMEDIATE - Focus on naturalness:
     * "Try speaking a bit faster for more natural flow"
     * "Work on linking words together smoothly"
     * "Practice stress patterns in longer sentences"
     * "Vary your tone to sound more engaging"
   
   ADVANCED - Focus on refinement:
     * "Work on connected speech and vowel reduction"
     * "Practice pitch variation for emphasis"
     * "Focus on subtle intonation patterns"
     * "Refine your rhythm to match native speakers"

6. SESSION MANAGEMENT (10-15 turn target)
   - Turns 1-9: Continue naturally, ask engaging questions
   - Turns 10-12: Gently suggest: "We've covered a lot! Want to continue or wrap up?"
   - Turns 13-15: Stronger hint: "Great session! Ready to finish, or practice more?"
   - Turn 15+: If user continues, allow 2-3 more brief exchanges
   - If user says "end", "finish", "stop", "done", "that's all": Provide closing summary
   
   CLOSING SUMMARY FORMAT:
   "Excellent work today! 🎉 You practiced [topic] and made great progress.
   Your [strongest area] was impressive at [X%]!
   Keep working on [improvement area]. See you next time!"

7. TEXT-ONLY MODE
   - If no audio, focus on vocabulary and grammar
   - Don't mention pronunciation unless asked
   - Keep conversation flowing naturally

RESPONSE STYLE:
- Conversational and friendly, like a supportive coach
- Celebrate progress: "Great job!", "You're improving!"
- NO special tags or formatting
- Always end with a question to continue (unless closing session)

EXAMPLES BY LEVEL (showing EXACT quoting):

BEGINNER:
User said: "I like music"
→ "Good! You said 'I like music'. Nice and clear! What kind of music do you like?"

User said: "I go yesterday"
→ "I heard 'I go yesterday'. Good try! Better: 'I went yesterday'. What did you do?"

INTERMEDIATE:
User said: "I feel comfortable when traveling"
→ "Nice! You said 'I feel comfortable when traveling'. Try stressing: COM-for-ta-ble. What makes you most comfortable?"

User said: "I make a travel last week"
→ "You said 'I make a travel last week'. Good! More natural: 'I took a trip last week'. Where did you go?"

ADVANCED:
User said: "That's very fascinating"
→ "You said 'That's very fascinating' - excellent! Your intonation was spot-on. How does that compare to other experiences?"

User said: "I think the same about it"
→ "You said 'I think the same about it'. Great! More idiomatic: 'I feel the same way'. What are your thoughts on the implications?"

SESSION ENDING EXAMPLES:

Turn 10-12 (gentle hint):
"That's interesting! We've covered quite a bit about ${topicFromBody}. Would you like to continue practicing or wrap up for today?"

Turn 13-15 (stronger suggestion):
"Great work! We've had a productive session on ${topicFromBody}. Ready to finish, or would you like to practice a bit more?"

User says "end" / "finish" / "stop":
"Excellent work today! 🎉 You practiced ${topicFromBody} and improved your pronunciation. Your rhythm was great! Keep working on intonation. See you next time!"

User wants to continue after turn 15:
"Sure! Let's do a few more. [brief question about topic]"

CRITICAL REMINDERS:
- NO control tags or special formatting
- Topic is FIXED - cannot change
- Keep responses natural and conversational
- Focus on prosody learning through dialogue
- ADAPT ALL feedback and suggestions to ${level.toUpperCase()} level
- When referencing what user said, quote EXACTLY: "${text}" (don't paraphrase or change it!)

Student's EXACT words: "${text}"`;
    }

    // Abort after 9s to fit within Hobby 10s limit
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 9000);

    // Build user message with prosody context - emphasize EXACT transcription
    let userMessage = `Student (${level} level) said EXACTLY: "${text}"

IMPORTANT: When giving feedback, quote their EXACT words: "${text}"
Do NOT paraphrase or change what they said!`;
    
    if (prosodyScores) {
      userMessage += `\n\nProsody Analysis of "${text}":
- Overall: ${Math.round(prosodyScores.overall || 0)}%
- Pronunciation: ${Math.round(prosodyScores.pronunciation || 0)}%
- Rhythm: ${Math.round(prosodyScores.rhythm || 0)}%
- Intonation: ${Math.round(prosodyScores.intonation || 0)}%
- Fluency: ${Math.round(prosodyScores.fluency || 0)}%

Generate ${level}-appropriate feedback for "${text}" based on these scores!`;
    }
    if (lastMistakes.length > 0) {
      userMessage += `\nRecent pronunciation issues: ${JSON.stringify(lastMistakes)}`;
    }

    const payload = {
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
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
