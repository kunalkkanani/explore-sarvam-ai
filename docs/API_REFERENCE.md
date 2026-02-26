# API Reference — Sarvam AI Integration

## Authentication

All requests to Sarvam AI use:
```
Header: API-Subscription-Key: <SARVAM_API_KEY>
Base URL: https://api.sarvam.ai
```

---

## 1. Speech-to-Text (STT)

**Endpoint:** `POST https://api.sarvam.ai/speech-to-text`

**Model:** `saarika:v2`

**Request** (multipart/form-data):
```
file              : audio file (webm, wav, mp3, ogg — max 25MB)
model             : "saarika:v2"
language_code     : "hi-IN"
```

**Response:**
```json
{
  "transcript": "नमस्ते, आप कैसे हैं",
  "language_code": "hi-IN",
  "disfluencies": false
}
```

**Python implementation:**
```python
async def speech_to_text(self, audio_file: UploadFile) -> str:
    audio_bytes = await audio_file.read()
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{self.base_url}/speech-to-text",
            headers={"API-Subscription-Key": self.api_key},
            files={"file": (audio_file.filename, audio_bytes, audio_file.content_type)},
            data={"model": "saarika:v2", "language_code": "hi-IN"},
        )
        response.raise_for_status()
        return response.json()["transcript"]
```

---

## 2. Chat / LLM

**Endpoint:** `POST https://api.sarvam.ai/chat/completions`

**Model:** `sarvam-m`

**Request** (application/json):
```json
{
  "model": "sarvam-m",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful Hindi voice assistant. Always respond in Hindi."
    },
    {
      "role": "user",
      "content": "नमस्ते, आप कैसे हैं"
    }
  ]
}
```

**Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "नमस्ते! मैं ठीक हूँ, धन्यवाद। आप कैसे हैं?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 42,
    "completion_tokens": 18,
    "total_tokens": 60
  }
}
```

**Python implementation:**
```python
SYSTEM_PROMPT = (
    "आप एक सहायक हिंदी वॉयस असिस्टेंट हैं। "
    "हमेशा हिंदी में जवाब दें। "
    "अपने जवाब संक्षिप्त और स्पष्ट रखें।"
)

async def chat(self, messages: list[dict]) -> str:
    payload = {
        "model": "sarvam-m",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            *messages,
        ],
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{self.base_url}/chat/completions",
            headers={
                "API-Subscription-Key": self.api_key,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
```

---

## 3. Text-to-Speech (TTS)

**Endpoint:** `POST https://api.sarvam.ai/text-to-speech`

**Model:** `bulbul:v2`

**Request** (application/json):
```json
{
  "inputs": ["नमस्ते! मैं ठीक हूँ, धन्यवाद।"],
  "target_language_code": "hi-IN",
  "speaker": "meera",
  "model": "bulbul:v2",
  "enable_preprocessing": true
}
```

**Available speakers:** `meera`, `pavithra`, `maitreyi`, `arvind`, `amol`, `amartya`

**Response:**
```json
{
  "audios": ["UklGRiQ..."],
  "request_id": "..."
}
```
Note: `audios[0]` is a base64-encoded WAV string.

**Python implementation:**
```python
async def text_to_speech(self, text: str) -> str:
    payload = {
        "inputs": [text],
        "target_language_code": "hi-IN",
        "speaker": "meera",
        "model": "bulbul:v2",
        "enable_preprocessing": True,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{self.base_url}/text-to-speech",
            headers={
                "API-Subscription-Key": self.api_key,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()["audios"][0]
```

---

## Backend Endpoint

### POST /voice-chat

**Request** (multipart/form-data):
```
audio    : File    — audio blob from browser MediaRecorder
messages : string  — JSON-encoded array: [{"role":"user","content":"..."}]
```

**Success Response 200:**
```json
{
  "transcript":   "आप कैसे हैं",
  "reply_text":   "मैं ठीक हूँ! आपकी क्या मदद करूँ?",
  "audio_base64": "UklGRiQ..."
}
```

**Error Responses:**
```json
// 400 — no audio received
{"detail": "No audio file received"}

// 500 — STT failure
{"detail": "Speech-to-text failed: <upstream error>"}

// 500 — Chat failure
{"detail": "Chat API failed: <upstream error>"}

// 500 — TTS failure
{"detail": "Text-to-speech failed: <upstream error>"}
```

---

## Frontend Usage

### Playing base64 audio
```javascript
const playAudio = (base64String) => {
  const audioData = atob(base64String);
  const arrayBuffer = new ArrayBuffer(audioData.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < audioData.length; i++) {
    view[i] = audioData.charCodeAt(i);
  }
  const blob = new Blob([arrayBuffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
};
```

### Sending audio + history
```javascript
const formData = new FormData();
formData.append("audio", audioBlob, "recording.webm");
formData.append("messages", JSON.stringify(messages));

const response = await axios.post("http://localhost:8000/voice-chat", formData);
```
