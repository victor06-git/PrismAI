"""
audio/router.py

Two ways to run the same speech-to-workflow pipeline:

  POST /transcribe-and-orchestrate  — streams every stage back as SSE (see
                                       _run_pipeline). Good for a UI that
                                       wants to populate incrementally.
  POST /transcribe-and-process      — awaits the whole pipeline and returns
                                       one consolidated JSON payload. Good
                                       for a plain fetch()-and-await client.

Both share the same underlying steps:
  1. Whisper transcribes the uploaded recording (with real per-segment
     timestamps — see services/whisper_service.py).
  2. GPT-4o-mini (Structured Outputs) extracts the backlog / visual prompts /
     data-insight questions from that transcript in one shot (reuses
     services/openai_service.py — same contract as the text-transcript flow).
  3. Fal.ai (one call per visual prompt) and Cala (one enrichment call) run
     CONCURRENTLY.
  4. Every third-party failure degrades gracefully (per-image, per-insight,
     or — if transcription/extraction itself fails — the whole static
     mock_data.py fallback), matching the rest of the app's ENABLE_MOCK_FALLBACK
     convention.

SSE event types emitted by /transcribe-and-orchestrate, in order:
  status              {"stage": "..."}                              — narration for the UI's loading state
  transcript          {"transcript": "...", "segments": [...]}       — once Whisper finishes
  extracted           {summary, tickets, visualAssets, dataInsights}  — once GPT structured output finishes (images still null)
  visual_asset_ready  {"index": i, "imageUrl": "..."}                 — one per successful Fal.ai generation, as it completes
  visual_asset_failed {"index": i, "message": "..."}                   — one per failed Fal.ai generation (that card just keeps its prompt, no image)
  insights_enriched   {"dataInsights": [...]}                          — once the Cala call resolves (real data, or the LLM's own guess kept as a fallback)
  done                <full ProcessMeetingResponse, images included>    — final consolidated snapshot
  error               {"stage": "...", "message": "..."}               — unrecoverable failure (only when ENABLE_MOCK_FALLBACK is off)
"""

import asyncio
import json
from typing import AsyncIterator
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from database import save_asset, save_context, save_meeting
from mock_data import MOCK_PROCESS_MEETING_RESPONSE
from schemas import AudioProcessResponse, ProcessMeetingResponse, VisualAssetPrompt
from schemas import TranscriptSegment as TranscriptSegmentSchema
from services.cala_service import fetch_data_insights_typed
from services.clients import ENABLE_MOCK_FALLBACK, MissingAPIKeyError, UpstreamServiceError, logger
from services.fal_service import generate_visual_asset
from services.openai_service import generate_meeting_outputs
from services.whisper_service import Transcription, TranscriptSegment, transcribe_audio

router = APIRouter(prefix="/api/audio", tags=["audio"])

MAX_AUDIO_BYTES = 25 * 1024 * 1024  # Whisper's own hard limit.


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _dump_response(response: ProcessMeetingResponse) -> dict:
    return {
        "summary": response.summary,
        "tickets": [t.model_dump() for t in response.tickets],
        "visualAssets": [v.model_dump() for v in response.visualAssets],
        "dataInsights": [d.model_dump() for d in response.dataInsights],
    }


def _dump_segments(segments: list[TranscriptSegment]) -> list[dict]:
    return [{"index": s.index, "start": s.start, "end": s.end, "text": s.text} for s in segments]


def _read_and_validate_upload_sync(raw: bytes) -> None:
    if not raw:
        raise HTTPException(status_code=422, detail="Uploaded audio file is empty.")
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413, detail=f"Audio file exceeds the {MAX_AUDIO_BYTES // (1024 * 1024)}MB limit."
        )


