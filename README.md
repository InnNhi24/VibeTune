# 🎵 VibeTune - AI-Powered English Pronunciation Learning Platform

VibeTune is an intelligent English pronunciation learning platform that uses AI to provide real-time feedback on your speaking skills. Practice conversations, get detailed prosody analysis, and improve your English pronunciation with personalized AI coaching.

🌐 **Live Demo:** [https://vibe-tune-two.vercel.app](https://vibe-tune-two.vercel.app)

## ✨ Features

### 🎯 Core Features
- **AI Conversation Practice** - Natural conversations with AI on topics you choose
- **Real-time Prosody Analysis** - Powered by OpenAI Whisper & GPT-4
- **Voice & Text Input** - Flexible input methods for all learning styles
- **Detailed Feedback** - Pronunciation, rhythm, intonation, and fluency scores
- **Placement Test** - AI-powered assessment to determine your level
- **Session Management** - Smart conversation limits with comprehensive summaries
- **Offline Support** - Continue learning even without internet connection

### 📊 Prosody Analysis
- Overall pronunciation score
- Detailed metrics: Pronunciation, Rhythm, Intonation, Fluency
- Word-level feedback with specific issues
- AI-generated improvement suggestions
- 5-star rating system for tracking progress

### 🎓 Learning Levels
- **Beginner** - Basic pronunciation and sentence stress
- **Intermediate** - Word stress, question intonation, linking sounds
- **Advanced** - Accent reduction, complex intonation, natural rhythm

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x and npm
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/InnNhi24/VibeTune.git
cd VibeTune
```

2. Install dependencies
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` with your credentials (get from respective service dashboards):
```env
# Supabase (from supabase.com project settings)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (from platform.openai.com)
OPENAI_API_KEY=sk-proj-...

# Optional: Upstash Redis for rate limiting (from upstash.com)
UPSTASH_REDIS_REST_URL=https://your-redis-id.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXAAIncDEyMzQ1Njc4...
```

4. Run database migrations
```bash
# Apply schema to your Supabase database
# Copy contents of supabase/schema.sql to Supabase SQL Editor
```

5. Start development servers
```bash
# Frontend
cd frontend
npm run dev

# Backend (if needed)
cd backend
npm run dev
```

## 📁 Project Structure

```
VibeTune/
├── api/                    # Serverless API endpoints
│   ├── chat.ts            # AI conversation endpoint
│   ├── prosody-analysis.ts # Voice analysis endpoint
│   ├── placement-test.ts  # Placement test scoring
│   ├── transcribe.ts      # Audio transcription
│   └── data.ts            # Database operations
├── frontend/              # React + TypeScript frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   ├── store/         # Zustand state management
│   │   └── utils/         # Utility functions
│   └── public/            # Static assets
├── supabase/              # Database schema
│   └── schema.sql         # Database tables & policies
└── docs/                  # Documentation
    ├── API.md             # API documentation
    ├── DEPLOYMENT.md      # Deployment guide
    ├── ARCHITECTURE.md    # System architecture
    └── DEVELOPMENT.md     # Development guide
```

## 🔧 Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Framer Motion** - Animations
- **Shadcn/ui** - UI components

### Backend
- **Vercel Serverless Functions** - API hosting
- **Supabase** - Database & Authentication
- **OpenAI API** - AI & Speech processing
  - Whisper - Speech-to-text
  - GPT-4 - Conversation & feedback

### Infrastructure
- **Vercel** - Hosting & deployment
- **Supabase** - PostgreSQL database
- **Upstash Redis** - Rate limiting (optional)

## 🎮 Usage

### For Users

1. **Sign Up** - Create an account with email or social login
2. **Choose Level** - Select your level or take the placement test
3. **Start Conversation** - Pick a topic and start practicing
4. **Record Voice** - Speak naturally and get instant feedback
5. **Review Analysis** - Check your scores and improvement areas
6. **Track Progress** - View session summaries and recommendations

### For Developers

See [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for detailed development guide.

## 📖 Documentation

- **[API.md](./docs/API.md)** - Complete API reference
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deployment guide
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture
- **[DEVELOPMENT.md](./docs/DEVELOPMENT.md)** - Development guide

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- API rate limiting with Upstash Redis
- CORS configuration for production
- Secure authentication with Supabase
- No API keys exposed in frontend

## 🌍 Environment Variables

See [.env.example](./.env.example) for all required environment variables.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 📧 Support

For issues and questions:
- **GitHub Issues**: [Create an issue](https://github.com/InnNhi24/VibeTune/issues)
- **Email**: almira.ynh@gmail.com
- **Live App**: [https://vibe-tune-two.vercel.app](https://vibe-tune-two.vercel.app)

## 🙏 Acknowledgments

- OpenAI for Whisper and GPT-4 APIs
- Supabase for backend infrastructure
- Vercel for hosting platform

---

Built with ❤️ for English learners worldwide
