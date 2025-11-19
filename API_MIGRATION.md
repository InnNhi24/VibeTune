# API Migration Guide

## API Routes Consolidation

To reduce serverless functions from 13 to 7 (below Vercel Hobby's limit of 12), consolidated 5 API routes into a single `api/data.ts` file.

### Old API → New API

| Old API | New API |
|---------|---------|
| `GET /api/get-history` | `GET /api/data?action=get-history` |
| `POST /api/save-conversation` | `POST /api/data?action=save-conversation` |
| `POST /api/save-message` | `POST /api/data?action=save-message` |
| `DELETE /api/delete-conversation?id=xxx` | `DELETE /api/data?action=delete-conversation&id=xxx` |
| `GET /api/get-messages?profile_id=xxx` | `GET /api/data?action=get-messages&profile_id=xxx` |
| ~~`/api/live-transcribe`~~ | Removed (was just an alias of `/api/transcribe`) |

### Deleted Files

- `api/live-transcribe.ts` - Unnecessary alias
- `api/get-history.ts` - Merged into `data.ts`
- `api/save-conversation.ts` - Merged into `data.ts`
- `api/save-message.ts` - Merged into `data.ts`
- `api/delete-conversation.ts` - Merged into `data.ts`
- `api/get-messages.ts` - Merged into `data.ts`

### Updated Frontend Files

- `frontend/src/components/ChatPanel.tsx`
- `frontend/src/components/MainAppScreen.tsx`
- `frontend/src/services/conversationService.ts`
- `frontend/src/store/appStore.ts`

### Current API Routes Count: 7

1. `api/analytics.ts`
2. `api/chat-stream.ts`
3. `api/chat.ts`
4. `api/data.ts` ⭐ (consolidated 5 routes)
5. `api/index.js`
6. `api/realtime-token.ts`
7. `api/transcribe.ts`
8. `api/voice.ts`

✅ Reduced from 13 to 7 routes (below Vercel Hobby's limit of 12)
