# VibeTune 🎭

> **Production-ready AI-powered English speech prosody learning app**

VibeTune is a comprehensive mobile-first application that helps ESL (English as a Second Language) learners improve their English prosody through AI-driven conversation practice, real-time pronunciation feedback, and adaptive learning experiences.

[![CI/CD Status](https://github.com/InnNhi24/VibeTune/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/InnNhi24/VibeTune/actions)
[![Coverage](https://codecov.io/gh/InnNhi24/VibeTune/branch/main/graph/badge.svg)](https://codecov.io/gh/InnNhi24/VibeTune)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Key Features

### 🤖 **AI-Powered Learning**
- **Advanced Prosody Analysis**: Real-time speech analysis using OpenAI GPT-4
- **Adaptive Conversations**: AI adjusts difficulty based on user performance
- **Contextual Feedback**: Personalized suggestions for pronunciation improvement
- **Multi-Topic Practice**: Travel, business, daily life, and more

### 📱 **Mobile-First Experience**
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Offline Capability**: Continue learning without internet connection
- **Progressive Web App**: Install as native app experience
- **Cross-Platform**: iOS, Android, and Web support via Capacitor

### 📊 **Learning Management**
- **Placement Testing**: AI-driven assessment to determine optimal learning level
- **Progress Tracking**: Detailed analytics and conversation history
- **Level Adaptation**: Beginner, Intermediate, and Advanced pathways
- **Retry System**: Robust offline sync with conflict resolution

### 🔐 **Enterprise-Grade Security**
- **OAuth Integration**: Google and GitHub authentication
- **Rate Limiting**: Comprehensive API protection
- **Data Privacy**: GDPR-compliant user data handling
- **Secure Storage**: Encrypted local and cloud data storage

## 🏗️ Tech Stack

### **Frontend**
- **React 18** + **TypeScript** - Modern component-based architecture
- **Tailwind CSS v4** - Utility-first styling with custom design system
- **Motion** - Smooth animations and micro-interactions
- **Zustand** - Lightweight state management with persistence
- **Capacitor** - Native mobile app deployment

### **Backend**
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **Edge Functions** - Serverless API with Deno runtime
- **Real-time Sync** - Live data synchronization
- **Storage** - Secure file and audio storage

### **AI Integration**
- **OpenAI GPT-4** - Advanced language processing
- **Deepgram** - Real-time speech recognition
- **Custom AI Service** - Prosody analysis engine
- **Streaming API** - Real-time conversation feedback

### **Testing & QA**
- **Vitest** - Lightning-fast unit testing
- **Testing Library** - Component testing utilities
- **Playwright** - End-to-end browser testing
- **Coverage Reports** - Comprehensive test coverage

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and npm
- **Supabase CLI** (for local development)
- **Git** for version control

### Installation

```bash
# Clone the repository
git clone https://github.com/InnNhi24/VibeTune.git
cd VibeTune

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start Supabase locally
npm run supabase:start

# Start development server
npm run dev
```

### Environment Setup

Copy and configure your environment:

```bash
# Copy environment template
cp env.local .env.local
```

Your `.env.local` should contain:

```env
# 🤖 AI Service Configuration
OPENAI_API_KEY=your_openai_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# 🗄️ Supabase Configuration (Private Keys)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# 🔧 Development Configuration
NODE_ENV=development
DEBUG=true
```

**⚠️ Security Note**: 
- Public Supabase keys are already configured in `/utils/supabase/info.tsx`
- NEVER commit `.env.local` to version control
- The `gitignore` file is configured to protect your secrets

## 📱 Mobile Development

### iOS Setup
```bash
# Build and sync iOS
npm run capacitor:build:ios

# Run on iOS device/simulator
npm run capacitor:run:ios
```

### Android Setup
```bash
# Build and sync Android
npm run capacitor:build:android

# Run on Android device/emulator
npm run capacitor:run:android
```

## 🧪 Testing

### Unit Tests
```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### End-to-End Tests
```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Linting & Formatting
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

## 🏛️ Architecture

### **State Management (Zustand)**
```typescript
interface AppStore {
  user: Profile | null;
  conversations: Conversation[];
  messages: Message[];
  sync: SyncStatus;
  retryQueue: Message[];
  placementTestProgress: PlacementTestProgress;
}
```

### **Component Structure**
```
components/
├── pages/           # Route-level components
│   ├── Onboarding   # Welcome and introduction
│   └── Auth         # Authentication flow
├── ui/              # Reusable UI components (shadcn/ui)
├── ChatPanel        # Main conversation interface
├── RecordingControls # Audio recording and playback
├── ProsodyFeedback  # AI analysis results
└── SyncStatusIndicator # Offline/online status
```

### **Services Architecture**
```
services/
├── aiProsodyService    # AI conversation and analysis
├── authServiceSimple   # Authentication management
├── supabaseClient     # Database operations
├── syncManager        # Offline/online synchronization
└── analyticsService   # User behavior tracking
```

## 🔄 Offline-First Architecture

VibeTune is designed to work seamlessly offline:

1. **Local Storage**: Messages and user data cached locally
2. **Retry Queue**: Failed operations queued for sync
3. **Conflict Resolution**: Latest-wins strategy for data conflicts
4. **Background Sync**: Automatic synchronization when online

## 📊 Database Schema

### Core Tables
```sql
-- User profiles
profiles (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  username text,
  level text CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  placement_test_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Conversations
conversations (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  topic text,
  is_placement_test boolean DEFAULT false,
  started_at timestamptz DEFAULT now()
);

-- Messages with prosody feedback
messages (
  id uuid PRIMARY KEY,
  conversation_id uuid REFERENCES conversations(id),
  sender text CHECK (sender IN ('user', 'ai')),
  content text,
  prosody_feedback jsonb,
  retry_of_message_id uuid REFERENCES messages(id),
  created_at timestamptz DEFAULT now()
);

-- Analytics events
analytics_events (
  id uuid PRIMARY KEY,
  profile_id uuid REFERENCES profiles(id),
  event_type text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

## 🚦 API Endpoints

### Authentication
- `POST /signup` - Create new user account
- `POST /signin` - User authentication

### AI Services
- `POST /api/ai-prosody-analysis` - Analyze speech audio
- `POST /api/ai-conversation` - Generate AI responses

### Data Management
- `POST /api/save-message` - Store conversation messages
- `POST /api/retry-message/:id` - Retry failed operations
- `GET /api/get-history` - Retrieve conversation history

### Analytics
- `POST /api/analytics` - Track user events

## 🔐 Security Features

### Rate Limiting
- **Authentication**: 5 requests/minute per IP
- **AI Analysis**: 100 requests/minute per user
- **Conversations**: 20 requests/minute per user
- **Retries**: 5 requests/minute per message

### Data Protection
- **HTTPS Only**: All API communications encrypted
- **CORS Policy**: Restricted to app domains
- **Token Rotation**: Automatic refresh token management
- **Input Validation**: Comprehensive request sanitization

## 📈 Performance Optimizations

### Frontend
- **Code Splitting**: Lazy-loaded route components
- **Image Optimization**: WebP format with fallbacks
- **Bundle Analysis**: Webpack bundle analyzer integration
- **Caching Strategy**: Service worker for offline assets

### Backend
- **Edge Functions**: Global CDN deployment
- **Database Indexing**: Optimized query performance
- **Connection Pooling**: Efficient database connections
- **Caching**: Redis-based response caching

## 🌍 Deployment

### Staging Environment
```bash
# Deploy to staging
git push origin develop

# Manual staging deployment
npm run build
npm run deploy:staging
```

### Production Deployment
```bash
# Deploy to production
git push origin main

# Manual production deployment
npm run build
npm run deploy:production
```

### Environment Configuration
- **Development**: Local Supabase + Mock AI
- **Staging**: Staging Supabase + Real AI APIs
- **Production**: Production Supabase + Full AI Integration

## 📚 Documentation

- [**API Documentation**](./docs/API.md) - Complete API reference
- [**AI Integration Guide**](./docs/AI_INTEGRATION_GUIDE.md) - AI service setup
- [**Component Documentation**](./docs/COMPONENTS.md) - UI component guide
- [**Database Schema**](./docs/DATABASE.md) - Complete schema reference

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Airbnb configuration with React hooks
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Semantic commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** - Advanced language model integration
- **Supabase** - Backend-as-a-Service platform
- **Deepgram** - Real-time speech recognition
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first CSS framework

---

## 🆘 Support

### Getting Help
- 📖 [Documentation](https://github.com/InnNhi24/VibeTune/wiki)
- 🐛 [Issue Tracker](https://github.com/InnNhi24/VibeTune/issues)
- 💬 [Discussions](https://github.com/InnNhi24/VibeTune/discussions)
- 📧 [Email Support](mailto:support@vibetune.com)

### Status
- 🟢 **Production**: [vibetune.app](https://vibetune.app)
- 🟡 **Staging**: [vibetune-staging.vercel.app](https://vibetune-staging.vercel.app)
- 📊 **Status Page**: [status.vibetune.app](https://status.vibetune.app)

---

**Built with ❤️ by the VibeTune Team**