# Live Transcription Integration Guide

## Overview
VibeTune now supports live speech-to-text transcription using Deepgram. The system sends audio chunks every 2 seconds to the backend for transcription, creating a "live" transcription experience.

## Architecture

### Backend
- **Endpoint**: `POST /api/live-transcribe`
- **Input**: Base64-encoded audio chunks (webm format)
- **Output**: Transcript text and confidence score
- **Security**: API keys stay on server, not exposed to client

### Frontend
- **Service**: `LiveTranscriptionService` (`frontend/src/services/liveTranscriptionService.ts`)
- **Features**:
  - Records audio in 2-second chunks
  - Automatically sends chunks to backend
  - Accumulates transcript in real-time
  - Callback-based API for UI updates

## How to Use

### Basic Usage

```typescript
import { liveTranscriptionService } from '../services/liveTranscriptionService';

// Start live transcription
await liveTranscriptionService.start(
  (transcript, isFinal) => {
    // Update UI with live transcript
    console.log('Live transcript:', transcript);
    setLiveText(transcript);
  },
  (error) => {
    // Handle errors
    console.error('Transcription error:', error);
  }
);

// Stop transcription
const finalTranscript = await liveTranscriptionService.stop();
console.log('Final transcript:', finalTranscript);
```

### Integration with RecordingControls

To integrate live transcription into `RecordingControls.tsx`:

1. Import the service:
```typescript
import { liveTranscriptionService } from '../services/liveTranscriptionService';
```

2. Add state for live transcript:
```typescript
const [liveTranscript, setLiveTranscript] = useState("");
```

3. Update `handleStartRecording` to use live transcription:
```typescript
const handleStartRecording = async () => {
  if (disabled) return;
  
  try {
    // Start live transcription
    await liveTranscriptionService.start(
      (transcript, isFinal) => {
        setLiveTranscript(transcript);
        if (!isFinal) {
          // Show partial transcript in UI
          setRecordedMessage(transcript);
        }
      },
      (error) => {
        console.error('Live transcription error:', error);
      }
    );
    
    setRecordingState('recording');
    setRecordingTime(0);
  } catch (error) {
    console.error('Failed to start recording:', error);
  }
};
```

4. Update `handleStopRecording` to get final transcript:
```typescript
const handleStopRecording = async () => {
  setRecordingState('processing');
  
  // Stop live transcription and get final result
  const finalTranscript = await liveTranscriptionService.stop();
  setRecordedMessage(finalTranscript);
  setRecordingState('ready');
};
```

5. Display live transcript in UI:
```tsx
{recordingState === 'recording' && liveTranscript && (
  <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
    <span className="text-gray-500">Transcribing: </span>
    <span>{liveTranscript}</span>
  </div>
)}
```

## Backend API

### POST /api/live-transcribe

**Request:**
```json
{
  "audioData": "base64_encoded_audio_chunk",
  "format": "webm"
}
```

**Response:**
```json
{
  "transcript": "transcribed text",
  "confidence": 0.95,
  "is_final": true
}
```

**Error Response:**
```json
{
  "error": "Transcription failed",
  "details": "Error message"
}
```

## Current Status

✅ **Completed:**
- Backend endpoint `/api/live-transcribe` implemented
- Frontend service `LiveTranscriptionService` created
- Security: API keys protected on server
- Chunking: 2-second audio chunks for low latency
- Error handling implemented

⏳ **Pending Integration:**
- RecordingControls component still uses mock transcription
- Need to replace lines 142-162 in `RecordingControls.tsx` with live service
- UI updates to show live transcript while recording

## Testing

1. Test live transcription service:
```typescript
// In browser console
import { liveTranscriptionService } from './services/liveTranscriptionService';

await liveTranscriptionService.start(
  (text) => console.log('Transcript:', text),
  (err) => console.error('Error:', err)
);

// Speak for a few seconds

await liveTranscriptionService.stop();
```

2. Test backend endpoint directly:
```bash
# Record audio and convert to base64
curl -X POST http://localhost:5000/api/live-transcribe \
  -H "Content-Type: application/json" \
  -d '{"audioData": "base64_audio_here", "format": "webm"}'
```

## Performance Considerations

- **Chunk size**: 2 seconds provides good balance between latency and accuracy
- **Network**: Each chunk ~20-50KB, manageable for most connections
- **Server**: 50MB JSON limit supports large audio chunks
- **Memory**: Chunks are processed and discarded, minimal memory footprint

## Future Improvements

1. **Websocket support** for true real-time streaming
2. **Interim results** before final transcription
3. **Multi-language support** (currently English only)
4. **Custom chunk size** configuration
5. **Noise reduction** preprocessing
