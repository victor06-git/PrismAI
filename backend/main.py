"""
PrismAI backend — FastAPI service.

Turns a raw meeting transcript into three simultaneous outputs:
  1. A Scrum/Jira-style software backlog (OpenAI, Structured Outputs).
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

This module is intentionally a thin routing/orchestration layer: all external
API calls live in services/ (openai_service.py, fal_service.py,
cala_service.py, whisper_service.py), built on shared client setup + custom
exceptions in services/clients.py. Auth and audio each have their own
self-contained package (auth/, audio/).

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
from typing import Callable

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.concurrency import run_in_threadpool

from audio.live_session import websocket_live_session
from audio.router import router as audio_router
from auth.router import router as auth_router
from mock_data import (
    MOCK_DATA_INSIGHTS_RESPONSE,
    MOCK_GENERATE_ASSET_RESPONSE,
    MOCK_PROCESS_MEETING_RESPONSE,
)
from database import (
    init_db,
    save_asset,
    save_meeting,
    get_meeting,
    save_context,
)
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
    ENABLE_MOCK_FALLBACK,
    FAL_KEY,
    OPENAI_API_KEY,
    MissingAPIKeyError,
    UpstreamServiceError,
    logger,
)
from services.fal_service import generate_visual_asset
from services.openai_service import generate_meeting_outputs

app = FastAPI(
    title="PrismAI API",
    description="Real-time meeting copilot: backlog, moodboards & data insights.",
    version="0.5.0",
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


# ---------------------------------------------------------------------------
# Shared error-handling helper
# ---------------------------------------------------------------------------


def _resolve_with_fallback(
    route: str, exc: Exception, status_code: int, build_fallback: Callable[[], object]
) -> object:
    """
    Single failure path shared by every external-API route:
      - always logs the real error (clear, upstream-attributable message),
      - returns mock data (HTTP 200) when ENABLE_MOCK_FALLBACK is on, so a
        live demo never shows a broken screen,
      - otherwise — or if the fallback itself is broken — raises a proper
        HTTPException(status_code) so the failure is visible to the caller.
    """
    logger.error("%s: %s failed: %s", route, type(exc).__name__, exc)

    if not ENABLE_MOCK_FALLBACK:
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    try:
        logger.warning("%s: falling back to mock data.", route)
        return build_fallback()
    except Exception as fallback_exc:
        logger.error("%s: fallback data itself is invalid: %s", route, fallback_exc)
        raise HTTPException(
            status_code=500,
            detail=f"{route} failed and fallback data is unavailable: {fallback_exc}",
        ) from fallback_exc


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
        "mockFallbackEnabled": ENABLE_MOCK_FALLBACK,
    }


@app.post("/api/process-meeting", response_model=ProcessMeetingResponse)
@limiter.limit("15/minute")
async def process_meeting(request: Request, payload: ProcessMeetingRequest) -> ProcessMeetingResponse:
    """
    Analyze a meeting transcript with OpenAI Structured Outputs (gpt-4o-mini)
    and return the backlog + visual asset prompts + data insights at once.
    """
    if not payload.transcript.strip():
        raise HTTPException(status_code=422, detail="transcript must not be empty.")

    def fallback() -> ProcessMeetingResponse:
        return ProcessMeetingResponse(**MOCK_PROCESS_MEETING_RESPONSE)

    try:
        return await run_in_threadpool(generate_meeting_outputs, payload.transcript)
    except MissingAPIKeyError as exc:
        return _resolve_with_fallback("process-meeting", exc, 500, fallback)
    except UpstreamServiceError as exc:
        return _resolve_with_fallback("process-meeting", exc, 502, fallback)
    except Exception as exc:  # unexpected / programmer error — still never crash the demo
        return _resolve_with_fallback("process-meeting", exc, 500, fallback)


@app.post("/api/process-text", response_model=ProcessMeetingResponse)
@limiter.limit("15/minute")
async def process_text(request: Request, payload: ProcessTextRequest) -> ProcessMeetingResponse:
    """
    Fallback / quick-testing endpoint: identical extraction to
    /api/process-meeting, accepting raw text directly — handy for exercising
    the OpenAI -> Fal.ai/Cala pipeline downstream without a microphone.
    """
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="text must not be empty.")

    def fallback() -> ProcessMeetingResponse:
        return ProcessMeetingResponse(**MOCK_PROCESS_MEETING_RESPONSE)

    try:
        result = await run_in_threadpool(generate_meeting_outputs, payload.text)
    except MissingAPIKeyError as exc:
        return _resolve_with_fallback("process-text", exc, 500, fallback)
    except UpstreamServiceError as exc:
        return _resolve_with_fallback("process-text", exc, 502, fallback)
    except Exception as exc:
        return _resolve_with_fallback("process-text", exc, 500, fallback)

    if payload.meetingId and not get_meeting(payload.meetingId):
        save_meeting(payload.meetingId, payload.text)

    return result


@app.post("/api/generate-asset", response_model=GenerateAssetResponse)
@limiter.limit("15/minute")
async def generate_asset(request: Request, payload: GenerateAssetRequest) -> GenerateAssetResponse:
    """Generate a 16:9 mockup/moodboard image via Fal.ai Flux Schnell."""
    if not payload.prompt.strip():
        raise HTTPException(status_code=422, detail="prompt must not be empty.")

    def fallback() -> GenerateAssetResponse:
        return GenerateAssetResponse(**MOCK_GENERATE_ASSET_RESPONSE)

    try:
        image_url = await run_in_threadpool(
            generate_visual_asset,
            payload.prompt
        )

        if not get_meeting(payload.meetingId):
            save_meeting(payload.meetingId, "")

        save_asset(
            meeting_id=payload.meetingId,
            prompt=payload.prompt,
            image_url=image_url
        )

        return GenerateAssetResponse(imageUrl=image_url)
    
    except MissingAPIKeyError as exc:
        return _resolve_with_fallback("generate-asset", exc, 500, fallback)
    except UpstreamServiceError as exc:
        return _resolve_with_fallback("generate-asset", exc, 502, fallback)
    except Exception as exc:
        return _resolve_with_fallback("generate-asset", exc, 500, fallback)


@app.post("/api/data-insights", response_model=DataInsightsResponse)
@limiter.limit("15/minute")
async def data_insights(request: Request, payload: DataInsightsRequest):
    try:
        # Consultar Cala
        cala_data = await run_in_threadpool(
            fetch_data_insights,
            payload.transcript
        )

        results = cala_data.get("results", [])[:8]
        entities = cala_data.get("entities", [])[:8]

        # Asegurar que existe la reunión
        if not get_meeting(payload.meetingId):
            save_meeting(payload.meetingId, payload.transcript)

        # Guardar resultado de Cala en SQLite
        save_context(
            meeting_id=payload.meetingId,
            context_type="cala_results",
            value=json.dumps(results)
        )

        save_context(
            meeting_id=payload.meetingId,
            context_type="cala_entities",
            value=json.dumps(entities)
        )

        return DataInsightsResponse(
            results=results,
            entities=entities
        )

    except MissingAPIKeyError:
        raise HTTPException(
            status_code=500,
            detail="Cala API is not configured."
        )

    except UpstreamServiceError:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve Cala insights."
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to process data insights."
        )