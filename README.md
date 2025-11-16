# 🎧 VibeTune — AI Prosody Learning App

Find your English rhythm — speak with confidence, not perfection.

## 🧭 Overview

VibeTune is a mobile-first AI-powered prosody learning app designed to help English learners improve their pronunciation, prosody, grammar, vocabulary, and conversational fluency through friendly, natural-sounding chats with an AI tutor — just like having a casual coffee conversation ☕.

The app analyzes speech rhythm, intonation, pacing, and phrasing, providing real-time feedback on pronunciation, grammatical accuracy, and vocabulary usage. Learners can communicate with the AI via text or voice, receive grammar and vocabulary feedback, review interactive flashcards, and progress through adaptive difficulty levels tailored to their performance.

## ⚙️ Tech Stack

| Layer               | Technology                                             |
| :------------------ | :----------------------------------------------------- |
| Frontend (Mobile/Web) | React Native (mobile), Capacitor, Vite (web demo / PWA) |
| Backend & Database  | Supabase (Auth, Postgres Database, RLS, Realtime)      |
| AI Integration      | OpenAI (GPT-4 / GPT-3.5-Turbo) for conversational AI and language feedback |
| Speech Recognition  | OpenAI Whisper (high-quality speech-to-text transcription) |
| Text-to-Speech (optional) | OpenAI TTS / ElevenLabs                                |
| Edge Functions      | Supabase Edge Functions (Deno)                         |
| CI/CD               | GitHub Actions                                         |
| Deployment          | Web via Vercel (GitHub → Vercel) • Mobile via Capacitor / EAS |
| Monitoring & Analytics | Supabase logs + custom analytics_events table          |
| Offline-first (optional) | Local SQLite cache + conflict resolution (Last-Writer-Wins) |

## 🧱 Database Schema & Security

### Tables

| Table            | Fields                                                                                                                                                                                                | Description                                     |
| :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| `profiles`       | `id`, `email`, `username`, `level` (Beginner / Intermediate / Advanced), `placement_test_completed`, `placement_test_score`, `last_login`, `device_id`                                                  | Stores user information and learning level      |
| `conversations`  | `id`, `profile_id`, `topic`, `is_placement_test`, `started_at`, `ended_at`                                                                                                                            | Each conversation or placement test session     |
| `messages`       | `id`, `conversation_id`, `sender` (user / ai), `type` (text / audio), `content`, `audio_url`, `prosody_feedback`, `vocab_suggestions`, `guidance`, `retry_of_message_id`, `version`, `created_at` | Stores message content and AI feedback          |
| `analytics_events` | `id`, `profile_id`, `event_type`, `metadata`, `created_at`                                                                                                                                            | Tracks app usage and learning analytics         |
| `feedback_rating` (optional) | `id`, `message_id`, `profile_id`, `rating`, `created_at`                                                                                                                                              | User ratings for AI feedback quality            |

### Security & RLS

Row-Level Security (RLS) is enabled on all tables, ensuring users can only access and modify their own data.

**Indexes:**

*   `messages(conversation_id, created_at DESC)`
*   `conversations(profile_id, started_at DESC)`
*   `analytics_events(profile_id, created_at DESC)`

## 🧭 User Flow

### 1️⃣ Onboarding

Users sign in via email OTP or Google/GitHub (Supabase Auth). They then choose one of two paths:

*   **Placement Test:** A conversational assessment with the AI to automatically determine their English level.
*   **Self-Select Level:** Manually select Beginner, Intermediate, or Advanced.

### 2️⃣ Placement Test

The AI initiates a casual chat (e.g., “Tell me about your hobbies”, “What’s your favorite food?”).

*   Deepgram transcribes voice input to text in real time.
*   OpenAI analyzes the transcript for:
    *   Grammar accuracy
    *   Vocabulary range and usage
    *   Prosody metrics (pitch, rate, pauses, energy)
*   A final level (Beginner / Intermediate / Advanced) is automatically assigned and saved to `profiles.level`.

### 3️⃣ Main Chat

Users select a topic; the AI adjusts conversation difficulty accordingly.

*   Grammar corrections and vocabulary tips are presented naturally during the chat.
*   After each conversation:
    *   A grammar feedback summary is displayed.
    *   Vocabulary flashcards are generated.
    *   Optional AI voice playback (TTS).

### 4️⃣ Replacement Test

To change their level, users must complete a replacement test with the AI.

### 5️⃣ Offline Mode (optional)

Messages and conversations are stored locally and synced automatically when the user reconnects. Conflict handling strategy: client-wins.

## 🧠 AI & Edge Function Architecture

### `chat-stream` Function

Handles both text and voice input for AI conversations.

**Input:**

```json
{ "conversationId": "uuid", "text": "Hello!", "audioUrl": null }
```

**Process:**

1.  If `audioUrl` is provided → send to Deepgram → receive transcript and timing data.
2.  Call OpenAI with a “friendly tutor” prompt → request structured feedback:

    ```json
    {
      "turn_feedback": {
        "grammar": [{"error": "I am agree", "suggest": "I agree"}],
        "vocab": [{"word": "excited", "explain": "feeling happy and eager", "CEFR": "B1"}],
        "prosody": {"rate": 0.7, "pitch": 0.8, "energy": 0.6, "pauses": [{"t": 1.2, "dur": 0.4}]}
      },
      "guidance": "Try speaking a little slower next time."
    }
    ```

