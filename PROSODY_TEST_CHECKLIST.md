# Prosody Testing Checklist

## ✅ Basic Checks

### 1. Environment Setup
- [ ] `OPENAI_API_KEY` is set in `.env`
- [ ] API key has access to Whisper API
- [ ] Frontend can connect to backend API
- [ ] Browser has microphone permission

### 2. Recording Functionality
- [ ] Click record button → microphone permission prompt
- [ ] Recording indicator displays (red, recording)
- [ ] Stop recording → audio blob created
- [ ] Audio playback works (if preview available)

### 3. Message Flow
- [ ] User message displays immediately
- [ ] Message has "Analyzing..." state during processing
- [ ] AI response displays after analysis complete
- [ ] Messages saved to store and database

## 🎤 Prosody Analysis Checks

### 4. API Call Flow
```bash
# Check console logs when recording audio:
🎤 [PROSODY] analyzeAudio called!
📡 [PROSODY] Calling /api/prosody-analysis endpoint...
📡 [PROSODY] API response status: 200
✅ [PROSODY] API response received
✅ [PROSODY] REAL analysis complete!
```

**Expected:**
- [ ] All logs appear in correct order
- [ ] No errors in console
- [ ] Response status = 200

### 5. Transcription Accuracy
**Test Cases:**
```
Test 1: "Hello, how are you today?"
Expected: Accurate transcription, no typos

Test 2: "I love listening to classical music"
Expected: Correct transcription, including "classical"

Test 3: "What's your favorite food?"
Expected: Transcription has question mark, correct contraction
```

