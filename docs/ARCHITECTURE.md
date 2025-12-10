# 🏗️ VibeTune Architecture

## Overview

VibeTune is a full-stack AI-powered English pronunciation learning platform built with a modern, scalable architecture. The system uses a serverless backend, real-time database, and offline-first frontend to provide seamless learning experiences.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  React 18 + TypeScript + Vite + Tailwind CSS               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   UI Layer   │  │  State Mgmt  │  │   Services   │     │
│  │  (Shadcn/ui) │  │   (Zustand)  │  │  (API calls) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Serverless API Functions                    │  │
│  │  /api/chat  /api/prosody  /api/transcribe  /api/data │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │   OpenAI     │ │   Supabase   │ │   Upstash    │
    │   API        │ │   Database   │ │   Redis      │
    │ (GPT-4 +     │ │   + Auth     │ │ (Rate Limit) │
    │  Whisper)    │ │              │ │              │
    └──────────────┘ └──────────────┘ └──────────────┘
```

## Tech Stack Decisions

### Frontend

**React 18 + TypeScript**
- Type safety for complex state management
- Component reusability
- Strong ecosystem and tooling

**Vite**
- Fast HMR for development
- Optimized production builds
- Native ESM support

**Zustand**
- Lightweight state management (3KB)
- No boilerplate compared to Redux
- Built-in persistence middleware
- Perfect for offline-first architecture

**Tailwind CSS + Shadcn/ui**
- Rapid UI development
- Consistent design system
- Accessible components out of the box
- Easy customization

**Framer Motion**
- Smooth animations for better UX
- Gesture support for mobile
- Performance optimized

### Backend

**Vercel Serverless Functions**
- Zero server management
- Auto-scaling
- Global edge network
- Cost-effective for variable traffic

**Supabase**
- PostgreSQL with real-time capabilities
- Built-in authentication
- Row Level Security (RLS)
- Auto-generated REST API
- Free tier suitable for MVP

**OpenAI API**
- Whisper: Best-in-class speech-to-text
- GPT-4: Natural conversation and feedback
- Reliable and well-documented

**Upstash Redis (Optional)**
- Serverless Redis for rate limiting
- Pay-per-request pricing
- Global replication

## Database Schema

### Core Tables

**profiles**
```sql
- id (UUID, PK, FK to auth.users)
- email, username, full_name
- level (Beginner/Intermediate/Advanced)
- placement_test_completed, placement_test_score
- avatar_url, dob, timezone, country
- native_language, learning_goal
- created_at, updated_at
```

**conversations**
```sql
- id (UUID, PK)
- profile_id (FK to profiles)
- topic, title
- is_placement_test (boolean)
- status (active/completed/paused/cancelled)
- started_at, ended_at
- metadata (JSONB)
```

**messages**
```sql
- id (UUID, PK)
- conversation_id (FK to conversations)
- sender (user/ai)
- type (text/audio)
- content, audio_url, transcript
- prosody_feedback (JSONB)
- vocab_suggestions (JSONB)
- guidance, tags
- created_at, updated_at
```

**analytics_events**
```sql
- id (UUID, PK)
- profile_id (FK to profiles)
- event_type, metadata (JSONB)
- session_id, device_id
- created_at
```

### Indexes

Performance-critical indexes:
- `idx_conversations_profile_started` - Fast conversation history lookup
- `idx_messages_conversation_created` - Efficient message retrieval
- `idx_messages_prosody_feedback_gin` - JSONB search on feedback
- `idx_analytics_profile_event_created` - Analytics queries

### Row Level Security (RLS)

All tables have RLS enabled:
- Users can only access their own data
- Service role has full access for backend operations
- Prevents data leakage between users

## Data Flow

### 1. User Authentication Flow

```
User Sign Up/In
    ↓
Supabase Auth (PKCE flow)
    ↓
Auto-create Profile (trigger)
    ↓
Return JWT token
    ↓
Store in localStorage
    ↓
Include in API requests
```

### 2. Conversation Flow

```
User starts conversation
    ↓
POST /api/chat (topic discovery)
    ↓
AI suggests topics
    ↓
User confirms topic
    ↓
Create conversation in DB
    ↓
Store conversation_id in Zustand
    ↓
User sends messages (text/audio)
    ↓
Process & get AI response
    ↓
Save to DB + Update local state
```

### 3. Prosody Analysis Flow

```
User records audio
    ↓
Convert to Blob
    ↓
POST /api/prosody-analysis
    ↓
Transcribe with Whisper
    ↓
Analyze with GPT-4
    ↓
Return scores + feedback
    ↓
Update message with prosody_feedback
    ↓
