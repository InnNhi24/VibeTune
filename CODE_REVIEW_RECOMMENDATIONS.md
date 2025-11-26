# VibeTune - Code Review & UX Recommendations

## 🔴 CRITICAL BUGS (Fix Immediately)

### 1. Missing Store Method
**File**: `frontend/src/components/MainAppScreen.tsx:98`
**Issue**: Calls `store.clearActiveSession()` which doesn't exist
**Impact**: Runtime error when clicking "New Conversation"
**Fix**: Add method to `appStore.ts` or remove the call

```typescript
// Add to appStore.ts
clearActiveSession: () => set({ 
  activeConversationId: null,
  currentTopic: 'New Conversation'
}),
```

---

## ⚠️ HIGH PRIORITY UX Issues

### 2. No Visual Feedback During Audio Recording
**Problem**: Users don't know if recording is working
**User Impact**: Confusion, uncertainty
**Recommendation**: Add visual indicators:
- Recording timer (00:05)
- Waveform animation
- Red recording dot
- "Recording..." text

### 3. Prosody Scores Not Visible
**Problem**: Scores calculated but not shown prominently
**User Impact**: Users don't see their progress
**Recommendation**: Add ProsodyScoreCard component:
```tsx
<ProsodyScoreCard 
  overall={75}
  pronunciation={80}
  rhythm={70}
  intonation={75}
  fluency={72}
/>
```

### 4. No Audio Playback
**Problem**: Users can't replay their recordings
**User Impact**: Can't review pronunciation
**Recommendation**: Add playback button to audio messages

### 5. No Session Progress Indicator
**Problem**: AI suggests ending after 10-15 turns, but no visual cue
**User Impact**: Users don't know how long session is
**Recommendation**: Add progress bar:
```
Turn 8/15 ████████░░░░░░░
```

### 6. No Session Summary
**Problem**: When session ends, no recap of progress
**User Impact**: No sense of achievement
**Recommendation**: Show summary modal:
- Total turns: 12
- Average score: 78%
- Best area: Pronunciation (85%)
- Improvement area: Rhythm (65%)
- Time spent: 15 minutes

---

## 🟡 MEDIUM PRIORITY Features

### 7. No Progress Dashboard
**Problem**: No way to see improvement over time
**Recommendation**: Add dashboard page with:
- Line chart of scores over time
- Total practice time
- Streak counter
- Topic breakdown

### 8. No Message Editing/Deletion
**Problem**: Can't fix mistakes
**Recommendation**: Add edit/delete buttons to messages

### 9. No Conversation Export
**Problem**: Can't save/share conversations
**Recommendation**: Add "Export as PDF" or "Share" button

### 10. No Keyboard Shortcuts
**Problem**: Mouse-only interaction
**Recommendation**: Add shortcuts:
- `Ctrl+Enter`: Send message
- `Ctrl+R`: Start recording
- `Ctrl+N`: New conversation
- `Ctrl+,`: Settings

---

## 🟢 LOW PRIORITY Enhancements

### 11. No Dark Mode Toggle
**Problem**: Theme is fixed
**Recommendation**: Add theme switcher in Settings

### 12. No Notification Preferences
**Problem**: Can't customize notifications
**Recommendation**: Add granular notification settings

### 13. No Conversation Search
**Problem**: Hard to find old conversations
**Recommendation**: Add search bar in sidebar

### 14. No Voice Selection
**Problem**: AI voice is fixed
**Recommendation**: Let users choose AI voice (male/female, accent)

---

## 📊 CODE QUALITY Improvements

### 15. Add Loading States
**Files**: `ChatPanel.tsx`, `RecordingControls.tsx`
**Issue**: No loading indicators during API calls
**Fix**: Add skeleton loaders and spinners

### 16. Add Error Recovery
**Files**: `aiProsodyService.ts`, `api/prosody-analysis.ts`
**Issue**: If Whisper fails, no retry mechanism
**Fix**: Add exponential backoff retry

### 17. Add Request Cancellation
**Files**: `ChatPanel.tsx`
**Issue**: If user navigates away, requests continue
**Fix**: Use AbortController

### 18. Add Optimistic Updates
**Files**: `ChatPanel.tsx`
**Issue**: UI waits for server response
**Fix**: Show message immediately, rollback on error

---

## 🎯 IMPLEMENTATION PRIORITY

### Phase 1 (This Week):
1. ✅ Fix `clearActiveSession` bug
2. ✅ Add recording visual feedback
3. ✅ Show prosody scores prominently
4. ✅ Add session progress indicator

### Phase 2 (Next Week):
5. Add session summary
6. Add audio playback
7. Add loading states
8. Add error recovery

### Phase 3 (Future):
9. Progress dashboard
10. Message editing
11. Keyboard shortcuts
12. Conversation export

---

## 💡 QUICK WINS (Easy to implement, high impact)

1. **Add recording timer**: 5 minutes to implement
2. **Show turn count**: "Turn 8/15" - 2 minutes
3. **Add loading spinners**: 10 minutes
4. **Fix clearActiveSession bug**: 2 minutes

---

## 📝 NOTES

- Overall code quality is **GOOD**
- Architecture is **SOLID**
- Main issues are **UX polish** and **visual feedback**
- No major security concerns
- Performance is acceptable

**Recommendation**: Focus on UX improvements to make the app feel more polished and professional.
