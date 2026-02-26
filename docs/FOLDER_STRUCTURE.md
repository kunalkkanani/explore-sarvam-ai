# Folder Structure — Hindi Voice Assistant

## Full Project Layout

```
explore-sarvam-ai/
│
├── docs/                          ← Planning & reference docs (you are here)
│   ├── ROADMAP.md
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   ├── FOLDER_STRUCTURE.md
│   ├── IMPLEMENTATION_GUIDE.md
│   └── UI_MOCKUP.md
│
├── backend/                       ← FastAPI app (NEW)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                ← FastAPI app, CORS, /voice-chat endpoint
│   │   └── services/
│   │       ├── __init__.py
│   │       └── sarvam.py          ← SarvamService (STT + Chat + TTS)
│   ├── .env                       ← SARVAM_API_KEY=... (not committed)
│   └── .env.example               ← Template (committed)
│
├── frontend/                      ← React app (NEW)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── components/
│   │       └── VoiceAssistant.jsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── tests/                         ← EXISTING — backend tests go here too
│   └── test_sample.py             ← existing placeholder
│
├── venv/                          ← EXISTING Python 3.10.17 venv (reused)
├── main.py                        ← EXISTING boilerplate (leave as-is)
├── requirements.txt               ← EXISTING dev tools → ADD app deps here
├── pyproject.toml                 ← EXISTING black/isort config (line-length=88)
├── .flake8                        ← EXISTING (max-line-length=88)
├── .pre-commit-config.yaml        ← EXISTING hooks: black, flake8, isort
├── Taskfile.yaml                  ← EXISTING empty → ADD run tasks
├── PYTHON_VERSION                 ← 3.10.17 (NOT 3.11)
├── .env                           ← Root boilerplate env (DEBUG/SECRET_KEY)
└── .gitignore                     ← covers .env, venv/, node_modules/
```

---

## File Responsibilities

### Backend

| File | Responsibility |
|------|----------------|
| `backend/app/main.py` | Create FastAPI app, add CORS middleware, define `POST /voice-chat` endpoint |
| `backend/app/services/sarvam.py` | `SarvamService` class — wraps all three Sarvam AI API calls |
| `backend/.env` | Holds `SARVAM_API_KEY` (never committed) |
| `backend/.env.example` | Template showing required env vars (committed) |
| `backend/requirements.txt` | `fastapi`, `uvicorn[standard]`, `httpx`, `python-dotenv`, `python-multipart` |

### Frontend

| File | Responsibility |
|------|----------------|
| `frontend/src/App.jsx` | Top-level component, imports and renders `VoiceAssistant` |
| `frontend/src/main.jsx` | React entry point, mounts `<App />` into `#root` |
| `frontend/src/components/VoiceAssistant.jsx` | Mic recording, API call, conversation state, audio playback, UI |
| `frontend/vite.config.js` | Dev server on port 5173, proxy `/api` → `localhost:8000` (optional) |
| `frontend/tailwind.config.js` | Content paths for TailwindCSS purging |

---

## Dependencies

### Root `requirements.txt` (existing dev tools + new app deps)
```
# --- existing dev tools ---
black==26.1.0
flake8==7.3.0
isort==8.0.0
pytest==9.0.2
pre_commit==4.5.1
# ... (keep all existing entries)

# --- new app dependencies ---
fastapi==0.115.0
uvicorn[standard]==0.32.0
httpx==0.27.2
python-dotenv==1.0.1
python-multipart==0.0.12
```

> NOTE: No separate `backend/requirements.txt`. The root venv (Python 3.10.17)
> is used for the backend. Install with:
> ```bash
> source venv/bin/activate
> pip install fastapi uvicorn[standard] httpx python-dotenv python-multipart
> pip freeze > requirements.txt
> ```

### Frontend (`frontend/package.json`)
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.9"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.5",
    "tailwindcss": "^3.4.17",
    "postcss": "^8.5.1",
    "autoprefixer": "^10.4.20"
  }
}
```

---

## Environment Variables

### `backend/.env`
```
SARVAM_API_KEY=your_actual_api_key_here
```

### `frontend/.env` (optional — if not using proxy)
```
VITE_API_BASE_URL=http://localhost:8000
```
