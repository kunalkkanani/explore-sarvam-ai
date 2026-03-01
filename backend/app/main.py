from __future__ import annotations

import json
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

from backend.app.services.sarvam import SarvamService  # noqa: E402

_LANG_NAMES: dict[str, str] = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "gu-IN": "Gujarati",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Voice Assistant API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/voice-chat")
async def voice_chat(
    audio: UploadFile = File(...),
    messages: str = Form(default="[]"),
) -> dict:
    if not audio or not audio.filename and audio.size == 0:
        raise HTTPException(status_code=400, detail="No audio file received")

    try:
        history: list[dict] = json.loads(messages)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid messages JSON")

    svc = SarvamService()

    logger.info("STT — processing audio: %s", audio.filename)
    transcript, detected_lang = await svc.speech_to_text(audio)
    lang_name = _LANG_NAMES.get(detected_lang, "English")
    logger.info("STT — transcript: %s (lang: %s)", transcript, detected_lang)

    # Prefix the detected language so the LLM doesn't have to guess
    history.append(
        {
            "role": "user",
            "content": f"[Speaking {lang_name}]: {transcript}",
        }
    )

    logger.info("Chat — sending %d messages", len(history))
    reply_text, translation, tts_lang = await svc.chat(history)
    logger.info("Chat — lang=%s reply=%s", tts_lang, reply_text)

    logger.info("TTS — converting to speech [%s]", tts_lang)
    audio_base64 = await svc.text_to_speech(reply_text, language_code=tts_lang)
    logger.info("TTS — done, %d chars", len(audio_base64))

    return {
        "transcript": transcript,
        "reply_text": reply_text,
        "translation": translation,
        "audio_base64": audio_base64,
    }
