"""
audio/router.py

Two ways to run the same speech-to-workflow pipeline:

  POST /transcribe-and-orchestrate  — streams every stage back as SSE (see
                                       _run_pipeline). Good for a UI that
                                       wants to populate incrementally.
  POST /transcribe-and-process      — awaits the whole pipeline and returns
                                       one consolidated JSON payload. Good
                                       for a plain fetch()-and-await client.

Both share the same underlying steps (services/orchestrator.py):
  1. Whisper transcribes the uploaded recording (with real per-segment
     timestamps — see services/whisper_service.py).
  2. GPT-4o-mini (Structured Outputs) extracts the backlog / visual prompts /
     data-insight questions from that transcript, then every ticket is
     scored and sorted by the weighted priority algorithm.
  3. Fal.ai (one call per visual prompt) and Cala (one enrichment call) run
     CONCURRENTLY.

No mocks: a transcription or extraction failure raises a real HTTPException
(500 = missing key, 502 = upstream failure). A single failed image or a Cala
call with nothing useful to add degrades gracefully on its own (keeps the
prompt with no image / keeps the LLM's own guessed insights) without
touching any canned data — there isn't any.

SSE event types emitted by /transcribe-and-orchestrate, in order:
  status              {"stage": "..."}                              — narration for the UI's loading state
  transcript          {"transcript": "...", "segments": [...]}       — once Whisper finishes
  extracted           {summary, tickets, visualAssets, dataInsights}  — once GPT structured output + scoring finishes (images still null)
  visual_asset_ready  {"index": i, "imageUrl": "..."}                 — one per successful Fal.ai generation, as it completes
  visual_asset_failed {"index": i, "message": "..."}                   — one per failed Fal.ai generation (that card just keeps its prompt, no image)
  insights_enriched   {"dataInsights": [...]}                          — once the Cala call resolves (real data, or the LLM's own guess kept as a fallback)
  done                <full ProcessMeetingResponse, images included>    — final consolidated snapshot
  error               {"stage": "...", "message": "..."}               — unrecoverable failure (transcription/extraction only)
"""

import asyncio
import json
from typing import AsyncIterator
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from database import save_asset, save_context, save_meeting
from rate_limit import limiter
from schemas import AudioProcessResponse, ProcessMeetingResponse
from schemas import TranscriptSegment as TranscriptSegmentSchema
from services.cala_service import fetch_data_insights_typed
from services.clients import MissingAPIKeyError, UpstreamServiceError, logger
from services.fal_service import generate_visual_asset
from services.orchestrator import enrich_with_cala, extract_and_score, generate_all_moodboard_images
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
@limiter.limit("10/minute")
async def transcribe_and_orchestrate(request: Request, audio: UploadFile = File(...)) -> StreamingResponse:
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


async def _run_pipeline(audio_bytes: bytes, filename: str) -> AsyncIterator[str]:
    # --- 1. Transcribe -----------------------------------------------------
    yield _sse("status", {"stage": "transcribing"})
    try:
        transcription = await asyncio.to_thread(transcribe_audio, audio_bytes, filename)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        logger.error("audio-orchestrate: transcription failed: %s", exc)
        yield _sse("error", {"stage": "transcribe", "message": str(exc)})
        return
    except Exception as exc:  # unexpected / programmer error
        logger.error("audio-orchestrate: unexpected transcription error: %s", exc)
        yield _sse("error", {"stage": "transcribe", "message": str(exc)})
        return

    transcript = transcription.text
    if not transcript:
        yield _sse("error", {"stage": "transcribe", "message": "No speech detected in the recording."})
        return

    yield _sse("transcript", {"transcript": transcript, "segments": _dump_segments(transcription.segments)})

    # --- 2. Structured extraction + priority scoring -----------------------
    yield _sse("status", {"stage": "analyzing"})
    try:
        extracted = await asyncio.to_thread(extract_and_score, transcript)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        logger.error("audio-orchestrate: extraction failed: %s", exc)
        yield _sse("error", {"stage": "analyze", "message": str(exc)})
        return
    except Exception as exc:
        logger.error("audio-orchestrate: unexpected extraction error: %s", exc)
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
                # Merge, don't replace — Cala's real entity facts (source="cala")
                # sit alongside the LLM's own narrated estimates (source="ai")
                # on the "Data as Art" canvas, instead of one discarding the other.
                data_insights = [*data_insights, *payload]
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


@router.post("/transcribe-and-process", response_model=AudioProcessResponse)
@limiter.limit("10/minute")
async def transcribe_and_process(
    request: Request,
    audio: UploadFile = File(...),
    meetingId: str | None = Form(None),
) -> AudioProcessResponse:
    """
    Single-shot counterpart to /transcribe-and-orchestrate: the same pipeline
    (Whisper -> structured extraction + scoring -> concurrent Fal.ai + Cala,
    via asyncio.gather), but awaited end-to-end and returned as one
    consolidated JSON payload — no SSE parsing required on the client.
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
        status = 500 if isinstance(exc, MissingAPIKeyError) else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc

    if not transcription.text:
        raise HTTPException(status_code=422, detail="No speech detected in the recording.")

    save_meeting(meeting_id, transcription.text)

    # --- 2. Structured extraction + scoring, then Fal.ai + Cala concurrently
    try:
        extracted = await asyncio.to_thread(extract_and_score, transcription.text)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        logger.error("audio-process: extraction failed: %s", exc)
        status = 500 if isinstance(exc, MissingAPIKeyError) else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc

    visual_assets, data_insights = await asyncio.gather(
        generate_all_moodboard_images(extracted.visualAssets),
        enrich_with_cala(transcription.text, extracted.dataInsights),
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
