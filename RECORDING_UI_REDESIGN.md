# Recording UI Redesign - Requirements

## 🎯 Goal
Redesign recording interface theo style như ảnh mẫu (Siri/iOS style) - minimal, đẹp, với rainbow gradient button.

---

## 📋 Requirements

### 1. **Live Transcription Display**
**Location**: Hiển thị ở TRÊN recording button (không phải trong input box)

**Design**:
```
┌─────────────────────────────────────┐
│  "Hello what's your name."          │  <- Live transcription (large text)
│                                     │
│         [Rainbow Button]            │  <- Recording button
│         "Speak clearly..."          │  <- Instruction text
└─────────────────────────────────────┘
```

**Specs**:
- Font size: Large (text-2xl or text-3xl)
- Color: Dark gray/black
- Center aligned
- Updates in real-time as user speaks
- Smooth fade-in animation

---

### 2. **Recording Button - Rainbow Gradient**
**Design**: Circular button với rainbow gradient (như Siri)

**States**:

#### Idle State:
- Solid color (accent/primary)
- Icon: Microphone
- Text below: "Tap to record with AI analysis"

#### Recording State:
- **Rainbow gradient** background (animated)
- **Pulsing animation** (scale + opacity)
- **Audio wave animation** - Các thanh sóng chuyển động lên xuống theo âm thanh
- **Timer badge** ở góc trên phải: "0:54"
- Icon: MicOff (hoặc Stop icon)
- Text below: "Speak clearly - AI is listening"

#### Processing State:
- Spinner animation
- Text: "Processing audio..."
- Progress bar (optional)

#### Ready State:
- Green color
- Icon: Send
- Text: "Ready to send!"

**Rainbow Gradient CSS**:
```css
background: linear-gradient(
  135deg,
  #667eea 0%,
  #764ba2 25%,
  #f093fb 50%,
  #4facfe 75%,
  #00f2fe 100%
);
background-size: 200% 200%;
animation: rainbow 3s ease infinite;

@keyframes rainbow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

**Audio Wave Animation** (Sóng âm thanh):
- Hiển thị 5-7 thanh sóng dọc bên trong hoặc xung quanh nút
- Mỗi thanh có chiều cao thay đổi theo audio volume
- Animation: Lên xuống liên tục khi đang recording
- Màu: Trắng hoặc gradient matching với button
- Responsive to actual audio input (sử dụng Web Audio API)

```css
/* Wave bars animation */
@keyframes wave {
  0%, 100% { height: 20%; }
  50% { height: 100%; }
}

.wave-bar {
  animation: wave 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.2s; }
.wave-bar:nth-child(4) { animation-delay: 0.3s; }
.wave-bar:nth-child(5) { animation-delay: 0.4s; }
```

---

### 3. **Timer Badge**
**Location**: Absolute positioned trên recording button (top-right)

**Design**:
- Small badge: "0:54"
- Red/destructive color
- Font: Monospace
- Background: Semi-transparent
- Positioned: `absolute -top-2 -right-2`

---

### 4. **Recording State Card** (When recording)
**Design**: Card hiển thị phía trên button

**Content**:
```
┌─────────────────────────────────────┐
│  🔴 Recording...           0:54     │  <- Header with timer
│                                     │
│  "Hello what's your name."          │  <- Live transcription
│                                     │
│  🎤 Speak clearly into microphone   │  <- Instruction
└─────────────────────────────────────┘
```

**Specs**:
- Background: Light red/pink (destructive/10)
- Border: Red (destructive/30)
- Rounded corners
- Padding: p-4
- Animated entrance (fade + slide up)

---

### 5. **After Recording - Transcription Preview**
**Design**: Show transcription với Retry button

```
┌─────────────────────────────────────┐
│  "Hello what's your name."          │  <- Final transcription
│                                     │
│  [Retry]                            │  <- Retry button
└─────────────────────────────────────┘
```

---

## 🔧 Implementation Steps

### Step 1: Modify RecordingControls Component
**File**: `frontend/src/components/RecordingControls.tsx`

**Changes**:
1. Add prop: `onLiveTranscription?: (text: string) => void`
2. Call callback when `view` state changes
3. Simplify UI - remove large cards, keep only button
4. Add rainbow gradient CSS for recording state
5. Add timer badge on button
6. Return minimal JSX (just button + small status text)

### Step 2: Update ChatPanel
**File**: `frontend/src/components/ChatPanel.tsx`

**Changes**:
1. Add state: `const [liveTranscription, setLiveTranscription] = useState("")`
2. Pass callback to RecordingControls: `onLiveTranscription={setLiveTranscription}`
3. Show live transcription above recording button when recording
4. Hide text input when recording (optional)
5. Center everything with max-width container

### Step 3: Add Rainbow Gradient & Wave Animation CSS
**File**: `frontend/src/index.css`

**Add**:
```css
/* Rainbow gradient animation */
@keyframes rainbow-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.rainbow-recording {
  background: linear-gradient(
    135deg,
    #667eea 0%,
    #764ba2 25%,
    #f093fb 50%,
    #4facfe 75%,
    #00f2fe 100%
  );
  background-size: 200% 200%;
  animation: rainbow-gradient 3s ease infinite;
}

