# 📡 VibeTune API Documentation

## Base URL
```
Production: https://vibe-tune-two.vercel.app
Development: http://localhost:3000
```

## Authentication

Most endpoints require authentication via Supabase JWT token:
```
Authorization: Bearer <supabase_jwt_token>
```

## Rate Limiting

- 60 requests per minute per IP for `/api/chat`
- 30 requests per minute per IP for `/api/placement-test`
- 100 requests per minute per IP for other endpoints

---

## Endpoints

### 1. Chat API

**Endpoint:** `POST /api/chat`

**Description:** AI conversation endpoint for topic discovery and practice mode.

**Request Body:**
```json
{
  "text": "I want to talk about music",
  "stage": "topic_discovery",
  "level": "Intermediate",
  "conversationId": "uuid",
  "profileId": "uuid",
  "conversationHistory": [],
  "lastMistakes": ["rhythm", "intonation"],
  "turnCount": 5,
  "prosodyScores": {
    "overall": 85,
    "pronunciation": 80,
    "rhythm": 88,
    "intonation": 82,
    "fluency": 90
  }
}
```

**Response:**
```json
{
  "replyText": "Great! Let's talk about music...",
  "topic_confirmed": "Music"
}
```

---

### 2. Prosody Analysis API

**Endpoint:** `POST /api/prosody-analysis`

**Description:** Analyzes audio for pronunciation, rhythm, intonation, and fluency.

**Request:**
- Content-Type: `audio/webm` or `audio/wav`
- Body: Raw audio blob

**Response:**
```json
{
  "success": true,
  "transcription": "Hello, how are you?",
  "duration": 2.5,
  "prosody_analysis": {
    "overall_score": 85,
    "pronunciation_score": 82,
    "rhythm_score": 88,
    "intonation_score": 83,
    "fluency_score": 87,
    "detailed_feedback": {
      "strengths": ["Clear pronunciation", "Good rhythm"],
      "improvements": ["Work on intonation"],
      "specific_issues": [
        {
          "type": "pronunciation",
          "word": "hello",
          "severity": "medium",
          "feedback": "Stress the first syllable",
          "suggestion": "Say HEL-lo"
        }
      ]
    },
    "suggestions": ["Practice word stress", "Record yourself"]
  }
}
```

---

### 3. Placement Test API

**Endpoint:** `POST /api/placement-test`

**Description:** Evaluates student response for placement test.

**Request Body:**
```json
{
  "profileId": "uuid",
  "response": "My name is John...",
  "topic": "Personal Introduction",
  "difficulty": "beginner"
}
```

**Response:**
```json
{
  "score": 75,
  "feedback": "Good job! Your pronunciation was clear..."
}
```

---

### 4. Transcribe API

**Endpoint:** `POST /api/transcribe`

**Description:** Transcribes audio to text using OpenAI Whisper.

**Request:**
- Content-Type: `audio/webm` or `audio/wav`
- Body: Raw audio blob

**Response:**
```json
{
  "text": "Hello, how are you today?"
}
```

---

### 5. Data API

**Endpoint:** `GET/POST /api/data`

**Description:** Database operations for conversations and messages.

#### Get History
```
GET /api/data?action=get-history
Authorization: Bearer <token>
```

**Response:**
```json
{
  "conversations": [...],
  "messages": [...]
}
```

#### Save Conversation
```
POST /api/data?action=save-conversation
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "uuid",
  "profile_id": "uuid",
  "topic": "Music",
  "title": "Music Discussion",
  "started_at": "2024-01-01T00:00:00Z"
}
```

#### Save Message
```
POST /api/data?action=save-message
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": "uuid",
  "conversation_id": "uuid",
  "profile_id": "uuid",
  "sender": "user",
  "type": "audio",
  "content": "Hello, how are you?",
  "prosody_feedback": {...}
}
```

#### Update Message Prosody
```
POST /api/data?action=update-message-prosody
Content-Type: application/json
```

**Request Body:**
```json
{
  "messageId": "uuid",
  "prosodyFeedback": {...},
  "transcript": "Hello, how are you?"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Common Error Codes

- `400` - Bad Request (missing parameters)
- `401` - Unauthorized (invalid token)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640000000
```

---

## Examples

### JavaScript/TypeScript

```typescript
// Chat API
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'I want to talk about music',
    stage: 'topic_discovery',
    level: 'Intermediate'
  })
});

const data = await response.json();
```

### Prosody Analysis

```typescript
// Record audio
const audioBlob = await recordAudio();

// Analyze
const response = await fetch('/api/prosody-analysis', {
  method: 'POST',
  headers: {
    'Content-Type': audioBlob.type
  },
  body: audioBlob
});

const analysis = await response.json();
```

---

## Webhooks

Currently not supported. Coming soon!

---

## Changelog

### v1.0.0 (2024-01-01)
- Initial API release
- Chat, prosody analysis, placement test endpoints
- Database operations API
