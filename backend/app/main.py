from __future__ import annotations

import json
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

from backend.app.services.sarvam import SarvamService  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hindi Voice Assistant API", version="1.0.0")

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
    transcript = await svc.speech_to_text(audio)
    logger.info("STT — transcript: %s", transcript)

    history.append({"role": "user", "content": transcript})

    logger.info("Chat — sending %d messages", len(history))
    reply_text = await svc.chat(history)
    logger.info("Chat — reply: %s", reply_text)

    logger.info("TTS — converting reply to speech")
    audio_base64 = await svc.text_to_speech(reply_text)
    logger.info("TTS — done, audio length: %d chars", len(audio_base64))

    return {
        "transcript": transcript,
        "reply_text": reply_text,
        "audio_base64": audio_base64,
    }
