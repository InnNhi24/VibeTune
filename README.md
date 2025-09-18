# VibeTune - AI English Prosody Learning App

VibeTune is a comprehensive mobile-first AI chatbot application designed to help ESL (English as Second Language) users improve their English prosody skills including intonation, rhythm, and stress patterns through interactive AI-powered conversations.

## 🎯 App Overview

**Name**: VibeTune  
**Goal**: Help ESL users improve English prosody (intonation, rhythm, stress)  
**Platform**: React + Capacitor for mobile/web deployment  
**Stack**: React + TypeScript + Tailwind CSS + Zustand + Supabase  

### Key Features

- **AI-Powered Prosody Analysis**: Real-time feedback on pronunciation, rhythm, and intonation
- **Interactive Voice Chat**: Speech-to-text with AI responses and prosody scoring
- **Placement Testing**: Multi-topic assessment with dynamic AI adaptation
- **Level-Based Learning**: Personalized content based on user skill level
- **Offline-First Architecture**: Seamless sync with conflict resolution
- **OAuth Authentication**: Google and GitHub sign-in support
- **Comprehensive Analytics**: User progress tracking and event analytics
- **Mobile-First Design**: Responsive design optimized for mobile devices

## 🎨 Design System

### Color Palette
```css
Primary: #FDEFB2     /* Warm, friendly yellow */
Secondary: #F9D776   /* Softer yellow accent */
CTA: #8686AF         /* Calm purple for actions */
Success: #90CDC3     /* Soothing teal */
Error: #FF746C       /* Gentle red for errors */
Background: #FFFDF5  /* Cream background */
Text: #1F2937        /* Dark gray text */
```

### Typography
- **Font**: Friendly sans-serif optimized for ESL readability
- **Hierarchy**: Clear heading levels with consistent spacing
- **Accessibility**: High contrast ratios and readable sizes

### Motion Design
- **Smooth Animations**: Fade/slide transitions for content
- **Pulsing Mic**: Recording button animation
- **Progressive Disclosure**: Smooth panel collapse/expand

## 🏗️ Architecture

### Frontend Structure
```
├── App.tsx                 # Main app with routing logic
├── components/
│   ├── pages/             # Full-page components
│   │   ├── Onboarding.tsx
│   │   └── Auth.tsx
│   ├── MainAppScreen.tsx  # Main chat interface
│   ├── ChatPanel.tsx      # Chat conversation window
│   ├── MessageBubble.tsx  # Individual message display
│   ├── RecordingControls.tsx # Voice recording interface
│   ├── AppSidebar.tsx     # Navigation and history
│   ├── LevelSelection.tsx # Skill level picker
│   ├── PlacementTest.tsx  # Assessment interface
│   └── SyncStatusIndicator.tsx # Offline/sync status
├── services/              # Core business logic
│   ├── authService.ts     # Authentication management
│   ├── syncManager.ts     # Offline sync orchestration
│   ├── offlineService.ts  # Local data management
│   ├── apiAnalyzeAudio.ts # AI audio analysis
│   └── analyticsService.ts # Event tracking
└── contexts/
    └── AppContext.tsx     # Global state management
```

### Backend Infrastructure
```
supabase/functions/server/
├── index.tsx              # Hono web server
├── kv_store.tsx          # Key-value data utilities
└── API Endpoints:
    ├── /signup           # User registration
    ├── /api/analyze-audio # Prosody analysis
    ├── /api/save-message # Message persistence
    ├── /api/retry-message # Feedback retry
    ├── /api/get-history  # Conversation history
    └── /api/analytics    # Event tracking
```

### Database Schema (Supabase)
```sql
-- User profiles
profiles (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  level TEXT, -- 'Beginner', 'Intermediate', 'Advanced'
  placement_test_completed BOOLEAN DEFAULT FALSE,
  placement_test_score INTEGER,
  created_at TIMESTAMP,
  last_login TIMESTAMP
)

-- Conversation sessions
conversations (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  topic TEXT NOT NULL,
  is_placement_test BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  device_id TEXT
)

-- Individual messages
messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender TEXT NOT NULL, -- 'user' | 'ai'
  type TEXT NOT NULL,   -- 'text' | 'audio'
  content TEXT NOT NULL,
  audio_url TEXT,
  prosody_feedback JSONB, -- Detailed analysis results
  vocab_suggestions JSONB,
  guidance TEXT,
  retry_of_message_id UUID,
  version INTEGER DEFAULT 1,
  device_id TEXT,
  created_at TIMESTAMP
)

-- Analytics and usage tracking
analytics_events (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP
)
```

## 🔐 Authentication & Security

