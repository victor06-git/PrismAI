"""
services/whisper_service.py

Transcribes recorded meeting audio via OpenAI's Whisper API, with real
segment-level timestamps — no invented/mock speaker or time data.
"""

import io
from dataclasses import dataclass

from services.clients import MissingAPIKeyError, OPENAI_API_KEY, UpstreamServiceError, openai_client

WHISPER_MODEL = "whisper-1"


@dataclass
class TranscriptSegment:
    index: int
    start: float
    end: float
    text: str


@dataclass
class Transcription:
    text: str
    segments: list[TranscriptSegment]


def transcribe_audio(audio_bytes: bytes, filename: str) -> Transcription:
    """
    Transcribe a recorded audio clip, returning both the full text and its
    real per-segment start/end timestamps (Whisper's own segmentation).

    NOTE: whisper-1 does not do speaker diarization — a single mic can't be
    split into "who said what" by this model alone. Every segment is
    genuinely ordered and timestamped, just not attributed to a speaker;
    callers should label them generically (e.g. "You") rather than inventing
    speaker names.

    Blocking (sync SDK call) — call via asyncio.to_thread/run_in_threadpool.
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
        result = openai_client.audio.transcriptions.create(
            model=WHISPER_MODEL,
            file=buffer,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
    except Exception as exc:
        raise UpstreamServiceError(f"Whisper transcription failed: {exc}") from exc

    text = (result.text or "").strip()
    segments = [
        TranscriptSegment(index=i, start=float(seg.start), end=float(seg.end), text=seg.text.strip())
        for i, seg in enumerate(getattr(result, "segments", None) or [])
        if seg.text and seg.text.strip()
    ]
    return Transcription(text=text, segments=segments)
