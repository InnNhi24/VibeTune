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
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', '60');
    res.setHeader('X-RateLimit-Remaining', rl.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000 + 60).toString());
    
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

      // Prosody-specific suggestions based on actual scores
      const prosodyGuidance = prosodyScores ? `
🎯 PROSODY FEEDBACK PRIORITY (CRITICAL - READ CAREFULLY):

ANALYZE THE SCORES AND GIVE SPECIFIC, ACTIONABLE FEEDBACK:

1. IDENTIFY THE WEAKEST SCORE (lowest percentage):
   ${prosodyScores.pronunciation && prosodyScores.pronunciation < 75 ? `❌ PRONUNCIATION is weak (${Math.round(prosodyScores.pronunciation)}%)` : ''}
   ${prosodyScores.rhythm && prosodyScores.rhythm < 75 ? `❌ RHYTHM is weak (${Math.round(prosodyScores.rhythm)}%)` : ''}
   ${prosodyScores.intonation && prosodyScores.intonation < 75 ? `❌ INTONATION is weak (${Math.round(prosodyScores.intonation)}%)` : ''}
   ${prosodyScores.fluency && prosodyScores.fluency < 75 ? `❌ FLUENCY is weak (${Math.round(prosodyScores.fluency)}%)` : ''}

2. GIVE SPECIFIC ADVICE FOR THE WEAKEST AREA:

   IF PRONUNCIATION < 75%:
   - Beginner: "Focus on saying each word clearly. Practice: [specific word from their text]"
   - Intermediate: "Work on consonant sounds at word endings. Try: [specific example]"
   - Advanced: "Refine vowel quality in: [specific words]"

   IF RHYTHM < 75%:
   - Beginner: "Try speaking a bit slower and pause between words"
   - Intermediate: "Speed up slightly for more natural flow - aim for steady pace"
   - Advanced: "Work on connected speech - link words together smoothly"

   IF INTONATION < 75%:
   - Beginner: "Make your voice go up and down more when you speak"
   - Intermediate: "Vary your tone to sound more engaging - emphasize key words"
   - Advanced: "Use pitch variation to highlight important information"

   IF FLUENCY < 75%:
   - Beginner: "Take your time - it's okay to pause and think"
   - Intermediate: "Reduce filler words like 'um' and 'uh'"
   - Advanced: "Practice smoother transitions between ideas"

3. IF ALL SCORES > 80%:
   - Celebrate specifically: "Your [highest score area] at ${Math.round(Math.max(prosodyScores.pronunciation || 0, prosodyScores.rhythm || 0, prosodyScores.intonation || 0, prosodyScores.fluency || 0))}% is excellent!"
   - Give advanced tip: "To reach native-level, focus on [subtle refinement]"

⚠️ DO NOT USE GENERIC PHRASES LIKE "slower and clearer" UNLESS THE SCORES ACTUALLY SHOW THAT!
⚠️ ALWAYS reference the ACTUAL SCORES in your feedback!
⚠️ Match advice complexity to ${level} level!
` : '';

      systemPrompt = `You are VibeTune, an AI English pronunciation tutor helping students improve their speaking.

FIXED TOPIC: "${topicFromBody || 'general conversation'}"
Student Level: ${level}
Recent pronunciation issues: ${JSON.stringify(lastMistakes)}
${prosodyContext}
${prosodyGuidance}
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

2. PROSODY FEEDBACK (CRITICAL - Follow the guidance above!)
   - ANALYZE THE ACTUAL SCORES - don't use generic templates!
   - Find the LOWEST score and address it specifically
   - Reference what the user ACTUALLY SAID: "${text}"
   - Give 1-2 specific, actionable tips based on their WEAKEST area
   
   EXAMPLE GOOD FEEDBACK (based on actual scores):
   
   If pronunciation=65%, rhythm=82%, intonation=78%, fluency=80%:
   → "You said '${text}'. Good rhythm! However, your pronunciation score is 65% - focus on clearer consonant sounds, especially at word endings."
   
   If pronunciation=85%, rhythm=60%, intonation=75%, fluency=70%:
   → "You said '${text}'. Nice pronunciation! Your rhythm is 60% - try speaking a bit faster for more natural flow."
   
   If pronunciation=88%, rhythm=85%, intonation=62%, fluency=80%:
   → "You said '${text}'. Great clarity! Your intonation is 62% - vary your tone more to sound more engaging."
   
   If all scores > 80%:
   → "Excellent! You said '${text}' with great prosody. Your [highest area] at [X%] is impressive!"
   
   ⚠️ NEVER say "slower and clearer" unless rhythm score is actually low!
   ⚠️ ALWAYS check which score is lowest and address that specific area!
   ⚠️ Match vocabulary complexity to ${level} level!

3. NATURAL CONVERSATION (adapt to level)
   - Keep responses SHORT (2-4 sentences)
   - Respond naturally like a friend - sometimes answer, sometimes ask
   - Be warm and conversational
   - If user asks a question, ANSWER IT first, then optionally ask back
   - Don't always end with questions - sometimes just share your thoughts
   
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
- Conversational and friendly, like talking to a good friend
- Celebrate progress: "Great job!", "You're improving!"
- NO special tags or formatting
- Respond naturally - answer questions, share thoughts, sometimes ask back
- Don't force questions - let conversation flow naturally

EXAMPLES BY LEVEL (showing NATURAL conversation flow):

BEGINNER:
User asks: "What kind of pop music do you like?"
→ "You said 'What kind of pop music do you like?' - great question! I really enjoy upbeat pop songs. Taylor Swift and Ed Sheeran are amazing!"

User says: "I like music"
→ "You said 'I like music'. Nice and clear! Music is wonderful - it makes everything better!"

User says: "I go yesterday"
→ "I heard 'I go yesterday'. Good try! Better: 'I went yesterday'. Sounds like you had a busy day!"

INTERMEDIATE:
User asks: "Do you think pop music is getting better?"
→ "You said 'Do you think pop music is getting better?' Good question! I think it's evolving - there's so much variety now. Some artists are really creative!"

User says: "I feel comfortable when traveling"
→ "You said 'I feel comfortable when traveling'. Try stressing: COM-for-ta-ble. That's great - traveling should be enjoyable!"

User says: "I make a travel last week"
→ "You said 'I make a travel last week'. More natural: 'I took a trip last week'. That sounds exciting!"

ADVANCED:
User asks: "What's your opinion on modern pop music?"
→ "You said 'What's your opinion on modern pop music?' - excellent pronunciation! I find it fascinating how pop has become so diverse. The production quality is incredible these days."

User says: "That's very fascinating"
→ "You said 'That's very fascinating' - perfect! Your intonation was spot-on. I'm glad you find it interesting too!"

User says: "I think the same about it"
→ "You said 'I think the same about it'. More idiomatic: 'I feel the same way'. It's nice when we're on the same wavelength!"

CONVERSATION FLOW RULES:
- If user asks a question → Answer it naturally, then maybe ask back
- If user makes a statement → Respond with your thoughts, sometimes ask follow-up
- If user shares something → Show interest and relate to it
- Don't force questions - let it flow like real friends talking

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
