# VibeTune Setup Guide 🚀

This comprehensive guide will help you set up VibeTune from scratch, whether you're a developer, contributor, or someone looking to deploy the application.

## 📋 Prerequisites

### Required Software
- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **npm** 9.0.0 or higher (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))
- **VS Code** or your preferred code editor

### Recommended Tools
- **Supabase CLI** - For local database development
- **Docker** - For containerized development (optional)
- **Postman** - For API testing (optional)

## 🔧 Installation Steps

### 1. Clone the Repository

```bash
# Using HTTPS
git clone https://github.com/yourusername/vibetune.git

# Using SSH (recommended for contributors)
git clone git@github.com:yourusername/vibetune.git

# Navigate to project directory
cd vibetune
```

### 2. Install Dependencies

```bash
# Install all project dependencies
npm install

# Verify installation
npm run type-check
```

### 3. Environment Configuration

Create your environment file:

```bash
# Copy the example environment file
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# ====================================
# SUPABASE CONFIGURATION
# ====================================
VITE_SUPABASE_URL=https://qwvxgdrhjtgqwwksqebf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3dnhnZHJoanRncXd3a3NxZWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNTA2NDIsImV4cCI6MjA3MzcyNjY0Mn0.A37IkjTB0pZCs1JQEuE65IL6OQt0gJk1Wt6YpVpGnKA

# ====================================
# AI SERVICES (REQUIRED FOR PRODUCTION)
# ====================================
# OpenAI API for advanced AI features
OPENAI_API_KEY=your_openai_api_key_here

# Deepgram API for speech recognition
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# Supabase Service Role Key (Server-side only)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# ====================================
# APP CONFIGURATION
# ====================================
VITE_APP_ENV=development
VITE_APP_VERSION=1.0.0
VITE_APP_NAME=VibeTune

# ====================================
# DEVELOPMENT SETTINGS
# ====================================
VITE_DEBUG_MODE=true
VITE_MOCK_AI=false
```

## 🗃️ Database Setup

### Option 1: Local Supabase (Recommended for Development)

1. **Install Supabase CLI**:
```bash
npm install -g supabase
```

2. **Start Local Supabase**:
```bash
npm run supabase:start
```

3. **Apply Database Migrations**:
```bash
npm run supabase:reset
```

4. **Access Local Dashboard**:
- **Studio**: http://localhost:54323
- **API URL**: http://localhost:54321
- **Anon Key**: Available in CLI output

### Option 2: Cloud Supabase

1. **Create Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note down your project URL and anon key

2. **Set up Database Schema**:
```sql
-- Run this in your Supabase SQL editor
-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text UNIQUE NOT NULL,
  username text NOT NULL,
  level text CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  placement_test_completed boolean DEFAULT false,
  placement_test_score integer,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz DEFAULT now(),
  device_id text
);

-- Create conversations table
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  is_placement_test boolean DEFAULT false,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- Create messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  sender text CHECK (sender IN ('user', 'ai')) NOT NULL,
  type text CHECK (type IN ('text', 'audio')) NOT NULL,
  content text NOT NULL,
  audio_url text,
  prosody_feedback jsonb,
  vocab_suggestions jsonb,
  guidance text,
  retry_of_message_id uuid REFERENCES messages(id),
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create analytics_events table
CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_id AND conversations.profile_id = auth.uid())
);
CREATE POLICY "Users can create messages" ON messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM conversations WHERE conversations.id = conversation_id AND conversations.profile_id = auth.uid())
);

CREATE POLICY "Users can create analytics events" ON analytics_events FOR INSERT WITH CHECK (auth.uid() = profile_id);
```

3. **Configure Authentication**:
   - Enable Google OAuth (optional)
   - Enable GitHub OAuth (optional)
   - Configure email settings

## 🤖 AI Services Setup

### OpenAI Configuration

