# Prosody Learning Prompt Optimization

## Summary of Changes

This update optimizes the AI prompts and conversation flow to focus on prosody learning with a fixed topic approach.

## Key Changes

### 1. **Removed Control Tags**
- ❌ Removed `[[TOPIC_CONFIRMED: ...]]` tags from AI responses
- ✅ AI now responds naturally without any special formatting
- ✅ Topic detection happens automatically from conversation context

### 2. **Fixed Topic Flow**
- **Topic Discovery Stage**: User selects a topic → AI confirms naturally → Topic is LOCKED
- **Practice Stage**: Topic is fixed and sent with EVERY message to AI
- **No Topic Changes**: AI will redirect if user tries to change topic mid-conversation

### 3. **Optimized System Prompts**

#### Topic Discovery Prompt (api/chat.ts)
```
- Help user choose ONE clear topic
- Respond naturally when topic is mentioned
- NO control tags - just natural conversation
- System detects topic automatically from context
```

#### Practice Mode Prompt (api/chat.ts)
```
- Role: Pronunciation tutor (not just conversation partner)
- Fixed topic: Cannot be changed during session
- Focus: Prosody feedback (rhythm, stress, intonation)
- Style: Natural, conversational, encouraging
- Corrections: 1-2 specific tips per response
- Always end with follow-up question
```

### 4. **Frontend Updates**

#### ChatPanel.tsx
- Always sends fixed topic with every message in practice mode
- Cleans any unexpected control tags from AI responses
- Improved logging for debugging topic flow

#### aiProsodyService.ts
- Sends fixed topic to `/api/chat` endpoint
- Includes pronunciation mistakes from prosody analysis
- Always uses 'practice' stage when generating responses

## Flow Diagram

```
User starts conversation
    ↓
[Topic Discovery Stage]
    ↓
User: "I want to talk about music"
    ↓
AI: "Great! Let's talk about music. What kind do you like?"
    ↓
System detects topic: "music"
    ↓
Topic is LOCKED ✅
    ↓
[Practice Stage]
    ↓
Every message includes:
  - text: user message
  - topic: "music" (fixed)
  - stage: "practice"
  - level: user level
  - lastMistakes: pronunciation issues
    ↓
AI responds with:
  - Natural conversation about music
  - 1-2 pronunciation tips
  - Follow-up question
    ↓
User tries: "Let's talk about travel"
    ↓
AI: "Let's keep practicing music. We can explore other topics in a new session!"
    ↓
Conversation continues with FIXED topic
```

## Benefits

1. **No Visual Clutter**: Users see clean, natural conversation without tags
2. **Focused Learning**: Topic stays fixed, allowing deeper practice
3. **Better Feedback**: AI knows the topic context for every response
4. **Prosody Focus**: Clear role as pronunciation tutor, not just chat bot
5. **Consistent Context**: AI always knows what topic to discuss

## Testing

To test the changes:

1. Start a new conversation
2. Say "I want to talk about [topic]"
3. Verify AI responds naturally without tags
4. Continue conversation - topic should stay fixed
5. Try to change topic - AI should redirect
6. Check that pronunciation feedback is relevant to the topic

## Files Modified

- `api/chat.ts` - New optimized prompts
- `frontend/src/components/ChatPanel.tsx` - Always send fixed topic
- `frontend/src/services/aiProsodyService.ts` - Include topic in practice mode
- `api/chat-old.ts` - Backup of original file

## Rollback

If needed, restore the original:
```bash
mv api/chat-old.ts api/chat.ts
```
