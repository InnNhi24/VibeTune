// @ts-nocheck
// Pragmatic: disable TS checking for this server functions file so local
// Deno/hono/Supabase runtime types (not available in the dev environment)
// don't block iterative changes. We'll re-enable and type properly later.

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";
import serverLogger from './serverLogger.tsx';

const app = new Hono();

// Use serverLogger explicitly throughout this file. Removed the module-local
// console shim to make logging calls explicit and clear.

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Enable logger
app.use('*', logger(serverLogger.info));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Rate limiting helper
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimits.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

// Auth middleware
async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  
  c.set('user', user);
  await next();
}

// Health check endpoint
app.get("/make-server-b2083953/health", (c) => {
  return c.json({ status: "ok", service: "VibeTune API" });
});

// OAuth callback handler
app.get("/make-server-b2083953/callback", async (c) => {
  try {
  serverLogger.info('🔄 OAuth callback handler called');
    
    // Extract auth code and state from URL parameters
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    
  serverLogger.info('📋 Callback parameters:', { 
      hasCode: !!code, 
      hasState: !!state, 
      error, 
      errorDescription 
    });
    
    if (error) {
  serverLogger.error('❌ OAuth error in callback:', error, errorDescription);
      return c.redirect(`${Deno.env.get('SITE_URL') || 'http://localhost:3000'}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`);
    }
    
    if (!code) {
  serverLogger.error('❌ No authorization code in callback');
      return c.redirect(`${Deno.env.get('SITE_URL') || 'http://localhost:3000'}?error=no_code`);
    }
    
    // Exchange code for session (this should be handled by Supabase client-side)
  serverLogger.info('✅ OAuth callback successful, redirecting to app');
    return c.redirect(Deno.env.get('SITE_URL') || 'http://localhost:3000');
    
  } catch (error) {
    serverLogger.error('❌ OAuth callback error:', error);
    return c.redirect(`${Deno.env.get('SITE_URL') || 'http://localhost:3000'}?error=callback_error`);
  }
});

