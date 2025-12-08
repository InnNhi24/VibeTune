import type { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting setup
const UP_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function rateLimit(ip: string, limit = 30, windowSec = 60) {
  if (!UP_URL || !UP_TOKEN) return { ok: true, remaining: -1 };
  const rk = `rl:placement:${ip}`;
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

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown';
    const rl = await rateLimit(ip, 30, 60);
    if (!rl.ok) return res.status(429).json({ error: 'Too many requests' });

    const body = req.body as {
      profileId?: string;
      response: string;
      topic: string;
      difficulty: string;
      deviceId?: string;
    };

    const { response, topic, difficulty } = body;

    if (!response || !topic || !difficulty) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Analyze response with GPT-4
    const systemPrompt = `You are an English language assessment expert evaluating a student's response for a placement test.

Topic: ${topic}
Difficulty Level: ${difficulty}
Student Response: "${response}"

Evaluate the response based on:
1. Grammar accuracy and complexity
2. Vocabulary range and appropriateness
3. Response coherence and organization
4. Detail and elaboration
5. Natural language use

Provide a score from 0-100 and constructive feedback.

For ${difficulty} level:
- Beginner: Basic sentences, simple vocabulary (score range: 40-70)
- Intermediate: Complex sentences, varied vocabulary (score range: 55-85)
- Advanced: Sophisticated language, nuanced expression (score range: 70-95)

Format your response as JSON:
{
  "score": <number 0-100>,
  "feedback": "<encouraging feedback with specific observations>"
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: response }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const result = await openaiResponse.json();
    const content = result.choices[0]?.message?.content || '';
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return res.status(200).json({
        score: analysis.score,
        feedback: analysis.feedback
      });
    }

    // Fallback if JSON parsing fails
    return res.status(200).json({
      score: 60,
      feedback: "Thank you for your response! You're communicating your thoughts clearly."
    });

  } catch (error: any) {
    console.error('Placement test analysis error:', error);
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message || 'Unknown error'
    });
  }
}