@router.post("/transcribe-and-orchestrate")
async def transcribe_and_orchestrate(audio: UploadFile = File(...)) -> StreamingResponse:
    """
    Accepts a recorded audio clip (webm/mp3/wav/m4a/...) and streams the full
    transcribe -> extract -> generate pipeline back as Server-Sent Events.

    Validates the upload eagerly (before opening the stream) so a genuinely
    bad request still gets a normal 4xx JSON response instead of a "200 OK"
    stream that immediately errors out.
    """
    raw = await audio.read()
    _read_and_validate_upload_sync(raw)
    filename = audio.filename or "recording.webm"

    return StreamingResponse(
        _run_pipeline(raw, filename),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


async def _fallback_stream(reason: str) -> AsyncIterator[str]:
    """Demo-safety net: same static mock_data.py used by the text-transcript flow."""
    logger.warning("audio-orchestrate: falling back to mock data (%s)", reason)
    yield _sse("status", {"stage": "using_fallback_data", "reason": reason})
    mock = ProcessMeetingResponse(**MOCK_PROCESS_MEETING_RESPONSE)
    yield _sse("extracted", _dump_response(mock))
    yield _sse("done", _dump_response(mock))


async def _run_pipeline(audio_bytes: bytes, filename: str) -> AsyncIterator[str]:
    # --- 1. Transcribe -----------------------------------------------------
    yield _sse("status", {"stage": "transcribing"})
    try:
        transcription = await asyncio.to_thread(transcribe_audio, audio_bytes, filename)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        logger.error("audio-orchestrate: transcription failed: %s", exc)
        if ENABLE_MOCK_FALLBACK:
            async for chunk in _fallback_stream(f"transcription failed: {exc}"):
                yield chunk
        else:
            yield _sse("error", {"stage": "transcribe", "message": str(exc)})
        return
    except Exception as exc:  # unexpected / programmer error — still never crash the demo
        logger.error("audio-orchestrate: unexpected transcription error: %s", exc)
        if ENABLE_MOCK_FALLBACK:
            async for chunk in _fallback_stream(f"unexpected transcription error: {exc}"):
                yield chunk
        else:
            yield _sse("error", {"stage": "transcribe", "message": str(exc)})
        return

    transcript = transcription.text
    if not transcript:
        yield _sse("error", {"stage": "transcribe", "message": "No speech detected in the recording."})
        return

    yield _sse("transcript", {"transcript": transcript, "segments": _dump_segments(transcription.segments)})

    # --- 2. Structured extraction (backlog + visual prompts + insight Qs) --
    yield _sse("status", {"stage": "analyzing"})
    try:
        extracted = await asyncio.to_thread(generate_meeting_outputs, transcript)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        logger.error("audio-orchestrate: extraction failed: %s", exc)
        if ENABLE_MOCK_FALLBACK:
            async for chunk in _fallback_stream(f"extraction failed: {exc}"):
                yield chunk
        else:
            yield _sse("error", {"stage": "analyze", "message": str(exc)})
        return
    except Exception as exc:
        logger.error("audio-orchestrate: unexpected extraction error: %s", exc)
        if ENABLE_MOCK_FALLBACK:
            async for chunk in _fallback_stream(f"unexpected extraction error: {exc}"):
                yield chunk
        else:
            yield _sse("error", {"stage": "analyze", "message": str(exc)})
        return

    yield _sse("extracted", _dump_response(extracted))

    # --- 3. Concurrently: one Fal.ai call per visual prompt + one Cala call.
    yield _sse("status", {"stage": "generating_visuals_and_insights"})

    visual_assets = list(extracted.visualAssets)  # working copy we fill in as images arrive
    data_insights = list(extracted.dataInsights)  # replaced wholesale if Cala succeeds

    async def _image_job(index: int, prompt: str) -> tuple[str, int, str | None, str | None]:
        try:
            url = await asyncio.to_thread(generate_visual_asset, prompt)
            return ("image", index, url, None)
        except Exception as exc:  # a single failed image must not sink the whole request
            return ("image", index, None, str(exc))

    async def _insights_job() -> tuple[str, None, list | None, str | None]:
        try:
            fresh = await asyncio.to_thread(fetch_data_insights_typed, transcript)
            return ("insights", None, fresh, None)
        except Exception as exc:
            return ("insights", None, None, str(exc))

    jobs = [asyncio.create_task(_image_job(i, asset.falPrompt)) for i, asset in enumerate(visual_assets)]
    jobs.append(asyncio.create_task(_insights_job()))

    for finished in asyncio.as_completed(jobs):
        kind, index, payload, error = await finished

        if kind == "image":
            if payload:
                visual_assets[index] = visual_assets[index].model_copy(update={"imageUrl": payload})
                yield _sse("visual_asset_ready", {"index": index, "imageUrl": payload})
            else:
                logger.warning("audio-orchestrate: image %s generation failed: %s", index, error)
                yield _sse("visual_asset_failed", {"index": index, "message": error})
        else:  # kind == "insights"
            if payload:
                data_insights = payload
                logger.info("audio-orchestrate: insights enriched via Cala.")
            else:
                logger.warning("audio-orchestrate: Cala enrichment failed, keeping LLM-derived insights: %s", error)
            yield _sse("insights_enriched", {"dataInsights": [d.model_dump() for d in data_insights]})

    # --- 4. Final consolidated snapshot, matching ProcessMeetingResponse ---
    final = ProcessMeetingResponse(
        summary=extracted.summary,
        tickets=extracted.tickets,
        visualAssets=visual_assets,
        dataInsights=data_insights,
    )
    yield _sse("done", _dump_response(final))


# ---------------------------------------------------------------------------
# POST /transcribe-and-process — single-shot (non-streaming) counterpart
# ---------------------------------------------------------------------------


def _mock_process_response(meeting_id: str, transcript: str, segments: list[TranscriptSegment]) -> AudioProcessResponse:
    logger.warning("audio-process: falling back to mock data for meeting %s.", meeting_id)
    mock = ProcessMeetingResponse(**MOCK_PROCESS_MEETING_RESPONSE)
    return AudioProcessResponse(
        meetingId=meeting_id,
        transcript=transcript or mock.summary,
        segments=[TranscriptSegmentSchema(**vars(s)) for s in segments],
        summary=mock.summary,
        tickets=mock.tickets,
        visualAssets=mock.visualAssets,
        dataInsights=mock.dataInsights,
    )


async def _generate_all_images(visual_assets: list[VisualAssetPrompt]) -> list[VisualAssetPrompt]:
    """One Fal.ai call per prompt, run concurrently. A single failure just leaves that
    asset without an image (still usable — the UI can offer a manual retry)."""

    async def _one(asset: VisualAssetPrompt) -> VisualAssetPrompt:
        try:
            url = await asyncio.to_thread(generate_visual_asset, asset.falPrompt)
            return asset.model_copy(update={"imageUrl": url})
        except Exception as exc:
            logger.warning("audio-process: image generation failed for %r: %s", asset.assetName, exc)
            return asset

    return list(await asyncio.gather(*(_one(asset) for asset in visual_assets)))


async def _enrich_insights(transcript: str, fallback_insights: list) -> list:
    """One Cala call. Falls back to the LLM's own guessed insights if it fails."""
    try:
        return await asyncio.to_thread(fetch_data_insights_typed, transcript)
    except Exception as exc:
        logger.warning("audio-process: Cala enrichment failed, keeping LLM-derived insights: %s", exc)
        return fallback_insights


@router.post("/transcribe-and-process", response_model=AudioProcessResponse)
async def transcribe_and_process(
    audio: UploadFile = File(...),
    meetingId: str | None = Form(None),
) -> AudioProcessResponse:
    """
    Single-shot counterpart to /transcribe-and-orchestrate: the same pipeline
    (Whisper -> structured extraction -> concurrent Fal.ai + Cala, via
    asyncio.gather), but awaited end-to-end and returned as one consolidated
    JSON payload — no SSE parsing required on the client.
    """
    raw = await audio.read()
    _read_and_validate_upload_sync(raw)
    filename = audio.filename or "recording.webm"
    meeting_id = meetingId or str(uuid4())

    # --- 1. Transcribe ---------------------------------------------------
    try:
        transcription: Transcription = await asyncio.to_thread(transcribe_audio, raw, filename)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        logger.error("audio-process: transcription failed: %s", exc)
        if not ENABLE_MOCK_FALLBACK:
            status = 500 if isinstance(exc, MissingAPIKeyError) else 502
            raise HTTPException(status_code=status, detail=str(exc)) from exc
        return _mock_process_response(meeting_id, "", [])
    except Exception as exc:
        logger.error("audio-process: unexpected transcription error: %s", exc)
        if not ENABLE_MOCK_FALLBACK:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return _mock_process_response(meeting_id, "", [])

    if not transcription.text:
        raise HTTPException(status_code=422, detail="No speech detected in the recording.")

    save_meeting(meeting_id, transcription.text)

    # --- 2. Structured extraction ----------------------------------------
    try:
        extracted = await asyncio.to_thread(generate_meeting_outputs, transcription.text)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        logger.error("audio-process: extraction failed: %s", exc)
        if not ENABLE_MOCK_FALLBACK:
            status = 500 if isinstance(exc, MissingAPIKeyError) else 502
            raise HTTPException(status_code=status, detail=str(exc)) from exc
        return _mock_process_response(meeting_id, transcription.text, transcription.segments)
    except Exception as exc:
        logger.error("audio-process: unexpected extraction error: %s", exc)
        if not ENABLE_MOCK_FALLBACK:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return _mock_process_response(meeting_id, transcription.text, transcription.segments)

    # --- 3. Concurrently: Fal.ai (one call per prompt) + Cala enrichment ---
    visual_assets, data_insights = await asyncio.gather(
        _generate_all_images(extracted.visualAssets),
        _enrich_insights(transcription.text, extracted.dataInsights),
    )

    for asset in visual_assets:
        if asset.imageUrl:
            save_asset(meeting_id=meeting_id, prompt=asset.falPrompt, image_url=asset.imageUrl)
    save_context(
        meeting_id=meeting_id,
        context_type="cala_insights",
        value=json.dumps([d.model_dump() for d in data_insights]),
    )

    return AudioProcessResponse(
        meetingId=meeting_id,
        transcript=transcription.text,
        segments=[TranscriptSegmentSchema(**vars(s)) for s in transcription.segments],
        summary=extracted.summary,
        tickets=extracted.tickets,
        visualAssets=visual_assets,
        dataInsights=data_insights,
    )