### OAuth Integration
- **Google OAuth**: Complete setup required at [Google Console](https://console.cloud.google.com)
- **GitHub OAuth**: Setup at [GitHub Developer Settings](https://github.com/settings/developers)
- **Security**: PKCE flow with refresh token rotation
- **Sessions**: httpOnly secure cookies with automatic refresh

### Rate Limiting
```typescript
// API endpoint limits
auth: 5 requests/minute
chat/send: 20 requests/minute/user
retry: 5 requests/minute/message
analyze-audio: 100 requests/minute/user
```

### CORS Configuration
- Restricted to app domains
- Proper header management for secure cross-origin requests

## 🤖 AI Integration

### Prosody Analysis Pipeline
1. **Audio Input**: WebRTC capture or file upload
2. **Speech-to-Text**: Whisper API transcription
3. **Prosody Analysis**: Custom AI model analyzing:
   - Intonation patterns
   - Rhythm and timing
   - Word/syllable stress
   - Pronunciation accuracy
4. **Feedback Generation**: Contextual suggestions and scores

### AI Response System
- **Streaming Responses**: Real-time conversation flow
- **Level Adaptation**: Content adjusted to user skill level
- **Context Awareness**: Maintains conversation coherence
- **Retry Mechanism**: Alternative feedback on user request

## 📱 User Experience Flow

### New User Journey
1. **Onboarding**: Welcome screen with app introduction
2. **Authentication**: Email/password or OAuth signup
3. **Level Selection**: 
   - **Primary**: Self-select skill level (prominent buttons)
   - **Secondary**: Take placement test (small button in corner)
4. **Main Chat**: AI conversation interface

### Returning User Journey
1. **Auto-Login**: Session restoration
2. **Direct Access**: Immediate main app access
3. **Progress Continuation**: Resume where they left off

### Placement Test Features
- Multi-topic conversation assessment
- Dynamic difficulty adjustment
- Real-time prosody scoring
- Level recommendation with confidence metrics
- **Retry Option**: "Redo Placement Test" button (only for completed users)

## 🔄 Offline Sync Architecture

### Sync Strategy
- **Offline-First**: All operations work without connection
- **Automatic Sync**: Periodic background synchronization
- **Conflict Resolution**: Latest-wins strategy with version control
- **Retry Queue**: Failed operations automatically retried

### Data Flow
```typescript
// Offline operation
user.sendMessage() → localDB.store() → syncQueue.add()

// Coming online
network.connect() → syncManager.processQueue() → server.sync()

// Conflict resolution
if (serverVersion > localVersion) {
  merge(localChanges, serverData)
} else {
  uploadLocal()
}
```

## 📊 Analytics & Monitoring

### Event Tracking
```typescript
// User behavior events
trackEvent('placement_test_completed', {
  userId, score, level, duration
})

trackEvent('conversation_started', {
  userId, topic, level
})

trackEvent('prosody_feedback_received', {
  userId, score, improvements
})
```

### Performance Metrics
- Sync success rates
- Audio processing latency
- User engagement metrics
- Error rates and patterns

## 🧪 Testing Strategy

### Test Coverage
- **Unit Tests**: Component logic and utilities
- **Integration Tests**: API endpoints and data flow
- **E2E Tests**: Complete user journeys
- **Accessibility Tests**: ARIA compliance and keyboard navigation
- **Performance Tests**: Load testing and optimization

### Mock Services
- Audio analysis simulation
- Offline scenario testing  
- Authentication flow testing
- Sync conflict simulation

## 🚀 Deployment & Infrastructure

### Frontend Deployment
- **Web**: Vercel with automatic deployments
- **Mobile**: Capacitor build for iOS/Android
- **CDN**: Optimized asset delivery

### Backend Deployment
- **Supabase**: Hosted PostgreSQL and edge functions
- **Environment Variables**: Secure API key management
- **Monitoring**: Error tracking and performance monitoring

### CI/CD Pipeline
```yaml
# GitHub Actions workflow
- Lint and type checking
- Unit and integration tests
- Build optimization
- Deployment to staging
- Production deployment approval
- Post-deployment monitoring
```

## 📈 Roadmap & Future Enhancements

### Phase 1 (Current)
- ✅ Core chat interface with AI
- ✅ Basic prosody analysis
- ✅ Offline sync
- ✅ Authentication system

### Phase 2 (Next)
- 🔄 Advanced prosody algorithms
- 🔄 Social features (group conversations)
- 🔄 Detailed progress analytics
- 🔄 Gamification elements

### Phase 3 (Future)
- 📋 Specialized conversation topics
- 📋 Teacher/student dashboard
- 📋 Advanced reporting
- 📋 Multi-language support

## 🛠️ Development Setup

### Prerequisites
```bash
Node.js 18+
npm or yarn
Supabase CLI
```

### Environment Variables
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
```

### Getting Started
```bash
# Clone repository
git clone <repository-url>
cd vibetune

# Install dependencies
npm install

# Start development server
npm run dev

# Start Supabase locally
supabase start

# Run tests
npm test
```

### Building for Production
```bash
# Web build
npm run build

# Mobile build (iOS)
npx cap add ios
npx cap run ios

# Mobile build (Android)
npx cap add android
npx cap run android
```

## 🤝 Contributing

### Code Standards
- TypeScript strict mode
- ESLint + Prettier formatting
- Comprehensive test coverage
- Accessibility compliance (WCAG 2.1 AA)

### Pull Request Process
1. Feature branch from main
2. Comprehensive tests
3. Documentation updates
4. Code review approval
5. Automated deployment

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Supabase for backend infrastructure
- OpenAI for AI capabilities
- Tailwind CSS for styling system
- Motion for animations
- React community for ecosystem

---

**VibeTune** - Empowering English learners through AI-driven prosody improvement. 🎤✨