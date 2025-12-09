# � VibeTTune - AI-Powered English Pronunciation Learning Platform

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
- Node.js 18+ and npm
- Supabase account
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/vibetune.git
cd vibetune
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

Edit `.env` with your credentials:
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Optional: Upstash Redis for rate limiting
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
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
vibetune/
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

## 📖 API Documentation

### Main Endpoints

- `POST /api/chat` - AI conversation
- `POST /api/prosody-analysis` - Voice analysis
- `POST /api/placement-test` - Level assessment
- `POST /api/transcribe` - Audio transcription
- `GET/POST /api/data` - Database operations

See [API.md](./docs/API.md) for complete API documentation.

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- API rate limiting with Upstash Redis
- CORS configuration for production
- Secure authentication with Supabase
- No API keys exposed in frontend

## 🌍 Environment Variables

See [.env.example](./.env.example) for all required environment variables.

## � Lipcense

MIT License - see [LICENSE](./LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./docs/CONTRIBUTING.md) first.

## 📧 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/InnNhi24/VibeTune/issues)
- Live App: [https://vibe-tune-two.vercel.app](https://vibe-tune-two.vercel.app)

## 🙏 Acknowledgments

- OpenAI for Whisper and GPT-4 APIs
- Supabase for backend infrastructure
- Vercel for hosting platform

---

Built with ❤️ for English learners worldwide
