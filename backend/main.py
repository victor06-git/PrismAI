"""
PrismAI backend — FastAPI service.

Turns a raw meeting transcript into three simultaneous outputs:
  1. An intelligently-prioritized Scrum/Jira-style backlog (OpenAI Structured
     Outputs + a deterministic weighted priority-scoring algorithm — see
     services/orchestrator.py).
  2. Moodboard / visual creative prompts, rendered as images via Fal.ai Flux Schnell.
  3. Cala-style ("Skip the Data") analytics insights.

Also exposes:
  - A QR-based, passwordless auth flow (see auth/) for the desktop companion
    app: register -> create QR session -> mobile scan -> desktop poll -> JWT.
  - Two batch speech-to-workflow pipelines (see audio/router.py): record the
    whole take -> Whisper -> structured extraction -> concurrent Fal.ai
    image generation + Cala enrichment, either streamed as SSE or returned
    as one consolidated payload.
  - A progressive, WebSocket-driven live pipeline (see audio/live_session.py,
    /ws/live): ~4s audio segments transcribed and appended as they arrive,
    with tickets/moodboards/insights streamed in as the conversation grows.

No mocks anywhere. Every endpoint calls the real OpenAI/Fal.ai/Cala/Whisper
APIs; a failure raises a real HTTPException (500 = misconfigured on our end,
502 = the upstream call itself failed) instead of silently substituting
canned data.

This module is intentionally a thin routing layer: all external API calls
and the priority algorithm live in services/ (openai_service.py,
fal_service.py, cala_service.py, whisper_service.py, orchestrator.py), built
on shared client setup + custom exceptions in services/clients.py. Auth and
audio each have their own self-contained package (auth/, audio/).

Security notes:
  - CORS origins come from ALLOWED_ORIGINS (comma-separated) if set, else
    default to the local Next.js dev origins only — never "*".
  - Every OpenAI/Fal.ai/Cala-calling route is rate-limited (slowapi, see
    rate_limit.py) on top of the global per-IP default; /ws/live has its own
    payload-size + per-chunk-interval + max-concurrent-session guards
    (slowapi is HTTP-request-based and doesn't cover WebSockets).
  - OPENAI_API_KEY / FAL_KEY / CALA_API_KEY are read only in
    services/clients.py and never leave the backend process — the frontend
    only ever holds NEXT_PUBLIC_API_BASE_URL (a non-secret base URL).

Run locally with:
    uvicorn main:app --reload --port 8000
"""

import json
import os
from typing import NoReturn

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.concurrency import run_in_threadpool

from audio.live_session import websocket_live_session
from audio.router import router as audio_router
from auth.router import router as auth_router
from database import get_meeting, init_db, save_asset, save_context, save_meeting
from rate_limit import limiter
from schemas import (
    DataInsightsRequest,
    DataInsightsResponse,
    GenerateAssetRequest,
    GenerateAssetResponse,
    ProcessMeetingRequest,
    ProcessMeetingResponse,
    ProcessTextRequest,
)
from services.cala_service import fetch_data_insights
from services.clients import (
    CALA_API_KEY,
    FAL_KEY,
    OPENAI_API_KEY,
    MissingAPIKeyError,
    UpstreamServiceError,
    logger,
)
from services.fal_service import generate_visual_asset
from services.orchestrator import run_full_orchestration

app = FastAPI(
    title="PrismAI API",
    description="Real-time meeting copilot: intelligently-prioritized backlog, moodboards & data insights.",
    version="0.6.0",
)

