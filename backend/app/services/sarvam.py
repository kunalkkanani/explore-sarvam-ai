from __future__ import annotations

import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

logger = logging.getLogger(__name__)

SARVAM_BASE_URL = "https://api.sarvam.ai"

SYSTEM_PROMPT = (
    "आप एक सहायक हिंदी वॉयस असिस्टेंट हैं। "
    "हमेशा हिंदी में जवाब दें। "
    "अपने जवाब संक्षिप्त और स्पष्ट रखें।"
)


class SarvamService:
    def __init__(self) -> None:
        self.api_key = os.environ.get("SARVAM_API_KEY", "")
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY is not set in backend/.env")
        self.base_url = SARVAM_BASE_URL

    async def speech_to_text(self, audio_file: UploadFile) -> str:
        audio_bytes = await audio_file.read()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/speech-to-text",
                    headers={"API-Subscription-Key": self.api_key},
                    files={
                        "file": (
                            audio_file.filename or "audio.webm",
                            audio_bytes,
                            audio_file.content_type or "audio/webm",
                        )
                    },
                    data={"model": "saarika:v2", "language_code": "hi-IN"},
                )
                response.raise_for_status()
                return response.json()["transcript"]
        except httpx.HTTPStatusError as e:
            logger.error("STT API error: %s", e.response.text)
            raise HTTPException(
                status_code=500,
                detail=f"Speech-to-text failed: {e.response.text}",
            )
        except httpx.RequestError as e:
            logger.error("STT network error: %s", e)
            raise HTTPException(
                status_code=503,
                detail="Speech-to-text service unreachable",
            )

    async def chat(self, messages: list[dict]) -> str:
        payload = {
            "model": "sarvam-m",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                *messages,
            ],
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "API-Subscription-Key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
        except httpx.HTTPStatusError as e:
            logger.error("Chat API error: %s", e.response.text)
            raise HTTPException(
                status_code=500,
                detail=f"Chat API failed: {e.response.text}",
            )
        except httpx.RequestError as e:
            logger.error("Chat network error: %s", e)
            raise HTTPException(
                status_code=503,
                detail="Chat service unreachable",
            )

    async def text_to_speech(self, text: str) -> str:
        payload = {
            "inputs": [text],
            "target_language_code": "hi-IN",
            "speaker": "meera",
            "model": "bulbul:v2",
            "enable_preprocessing": True,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/text-to-speech",
                    headers={
                        "API-Subscription-Key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                return response.json()["audios"][0]
        except httpx.HTTPStatusError as e:
            logger.error("TTS API error: %s", e.response.text)
            raise HTTPException(
                status_code=500,
                detail=f"Text-to-speech failed: {e.response.text}",
            )
        except httpx.RequestError as e:
            logger.error("TTS network error: %s", e)
            raise HTTPException(
                status_code=503,
                detail="Text-to-speech service unreachable",
            )
