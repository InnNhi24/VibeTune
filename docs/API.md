# VibeTune API Documentation

## Overview

VibeTune's backend API provides comprehensive endpoints for user management, AI-powered prosody analysis, conversation management, and analytics. All endpoints are hosted on Supabase Edge Functions with Hono.js framework.

**Base URL**: `https://{project-id}.supabase.co/functions/v1/make-server-b2083953`

## Authentication

All protected endpoints require Bearer token authentication:

```http
Authorization: Bearer {access_token}
```

Get access token from Supabase auth:
```typescript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

## Rate Limiting

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Authentication | 5 requests | 1 minute |
| Chat/Send | 20 requests | 1 minute |
| Audio Analysis | 100 requests | 1 minute |
| Message Retry | 5 requests | 1 minute |
| General | 1000 requests | 1 hour |

Rate limit exceeded returns `429 Too Many Requests`.

## Endpoints

### Health Check

Check API status and availability.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "VibeTune API"
}
```

---

### Authentication

#### User Signup

Create a new user account.

```http
POST /signup
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "User Name"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "user_metadata": {
      "name": "User Name"
    },
    "created_at": "2023-12-01T10:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `409 Conflict` - Email already exists
- `429 Too Many Requests` - Rate limit exceeded

---

### Audio Analysis

#### Analyze Audio

Process user speech and provide prosody feedback.

```http
POST /api/analyze-audio
```

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "I think learning English prosody is really important for effective communication.",
  "level": "Intermediate",
  "audio_url": "optional-audio-file-url"
}
```

**Response:**
```json
{
  "data": {
    "prosodyErrors": [
      {
        "word": "really",
        "type": "stress",
        "suggestion": "Emphasize this intensifier with stronger stress",
        "position": 5
      }
    ],
    "vocabSuggestions": [
      {
        "word": "communication",
        "simpler_alternative": "talking",
        "definition": "The imparting or exchanging of information",
        "difficulty_level": "advanced"
      }
    ],
    "guidance": "Good effort! Focus on stress patterns and intonation.",
    "score": 78,
    "intonation_score": 82,
    "rhythm_score": 75,
    "stress_score": 77,
    "overall_feedback": "Your pronunciation shows good progress. Work on emphasizing key words.",
    "improvement_areas": ["word_stress", "sentence_rhythm"]
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `400 Bad Request` - Missing required text field
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Analysis processing failed

---

### Message Management

#### Save Message

Store a conversation message with optional AI feedback.

```http
POST /api/save-message
```

**Headers:**
```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "conversation_id": "uuid",
  "sender": "user",
  "type": "audio",
  "content": "I went to the store yesterday.",
  "audio_url": "https://storage.url/audio.wav",
  "prosody_feedback": {
    "score": 85,
    "highlights": [
      {
        "text": "store",
        "type": "good",
        "feedback": "Excellent stress placement!"
      }
    ]
  },
  "device_id": "device-uuid"
}
```

**Response:**
```json
{
  "data": {
    "id": "message-uuid",
    "conversation_id": "uuid",
    "sender": "user",
    "content": "I went to the store yesterday.",
    "prosody_feedback": { /* feedback object */ },
    "created_at": "2023-12-01T10:00:00Z",
    "version": 1
  }
}
```

#### Retry Message Analysis

Generate new AI feedback for an existing message.

```http
POST /api/retry-message/{messageId}
```

**Path Parameters:**
- `messageId` - UUID of the original message

**Request Body:**
```json
{
  "text": "I went to the store yesterday.",
  "level": "Intermediate",
  "retry_reason": "user_requested"
}
```

**Response:**
```json
{
  "data": {
    "id": "new-message-uuid",
    "conversation_id": "uuid",
    "sender": "ai",
    "type": "text",
    "content": "Updated analysis based on retry",
    "prosody_feedback": { /* new analysis */ },
    "retry_of_message_id": "original-message-uuid",
    "version": 1,
    "created_at": "2023-12-01T10:05:00Z"
  }
}
```

---

### Conversation History

#### Get User History

Retrieve all conversations and messages for the authenticated user.

```http
GET /api/get-history
```

**Query Parameters:**
- `limit` (optional) - Number of conversations to return (default: 50)
- `offset` (optional) - Pagination offset (default: 0)
- `since` (optional) - ISO date string for incremental sync

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "profile_id": "user-uuid",
      "topic": "Travel Discussion",
      "is_placement_test": false,
      "started_at": "2023-12-01T10:00:00Z",
      "ended_at": "2023-12-01T10:30:00Z",
      "message_count": 12,
      "average_prosody_score": 78.5
    }
  ],
  "messages": [
    {
      "id": "uuid",
      "conversation_id": "conversation-uuid",
      "sender": "user",
      "type": "audio",
      "content": "I love traveling to new places.",
      "audio_url": "https://storage.url/audio.wav",
      "prosody_feedback": {
        "score": 85,
        "highlights": [],
        "suggestions": []
      },
      "created_at": "2023-12-01T10:00:00Z"
    }
  ],
  "pagination": {
    "total_conversations": 25,
    "total_messages": 300,
    "has_more": true
  }
}
```