init_db()

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS — allow the Next.js frontend to call this API. Override with a
# comma-separated ALLOWED_ORIGINS env var in non-local environments; never
# falls back to "*" (that would defeat allow_credentials=True anyway).
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
ALLOWED_ORIGINS = (
    [origin.strip() for origin in _allowed_origins_env.split(",") if origin.strip()]
    if _allowed_origins_env
    else ["http://localhost:3000", "http://127.0.0.1:3000"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(audio_router)


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket) -> None:
    """Progressive live pipeline — see audio/live_session.py for the full protocol."""
    await websocket_live_session(websocket)


def _raise_for(route: str, exc: Exception, upstream_status: int = 502) -> NoReturn:
    """Every endpoint's uniform failure path: log clearly, then raise a real
    HTTPException — 500 if it's our own misconfiguration (missing key), the
    given upstream_status (default 502) if the third-party call itself failed."""
    logger.error("%s: %s failed: %s", route, type(exc).__name__, exc)
    status_code = 500 if isinstance(exc, MissingAPIKeyError) else upstream_status
    raise HTTPException(status_code=status_code, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health_check() -> dict:
    """Basic liveness/config check for the service."""
    return {
        "status": "ok",
        "openaiConfigured": bool(OPENAI_API_KEY),
        "falConfigured": bool(FAL_KEY),
        "calaConfigured": bool(CALA_API_KEY),
    }


@app.post("/api/process-meeting", response_model=ProcessMeetingResponse)
@limiter.limit("15/minute")
async def process_meeting(request: Request, payload: ProcessMeetingRequest) -> ProcessMeetingResponse:
    """
    Full pipeline on a pasted transcript: OpenAI Structured Outputs + priority
    scoring, then real Fal.ai images and Cala enrichment concurrently.
    """
    if not payload.transcript.strip():
        raise HTTPException(status_code=422, detail="transcript must not be empty.")

    try:
        return await run_full_orchestration(payload.transcript)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        _raise_for("process-meeting", exc)


@app.post("/api/process-text", response_model=ProcessMeetingResponse)
@limiter.limit("15/minute")
async def process_text(request: Request, payload: ProcessTextRequest) -> ProcessMeetingResponse:
    """
    Quick-testing endpoint: identical full pipeline to /api/process-meeting,
    accepting raw text directly — handy for exercising OpenAI -> Fal.ai/Cala
    without a microphone.
    """
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty.")

    try:
        result = await run_full_orchestration(payload.text)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        _raise_for("process-text", exc)

    if payload.meetingId and not get_meeting(payload.meetingId):
        save_meeting(payload.meetingId, payload.text)

    return result


@app.post("/api/generate-asset", response_model=GenerateAssetResponse)
@limiter.limit("15/minute")
async def generate_asset(request: Request, payload: GenerateAssetRequest) -> GenerateAssetResponse:
    """Generate (or regenerate) a single 16:9 mockup/moodboard image via Fal.ai Flux Schnell."""
    if not payload.prompt.strip():
        raise HTTPException(status_code=422, detail="prompt must not be empty.")

    try:
        image_url = await run_in_threadpool(generate_visual_asset, payload.prompt)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        _raise_for("generate-asset", exc)

    if not get_meeting(payload.meetingId):
        save_meeting(payload.meetingId, "")
    save_asset(meeting_id=payload.meetingId, prompt=payload.prompt, image_url=image_url)

    return GenerateAssetResponse(imageUrl=image_url)


@app.post("/api/data-insights", response_model=DataInsightsResponse)
@limiter.limit("15/minute")
async def data_insights(request: Request, payload: DataInsightsRequest) -> DataInsightsResponse:
    """Raw Cala knowledge-query passthrough (see services/cala_service.py) — persists results per meeting."""
    try:
        cala_data = await run_in_threadpool(fetch_data_insights, payload.transcript)
    except (MissingAPIKeyError, UpstreamServiceError) as exc:
        _raise_for("data-insights", exc)

    results = cala_data.get("results", [])[:8]
    entities = cala_data.get("entities", [])[:8]

    if not get_meeting(payload.meetingId):
        save_meeting(payload.meetingId, payload.transcript)

    save_context(meeting_id=payload.meetingId, context_type="cala_results", value=json.dumps(results))
    save_context(meeting_id=payload.meetingId, context_type="cala_entities", value=json.dumps(entities))

    return DataInsightsResponse(results=results, entities=entities)
