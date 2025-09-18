import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const app = new Hono()

// Middleware
app.use('*', cors({
  origin: ['*'],
  allowHeaders: ['*'],
  allowMethods: ['*'],
}))

app.use('*', logger(console.log))

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

const checkRateLimit = (identifier: string, maxRequests: number = 100, windowMs: number = 60000): boolean => {
  const now = Date.now()
  const userLimit = rateLimitStore.get(identifier)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (userLimit.count >= maxRequests) {
    return false
  }
  
  userLimit.count++
  return true
}

// Audio analysis endpoint
app.post('/make-server-b2083953/analyze-audio', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401)
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }

    // Rate limiting per user
    if (!checkRateLimit(user.id)) {
      return c.json({ error: 'Rate limit exceeded. Please try again later.' }, 429)
    }

    const formData = await c.req.formData()
    const audioFile = formData.get('audio') as File | null
    const text = formData.get('text') as string | null
    const level = formData.get('level') as string || 'Beginner'
    const context = formData.get('context') as string || 'general'

    if (!audioFile && !text) {
      return c.json({ error: 'Either audio file or text must be provided' }, 400)
    }

    let transcript = text || ''
    
    // If audio file is provided, transcribe it first
    if (audioFile) {
      try {
        // Convert audio to text using OpenAI Whisper API
        const audioBuffer = await audioFile.arrayBuffer()
        const audioBlob = new Blob([audioBuffer], { type: audioFile.type })
        
        // Create form data for OpenAI
        const whisperFormData = new FormData()
        whisperFormData.append('file', audioBlob, 'audio.wav')
        whisperFormData.append('model', 'whisper-1')
        whisperFormData.append('response_format', 'json')

        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          },
          body: whisperFormData
        })

        if (!transcriptionResponse.ok) {
          throw new Error(`Transcription failed: ${transcriptionResponse.statusText}`)
        }

        const transcriptionResult = await transcriptionResponse.json()
        transcript = transcriptionResult.text || transcript
        
      } catch (transcriptionError) {
        console.error('Transcription error:', transcriptionError)
        // Continue with provided text or empty string if transcription fails
      }
    }

    // Analyze the transcript for prosody using OpenAI
    const analysisPrompt = `
You are an expert English pronunciation and prosody teacher. Analyze the following text for prosody patterns, stress, intonation, and rhythm. The student is at ${level} level learning ${context}.

Text: "${transcript}"

Please provide analysis in this exact JSON format:
{
  "prosodyErrors": [
    {
      "type": "intonation" | "stress" | "rhythm",
      "score": 0.0-1.0,
      "location": "specific word or phrase",
      "suggestion": "specific improvement suggestion"
    }
  ],
  "vocabSuggestions": ["word1", "word2"],
  "guidance": "short encouraging feedback with specific tips",
  "overallScore": 70-100,
  "transcript": "the analyzed text"
}

Focus on:
- Word stress patterns
- Sentence-level intonation
- Rhythm and connected speech
- Level-appropriate feedback for ${level} learners
- Positive, encouraging tone
- Specific, actionable suggestions
`

    try {
      const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert English pronunciation teacher. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 800
        })
      })

      if (!analysisResponse.ok) {
        throw new Error(`OpenAI API error: ${analysisResponse.statusText}`)
      }

      const analysisResult = await analysisResponse.json()
      const analysisText = analysisResult.choices[0]?.message?.content

      if (!analysisText) {
        throw new Error('No analysis content received from OpenAI')
      }

      let parsedAnalysis
      try {
        parsedAnalysis = JSON.parse(analysisText)
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', analysisText)
        throw new Error('Invalid analysis format received')
      }

      // Ensure the analysis has the expected structure
      const sanitizedAnalysis = {
        prosodyErrors: Array.isArray(parsedAnalysis.prosodyErrors) ? parsedAnalysis.prosodyErrors : [],
        vocabSuggestions: Array.isArray(parsedAnalysis.vocabSuggestions) ? parsedAnalysis.vocabSuggestions : [],
        guidance: typeof parsedAnalysis.guidance === 'string' ? parsedAnalysis.guidance : 'Keep practicing! Your effort is appreciated.',
        overallScore: typeof parsedAnalysis.overallScore === 'number' ? 
          Math.max(70, Math.min(100, parsedAnalysis.overallScore)) : 75,
        transcript: parsedAnalysis.transcript || transcript
      }

      // Log the analysis for debugging (remove in production)
      console.log('Analysis completed for user:', user.id, {
        level,
        context,
        transcriptLength: transcript.length,
        score: sanitizedAnalysis.overallScore
      })

      return c.json(sanitizedAnalysis)

    } catch (analysisError) {
      console.error('Analysis error:', analysisError)
      
      // Return fallback analysis
      const fallbackAnalysis = {
        prosodyErrors: [
          {
            type: 'general',
            score: 0.8,
            location: 'overall',
            suggestion: 'Continue practicing natural rhythm and intonation patterns.'
          }
        ],
        vocabSuggestions: [],
        guidance: `Great effort! For ${level} level, focus on clear pronunciation and natural pace.`,
        overallScore: 75,
        transcript: transcript
      }

      return c.json(fallbackAnalysis)
    }

  } catch (error) {
    console.error('Audio analysis endpoint error:', error)
    return c.json(
      { 
        error: 'Audio analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      500
    )
  }
})

// Health check endpoint
app.get('/make-server-b2083953/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: Deno.env.get('DENO_DEPLOYMENT_ID') ? 'production' : 'development'
  })
})

// Streaming transcription endpoint (WebSocket simulation)
app.post('/make-server-b2083953/stream-transcription', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401)
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return c.json({ error: 'Invalid or expired token' }, 401)
    }

    // Rate limiting
    if (!checkRateLimit(`stream_${user.id}`, 20)) {
      return c.json({ error: 'Stream rate limit exceeded' }, 429)
    }

    // For now, return mock streaming response
    // In production, this would connect to a real-time transcription service
    const mockTranscriptions = [
      { text: 'I', isFinal: false, confidence: 0.8 },
      { text: 'I think', isFinal: false, confidence: 0.85 },
      { text: 'I think learning', isFinal: false, confidence: 0.9 },
      { text: 'I think learning English', isFinal: false, confidence: 0.9 },
      { text: 'I think learning English pronunciation', isFinal: false, confidence: 0.92 },
      { text: 'I think learning English pronunciation is very important', isFinal: true, confidence: 0.95 }
    ]

    return c.json({ 
      streamId: `stream_${Date.now()}`,
      mockTranscriptions,
      message: 'Streaming transcription initiated. In production, this would return a WebSocket connection.'
    })

  } catch (error) {
    console.error('Streaming transcription error:', error)
    return c.json({ error: 'Streaming transcription failed' }, 500)
  }
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Endpoint not found' }, 404)
})

Deno.serve(app.fetch)