from __future__ import annotations

import logging
import os
import re
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException, UploadFile

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

logger = logging.getLogger(__name__)

SARVAM_BASE_URL = "https://api.sarvam.ai"

# Supported languages and their Sarvam TTS language codes
_TTS_LANG_MAP: dict[str, str] = {
    "en": "en-IN",
    "hi": "hi-IN",
    "gu": "gu-IN",
}

SYSTEM_PROMPT = """\
You are a friendly, knowledgeable voice assistant.
You are conversational, engaging, and genuinely helpful.

SUPPORTED LANGUAGES: English, Hindi, Gujarati only.

RESPONSE FORMAT — always structure your reply exactly like this:
[LANG]: <one of: en, hi, gu>
[REPLY]: <your full response in the SAME language the user used>
[EN]: <English translation of [REPLY] — include ONLY when LANG is "hi" or "gu">

LANGUAGE RULES:
- Each user message is prefixed with [Speaking <Language>]: — this is the
  definitive detected language. ALWAYS reply in that exact language.
- If the prefix says "English", reply in English — never switch to Hindi.
- If the prefix says "Hindi", reply in Hindi.
- If the prefix says "Gujarati", reply in Gujarati.
- If the language is unsupported, reply in English and politely explain.

CONVERSATION RULES:
- Give accurate, thoughtful, and complete answers
- Responses are spoken aloud — write naturally, avoid bullet points and markdown
- Drive the conversation forward: ask a follow-up question when it feels natural
- Be warm and concise — spoken replies should not be too long\
"""


def _parse_chat_response(raw: str) -> tuple[str, str | None, str]:
    """Parse structured LLM output into (reply, translation, tts_lang_code)."""
    lang_match = re.search(r"\[LANG\]:\s*(\w+)", raw)
    reply_match = re.search(r"\[REPLY\]:\s*(.*?)(?=\s*\[EN\]:|$)", raw, re.DOTALL)
    en_match = re.search(r"\[EN\]:\s*(.*?)$", raw, re.DOTALL)

    lang = lang_match.group(1).strip().lower() if lang_match else "en"
    reply = reply_match.group(1).strip() if reply_match else raw.strip()
    translation = en_match.group(1).strip() if en_match else None

    # No translation needed if the reply is already in English
    if lang == "en":
        translation = None

    # Unsupported language → model replies in English, so default to en-IN
    tts_lang = _TTS_LANG_MAP.get(lang, "en-IN")
    return reply, translation, tts_lang


class SarvamService:
    def __init__(self) -> None:
        self.api_key = os.environ.get("SARVAM_API_KEY", "")
        if not self.api_key:
            raise ValueError("SARVAM_API_KEY is not set in backend/.env")
        self.base_url = SARVAM_BASE_URL

    async def speech_to_text(self, audio_file: UploadFile) -> tuple[str, str]:
        """Returns (transcript, detected_language_code e.g. 'en-IN')."""
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
                    data={"model": "saaras:v3"},
                )
                response.raise_for_status()
                data = response.json()
                transcript = data["transcript"]
                lang_code = data.get("language_code", "en-IN")
                return transcript, lang_code
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

    async def chat(self, messages: list[dict]) -> tuple[str, str | None, str]:
        """Returns (reply_text, english_translation_or_None, tts_language_code)."""
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
                    f"{self.base_url}/v1/chat/completions",
                    headers={
                        "API-Subscription-Key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
                raw = response.json()["choices"][0]["message"]["content"]
                logger.debug("Chat raw response: %s", raw)
                return _parse_chat_response(raw)
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

    async def text_to_speech(self, text: str, language_code: str = "hi-IN") -> str:
        payload = {
            "inputs": [text],
            "target_language_code": language_code,
            "speaker": "simran",
            "model": "bulbul:v3",
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
