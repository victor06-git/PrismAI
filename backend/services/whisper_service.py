"""
services/whisper_service.py

Transcribes recorded meeting audio via OpenAI's Whisper API.
"""

import io

from services.clients import MissingAPIKeyError, OPENAI_API_KEY, UpstreamServiceError, openai_client

WHISPER_MODEL = "whisper-1"


def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """
    Transcribe a recorded audio clip to text. Blocking (sync SDK call) — call
    via asyncio.to_thread/run_in_threadpool from the route handler.

    Raises MissingAPIKeyError / UpstreamServiceError on failure; callers
    decide how to respond (HTTPException vs. mock fallback).
    """
    if not OPENAI_API_KEY:
        raise MissingAPIKeyError("OPENAI_API_KEY is not configured.")

    # Whisper's SDK infers the audio format from the file object's `.name` —
    # a bare BytesIO has no filename, so we set one explicitly (keeping the
    # original extension when we have it, e.g. "recording.webm").
    buffer = io.BytesIO(audio_bytes)
    buffer.name = filename or "recording.webm"

    try:
        transcript = openai_client.audio.transcriptions.create(model=WHISPER_MODEL, file=buffer)
    except Exception as exc:
        raise UpstreamServiceError(f"Whisper transcription failed: {exc}") from exc

    return (transcript.text or "").strip()
