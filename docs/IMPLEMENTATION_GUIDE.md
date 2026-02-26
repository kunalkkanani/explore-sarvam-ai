# Implementation Guide — Step-by-Step

## Prerequisites

- Python 3.10.17 (already in `venv/` — do NOT create a new venv)
- Node.js 20+
- A Sarvam AI API key (https://dashboard.sarvam.ai)

> **Important:** The project uses Python 3.10.17 (not 3.11). Use
> `from __future__ import annotations` at the top of Python files to
> enable modern type hint syntax (`list[dict]` instead of `List[Dict]`).

---

## Phase 1: Backend Setup

### Step 1.1 — Create backend directory structure

```bash
mkdir -p backend/app/services
touch backend/app/__init__.py
touch backend/app/services/__init__.py
touch backend/app/main.py
touch backend/app/services/sarvam.py
touch backend/.env
touch backend/.env.example
```

### Step 1.2 — Install app deps into EXISTING root venv

```bash
# Activate existing venv (Python 3.10.17)
source venv/bin/activate

# Install app dependencies
pip install fastapi "uvicorn[standard]" httpx python-dotenv python-multipart

# Update the root requirements.txt (appends new packages)
pip freeze > requirements.txt
```

> No separate `backend/requirements.txt` — the root venv and
> `requirements.txt` are the single source of truth for Python deps.

### Step 1.3 — Write `backend/app/services/sarvam.py`

Implements `SarvamService` with three async methods:
- `speech_to_text(audio_file: UploadFile) -> str`
- `chat(messages: list[dict]) -> str`
- `text_to_speech(text: str) -> str`

Key points:
- Load `SARVAM_API_KEY` from environment at class init
- Use `async with httpx.AsyncClient()` for each call
- Set `timeout=30.0` on chat and TTS calls
- Raise `HTTPException(500, detail=...)` on failure

### Step 1.4 — Write `backend/app/main.py`

```python
# Pseudocode structure:
app = FastAPI(title="Hindi Voice Assistant")

# CORS — allow all origins in dev
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

@app.post("/voice-chat")
async def voice_chat(
    audio: UploadFile = File(...),
    messages: str = Form(default="[]"),   # JSON string
):
    svc = SarvamService()
    transcript = await svc.speech_to_text(audio)
    history = json.loads(messages)
    history.append({"role": "user", "content": transcript})
    reply = await svc.chat(history)
    audio_b64 = await svc.text_to_speech(reply)
    return {"transcript": transcript, "reply_text": reply, "audio_base64": audio_b64}
```

### Step 1.5 — Test backend

```bash
# From project root (NOT from backend/)
source venv/bin/activate
echo "SARVAM_API_KEY=your_key" > backend/.env
uvicorn backend.app.main:app --reload --port 8000
```

Test with curl:
```bash
curl -X POST http://localhost:8000/voice-chat \
  -F "audio=@test.wav" \
  -F 'messages=[]'
```

---

## Phase 2: Frontend Setup

### Step 2.1 — Scaffold Vite + React app

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install axios
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 2.2 — Configure TailwindCSS

`tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 2.3 — Write `src/App.jsx`

Simple wrapper that renders `<VoiceAssistant />`.

### Step 2.4 — Write `src/components/VoiceAssistant.jsx`

State:
```javascript
const [isRecording, setIsRecording]     = useState(false);
const [isLoading, setIsLoading]         = useState(false);
const [messages, setMessages]           = useState([]);  // conversation history
const [error, setError]                 = useState(null);

const mediaRecorderRef = useRef(null);
const audioChunksRef   = useRef([]);
```

Recording logic:
```javascript
const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
  recorder.onstop = handleAudioReady;
  recorder.start();
  mediaRecorderRef.current = recorder;
  setIsRecording(true);
};

