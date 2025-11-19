# VibeTune Development Guide

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for API functions)
- `OPENAI_API_KEY` - Your OpenAI API key

### 3. Development Options

#### Option A: Frontend Only (Recommended for UI development)

```bash
npm run dev --workspace=frontend
```

This runs the frontend at `http://localhost:3000`. API calls will fail but the app will work with localStorage.

#### Option B: Full Stack with Vercel Dev

```bash
vercel dev
```

This runs both frontend and API functions locally. Use this when testing API integrations.

## Development Notes

### API Calls in Development

- **Frontend only mode**: API calls will fail gracefully. Data is saved to localStorage.
- **Vercel dev mode**: API calls work normally, connecting to Supabase.

### Console Warnings

You may see these warnings in development:

- `⚠️ Failed to save conversation to database` - Expected if not running `vercel dev`
- `⚠️ Error saving conversation (network/CORS)` - Expected if API server is not running

These are non-blocking. The app saves data to localStorage as a fallback.

## Project Structure

```
VibeTune/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/     # Zustand state management
│   │   └── utils/
│   └── package.json
├── api/              # Vercel serverless functions
│   ├── chat.ts
│   ├── save-conversation.ts
│   └── ...
└── package.json      # Monorepo root
```

## Common Issues

### CORS Errors

If you see CORS errors:
1. Make sure you're running `vercel dev` (not just `npm run dev`)
2. Check that `ALLOWED_ORIGINS` in `.env` includes your dev URL

### API Not Found (404)

If API calls return 404:
1. Run `vercel dev` instead of `npm run dev`
2. Check that API files are in the `api/` directory
3. Verify `vercel.json` configuration

### Supabase Connection Issues

If Supabase calls fail:
1. Verify your `.env` has correct Supabase credentials
2. Check Supabase project is active
3. Verify RLS policies allow your operations

## Testing

```bash
# Run frontend tests
npm run test --workspace=frontend

# Run with coverage
npm run test:coverage --workspace=frontend
```

## Building for Production

```bash
# Build frontend
npm run build --workspace=frontend

# Preview production build
npm run preview --workspace=frontend
```

## Deployment

The app is configured for Vercel deployment:

```bash
vercel deploy
```

Or push to `main` branch for automatic deployment via GitHub integration.
