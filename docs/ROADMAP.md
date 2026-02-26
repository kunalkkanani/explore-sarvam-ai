# Hindi Voice Assistant — Project Roadmap

## Overview

A full-stack web application where users speak Hindi, the AI transcribes it,
generates a Hindi response via LLM, and speaks it back — all in the browser.

```
User Mic → STT (Sarvam Saarika) → LLM (Sarvam Saaras) → TTS (Sarvam Bulbul) → Audio Playback
```

---

## Milestones

### M0 — Foundation & Planning ✅
- [x] Define tech stack
- [x] Write architecture docs
- [x] Create API contract
- [x] Write folder structure
- [ ] Bootstrap backend scaffold
- [ ] Bootstrap frontend scaffold

---

### M1 — Backend Core
**Goal:** Working `/voice-chat` endpoint end-to-end

Tasks:
- [ ] Setup FastAPI project in `backend/`
- [ ] Implement `SarvamService.speech_to_text()`
- [ ] Implement `SarvamService.chat()`
- [ ] Implement `SarvamService.text_to_speech()`
- [ ] Wire all three into `POST /voice-chat`
- [ ] Add CORS middleware
- [ ] Add `.env` loading with python-dotenv
- [ ] Add logging
- [ ] Manual test with `curl` / Postman

---

### M2 — Frontend Core
**Goal:** User can record, send, and hear a response

Tasks:
- [ ] Scaffold React + Vite app in `frontend/`
- [ ] Install TailwindCSS
- [ ] Build `VoiceAssistant.jsx` component
- [ ] Implement MediaRecorder audio capture
- [ ] POST audio blob to backend `/voice-chat`
- [ ] Display transcribed Hindi text
- [ ] Display AI reply text
- [ ] Auto-play returned base64 audio
- [ ] Loading spinner during processing

---

### M3 — Conversation History
**Goal:** Multi-turn contextual conversation

Tasks:
- [ ] Add `messages[]` state in React
- [ ] Append user and assistant turns to history
- [ ] Send full history to backend on each request
- [ ] Backend forwards history to Sarvam chat API
- [ ] Display scrollable conversation thread in UI

---

### M3.5 — Taskfile & DX
**Goal:** One-command dev startup

Tasks:
- [ ] Add `run:backend` task to Taskfile.yaml
- [ ] Add `run:frontend` task to Taskfile.yaml
- [ ] Add `install` task (pip + npm)
- [ ] Add `lint` task (pre-commit run --all-files)

---

### M4 — Polish & Production Ready
**Goal:** Clean, deployable application

Tasks:
- [ ] Error handling (mic denied, API failures, network errors)
- [ ] Loading states and disabled mic during processing
- [ ] Responsive design (mobile-first)
- [ ] Environment variable validation on startup
- [ ] Write `README.md` with setup instructions
- [ ] Add `.env.example` files for both backend and frontend
- [ ] Final code cleanup

---

## Tech Stack

| Layer     | Technology              | Purpose                          |
|-----------|-------------------------|----------------------------------|
| Backend   | Python 3.11 + FastAPI   | REST API server                  |
| HTTP      | httpx (async)           | Non-blocking calls to Sarvam API |
| Config    | python-dotenv           | Load API keys from `.env`        |
| Frontend  | React 18 + Vite         | UI framework                     |
| Styling   | TailwindCSS v3          | Utility-first CSS                |
| HTTP      | Axios                   | API calls from browser           |
| Audio     | MediaRecorder Web API   | Capture mic input in browser     |

---

## Sarvam AI APIs Used

| API              | Endpoint                                          | Model      |
|------------------|---------------------------------------------------|------------|
| Speech-to-Text   | `POST /speech-to-text`                            | `saarika:v2` |
| Chat / LLM       | `POST /chat/completions`                          | `sarvam-m`   |
| Text-to-Speech   | `POST /text-to-speech`                            | `bulbul:v2`  |

Base URL: `https://api.sarvam.ai`
Auth: `API-Subscription-Key: <SARVAM_API_KEY>` header