---

### Analytics

#### Track Event

Record user interaction events for analytics.

```http
POST /api/analytics
```

**Request Body:**
```json
{
  "event_type": "placement_test_completed",
  "metadata": {
    "score": 78,
    "level": "Intermediate",
    "duration_seconds": 900,
    "topics_covered": ["travel", "food", "work"],
    "difficulty_progression": [1, 2, 3, 2, 3]
  }
}
```

**Response:**
```json
{
  "success": true,
  "event_id": "uuid"
}
```

**Common Event Types:**
- `user_signed_up`
- `user_signed_in`
- `level_selected`
- `placement_test_started`
- `placement_test_completed`
- `conversation_started`
- `conversation_ended`
- `message_sent`
- `prosody_feedback_received`
- `audio_recording_started`
- `audio_recording_completed`
- `retry_feedback_requested`

---

## Data Models

### User Profile
```typescript
interface Profile {
  id: string
  username: string
  email: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  placement_test_completed: boolean
  placement_test_score?: number
  created_at: string
  last_login: string
}
```

### Conversation
```typescript
interface Conversation {
  id: string
  profile_id: string
  topic: string
  is_placement_test: boolean
  started_at: string
  ended_at?: string
  device_id?: string
}
```

### Message
```typescript
interface Message {
  id: string
  conversation_id: string
  sender: 'user' | 'ai'
  type: 'text' | 'audio'
  content: string
  audio_url?: string
  prosody_feedback?: ProsodyFeedback
  vocab_suggestions?: VocabSuggestion[]
  guidance?: string
  retry_of_message_id?: string
  version: number
  device_id?: string
  created_at: string
}
```

### Prosody Feedback
```typescript
interface ProsodyFeedback {
  score: number // 0-100
  intonation_score: number
  rhythm_score: number
  stress_score: number
  highlights: Array<{
    text: string
    type: 'error' | 'good' | 'suggestion'
    feedback: string
    position?: number
  }>
  suggestions: string[]
  improvement_areas: string[]
  overall_feedback: string
}
```

### Vocabulary Suggestion
```typescript
interface VocabSuggestion {
  word: string
  simpler_alternative?: string
  definition: string
  example?: string
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### HTTP Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Webhooks

### Real-time Updates

VibeTune supports real-time updates via Supabase real-time subscriptions:

```typescript
// Subscribe to conversation updates
supabase
  .channel('conversations')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`
  }, (payload) => {
    // Handle new message
  })
  .subscribe()
```

## SDK Usage Examples

### JavaScript/TypeScript
```typescript
// Initialize client
const client = new VibeTuneAPI({
  baseURL: 'https://project.supabase.co/functions/v1/make-server-b2083953',
  accessToken: userToken
})

// Analyze speech
const analysis = await client.analyzeAudio({
  text: "Hello, how are you today?",
  level: "Intermediate"
})

// Save conversation message
const message = await client.saveMessage({
  conversation_id: conversationId,
  sender: "user",
  content: "I'm learning English pronunciation!",
  type: "audio"
})
```

### Python
```python
import requests

class VibeTuneAPI:
    def __init__(self, base_url, access_token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
    
    def analyze_audio(self, text, level):
        response = requests.post(
            f'{self.base_url}/api/analyze-audio',
            json={'text': text, 'level': level},
            headers=self.headers
        )
        return response.json()
```

## Testing

### Mock Server

For development and testing, use the mock responses:

```json
// Mock audio analysis response
{
  "data": {
    "score": 85,
    "prosodyErrors": [],
    "vocabSuggestions": [],
    "guidance": "Excellent pronunciation!"
  }
}
```

### Postman Collection

Import the VibeTune Postman collection for easy API testing:

```bash
curl -o vibetune-api.postman_collection.json \
  https://api.vibetune.app/docs/postman-collection.json
```

## Monitoring & Observability

### Health Checks
- API availability monitoring
- Database connection status
- AI service integration health

### Metrics
- Request/response times
- Error rates by endpoint
- User engagement analytics
- Prosody analysis accuracy

### Logging
- Structured JSON logs
- Request correlation IDs
- Performance tracking
- Error context preservation

---

For additional support or questions, contact the VibeTune development team at dev@vibetune.app