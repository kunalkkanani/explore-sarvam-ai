# Architecture — Hindi Voice Assistant

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   React Frontend                     │  │
│  │                                                      │  │
│  │  ┌──────────────┐    ┌──────────────────────────┐   │  │
│  │  │  Mic Button  │    │  Conversation Display    │   │  │
│  │  │ (MediaRecord)│    │  - User transcript       │   │  │
│  │  └──────┬───────┘    │  - AI reply text         │   │  │
│  │         │ audio blob │  - Audio auto-play       │   │  │
│  │         ▼            └──────────────────────────┘   │  │
│  │  ┌──────────────┐                                    │  │
│  │  │  Axios POST  │─────────────────────────────────►  │  │
│  │  │ /voice-chat  │◄────────────────────────────────   │  │
│  │  └──────────────┘  {transcript, reply_text,          │  │
│  │                     audio_base64}                     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬────────────────────────┘
                                     │ HTTP (localhost:8000)
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                          │
│                                                             │
│  POST /voice-chat                                           │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  SarvamService                      │   │
│  │                                                     │   │
│  │  1. speech_to_text(audio_file)                      │   │
│  │         │ audio bytes (webm/wav)                    │   │
│  │         ▼                                           │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  Sarvam STT API  (saarika:v2)                │  │   │
│  │  │  POST /speech-to-text                        │  │   │
│  │  │  Returns: {"transcript": "आप कैसे हैं"}     │  │   │
│  │  └──────────────────────┬───────────────────────┘  │   │
│  │                         │ transcript string         │   │
│  │                         ▼                           │   │
│  │  2. chat(messages)                                  │   │
│  │         │ messages array with history               │   │
│  │         ▼                                           │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  Sarvam Chat API  (sarvam-m)                 │  │   │
│  │  │  POST /chat/completions                      │  │   │
│  │  │  Returns: {"choices": [{"message": {...}}]}  │  │   │
│  │  └──────────────────────┬───────────────────────┘  │   │
│  │                         │ reply_text string         │   │
│  │                         ▼                           │   │
│  │  3. text_to_speech(reply_text)                      │   │
│  │         │ Hindi text                                │   │
│  │         ▼                                           │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  Sarvam TTS API  (bulbul:v2)                 │  │   │
│  │  │  POST /text-to-speech                        │  │   │
│  │  │  Returns: {"audios": ["<base64_wav>"]}       │  │   │
│  │  └──────────────────────┬───────────────────────┘  │   │
│  │                         │ audio_base64 string       │   │
│  │                         ▼                           │   │
│  │  Return JSON response to frontend                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │    Sarvam AI Platform    │
              │   api.sarvam.ai          │
              │  - STT  (saarika:v2)     │
              │  - Chat (sarvam-m)       │
              │  - TTS  (bulbul:v2)      │
              └──────────────────────────┘
```

---

## Data Flow — Single Turn

```
1. User clicks mic → MediaRecorder starts (webm audio)
2. User releases mic → MediaRecorder stops, audio blob ready
3. Frontend creates FormData with audio blob
4. Axios POST /voice-chat (multipart/form-data)
5. Backend receives UploadFile
6. SarvamService.speech_to_text() → Sarvam STT API → transcript
7. Build messages = [...history, {role: "user", content: transcript}]
8. SarvamService.chat(messages) → Sarvam Chat API → reply_text
9. SarvamService.text_to_speech(reply_text) → Sarvam TTS API → audio_base64
10. Backend returns: {transcript, reply_text, audio_base64}
11. Frontend updates conversation state
12. Frontend creates Audio object from base64, plays it
```

## Data Flow — Multi-Turn (Conversation History)

```
Frontend state: messages = [
  {role: "user",      content: "नमस्ते"},
  {role: "assistant", content: "नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?"},
  ...
]

On each new voice message:
  - Append new user turn to messages
  - Send entire messages array in POST body as JSON field
  - Backend builds: [system_prompt, ...history, new_user_turn]
  - Chat API gets full context → coherent multi-turn response
  - Frontend appends assistant turn to messages
```

---

## Component Structure

### Backend

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, router mount
│   └── services/
│       └── sarvam.py        # SarvamService class (STT + Chat + TTS)
├── .env                     # SARVAM_API_KEY=...
└── requirements.txt         # fastapi, uvicorn, httpx, python-dotenv, python-multipart
```

### Frontend

```
frontend/
├── src/
│   ├── App.jsx              # Root component, renders VoiceAssistant
│   └── components/
│       └── VoiceAssistant.jsx  # All UI + logic (mic, state, API calls)
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

---

## API Contract

### POST /voice-chat

**Request** (multipart/form-data):
```
audio    : File    (webm/wav audio blob from MediaRecorder)
messages : string  (JSON-encoded array of {role, content} objects)
```

**Response** (application/json):
```json
{
  "transcript":   "आप कैसे हैं",
  "reply_text":   "मैं ठीक हूँ, धन्यवाद! आप कैसे हैं?",
  "audio_base64": "UklGRiQ..."
}
```

**Error Response**:
```json
{
  "detail": "Speech-to-text failed: <error message>"
}
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audio format | webm (browser default) | MediaRecorder default; Sarvam STT accepts it |
| TTS format | wav (base64) | Sarvam returns base64 WAV; easy to play via Web Audio API |
| HTTP client | httpx async | Non-blocking; matches FastAPI's async model |
| State management | React useState | No Redux needed; single-component scope |
| History encoding | JSON string in FormData | Allows sending mixed file+json in one multipart request |
| CORS | allow_origins=["*"] dev | Tighten to specific origin in production |