const stopRecording = () => {
  mediaRecorderRef.current?.stop();
  setIsRecording(false);
};
```

API call:
```javascript
const handleAudioReady = async () => {
  const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
  audioChunksRef.current = [];
  setIsLoading(true);

  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");
  formData.append("messages", JSON.stringify(
    messages.map(m => ({ role: m.role, content: m.content }))
  ));

  const { data } = await axios.post(
    `${import.meta.env.VITE_API_BASE_URL}/voice-chat`,
    formData
  );

  setMessages(prev => [
    ...prev,
    { role: "user",      content: data.transcript },
    { role: "assistant", content: data.reply_text  },
  ]);

  playAudio(data.audio_base64);
  setIsLoading(false);
};
```

Audio playback:
```javascript
const playAudio = (base64String) => {
  const bytes = atob(base64String);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  const blob = new Blob([buffer], { type: "audio/wav" });
  new Audio(URL.createObjectURL(blob)).play();
};
```

### Step 2.5 — Write `.env` for frontend

```
VITE_API_BASE_URL=http://localhost:8000
```

### Step 2.6 — Run frontend

```bash
cd frontend
npm run dev
# Open http://localhost:5173
```

---

## Phase 3: Conversation History

The `messages` state in React mirrors the OpenAI-style chat format:
```javascript
[
  { role: "user",      content: "नमस्ते" },
  { role: "assistant", content: "नमस्ते! कैसे हैं आप?" },
  { role: "user",      content: "मुझे मौसम बताओ" },
  { role: "assistant", content: "आज दिल्ली में धूप है..." },
]
```

This array is JSON-serialized and sent with every request so the backend
can pass full conversation context to the chat API.

---

## Phase 4: UI Design

### Layout
```
┌─────────────────────────────────────┐
│         Hindi Voice Assistant        │
│            (heading)                 │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🎤 User: नमस्ते           │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🤖 AI: नमस्ते! कैसे हैं? │    │
│  └─────────────────────────────┘    │
│                                     │
│              (scroll)               │
│                                     │
├─────────────────────────────────────┤
│                                     │
│          ┌─────────────┐            │
│          │   🎙️  Mic   │            │
│          │  (big btn)  │            │
│          └─────────────┘            │
│       Hold to speak / Click         │
│                                     │
└─────────────────────────────────────┘
```

### TailwindCSS color scheme
- Background: `bg-gray-950`
- Card: `bg-gray-900 rounded-2xl shadow-2xl`
- User message: `bg-blue-600 text-white`
- AI message: `bg-gray-800 text-gray-100`
- Mic (idle): `bg-blue-600 hover:bg-blue-500`
- Mic (recording): `bg-red-600 animate-pulse`
- Loading: spinner with `animate-spin`

---

## Running the Full Stack

```bash
# Terminal 1 — Backend (run from project ROOT)
source venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Or via Taskfile (after tasks are added):
```bash
task run:backend   # Terminal 1
task run:frontend  # Terminal 2
```

Open: http://localhost:5173

---

## Code Style (pre-commit enforced)

The repo has pre-commit hooks for **black**, **flake8**, and **isort**.
All backend Python must pass these before commit.

```bash
# Install hooks (once)
source venv/bin/activate
pre-commit install

# Run manually
pre-commit run --all-files
```

Rules from existing config:
- `black`: line-length = 88
- `flake8`: max-line-length = 88, ignores E203/W503
- `isort`: profile = "black"
- Use `from __future__ import annotations` for modern type hints on Python 3.10

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Mic not working | Browser permissions | Allow mic in browser settings |
| CORS error | Backend CORS not configured | Ensure CORSMiddleware is added |
| 422 Unprocessable Entity | Form field name mismatch | Check `audio` and `messages` field names |
| Audio not playing | Autoplay policy | Trigger playback from user gesture (mic click) |
| `SARVAM_API_KEY` missing | .env not loaded | Run from `backend/` dir; check dotenv call |
| Hindi text garbled | Wrong language code | Use `hi-IN` for all Sarvam API calls |