// User signup endpoint
app.post("/make-server-b2083953/signup", async (c) => {
  try {
    const clientIp = c.req.header('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`signup_${clientIp}`, 5, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const { email, password, name } = await c.req.json();
    
    if (!email || !password || !name) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

  serverLogger.info('🔄 Creating user with admin.createUser for:', email);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, username: name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
  serverLogger.error('❌ Supabase auth.admin.createUser error:', error);
      
      // Provide specific error details for debugging
      const errorDetails = {
        message: error.message,
        status: error.status,
        code: error.code,
        details: error.details
      };
  serverLogger.error('❌ Detailed signup error:', errorDetails);
      
      return c.json({ 
        error: `Database error saving new user: ${error.message}`,
        details: errorDetails 
      }, error.status || 400);
    }

    if (data?.user) {
  serverLogger.info('✅ User created successfully:', data.user.id, data.user.email);
      
      // Verify user was actually created by checking auth.users
      try {
        const { data: verifyData, error: verifyError } = await supabase.auth.admin.getUserById(data.user.id);
        if (verifyError) {
          serverLogger.error('⚠️ User creation verification failed:', verifyError);
        } else {
          serverLogger.info('✅ User creation verified in database');
        }
      } catch (verifyErr) {
        serverLogger.warn('⚠️ Could not verify user creation:', verifyErr);
      }
      
      return c.json({ user: data.user });
    }

  serverLogger.error('❌ No user data returned from createUser');
    return c.json({ error: 'User creation failed - no data returned' }, 500);
    
  } catch (error) {
    serverLogger.error('❌ Signup endpoint error:', error);
    
    // Enhanced error logging for database issues
    if (error.message?.includes('database') || error.message?.includes('trigger')) {
  serverLogger.error('💾 Database/Trigger error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
  return c.json({ 
        error: 'Database error saving new user - check server logs',
        type: 'database_error'
      }, 500);
    }
    
    return c.json({ 
      error: 'Internal server error during signup',
      type: 'server_error'
    }, 500);
  }
});

// Audio analysis endpoint
app.post("/make-server-b2083953/api/analyze-audio", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    if (!checkRateLimit(`analyze_${userId}`, 100, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const { text, level } = await c.req.json();
    
    if (!text) {
      return c.json({ error: 'Text is required' }, 400);
    }

    // Mock AI analysis - in production, this would call actual AI services
    const analysis = await generateMockProsodyAnalysis(text, level || 'Intermediate');
    
    return c.json({ data: analysis });
  } catch (error) {
    serverLogger.error('Audio analysis error:', error);
    return c.json({ error: 'Failed to analyze audio' }, 500);
  }
});

// Save message endpoint
app.post("/make-server-b2083953/api/save-message", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    if (!checkRateLimit(`save_message_${userId}`, 20, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const messageData = await c.req.json();
    
    // Save to database
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        ...messageData,
        profile_id: userId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      serverLogger.error('Save message error:', error);
      return c.json({ error: 'Failed to save message' }, 500);
    }

    return c.json({ data });
  } catch (error) {
    serverLogger.error('Save message error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Retry message endpoint
app.post("/make-server-b2083953/api/retry-message/:msgId", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    const messageId = c.req.param('msgId');
    
    if (!checkRateLimit(`retry_${messageId}`, 5, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const { text, level } = await c.req.json();
    
    // Generate new AI feedback
    const newFeedback = await generateMockProsodyAnalysis(text, level || 'Intermediate');
    
    // Create new message linked to original
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: messageId, // In real app, would get conversation_id from original message
        sender: 'ai',
        type: 'text',
        content: 'Updated analysis based on retry',
        prosody_feedback: newFeedback,
        retry_of_message_id: messageId,
        version: 1,
        profile_id: userId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      serverLogger.error('Retry message error:', error);
      return c.json({ error: 'Failed to retry message' }, 500);
    }

    return c.json({ data });
  } catch (error) {
    serverLogger.error('Retry message error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get conversation history
app.get("/make-server-b2083953/api/get-history", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;

    // Get conversations
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('profile_id', userId)
      .order('started_at', { ascending: false });

    if (convError) {
      serverLogger.error('Get conversations error:', convError);
      return c.json({ error: 'Failed to get conversations' }, 500);
    }

    // Get messages for conversations
    const conversationIds = conversations?.map(c => c.id) || [];
    let messages = [];
    
    if (conversationIds.length > 0) {
      const { data: messagesData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });

      if (msgError) {
        serverLogger.error('Get messages error:', msgError);
        return c.json({ error: 'Failed to get messages' }, 500);
      }
      
      messages = messagesData || [];
    }

    return c.json({ 
      conversations: conversations || [],
      messages: messages
    });
  } catch (error) {
    serverLogger.error('Get history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Analytics event tracking
app.post("/make-server-b2083953/api/analytics", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    const { event_type, metadata } = await c.req.json();
    
    if (!event_type) {
      return c.json({ error: 'Event type is required' }, 400);
    }

    const { data, error } = await supabase
      .from('analytics_events')
      .insert([{
        profile_id: userId,
        event_type,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      }]);

    if (error) {
      serverLogger.error('Analytics error:', error);
      return c.json({ error: 'Failed to track event' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    serverLogger.error('Analytics error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// AI-powered prosody analysis endpoint using OpenAI
app.post("/make-server-b2083953/api/ai-prosody-analysis", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    if (!checkRateLimit(`ai_prosody_${userId}`, 50, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const { text, level, context } = await c.req.json();
    
    if (!text) {
      return c.json({ error: 'Text is required' }, 400);
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      serverLogger.warn('OpenAI API key not configured, falling back to mock analysis');
      const mockAnalysis = await generateMockProsodyAnalysis(text, level || 'Intermediate');
      return c.json({ data: mockAnalysis });
    }

    // Call OpenAI API for prosody analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert English speech prosody coach. Analyze the provided text and provide detailed feedback on pronunciation, rhythm, intonation, and fluency. The user's level is ${level || 'Intermediate'}. Return your analysis in this exact JSON format:

{
  "overall_score": number (0-100),
  "pronunciation_score": number (0-100),
  "rhythm_score": number (0-100),
  "intonation_score": number (0-100),
  "fluency_score": number (0-100),
  "detailed_feedback": {
    "strengths": ["strength1", "strength2"],
    "improvements": ["area1", "area2"],
    "specific_issues": [
      {
        "type": "pronunciation|rhythm|intonation|stress|pace",
        "word": "word",
        "severity": "low|medium|high",
        "feedback": "specific feedback",
        "suggestion": "how to improve"
      }
    ]
  },
  "suggestions": ["suggestion1", "suggestion2"],
  "next_focus_areas": ["area1", "area2"]
}`
          },
          {
            role: 'user',
            content: `Please analyze this text for English speech prosody (focus on how it would be spoken): "${text}"`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      serverLogger.error('OpenAI API error:', response.status, await response.text());
      const fallbackAnalysis = await generateMockProsodyAnalysis(text, level || 'Intermediate');
      return c.json({ data: fallbackAnalysis, note: 'Using fallback analysis due to API error' });
    }

    const aiResponse = await response.json();
    const analysisText = aiResponse.choices[0]?.message?.content;

    if (!analysisText) {
      const fallbackAnalysis = await generateMockProsodyAnalysis(text, level || 'Intermediate');
      return c.json({ data: fallbackAnalysis, note: 'Using fallback analysis - no AI response' });
    }

    try {
      const analysis = JSON.parse(analysisText);
      return c.json({ data: analysis, powered_by: 'OpenAI GPT-4' });
    } catch (parseError) {
      serverLogger.error('Failed to parse AI response:', parseError);
      const fallbackAnalysis = await generateMockProsodyAnalysis(text, level || 'Intermediate');
      return c.json({ data: fallbackAnalysis, note: 'Using fallback analysis - parsing error' });
    }

  } catch (error) {
    serverLogger.error('AI prosody analysis error:', error);
    const fallbackAnalysis = await generateMockProsodyAnalysis(text, level || 'Intermediate');
    return c.json({ data: fallbackAnalysis, note: 'Using fallback analysis due to error' });
  }
});

// AI conversation response endpoint
app.post("/make-server-b2083953/api/ai-conversation", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    if (!checkRateLimit(`ai_conversation_${userId}`, 30, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const { userInput, context, prosodyAnalysis } = await c.req.json();
    
    if (!userInput) {
      return c.json({ error: 'User input is required' }, 400);
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      serverLogger.warn('OpenAI API key not configured, using mock response');
      const mockResponse = generateMockConversationResponse(userInput, context);
      return c.json({ data: mockResponse });
    }

    const conversationHistory = context?.conversation_history || [];
    const userLevel = context?.user_level || 'Intermediate';
    const topic = context?.topic || 'General conversation';

    const messages = [
      {
        role: 'system',
        content: `You are VibeTune, an AI English speaking teacher who talks like a friendly friend.\n\nFollow the 3-phase flow: TOPIC_DISCOVERY -> MAIN_CHAT -> WRAP-UP. When you decide on a clear topic, include a control tag at the end of your reply exactly like: [[TOPIC_CONFIRMED: topic_name_here]]. When the user requests end (/end) or you are instructed to wrap up, return a short goodbye plus a structured summary with headings: VOCABULARY, GRAMMAR POINTS, OVERALL FEEDBACK. Keep replies short (2–5 sentences) and friendly.`
      }
    ];

    // Add conversation history
    conversationHistory.slice(-6).forEach((msg: any) => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current user input
    messages.push({
      role: 'user',
      content: userInput
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.8,
        max_tokens: 200
      })
    });

    if (!response.ok) {
      serverLogger.error('OpenAI API error for conversation:', response.status);
      const mockResponse = generateMockConversationResponse(userInput, context);
      return c.json({ data: mockResponse, note: 'Using fallback response' });
    }

    const aiResponse = await response.json();
    const aiMessage = aiResponse.choices[0]?.message?.content;

    if (!aiMessage) {
      const mockResponse = generateMockConversationResponse(userInput, context);
      return c.json({ data: mockResponse, note: 'Using fallback response' });
    }

    // Detect topic confirmation tag in AI reply
    const topicTagMatch = aiMessage.match(/\[\[TOPIC_CONFIRMED:\s*([^\]]+)\]\]/i);
    let confirmedTopic = null;
    // Attempt to persist confirmed topic if we have a conversation id in context
    const conversationId = context?.conversation_id || context?.conversationId || null;
    if (topicTagMatch) {
      confirmedTopic = topicTagMatch[1].trim();
      if (conversationId) {
        try {
          await supabase
            .from('conversations')
            .update({ topic: confirmedTopic })
            .eq('id', conversationId);
        } catch (e) {
          serverLogger.warn('Failed to persist confirmed topic in supabase function:', e);
        }
      }
    }

    return c.json({ 
      data: {
        text_response: aiMessage,
        topic_confirmed: confirmedTopic,
        conversation_flow: {
          next_topic_suggestions: ['Travel', 'Food', 'Hobbies', 'Technology'],
          difficulty_adjustment: 'maintain',
          engagement_level: 0.9
        },
        practice_suggestions: {
          immediate: ['Great job! Keep the conversation flowing'],
          session_goals: ['Practice natural conversation'],
          homework: ['Try this topic with friends']
        }
      },
      powered_by: 'OpenAI GPT-4'
    });

  } catch (error) {
    serverLogger.error('AI conversation error:', error);
    const mockResponse = generateMockConversationResponse(userInput, context);
    return c.json({ data: mockResponse, note: 'Using fallback response due to error' });
  }
});

// Mock conversation response generator
function generateMockConversationResponse(userInput: string, context: any) {
  const responses = [
    "That's really interesting! Can you tell me more about that?",
    "I see what you mean. What do you think about it?",
    "That sounds great! How did that make you feel?",
    "Wow, that's fascinating! I'd love to hear more details.",
    "That's a good point. Have you experienced something similar before?"
  ];
  
  return {
    text_response: responses[Math.floor(Math.random() * responses.length)],
    conversation_flow: {
      next_topic_suggestions: ['Travel', 'Food', 'Hobbies', 'Work'],
      difficulty_adjustment: 'maintain',
      engagement_level: 0.8
    },
    practice_suggestions: {
      immediate: ['Try adding more details', 'Use descriptive words'],
      session_goals: ['Improve conversation flow'],
      homework: ['Practice storytelling']
    }
  };
}
// Mock prosody analysis function (fallback)
async function generateMockProsodyAnalysis(text: string, level: string) {
  const words = text.toLowerCase().split(' ');
  const score = Math.floor(Math.random() * 30) + 70; // 70-100%
  
  const prosodyErrors = [];
  const vocabSuggestions = [];
  
  // Add some mock analysis based on text content
  if (words.some(w => ['really', 'very', 'quite'].includes(w))) {
    prosodyErrors.push({
      word: 'really',
      type: 'stress',
      suggestion: 'Emphasize this intensifier with stronger stress'
    });
  }
  
  if (words.some(w => ['important', 'interesting', 'communication'].includes(w))) {
    prosodyErrors.push({
      word: words.find(w => ['important', 'interesting', 'communication'].includes(w)),
      type: 'syllable_stress',
      suggestion: 'Focus on primary stress placement in multisyllabic words'
    });
  }
  
  // Vocabulary suggestions based on level
  if (level === 'Beginner' && words.some(w => w.length > 8)) {
    const complexWord = words.find(w => w.length > 8);
    if (complexWord) {
      vocabSuggestions.push({
        word: complexWord,
        simpler_alternative: 'Try using simpler words',
        definition: 'Complex vocabulary for your level'
      });
    }
  }
  
  const guidance = score >= 85 
    ? "Excellent prosody! Keep practicing with more complex sentences."
    : score >= 70 
    ? "Good effort! Focus on stress patterns and intonation."
    : "Keep practicing! Try speaking more slowly and emphasize key words.";
  
  return {
    overall_score: score,
    pronunciation_score: score + (Math.random() * 10 - 5),
    rhythm_score: score + (Math.random() * 10 - 5), 
    intonation_score: score + (Math.random() * 10 - 5),
    fluency_score: score + (Math.random() * 10 - 5),
    detailed_feedback: {
      strengths: ['Clear pronunciation', 'Good pace'],
      improvements: ['Work on intonation', 'Practice word stress']
    },
    suggestions: ['Practice with audio recordings', 'Focus on sentence stress'],
    next_focus_areas: ['Question intonation', 'Connected speech']
  };
}

// Speech service endpoints using Deepgram API
app.post("/make-server-b2083953/api/speech/transcribe", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    if (!checkRateLimit(`transcribe_${userId}`, 60, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    if (!deepgramApiKey) {
      serverLogger.warn('Deepgram API key not configured, falling back to mock transcription');
      return c.json({ 
        data: {
          text: "Hello, this is a mock transcription for testing purposes.",
          
          words: [
            { word: "Hello", start: 0.0, end: 0.5, confidence: 0.98 },
            { word: "this", start: 0.6, end: 0.8, confidence: 0.95 },
            { word: "is", start: 0.9, end: 1.0, confidence: 0.97 },
            { word: "a", start: 1.1, end: 1.2, confidence: 0.93 },
            { word: "mock", start: 1.3, end: 1.6, confidence: 0.94 },
            { word: "transcription", start: 1.7, end: 2.5, confidence: 0.96 }
          ],
          prosody_hints: {
            pace: 'normal',
            volume: 'normal',
            clarity: 'good'
          }
        },
        note: 'Using mock transcription - API key not configured'
      });
    }

    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    const options = JSON.parse(formData.get('options') as string || '{}');

    if (!audioFile) {
      return c.json({ error: 'Audio file is required' }, 400);
    }

    // Convert File to ArrayBuffer for Deepgram
    const audioBuffer = await audioFile.arrayBuffer();

    // Call Deepgram API
    const response = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': audioFile.type || 'audio/webm'
      },
      body: audioBuffer
    });

    if (!response.ok) {
      console.error('Deepgram API error:', response.status, await response.text());
      return c.json({ 
        data: {
          text: "Transcription unavailable - using fallback",
          confidence: 0.5,
          words: [],
          prosody_hints: { pace: 'normal', volume: 'normal', clarity: 'fair' }
        },
        note: 'Using fallback due to API error'
      }, 200);
    }

    const deepgramResult = await response.json();
    const transcript = deepgramResult.results?.channels?.[0]?.alternatives?.[0];

    if (!transcript) {
      return c.json({ 
        data: {
          text: "",
          confidence: 0,
          words: [],
          prosody_hints: { pace: 'normal', volume: 'quiet', clarity: 'poor' }
        },
        note: 'No transcription found'
      });
    }

    // Transform Deepgram response to our format
    const result = {
      text: transcript.transcript || '',
      confidence: transcript.confidence || 0,
      words: transcript.words?.map((word: any) => ({
        word: word.word,
        start: word.start,
        end: word.end,
        confidence: word.confidence
      })) || [],
      prosody_hints: {
        pace: transcript.confidence > 0.8 ? 'normal' : 'slow',
        volume: 'normal', // Deepgram doesn't provide volume analysis
        clarity: transcript.confidence > 0.9 ? 'excellent' : 
                transcript.confidence > 0.7 ? 'good' : 'fair'
      }
    };

    return c.json({ data: result, powered_by: 'Deepgram Nova-2' });

  } catch (error) {
    console.error('Speech transcription error:', error);
    return c.json({ 
      data: {
        text: "Transcription error - please try again",
        confidence: 0,
        words: [],
        prosody_hints: { pace: 'normal', volume: 'normal', clarity: 'poor' }
      },
      error: 'Transcription failed'
    }, 500);
  }
});

// Speech synthesis endpoint (Text-to-Speech)
app.post("/make-server-b2083953/api/speech/synthesize", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    if (!checkRateLimit(`synthesize_${userId}`, 30, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const { text, voice, speed, pitch } = await c.req.json();
    
    if (!text) {
      return c.json({ error: 'Text is required' }, 400);
    }

    // For now, return a mock response since we're focusing on transcription
    // In production, you could integrate with Google Cloud Text-to-Speech or similar
    return c.json({ 
      error: 'Text-to-speech synthesis not yet implemented',
      note: 'This feature will be available in a future update'
    }, 501);

  } catch (error) {
    console.error('Speech synthesis error:', error);
    return c.json({ error: 'Speech synthesis failed' }, 500);
  }
});

// Speech prosody analysis endpoint
app.post("/make-server-b2083953/api/speech/analyze-prosody", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.id;
    
    if (!checkRateLimit(`prosody_${userId}`, 30, 60000)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const formData = await c.req.formData();
    const audioFile = formData.get('audio') as File;
    const expectedText = formData.get('expected_text') as string;

    if (!audioFile) {
      return c.json({ error: 'Audio file is required' }, 400);
    }

    // First transcribe the audio
    const audioBuffer = await audioFile.arrayBuffer();
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    
    let transcription = null;
    if (deepgramApiKey) {
      try {
        const response = await fetch('https://api.deepgram.com/v1/listen?punctuate=true&utterances=true', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': audioFile.type || 'audio/webm'
          },
          body: audioBuffer
        });

        if (response.ok) {
          const deepgramResult = await response.json();
          transcription = deepgramResult.results?.channels?.[0]?.alternatives?.[0];
        }
      } catch (error) {
        console.warn('Deepgram transcription failed for prosody analysis:', error);
      }
    }

    // Analyze prosody using AI (OpenAI) with transcription context
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openaiApiKey && transcription) {
      try {
        const prosodyPrompt = `Analyze the speech prosody of this transcribed text: "${transcription.transcript}"
        ${expectedText ? `Expected text: "${expectedText}"` : ''}
        
        Provide detailed prosody feedback including:
        - Pronunciation accuracy
        - Rhythm and timing
        - Intonation patterns
        - Stress placement
        - Overall fluency
        
        Return analysis in JSON format with scores (0-100) and specific feedback.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an expert English pronunciation and prosody coach. Analyze speech patterns and provide constructive feedback.'
              },
              {
                role: 'user',
                content: prosodyPrompt
              }
            ],
            temperature: 0.3,
            max_tokens: 800
          })
        });

        if (response.ok) {
          const aiResponse = await response.json();
          const analysis = aiResponse.choices[0]?.message?.content;
          
          try {
            const parsedAnalysis = JSON.parse(analysis);
            return c.json({ 
              data: {
                ...parsedAnalysis,
                transcription: transcription.transcript,
                confidence: transcription.confidence,
                word_timing: transcription.words
              },
              powered_by: 'Deepgram + OpenAI'
            });
          } catch (parseError) {
            console.warn('Failed to parse AI prosody analysis, using fallback');
          }
        }
      } catch (error) {
        console.warn('AI prosody analysis failed:', error);
      }
    }

    // Fallback prosody analysis
    const mockAnalysis = await generateMockProsodyAnalysis(
      transcription?.transcript || expectedText || 'Speech analysis',
      'Intermediate'
    );

    return c.json({ 
      data: {
        ...mockAnalysis,
        transcription: transcription?.transcript || null,
        confidence: transcription?.confidence || 0,
        word_timing: transcription?.words || []
      },
      note: 'Using fallback prosody analysis'
    });

  } catch (error) {
    console.error('Prosody analysis error:', error);
    return c.json({ error: 'Prosody analysis failed' }, 500);
  }
});

// Speech service health check
app.get("/make-server-b2083953/api/speech/health", (c) => {
  const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

  return c.json({
    available: true,
    services: {
      transcription: !!deepgramApiKey,
      synthesis: false, // Not implemented yet
      prosody_analysis: !!(deepgramApiKey && openaiApiKey)
    },
    configuration: {
      deepgram_configured: !!deepgramApiKey,
      openai_configured: !!openaiApiKey
    }
  });
});

Deno.serve(app.fetch);