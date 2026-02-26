# Hindi Voice Assistant

A full-stack web app where you speak Hindi, an AI replies in Hindi — voice in, voice out.

```
Mic → Sarvam STT (saarika:v2) → Sarvam LLM (sarvam-m) → Sarvam TTS (bulbul:v2) → Audio
```

**Stack:** FastAPI · React + Vite · TailwindCSS · Sarvam AI

---

## Quick Start

### 1. Get a Sarvam AI API key

Sign up at [dashboard.sarvam.ai](https://dashboard.sarvam.ai) and copy your key.

### 2. Set up the backend env

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set:  SARVAM_API_KEY=your_key_here
```

### 3. Install dependencies

```bash
# Python (uses existing venv — Python 3.10.17)
source venv/bin/activate
pip install -r requirements.txt

# Node
cd frontend && npm install && cd ..
```

Or with Taskfile:
```bash
task install
```

### 4. Run the app

Open two terminals:

```bash
# Terminal 1 — Backend (from project root)
source venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Or with Taskfile:
```bash
task run:backend    # terminal 1
task run:frontend   # terminal 2
```

Open **http://localhost:5173** in your browser.

---

## How to use

1. Allow microphone access when the browser prompts
2. Click the **🎙️ mic button** and speak in Hindi
3. Click the **⏹ stop button** when you're done speaking
4. The app will:
   - Transcribe your speech to text
   - Get a Hindi reply from the AI
   - Display both in the chat
   - Automatically play the audio response

---

## Project Structure

```
explore-sarvam-ai/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app — POST /voice-chat
│   │   └── services/
│   │       └── sarvam.py         # SarvamService (STT + Chat + TTS)
│   ├── .env                      # SARVAM_API_KEY (not committed)
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.jsx
│       └── components/
│           └── VoiceAssistant.jsx  # All UI + recording + playback
├── docs/                         # Architecture, API reference, roadmap
├── tests/                        # Pytest tests
├── requirements.txt              # Python deps (managed by root venv)
└── Taskfile.yaml                 # Dev tasks
```

---

## API

```
POST /voice-chat
Content-Type: multipart/form-data

Fields:
  audio    — audio blob (webm)
  messages — JSON string: [{"role": "user", "content": "..."}]

Response:
  {
    "transcript":   "...",   // what you said
    "reply_text":   "...",   // AI reply
    "audio_base64": "..."    // base64 WAV to play
  }
```

---

## Environment Variables

| Variable | File | Description |
|----------|------|-------------|
| `SARVAM_API_KEY` | `backend/.env` | Your Sarvam AI API key |
| `VITE_API_BASE_URL` | `frontend/.env` | Backend URL (default: `http://localhost:8000`) |

---

## Docs

See [`docs/`](docs/) for detailed architecture, API reference, and implementation notes.
