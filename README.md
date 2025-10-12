# VibeTune - AI Prosody Learning App

VibeTune is a mobile-first AI prosody learning application designed for English learners. It helps users improve their pronunciation, grammar, vocabulary, and conversation skills through AI-powered conversations that simulate casual coffee-chat style interactions.

## Project Overview

### 1. Platform & Technologies

*   **Frontend:** iOS/Android (React Native / Capacitor)
*   **Backend:** Supabase (Authentication, Database, RLS)
*   **AI Integration:** OpenAI (text/audio), Deepgram (speech-to-text), TTS (optional)
*   **CI/CD:** Vercel (web hosting, mobile app build), GitHub Actions
*   **Architecture:** Offline-first (supports offline sync, conflict handling optional)
*   **Monitoring:** Supabase logs, event tracking

### 2. Key Features

*   **Adaptive AI Conversation:** Personalized learning based on user level.
*   **Text/Audio Input:** With live transcription for immediate feedback.
*   **Grammar & Vocabulary Feedback:** Includes flashcards for effective learning.
*   **Level Selection Flow:**
    *   **Placement Test:** AI-driven assessment to determine user proficiency.
    *   **Self-Select Level:** Users can choose Beginner, Intermediate, or Advanced.
    *   **Change Level:** Requires a Replacement Test to update proficiency.
*   **Mobile-first UI/UX:** Chat interface similar to popular messaging apps, with visual feedback for grammar and vocabulary.
*   **Analytics Tracking:** For retention and engagement monitoring.

### 3. Setup and Installation

To get the VibeTune project up and running locally, follow these steps:

1.  **Clone the repository:**

    ```bash
    gh repo clone InnNhi24/VibeTune
    cd VibeTune
    ```

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

3.  **Environment Variables:**

    Create a `.env` file in the root of the project and add your API keys and Supabase credentials. Refer to `src/env.example` for the required variables.

    ```
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_OPENAI_API_KEY=your_openai_api_key
    VITE_DEEPGRAM_API_KEY=your_deepgram_api_key
    ```

4.  **Run the Development Server:**

    ```bash
    npm run dev
    ```

    The application will be accessible at `http://localhost:3000/`.

### 4. Recent Fixes

*   **Resolved 

Registration/Login Bounceback Error:** Fixed a `ReferenceError: React is not defined` issue in `MainAppScreen.tsx` that caused a bounceback during user registration and login flows. The application now successfully navigates to the main interface after authentication.

## Next Steps

Based on the project overview, the following are the next steps to complete the project:

*   Implement self-selected level + replacement test flow.
*   Connect AI conversation (OpenAI + Deepgram + optional TTS).
*   Enable live transcription for audio input.
*   UI polish: grammar/vocab feedback, chat bubbles, flashcards.
*   Testing: unit, e2e, manual for all core flows.
*   CI/CD: deploy web & mobile builds.
*   Optional: offline sync, conflict resolution.