Display in UI with visualizations
```

## State Management

### Zustand Store Structure

```typescript
{
  // User state
  user: Profile | null
  
  // Conversation state
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Message[]
  currentTopic: string
  
  // Placement test
  placementTestProgress: PlacementTestProgress
  
  // Sync state (offline-first)
  sync: {
    online: boolean
    lastSync: Date | null
    syncing: boolean
    hasOfflineChanges: boolean
  }
  
  // Retry queue for failed requests
  retryQueue: Message[]
}
```

### Persistence Strategy

- **localStorage**: User, conversations, messages, sync state
- **Backup**: Separate backup in `vibetune-messages-backup`
- **Rehydration**: On app load, restore from localStorage
- **Sync**: Periodic sync with server when online

## Offline-First Architecture

### Strategy

1. **Optimistic Updates**: Update UI immediately, sync later
2. **Retry Queue**: Failed requests queued for retry
3. **Conflict Resolution**: Server data is source of truth
4. **Backup System**: Dual storage (Zustand + localStorage backup)

### Implementation

```typescript
// Add message optimistically
addMessage(message)
  ↓
Update Zustand store
  ↓
Save to localStorage backup
  ↓
If online: POST to /api/data
  ↓
If offline: Add to retry queue
  ↓
On reconnect: Process retry queue
```

## API Design

### RESTful Endpoints

- `POST /api/chat` - AI conversation
- `POST /api/prosody-analysis` - Voice analysis
- `POST /api/placement-test` - Level assessment
- `POST /api/transcribe` - Audio transcription
- `GET/POST /api/data` - Database operations

### Rate Limiting

- Chat: 60 req/min
- Placement test: 30 req/min
- Other: 100 req/min

### Error Handling

```typescript
{
  error: "Error type",
  message: "User-friendly message",
  details?: "Technical details"
}
```

## Security

### Authentication

- Supabase Auth with PKCE flow
- JWT tokens in Authorization header
- Auto-refresh tokens
- Secure session storage

### Authorization

- Row Level Security (RLS) on all tables
- User can only access own data
- Service role for backend operations

### API Security

- CORS configured for production domain
- Rate limiting with Upstash Redis
- Input validation on all endpoints
- No API keys in frontend code

### Data Privacy

- User data isolated by profile_id
- Conversations and messages protected by RLS
- Analytics anonymized where possible

## Performance Optimizations

### Frontend

- Code splitting with React.lazy()
- Image optimization with lazy loading
- Debounced API calls
- Memoized components with React.memo()
- Virtual scrolling for long message lists

### Backend

- Database indexes on hot paths
- Connection pooling in Supabase
- Edge caching with Vercel
- Compressed responses (gzip/brotli)

### Database

- GIN indexes for JSONB columns
- Composite indexes for common queries
- Materialized views for analytics (future)
- Automatic vacuuming

## Scalability

### Current Capacity

- Vercel: Auto-scales to traffic
- Supabase: 500MB database (free tier)
- OpenAI: Rate limited by API key tier

### Scaling Strategy

1. **Database**: Upgrade Supabase plan or migrate to dedicated PostgreSQL
2. **API**: Vercel Pro for higher limits
3. **Caching**: Add Redis for frequently accessed data
4. **CDN**: Vercel Edge Network handles this
5. **Analytics**: Move to dedicated analytics DB

## Monitoring & Observability

### Logging

- Frontend: Console logs with logger utility
- Backend: Vercel function logs
- Database: Supabase logs

### Metrics

- Vercel Analytics: Page views, performance
- Supabase: Database queries, auth events
- Custom: Analytics events table

### Error Tracking

- Frontend: ErrorBoundary component
- Backend: Try-catch with logging
- Future: Sentry integration

## Development Workflow

### Local Development

```bash
# Frontend
cd frontend && npm run dev

# Backend (serverless functions)
vercel dev
```

### Testing

- Jest configured for unit tests
- React Testing Library for components
- Currently: `--passWithNoTests` (tests planned)

### Deployment

- Push to main → Auto-deploy to Vercel
- Preview deployments for PRs
- Environment variables in Vercel dashboard

## Future Improvements

### Short-term

- [ ] Add unit tests for critical paths
- [ ] Implement error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Optimize bundle size

### Long-term

- [ ] Real-time collaboration features
- [ ] Mobile app with Capacitor
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Voice cloning for AI responses
- [ ] Gamification system

## Technical Debt

- No test coverage yet
- Some components could be split further
- Analytics could be more comprehensive
- Need better error messages for users
- Mobile responsiveness needs testing

## References

- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Zustand Documentation](https://zustand-demo.pmnd.rs)

---

**Last Updated:** December 2024  
**Version:** 1.0.0
