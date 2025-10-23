# VibeTune - Replit Configuration

## Overview
VibeTune is an AI-powered prosody learning app that helps English learners improve their pronunciation, rhythm, and conversational fluency through interactive AI conversations.

## Recent Changes
**Date: October 23, 2025**
- Migrated from Vercel to Replit
- Configured unified Express server to serve both frontend and backend
- Updated Vite configuration to run on port 5000 with 0.0.0.0 binding
- Fixed Express 5 compatibility with static file serving
- Configured CORS to allow all origins for development
- **Fixed Vercel Deployment Configuration**: Removed problematic API rewrite rule that was blocking all endpoints except /api/chat
- **Fixed Live Transcription Integration**: Updated RecordingControls to use LiveTranscriptionService for real-time speech-to-text
- **Dual Recording System**: Component now captures full audio blob (for backend analysis) AND displays live transcription simultaneously
- Verified all API endpoints (/api/chat, /api/live-transcribe, etc.) are accessible
- Backend safely handles OpenAI and Deepgram API integration without exposing keys to frontend

## Project Architecture

### Monorepo Structure
```
vibetune-monorepo/
├── frontend/          # Vite + React frontend
│   ├── src/
│   ├── build/        # Production build output
│   └── vite.config.js
├── backend/          # Express + TypeScript backend
│   ├── src/
│   │   ├── routes/   # API routes
│   │   └── index.ts  # Main server file
│   └── dist/         # Compiled TypeScript
└── package.json      # Workspace configuration
```

### Technology Stack
- **Frontend**: Vite + React + TypeScript
- **Backend**: Express 5 + TypeScript + Node.js
- **AI Services**: OpenAI (GPT), Deepgram (Speech-to-Text)
- **Database**: Supabase (Postgres)
- **Build**: TypeScript compiler, Vite

## Environment Variables
The following secrets are configured in Replit:
- `OPENAI_API_KEY` - OpenAI API for AI conversations
- `DEEPGRAM_API_KEY` - Deepgram for speech-to-text
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Public Supabase key
- `SUPABASE_SERVICE_ROLE_KEY` - Private Supabase admin key

## Development Workflow

### Running Locally
The server automatically serves both frontend static files and backend API routes on port 5000.

The workflow is configured to:
1. Run the compiled backend server
2. Serve frontend build from `frontend/build/`
3. Handle API routes at `/api/*`
4. Serve the React SPA for all other routes

### Building
To rebuild the project:
```bash
# Build frontend
cd frontend && npm run build

# Build backend
cd backend && npm run build
```

### API Routes
- `POST /api/chat` - AI conversation endpoint (OpenAI GPT)
- `POST /api/placement-score` - Placement test scoring
- `POST /api/events-ingest` - Analytics events
- `POST /api/feedback` - User feedback
- `POST /api/live-transcribe` - Live audio transcription (Deepgram, 2-second chunks)

## Replit-Specific Configuration

### Port Configuration
- **Frontend Dev Server**: Port 5000 (Vite)
- **Production Server**: Port 5000 (Express serving static files)
- **Binding**: 0.0.0.0 (required for Replit)

### CORS Configuration
The backend is configured to allow all origins in development:
```typescript
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',')
```

### Static File Serving
The Express server serves the frontend build and handles SPA routing:
```typescript
app.use(express.static(frontendPath));
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});
```

## User Preferences
None documented yet.

## Known Issues
- One moderate severity npm vulnerability (run `npm audit fix` to address)
- Browser shows "No active session" on initial load (expected - user needs to sign in)

## Next Steps
- User should test authentication flow
- Consider setting up Replit database if needed
- Configure deployment settings for production
