import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import chatRoute from './routes/chat';
import placementScoreRoute from './routes/placementScore';
import eventsIngestRoute from './routes/eventsIngest';
import feedbackRoute from './routes/feedback';
import liveTranscribeRoute from './routes/liveTranscribe';
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

// API routes with rate limiting
app.post('/api/chat', rateLimits.ai, chatRoute);
app.post('/api/placement-score', rateLimits.general, placementScoreRoute);
app.post('/api/events-ingest', rateLimits.general, eventsIngestRoute);
app.post('/api/feedback', rateLimits.general, feedbackRoute);
app.post('/api/live-transcribe', rateLimits.audio, liveTranscribeRoute);

const frontendPath = path.join(__dirname, '../../frontend/build');
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
app.use('*', (req, res) => {
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