**Checklist:**
- [ ] Transcription displays in message bubble
- [ ] Transcription replaces placeholder text
- [ ] Transcription accurate with audio
- [ ] Special characters (?, !, ') preserved

### 6. Prosody Scores
**Expected Ranges:**
- Overall Score: 0-100
- Pronunciation: 0-100
- Rhythm: 0-100
- Intonation: 0-100
- Fluency: 0-100

**Checklist:**
- [ ] All scores in valid range (0-100)
- [ ] Overall score is weighted average
- [ ] Scores display in UI
- [ ] Scores have appropriate colors (green/yellow/red)

### 7. Speaking Rate Analysis
**Test Cases:**
```
Test 1: Slow speech (80 WPM)
Expected: Feedback "Try speaking a bit faster"

Test 2: Normal speech (140 WPM)
Expected: Feedback "Natural speaking rhythm"

Test 3: Fast speech (200 WPM)
Expected: Feedback "Slow down slightly for better clarity"
```

**Checklist:**
- [ ] Speaking rate calculated correctly (WPM)
- [ ] Feedback appropriate for speaking rate
- [ ] Rhythm score reflects speaking rate

### 8. Detailed Feedback
**Expected Structure:**
```json
{
  "strengths": [
    "Excellent pronunciation clarity",
    "Natural speaking rhythm and pacing"
  ],
  "improvements": [
    "Focus on clearer pronunciation",
    "Work on maintaining consistent pacing"
  ]
}
```

**Checklist:**
- [ ] Has at least 1 strength
- [ ] Has at least 1 improvement
- [ ] Feedback specific and actionable
- [ ] Feedback displays in UI

## 🔧 Error Handling Checks

### 9. API Key Missing
**Test:** Remove `OPENAI_API_KEY` from `.env`

**Expected:**
- [ ] Error message: "Prosody analysis service not configured"
- [ ] Fallback to mock analysis
- [ ] User still sees feedback (mock data)
- [ ] Console log warning

### 10. Network Error
**Test:** Disconnect internet or block API call

**Expected:**
- [ ] Error caught and logged
- [ ] Fallback to mock analysis
- [ ] User message: "Analysis unavailable, using fallback"
- [ ] No app crash

### 11. Invalid Audio
**Test:** Send empty blob or corrupted audio

**Expected:**
- [ ] Error: "No audio data provided"
- [ ] User-friendly error message
- [ ] Option to retry recording
- [ ] No app crash

### 12. Whisper API Error
**Test:** Invalid API key or rate limit

**Expected:**
- [ ] Error logged with status code
- [ ] Fallback to mock analysis
- [ ] User sees feedback (mock)
- [ ] Retry option available

## 🎯 Integration Checks

### 13. Topic Context
**Test:** Record audio about specific topic (e.g., "music")

**Expected:**
- [ ] Prosody analysis completes
- [ ] AI response related to topic
- [ ] AI response has pronunciation feedback
- [ ] Topic doesn't change

### 14. Level-Appropriate Feedback
**Test Cases:**
```
Beginner: Simple feedback, encouraging
Intermediate: More detailed, specific tips
Advanced: Sophisticated, nuanced feedback
```

**Checklist:**
- [ ] Feedback appropriate for user level
- [ ] Vocabulary in feedback appropriate
- [ ] Suggestions realistic for level

### 15. Previous Scores Context
**Test:** Record multiple audio messages

**Expected:**
- [ ] Each analysis independent
- [ ] Scores can be compared
- [ ] Progress tracking (future feature)
- [ ] History saved correctly

## 📊 Performance Testing

### 16. Response Time
**Benchmarks:**
- Audio upload: < 1s
- Whisper transcription: 2-5s
- Prosody calculation: < 1s
- Total: < 7s

**Checklist:**
- [ ] Total time < 10s
- [ ] Loading indicator displays
- [ ] No UI freeze
- [ ] Smooth user experience

### 17. Audio Quality
**Test Cases:**
```
Test 1: Clear audio, quiet environment
Expected: High scores, accurate transcription

Test 2: Noisy background
Expected: Lower scores, possible transcription errors

Test 3: Low volume
Expected: Warning or lower confidence
```

**Checklist:**
- [ ] Clear audio → high accuracy
- [ ] Noisy audio → appropriate feedback
- [ ] Volume issues detected

## 🔍 Debug Checklist

### 18. Console Logs
**Expected Logs:**
```
🎤 [PROSODY] analyzeAudio called!
📡 [PROSODY] Calling /api/prosody-analysis endpoint...
📡 [PROSODY] API response status: 200
✅ [PROSODY] API response received
✅ [PROSODY] REAL analysis complete!
```

**Checklist:**
- [ ] All emoji logs present
- [ ] No error logs
- [ ] Timing reasonable
- [ ] Data structure correct

### 19. Network Tab
**Expected:**
- Request to `/api/prosody-analysis`
- Method: POST
- Content-Type: audio/webm
- Response: 200 OK
- Response body: JSON with transcription + analysis

**Checklist:**
- [ ] Request sent correctly
- [ ] Audio blob in request body
- [ ] Response received
- [ ] Response structure correct

### 20. State Management
**Expected State Updates:**
```
1. Message added with isProcessing: true
2. Prosody analysis starts
3. Message updated with transcription
4. Message updated with prosodyAnalysis
5. Message updated with isProcessing: false
```

**Checklist:**
- [ ] State updates in correct order
- [ ] No duplicate messages
- [ ] No lost messages
- [ ] UI reflects state correctly

## 🎨 UI/UX Testing

### 21. Visual Feedback
**Checklist:**
- [ ] Recording indicator visible
- [ ] "Analyzing..." spinner shows
- [ ] Prosody scores display with colors
- [ ] Feedback suggestions readable
- [ ] Mobile responsive

### 22. User Flow
**Scenario:** New user records first audio

**Steps:**
1. [ ] User clicks record
2. [ ] Permission prompt appears
3. [ ] Recording starts (visual indicator)
4. [ ] User speaks
5. [ ] User stops recording
6. [ ] Message appears immediately
7. [ ] "Analyzing..." shows
8. [ ] Transcription updates
9. [ ] Scores appear
10. [ ] Feedback suggestions show
11. [ ] AI responds with pronunciation tips

## 📝 Documentation Check

### 23. Code Comments
- [ ] API endpoints documented
- [ ] Function parameters explained
- [ ] Return types clear
- [ ] Error cases documented

### 24. User Documentation
- [ ] How to use prosody feature
- [ ] What scores mean
- [ ] How to improve scores
- [ ] Troubleshooting guide

## 🚀 Production Readiness

### 25. Environment Variables
- [ ] `OPENAI_API_KEY` in production
- [ ] `ALLOWED_ORIGINS` configured
- [ ] Rate limiting enabled
- [ ] Error tracking setup

### 26. Monitoring
- [ ] API call success rate
- [ ] Average response time
- [ ] Error rate tracking
- [ ] User feedback collection

### 27. Fallback Strategy
- [ ] Mock analysis works
- [ ] Graceful degradation
- [ ] User informed of limitations
- [ ] Retry mechanism available

## ✅ Final Checklist

**Before Deployment:**
- [ ] All tests passed
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Error handling robust
- [ ] Documentation complete
- [ ] User testing done
- [ ] Monitoring setup
- [ ] Rollback plan ready

**Post-Deployment:**
- [ ] Monitor error rates
- [ ] Check API usage
- [ ] Collect user feedback
- [ ] Track success metrics
- [ ] Plan improvements

---

## 🎯 Quick Test Script

```bash
# 1. Check environment
echo $OPENAI_API_KEY

# 2. Start dev server
npm run dev

# 3. Open browser console
# 4. Record audio message
# 5. Check console logs:
#    - Should see 🎤 [PROSODY] logs
#    - Should see ✅ success messages
#    - No ❌ error messages

# 6. Verify UI:
#    - Transcription appears
#    - Scores display
#    - Feedback shows
#    - AI responds

# 7. Test error case:
#    - Remove API key
#    - Record again
#    - Should fallback to mock
#    - Should still work
```

## 📊 Success Criteria

**Minimum Requirements:**
- ✅ Transcription accuracy > 90%
- ✅ Response time < 10s
- ✅ Error rate < 5%
- ✅ User satisfaction > 80%

**Optimal Performance:**
- 🎯 Transcription accuracy > 95%
- 🎯 Response time < 7s
- 🎯 Error rate < 2%
- 🎯 User satisfaction > 90%
