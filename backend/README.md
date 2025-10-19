# VibeTune – Backend API

VibeTune is a mobile-first AI prosody learning app for English learners. Users chat by text or voice with an AI tutor. The app analyzes grammar, vocabulary, and prosody (rate, pitch, energy, pauses) and returns short feedback each turn. Data is stored in Supabase.

## Tech Stack
- Runtime: Node.js (TypeScript)
- External services: OpenAI (chat + analysis), Deepgram (speech-to-text; optional if audioUrl provided)
- Database: Supabase (Auth, Postgres, RLS) via REST endpoints

## Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm
- Git

### Installation

1. Navigate to the backend directory:
   ```bash
   cd VibeTune/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example` and fill in your API keys and Supabase details:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your actual values. The `ALLOWED_ORIGINS` should include your frontend URLs (e.g., `https://vibetune.vercel.app,http://localhost:5173`).
   ```
   OPENAI_API_KEY=YOUR_OPENAI_API_KEY
   DEEPGRAM_API_KEY=YOUR_DEEPGRAM_API_KEY
   SUPABASE_URL=YOUR_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
   SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ALLOWED_ORIGINS=https://vibetune.vercel.app,http://localhost:5173
   PORT=3000
   ```

### Running the Server

To compile and run the TypeScript server:

```bash
# Compile TypeScript
npx tsc
# Run the server
node dist/index.js
```

The server will start on the port specified in your `.env` file (default: 3000).

## API Endpoints

### 1. `POST /chat`
Handles user chat messages, processes audio (if provided) via Deepgram, generates AI responses via OpenAI, and stores messages in Supabase.

**Request Body:**
```json
{
  "conversationId": "uuid",
  "profileId": "uuid",
  "text": "string | optional",
  "audioUrl": "string | optional",
  "deviceId": "string | optional",
  "retryOfMessageId": "uuid | optional",
  "version": "number | optional"
}
```

**Example `curl` with text:**
```bash
curl -X POST http://localhost:3000/chat \
-H "Content-Type: application/json" \
-d 
'\''
{
  "conversationId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "profileId": "f1e2d3c4-b5a6-9876-5432-10fedcba9876",
  "text": "Hello, how are you today?",
  "deviceId": "test-device-1"
}
'\''
```

**Example `curl` with audioUrl:**
```bash
curl -X POST http://localhost:3000/chat \
-H "Content-Type: application/json" \
-d 
'\''
{
  "conversationId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "profileId": "f1e2d3c4-b5a6-9876-5432-10fedcba9876",
  "audioUrl": "https://example.com/path/to/your/audio.mp3",
  "deviceId": "test-device-1"
}
'\''
```

**Response:**
```json
{
  "replyText": "...",
  "feedback": {...},    // turn_feedback
  "guidance": "...",
  "scores": {"pronunciation":0.8,"rhythm":0.75,"intonation":0.78}
}
```

### 2. `POST /placement-score`
Calculates an average prosody score for a conversation and updates the user's profile level in Supabase.

**Request Body:**
```json
{
  "profileId": "uuid",
  "conversationId": "uuid"
}
```

**Example `curl`:**
```bash
curl -X POST http://localhost:3000/placement-score \
-H "Content-Type: application/json" \
-d 
'\''
{
  "profileId": "f1e2d3c4-b5a6-9876-5432-10fedcba9876",
  "conversationId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
}
'\''
```

**Response:**
```json
{
  "level":"Intermediate",
  "score":0.68
}
```

### 3. `POST /events-ingest`
Ingests analytics events with a soft rate-limit to prevent excessive logging.

**Request Body:**
```json
{
  "profileId":"uuid",
  "event_type":"string",
  "metadata":{...}
}
```

**Example `curl`:**
```bash
curl -X POST http://localhost:3000/events-ingest \
-H "Content-Type: application/json" \
-d 
'\''
{
  "profileId": "f1e2d3c4-b5a6-9876-5432-10fedcba9876",
  "event_type": "app_opened",
  "metadata": {
    "device": "iOS",
    "version": "1.0.0"
  }
}
'\''
```

**Response:**
```json
{
  "ok": true,
  "skipped": false
}
```

### 4. `POST /feedback`
Allows users to rate AI messages (1–5).

**Request Body:**
```json
{
  "messageId":"uuid",
  "profileId":"uuid",
  "rating":4
}
```

**Example `curl`:**
```bash
curl -X POST http://localhost:3000/feedback \
-H "Content-Type: application/json" \
-d 
'\''
{
  "messageId": "g1h2i3j4-k5l6-7890-1234-567890mnopqr",
  "profileId": "f1e2d3c4-b5a6-9876-5432-10fedcba9876",
  "rating": 5
}
'\''
```

**Response:**
```json
{
  "ok": true,
  "rating": 5
}
```

