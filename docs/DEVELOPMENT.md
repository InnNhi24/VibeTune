# 🛠️ VibeTune Development Guide

## Prerequisites

### Required

- **Node.js**: v20.x (required by package.json)
- **npm**: v9.x or higher
- **Git**: Latest version

### Accounts Needed

- **Supabase**: Free account at [supabase.com](https://supabase.com)
- **OpenAI**: API key from [platform.openai.com](https://platform.openai.com)
- **Vercel**: Account for deployment (optional for local dev)

### Optional

- **Upstash**: Redis for rate limiting (optional)
- **VS Code**: Recommended IDE with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense

---

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/InnNhi24/VibeTune.git
cd VibeTune
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies (if needed)
cd ../backend
npm install

# Return to root
cd ..
```

### 3. Environment Setup

#### Create Environment Files

```bash
# Root .env (for API functions)
cp .env.example .env

# Frontend .env
cp frontend/.env.example frontend/.env

# Backend .env (if using)
cp backend/.env.example backend/.env
```

#### Configure Environment Variables

**Root `.env`:**
```env
# Supabase (get from your Supabase project settings)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (get from platform.openai.com)
OPENAI_API_KEY=sk-proj-...

# CORS (for local dev)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Optional: Rate Limiting (get from upstash.com)
UPSTASH_REDIS_REST_URL=https://your-redis-id.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXAAIncDEyMzQ1Njc4...

# Environment
NODE_ENV=development
APP_ENV=development
```

**Frontend `frontend/.env`:**
```env
# Supabase (public keys - get from your Supabase project settings)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API Base URL (for local dev)
VITE_API_BASE_URL=http://localhost:3000
```

### 4. Database Setup

#### Apply Schema to Supabase

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy contents of `supabase/schema.sql`
4. Paste and execute
5. Verify tables are created in Table Editor

#### Verify Setup

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Should see: profiles, conversations, messages, analytics_events, etc.
```

### 5. Start Development Servers

#### Option A: Frontend Only (Recommended for UI work)

```bash
cd frontend
npm run dev
```

Access at: `http://localhost:5173`

#### Option B: Full Stack with Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Start Vercel dev server (includes API functions)
vercel dev
```

Access at: `http://localhost:3000`

#### Option C: Backend Separately (if needed)

```bash
cd backend
npm run dev
```

---

## Project Structure

```
VibeTune/
├── api/                      # Vercel serverless functions
│   ├── chat.ts              # AI conversation endpoint
│   ├── prosody-analysis.ts  # Voice analysis
│   ├── placement-test.ts    # Placement test scoring
│   ├── transcribe.ts        # Audio transcription
│   └── data.ts              # Database operations
│
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── pages/       # Page components
│   │   │   ├── ui/          # Shadcn/ui components
│   │   │   └── ...          # Feature components
│   │   ├── services/        # API services
│   │   │   ├── supabaseClient.ts
│   │   │   ├── authServiceSimple.ts
│   │   │   └── analyticsServiceSimple.ts
│   │   ├── store/           # Zustand state management
│   │   │   └── appStore.ts
│   │   ├── contexts/        # React contexts
│   │   ├── utils/           # Utility functions
│   │   ├── pages/           # Page components
│   │   ├── App.tsx          # Main app component
│   │   └── index.css        # Global styles
│   ├── public/              # Static assets
│   └── package.json
│
├── backend/                  # Express backend (optional)
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── index.ts
│   └── package.json
│
├── supabase/                 # Database schema
│   └── schema.sql
│
├── docs/                     # Documentation
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── ARCHITECTURE.md
│   └── DEVELOPMENT.md (this file)
│
├── .env.example              # Environment template
├── vercel.json               # Vercel configuration
├── package.json              # Root package.json
└── README.md
```

---

## Development Workflow

### Code Style

#### ESLint

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix
```

#### Prettier

```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature"

# Push to GitHub
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

#### Commit Message Convention

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

Examples:
```
feat: add voice recording component
fix: resolve audio playback issue
docs: update API documentation
refactor: simplify state management
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

### Writing Tests

Tests are located next to the files they test:

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
```

Example test:

```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

**Note:** Test suite is currently minimal. Tests are planned for future development.

---

## Debugging

### Frontend Debugging

#### Browser DevTools

1. Open Chrome DevTools (F12)
2. Go to Sources tab
3. Set breakpoints in source files
4. Inspect state in React DevTools

#### Console Logging

```typescript
import { logger } from './utils/logger';

logger.info('User logged in', { userId: user.id });
logger.warn('API call failed', { error });
logger.error('Critical error', { error });
```

#### Zustand DevTools

```typescript
// In appStore.ts, add devtools middleware
import { devtools } from 'zustand/middleware';

export const useAppStore = create(
  devtools(
    persist(
      (set, get) => ({
        // ... store implementation
      }),
      { name: 'vibetune-app-store' }
    ),
    { name: 'VibeTune Store' }
  )
);
```

### Backend Debugging

#### Vercel Function Logs

```bash
# View logs in real-time
vercel logs --follow

# View logs for specific function
vercel logs api/chat.ts
```

#### Local Debugging

Add console.log in API functions:

```typescript
export default async function handler(req, res) {
  console.log('Request received:', req.method, req.url);
  console.log('Body:', req.body);
  
  // ... handler logic
}
```

### Database Debugging

#### Supabase SQL Editor

```sql
-- Check recent conversations
SELECT * FROM conversations 
ORDER BY created_at DESC 
LIMIT 10;

-- Check messages for a conversation
SELECT * FROM messages 
WHERE conversation_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY created_at;

-- Check user profile
SELECT * FROM profiles 
WHERE email = 'almira.ynh@gmail.com';
```

#### Enable Query Logging

In Supabase Dashboard:
1. Go to Settings > Database
2. Enable "Log queries"
3. View in Logs section

---

## Common Tasks

### Adding a New Component

```bash
# Create component file
touch frontend/src/components/MyComponent.tsx

# Create test file
touch frontend/src/components/MyComponent.test.tsx
```

```typescript
// MyComponent.tsx
import { FC } from 'react';

interface MyComponentProps {
  title: string;
}

export const MyComponent: FC<MyComponentProps> = ({ title }) => {
  return <div>{title}</div>;
};
```

### Adding a New API Endpoint

```bash
# Create API function
touch api/my-endpoint.ts
```

```typescript
// api/my-endpoint.ts
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Your logic here
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

Update `vercel.json`:

```json
{
  "functions": {
    "api/my-endpoint.ts": { "maxDuration": 10 }
  }
}
```

### Adding a Database Table

1. Write migration SQL in `supabase/schema.sql`
2. Test locally in Supabase SQL Editor
3. Apply to production database
4. Update TypeScript types in `frontend/src/services/supabaseClient.ts`

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update specific package
npm update package-name

# Update all packages (careful!)
npm update

# Update package.json and install
npm install package-name@latest
```

---

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Kill process on port 5173
npx kill-port 5173

# Or use different port
npm run dev -- --port 3001
```

#### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Supabase Connection Issues

- Verify `SUPABASE_URL` and keys in `.env`
- Check Supabase project is active
- Verify RLS policies allow access
- Check network/firewall settings

#### OpenAI API Errors

- Verify API key is valid
- Check API quota/billing
- Ensure correct model names (gpt-4, whisper-1)
- Check rate limits

#### Build Errors

```bash
# Clear Vite cache
rm -rf frontend/node_modules/.vite

# Clear build output
rm -rf frontend/dist

# Rebuild
cd frontend && npm run build
```

### Getting Help

- **GitHub Issues**: [Create an issue](https://github.com/InnNhi24/VibeTune/issues)
- **Email**: almira.ynh@gmail.com
- **Documentation**: Check other docs in `/docs` folder

---

## Performance Tips

### Frontend Optimization

- Use React.memo() for expensive components
- Lazy load routes with React.lazy()
- Optimize images (WebP format, lazy loading)
- Debounce API calls
- Use virtual scrolling for long lists

### Backend Optimization

- Add database indexes for slow queries
- Cache frequently accessed data
- Minimize API calls
- Use connection pooling
- Compress responses

### Development Speed

- Use Vite's HMR effectively
- Keep dev server running
- Use TypeScript for better autocomplete
- Install recommended VS Code extensions

---

## Resources

### Documentation

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [Zustand Docs](https://zustand-demo.pmnd.rs)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Tools

- [Supabase Studio](https://supabase.com/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [OpenAI Playground](https://platform.openai.com/playground)
- [React DevTools](https://react.dev/learn/react-developer-tools)

### Learning Resources

- [React Tutorial](https://react.dev/learn)
- [TypeScript for React](https://react-typescript-cheatsheet.netlify.app/)
- [Supabase Tutorial](https://supabase.com/docs/guides/getting-started)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

---

**Happy Coding! 🚀**

For questions or issues, reach out via GitHub Issues or email almira.ynh@gmail.com
