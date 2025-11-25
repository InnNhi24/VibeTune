import dotenv from 'dotenv';
// Load environment variables before importing modules that initialize
// clients using env vars (OpenAI, Supabase, etc.). This prevents
// "Missing credentials" errors when those modules initialize at import time.
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import chatRoute from './routes/chat';
import placementScoreRoute from './routes/placementScore';
import eventsIngestRoute from './routes/eventsIngest';
import feedbackRoute from './routes/feedback';
import liveTranscribeRoute from './routes/liveTranscribe';
import speechRoute from './routes/liveTranscribe';
import synthesizeRoute from './routes/synthesize';
import analyzeProsodyRoute, { analyzeProsodyMiddleware } from './routes/analyzeProsody';
import chatStreamRoute from './routes/chatStream';
import dataProxy from './routes/dataProxy';
import { 
  securityHeaders, 
  sanitizeInput, 
  requestSizeLimit, 
  corsConfig, 
  requestLogger, 
  errorHandler,
  healthCheck,
  rateLimits
} from './middleware/security';

dotenv.config();

const app = express();

// Security middleware (order matters!)
app.use(securityHeaders);
app.use(requestLogger);
app.use(sanitizeInput);
app.use(requestSizeLimit('10mb'));

// CORS configuration
app.use(cors(corsConfig));

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', healthCheck);
// Aliases to match frontend API expectations
app.get('/api/health', healthCheck);

// Speech API compatibility routes expected by frontend (/api/speech/*)
// Map /api/speech/transcribe -> existing liveTranscribeRoute
app.post('/api/speech/transcribe', rateLimits.audio, liveTranscribeRoute);

// Analyze prosody and synthesize endpoints are planned; return 501 until implemented.
// Implemented TTS endpoint
app.post('/api/speech/synthesize', rateLimits.ai, synthesizeRoute);

// Prosody analysis accepts multipart/form-data (audio file) or JSON { audioData: base64 }
app.post('/api/speech/analyze-prosody', rateLimits.ai, ...(Array.isArray(analyzeProsodyMiddleware) ? analyzeProsodyMiddleware : [analyzeProsodyMiddleware] ), analyzeProsodyRoute);

// Chat streaming endpoint (SSE)
app.post('/api/chat-stream', rateLimits.ai, chatStreamRoute);

// API routes with rate limiting
app.post('/api/chat', rateLimits.ai, chatRoute);
// Proxy legacy /api/data Vercel function to local Express route
app.all('/api/data', dataProxy);
app.post('/api/placement-score', rateLimits.general, placementScoreRoute);
app.post('/api/events-ingest', rateLimits.general, eventsIngestRoute);
app.post('/api/feedback', rateLimits.general, feedbackRoute);
app.post('/api/live-transcribe', rateLimits.audio, liveTranscribeRoute);

const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    next();
  }
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 VibeTune server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;

