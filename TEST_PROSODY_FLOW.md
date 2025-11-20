# Test Plan: Prosody Learning Flow

## Test Scenario 1: Topic Discovery

### Steps:
1. Start new conversation
2. User types: "I want to talk about music"
3. Verify AI response is natural (no `[[TOPIC_CONFIRMED:...]]` tags visible)
4. Check console logs for `topic_confirmed: "music"`
5. Verify conversation is created with topic "music"
6. Verify `waitingForTopic` is set to `false`

### Expected Results:
- ✅ AI responds naturally: "Great! Let's talk about music. What kind do you like?"
- ✅ No control tags visible in UI
- ✅ Topic "music" is saved to conversation
- ✅ Conversation appears in sidebar with title "music"

## Test Scenario 2: Practice Mode with Fixed Topic

### Steps:
1. Continue from Scenario 1 (topic is "music")
2. User types: "I like rock music"
3. Verify API payload includes:
   - `stage: "practice"`
   - `topic: "music"`
   - `level: "beginner"` (or user's level)
4. Check AI response for pronunciation feedback
5. Verify response stays on topic

### Expected Results:
- ✅ API receives fixed topic "music" with every message
- ✅ AI provides pronunciation tips related to music vocabulary
- ✅ AI asks follow-up question about music
- ✅ No topic change occurs

## Test Scenario 3: Topic Change Attempt (Should Fail)

### Steps:
1. Continue from Scenario 2 (topic is "music")
2. User types: "Let's talk about travel instead"
3. Verify AI redirects back to music topic

### Expected Results:
- ✅ AI responds: "Let's keep practicing music. We can explore other topics in a new session!"
- ✅ Topic remains "music" in conversation
- ✅ Next message still includes `topic: "music"`

## Test Scenario 4: Voice Message with Prosody Analysis

### Steps:
1. Continue from Scenario 2 (topic is "music")
2. User records voice message: "I love classical music"
3. Wait for prosody analysis
4. Check AI response includes:
   - Pronunciation feedback
   - Score/rating
   - Specific tips (e.g., "stress the first syllable of 'classical'")
   - Follow-up question about music

### Expected Results:
- ✅ Prosody analysis completes successfully
- ✅ AI provides specific pronunciation feedback
- ✅ Feedback is relevant to music topic
- ✅ Topic remains "music"

## Test Scenario 5: New Conversation (Reset)

### Steps:
1. Click "New Conversation" button
2. Verify state is reset:
   - `waitingForTopic: true`
   - `currentTopic: "New Conversation"`
   - Messages cleared
3. User types: "I want to talk about food"
4. Verify new topic "food" is set

### Expected Results:
- ✅ Previous conversation saved with topic "music"
- ✅ New conversation starts fresh
- ✅ Topic discovery works for "food"
- ✅ New conversation created with topic "food"

## Console Log Checks

### Topic Discovery:
```
📤 Sending to API: { text: "I want to talk about music...", stage: "topic_discovery", topic: undefined }
✅ Topic detected: music
✅ Topic confirmed: music
```

### Practice Mode:
```
📤 Sending to API: { text: "I like rock music...", stage: "practice", topic: "music" }
✅ AI response received: Nice! I heard you say...
```

### Topic Change Attempt:
```
📤 Sending to API: { text: "Let's talk about travel...", stage: "practice", topic: "music" }
✅ AI response received: Let's keep practicing music...
```

## API Response Format

### Topic Discovery Response:
```json
{
  "ok": true,
  "replyText": "Great! Let's talk about music. What kind do you like?",
  "topic_confirmed": "music",
  "stage": "topic_discovery",
  "nextStage": "practice",
  "conversationId": "uuid-here"
}
```

### Practice Mode Response:
```json
{
  "ok": true,
  "replyText": "Nice! I heard you say 'classical'. Remember to stress the first syllable: CLAS-si-cal. What's your favorite classical composer?",
  "topic": "music",
  "stage": "practice",
  "nextStage": "practice"
}
```

## Debugging Tips

If topic is not being detected:
1. Check console logs for "Topic detected:" message
2. Verify user message contains clear topic mention
3. Check API response for `topic_confirmed` field

If topic changes unexpectedly:
1. Check that `stage: "practice"` is being sent
2. Verify `topic` field is included in payload
3. Check AI prompt includes "FIXED TOPIC" instruction

If AI shows control tags:
1. Check that new `api/chat.ts` is deployed
2. Verify prompt doesn't include `[[TOPIC_CONFIRMED:...]]` instruction
3. Check frontend cleans tags with `.replace(/\[\[.*?\]\]/gi, '')`