3.  Save both the user and AI messages to Supabase.
4.  Return `{ replyText, feedback }` to the client.

### `placement-score` Function

Calculates overall language level from placement test results. Aggregates grammar, vocabulary, and prosody scores, then updates `profiles.level` accordingly.

### `events-ingest` Function

Logs analytics events into `analytics_events`. Implements basic rate-limiting by `user_id` and `device_id`.

**Example events:** `session_start`, `session_end`, `ai_first_token`, `feedback_shown`, `flashcards_reviewed`.

## 🎨 UI / UX Design

### Screens

| Screen            | Description                                          |
| :---------------- | :--------------------------------------------------- |
| Welcome / Login   | Supabase Auth login (Email OTP / Google / GitHub)    |
| Level Selection   | Choose Placement Test or Self-Select Level           |
| Placement Test    | Real-time chat with transcript and instant feedback  |
| Main Chat         | Text + voice chat interface with feedback highlights |
| Flashcards Review | Displays learned vocabulary after each session       |
| Settings          | Change level (Replacement Test), toggle TTS, delete data |

### Design Philosophy:

*   Friendly, approachable, and conversational tone.
*   Soft pastel color palette for a calm learning environment.
*   Feedback panels use color cues (green = correct, red = error, yellow = suggestion).
*   Smooth animations via Framer Motion or React Native Reanimated.

## 🔐 Environment Variables

| Variable                  | Scope         | Description                                     |
| :------------------------ | :------------ | :---------------------------------------------- |
| `VITE_SUPABASE_URL`       | Client        | Supabase project URL                            |
| `VITE_SUPABASE_ANON_KEY`  | Client        | Public anon key for Supabase                    |
| `OPENAI_API_KEY`          | Edge Functions | Access key for GPT API                          |
| `DEEPGRAM_API_KEY`        | Edge Functions | Real-time speech-to-text                        |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Elevated DB access for server functions         |
| `TTS_API_KEY`             | Edge Functions | Optional text-to-speech service                 |
| `APP_ENV`                 | All           | `development` / `production`                    |
| `VERCEL_TOKEN`            | GitHub Actions | Deploy token for Vercel CI/CD                   |

⚠️ **Never hard-code secrets.** Store environment variables securely in GitHub, Vercel, and Supabase according to their respective scopes.

## 🧪 Testing & Quality Assurance

| Test Type         | Purpose                                                              |
| :---------------- | :------------------------------------------------------------------- |
| Unit Tests        | Validate grammar/vocab/prosody parser, placement scoring logic       |
| Integration Tests | Mock Deepgram & OpenAI calls, validate feedback schema               |
| E2E Tests (Playwright / Detox) | Simulate user login → choose level → chat → receive feedback |
| Manual QA         | Evaluate response latency, speech accuracy, feedback clarity         |
| Monitoring        | Supabase logs + `analytics_events` table for usage tracking          |

## 🚀 Deployment Pipeline

### Deployment Flow

GitHub → Vercel (Web)
        ↳ Supabase (Edge Functions)

### Web Deployment

1.  Push changes to GitHub `main` branch.
2.  Vercel automatically deploys using environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3.  Web app live at project domain (e.g., `https://vibetune.vercel.app`).

### Edge Functions Deployment

Use Supabase CLI:

```bash
supabase functions deploy chat-stream
supabase functions deploy placement-score
supabase functions deploy events-ingest
```

### Mobile Deployment

Build with Capacitor / EAS for iOS and Android. Inject environment variables at build time.

## 📊 Analytics & Metrics

Tracked events include:

*   `session_start`, `session_end`
*   `asr_partial`, `asr_final`
*   `ai_first_token`
*   `feedback_shown`, `flashcards_reviewed`
*   `level_changed`
*   `retention_day1`, `retention_day7`

All stored in `analytics_events` with metadata for retention and engagement analysis.

## 🗺️ Product Roadmap

| Sprint   | Goal                                      | Deliverables                               |
| :------- | :---------------------------------------- | :----------------------------------------- |
| Sprint 1 | Authentication + Database schema + RLS    | Supabase migrations, auth setup            |
| Sprint 2 | Edge Functions + AI/ASR integration       | `chat-stream`, `placement-score`           |
| Sprint 3 | Chat UI + Grammar & Vocabulary Feedback   | Interactive chat experience                |
| Sprint 4 | Replacement Test + Analytics              | Adaptive learning & tracking               |
| Sprint 5 | Offline Sync + Polish + Deploy            | MVP live on Vercel + TestFlight            |

## ✅ Deliverables

*   Supabase migrations with RLS and indexes
*   Edge Functions: `chat-stream`, `placement-score`, `events-ingest`
*   React Hooks & UI Components
*   Offline caching (optional)
*   Unit, Integration, and E2E Tests
*   CI/CD workflows: GitHub pipelines
*   Documentation: `README.md`, `SECURITY.md`, `.env` setup guide
*   Verified production deployment on Vercel and Supabase

## 🧡 Credits

Developed by Group 1

Bachelor of Data Science – SP Jain School of Global Management

Focus areas: AI-powered language learning, speech prosody analysis, and intelligent tutoring systems.

