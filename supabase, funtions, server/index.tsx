import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Enable logger
app.use('*', logger(console.log));

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

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
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
    console.error('Audio analysis error:', error);
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
      console.error('Save message error:', error);
      return c.json({ error: 'Failed to save message' }, 500);
    }

    return c.json({ data });
  } catch (error) {
    console.error('Save message error:', error);
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
      console.error('Retry message error:', error);
      return c.json({ error: 'Failed to retry message' }, 500);
    }

    return c.json({ data });
  } catch (error) {
    console.error('Retry message error:', error);
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
      console.error('Get conversations error:', convError);
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
        console.error('Get messages error:', msgError);
        return c.json({ error: 'Failed to get messages' }, 500);
      }
      
      messages = messagesData || [];
    }

    return c.json({ 
      conversations: conversations || [],
      messages: messages
    });
  } catch (error) {
    console.error('Get history error:', error);
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
      console.error('Analytics error:', error);
      return c.json({ error: 'Failed to track event' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Analytics error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mock prosody analysis function
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
    prosodyErrors,
    vocabSuggestions,
    guidance,
    score,
    intonation_score: Math.floor(Math.random() * 30) + 70,
    rhythm_score: Math.floor(Math.random() * 30) + 70,
    stress_score: Math.floor(Math.random() * 30) + 70
  };
}

Deno.serve(app.fetch);