1. **Get API Key**:
   - Visit [OpenAI Platform](https://platform.openai.com)
   - Create API key
   - Add to `.env.local`

2. **Test Integration**:
```bash
# Test OpenAI connection
curl -X POST "http://localhost:5173/test-openai" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!"}'
```

### Deepgram Configuration (Optional)

1. **Get API Key**:
   - Visit [Deepgram Console](https://console.deepgram.com)
   - Create API key
   - Add to `.env.local`

2. **Test Integration**:
```bash
# Test Deepgram connection
curl -X POST "http://localhost:5173/test-deepgram" \
  -H "Authorization: Token YOUR_DEEPGRAM_KEY" \
  -F "audio=@sample.wav"
```

## 🏃‍♂️ Running the Application

### Development Mode

```bash
# Start development server
npm run dev

# Server will start at http://localhost:5173
# Hot reload enabled for instant updates
```

### Testing the Setup

1. **Access the Application**:
   - Open http://localhost:5173 in your browser
   - You should see the VibeTune onboarding screen

2. **Test Authentication**:
   - Click "Sign Up" or "Sign In"
   - Try creating a test account
   - Verify email/OAuth flows work

3. **Test AI Features**:
   - Complete onboarding
   - Try the placement test
   - Test voice recording (if AI keys configured)

## 📱 Mobile Development Setup

### iOS Setup

1. **Prerequisites**:
   - macOS with Xcode installed
   - iOS Simulator or physical device
   - Apple Developer account (for device testing)

2. **Build iOS App**:
```bash
# Build web assets
npm run build

# Add iOS platform
npx cap add ios

# Sync with Capacitor
npm run capacitor:sync

# Open in Xcode
npm run capacitor:build:ios
```

3. **Run on Device**:
```bash
# Run on connected device/simulator
npm run capacitor:run:ios
```

### Android Setup

1. **Prerequisites**:
   - Android Studio installed
   - Android SDK configured
   - Physical device or emulator

2. **Build Android App**:
```bash
# Build web assets
npm run build

# Add Android platform
npx cap add android

# Sync with Capacitor
npm run capacitor:sync

# Open in Android Studio
npm run capacitor:build:android
```

3. **Run on Device**:
```bash
# Run on connected device/emulator
npm run capacitor:run:android
```

## 🧪 Testing Setup

### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### E2E Tests

```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## 🚀 Production Deployment

### Vercel Deployment

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Deploy**:
```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

3. **Configure Environment Variables**:
   - Add all production environment variables in Vercel dashboard
   - Ensure CORS is configured for your domain

### Supabase Edge Functions

1. **Deploy Functions**:
```bash
# Deploy all functions
npm run supabase:deploy

# Deploy specific function
supabase functions deploy analyze-audio
```

2. **Configure Secrets**:
```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=your_key_here

# Set Deepgram API key
supabase secrets set DEEPGRAM_API_KEY=your_key_here
```

## 🔍 Troubleshooting

### Common Issues

#### "Cannot connect to Supabase"
```bash
# Check if Supabase is running
supabase status

# Restart Supabase
supabase stop
supabase start
```

#### "AI features not working"
- Verify API keys in `.env.local`
- Check console for error messages
- Ensure you have sufficient API credits

#### "Build fails"
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
npm run build --force
```

#### "Mobile app won't start"
```bash
# Clean and rebuild
npm run build
npx cap sync
npx cap run ios  # or android
```

### Getting Help

1. **Check Logs**:
   - Browser console for frontend issues
   - Supabase logs for backend issues
   - Mobile device logs for app issues

2. **Debug Mode**:
   - Set `VITE_DEBUG_MODE=true` in `.env.local`
   - Enable verbose logging

3. **Community Support**:
   - GitHub Issues for bug reports
   - GitHub Discussions for questions
   - Discord community for real-time help

## 🎯 Next Steps

After successful setup:

1. **Explore the Codebase**:
   - Review component structure
   - Understand state management
   - Learn the AI integration

2. **Make Your First Change**:
   - Try modifying a component
   - Add a new feature
   - Write tests for your changes

3. **Contribute**:
   - Fork the repository
   - Create a feature branch
   - Submit a pull request

## 📚 Additional Resources

- [**API Documentation**](./API.md)
- [**Component Guide**](./COMPONENTS.md)
- [**AI Integration Guide**](./AI_INTEGRATION_GUIDE.md)
- [**Deployment Guide**](./DEPLOYMENT.md)

---

**Happy coding! 🎉**

If you encounter any issues during setup, please [open an issue](https://github.com/yourusername/vibetune/issues) or join our [community discussions](https://github.com/yourusername/vibetune/discussions).