/* Audio wave bars animation */
@keyframes wave {
  0%, 100% { 
    transform: scaleY(0.3);
  }
  50% { 
    transform: scaleY(1);
  }
}

.wave-bar {
  width: 3px;
  height: 24px;
  background: white;
  border-radius: 2px;
  animation: wave 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.15s; }
.wave-bar:nth-child(4) { animation-delay: 0.2s; }
.wave-bar:nth-child(5) { animation-delay: 0.15s; }
.wave-bar:nth-child(6) { animation-delay: 0.1s; }
.wave-bar:nth-child(7) { animation-delay: 0s; }
```

### Step 4: Add Audio Visualizer Component
**File**: `frontend/src/components/AudioWaveVisualizer.tsx` (NEW)

**Purpose**: Component hiển thị wave bars responsive với audio input

**Features**:
- Sử dụng Web Audio API để analyze audio frequency
- Update wave bar heights theo real-time audio volume
- Fallback to CSS animation nếu không có audio data

---

## 🎨 Visual Specs

### Colors:
- **Idle**: `bg-accent` (purple/blue)
- **Recording**: Rainbow gradient + pulse
- **Processing**: `bg-muted` with spinner
- **Ready**: `bg-success` (green)

### Sizes:
- Button: `h-20 w-20` (large, prominent)
- Timer badge: `text-xs` monospace
- Live transcription: `text-2xl` or `text-3xl`
- Instruction text: `text-sm text-muted-foreground`

### Animations:
- Recording pulse: Scale 1 → 1.1 → 1 (1.5s loop)
- Rainbow gradient: Background position animation (3s loop)
- **Wave bars**: ScaleY 0.3 → 1 → 0.3 (0.8s loop, staggered delays)
- **Audio reactive**: Wave heights respond to actual audio volume
- Transcription fade-in: opacity 0 → 1 (0.3s)
- Button hover: Scale 1.05

---

## ✅ Success Criteria

1. ✅ Live transcription hiển thị to, rõ ràng phía trên button
2. ✅ Recording button có rainbow gradient + pulse animation
3. ✅ **Wave bars animation** - Sóng âm thanh chuyển động lên xuống khi recording
4. ✅ Wave bars responsive với audio volume (Web Audio API)
5. ✅ Timer badge hiển thị trên button (góc phải)
6. ✅ UI minimal, clean, không clutter
7. ✅ Smooth animations
8. ✅ Text input và voice recording tách biệt rõ ràng

---

## 📝 Notes

- RecordingControls hiện tại quá phức tạp với nhiều cards
- Cần simplify để chỉ return button + status
- Live transcription nên được lift up to ChatPanel để control layout
- Rainbow gradient cần CSS animation, không dùng Framer Motion (performance)

---

## 🚀 Next Session Command

```
Implement minimal recording UI redesign theo RECORDING_UI_REDESIGN.md:
1. Add rainbow gradient button for recording state
2. Add audio wave bars animation (sóng âm thanh lên xuống)
3. Make wave bars responsive to audio volume (Web Audio API)
4. Show live transcription above button (large text)
5. Add timer badge on button
6. Simplify RecordingControls component
7. Make it look like the reference image (Siri style)
```

---

## 🎵 Audio Wave Implementation Details

### Option 1: Simple CSS Animation (Easier)
- 5-7 div elements với class `wave-bar`
- CSS animation với staggered delays
- Không cần audio analysis
- Always animating khi recording

### Option 2: Audio-Reactive (Better UX)
- Sử dụng Web Audio API `AnalyserNode`
- Get frequency data từ microphone stream
- Update wave bar heights theo real-time volume
- Fallback to CSS animation nếu API không available

**Recommended**: Start với Option 1 (CSS), sau đó enhance với Option 2

### Wave Bar Layout Options:

**A. Inside Button** (Recommended - giống Siri):
```
┌─────────────────┐
│                 │
│   | | | | |    │  <- Wave bars inside
│                 │
└─────────────────┘
```

**B. Around Button**:
```
    | | | | |
┌─────────────────┐
│                 │
│    [Button]     │
│                 │
└─────────────────┘
    | | | | |
```

**C. Replace Icon**:
- Wave bars thay thế microphone icon khi recording
- Cleaner, more minimal
