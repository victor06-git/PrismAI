"""
PrismAI backend — FastAPI service.

Turns a raw meeting transcript into three simultaneous outputs:
  1. A Scrum/Jira-style software backlog (OpenAI, Structured Outputs).
  2. Moodboard / visual creative prompts, rendered as images via Fal.ai Flux Schnell.
  3. Cala-style ("Skip the Data") analytics insights.

This module is intentionally a thin routing/orchestration layer: all external
API calls live in services/ (openai_service.py, fal_service.py,
cala_service.py), built on shared client setup + custom exceptions in
services/clients.py.

Run locally with:
    uvicorn main:app --reload --port 8000
"""

import hashlib
import json
import os
import ssl
import time
from collections import defaultdict, deque
from typing import Callable

import httpx
import truststore
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

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

from schemas import (
    DataInsightsRequest,
    DataInsightsResponse,
    GenerateAssetRequest,
    GenerateAssetResponse,
    ProcessMeetingRequest,
    ProcessMeetingResponse,
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
    version="0.2.0",
)

init_db()

_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_api_attempts: dict[str, deque[float]] = defaultdict(deque)


def _check_rate_limit(client_ip: str, bucket: str, limit: int) -> None:
    now = time.monotonic()
    attempts = _api_attempts[f"{bucket}:{client_ip}"]
    while attempts and attempts[0] < now - 60:
        attempts.popleft()
    if len(attempts) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Try again shortly.")
    attempts.append(now)


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


@app.post("/api/realtime/token")
async def create_realtime_token(request: Request) -> Response:
    """Mint a short-lived browser credential without exposing the permanent API key."""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI is not configured on the server.")

    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip, "realtime", 5)
    from services.clients import OPENAI_TRANSCRIBE_MODEL

    session = {
        "type": "transcription",
        "audio": {
            "input": {
                "transcription": {
                    "model": OPENAI_TRANSCRIBE_MODEL,
                    "languages": ["es", "en"],
                    "delay": "low",
                    "prompt": "Product and software hackathon meeting. Preserve names, acronyms and ticket terminology.",
                },
                "turn_detection": None,
            }
        },
    }
    safety_id = hashlib.sha256(f"prismai-demo:{client_ip}".encode()).hexdigest()

    try:
        # Use the native Windows trust store. This supports corporate/local CA
        # chains while keeping TLS certificate verification fully enabled.
        tls_context = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        async with httpx.AsyncClient(timeout=20.0, verify=tls_context) as client:
            upstream = await client.post(
                "https://api.openai.com/v1/realtime/client_secrets",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "OpenAI-Safety-Identifier": safety_id,
                    "Content-Type": "application/json",
                },
                json={"session": session},
            )
    except httpx.RequestError as exc:
        logger.error("Realtime token request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not authorize live transcription.") from exc

    if upstream.status_code >= 400:
        logger.error("Realtime token rejected (%s): %s", upstream.status_code, upstream.text[:500])
        raise HTTPException(status_code=502, detail="OpenAI could not authorize live transcription.")
    return Response(content=upstream.content, media_type="application/json")


@app.post("/api/process-meeting", response_model=ProcessMeetingResponse)
async def process_meeting(request: Request, payload: ProcessMeetingRequest) -> ProcessMeetingResponse:
    """
    Analyze a meeting transcript with OpenAI Structured Outputs (gpt-4o-mini)
    and return the backlog + visual asset prompts + data insights at once.
    """
    if not payload.transcript.strip():
        raise HTTPException(status_code=422, detail="transcript must not be empty.")
    _check_rate_limit(request.client.host if request.client else "unknown", "analysis", 10)

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


@app.post("/api/generate-asset", response_model=GenerateAssetResponse)
async def generate_asset(request: Request, payload: GenerateAssetRequest) -> GenerateAssetResponse:
    """Generate a 16:9 mockup/moodboard image via Fal.ai Flux Schnell."""
    if not payload.prompt.strip():
        raise HTTPException(status_code=422, detail="prompt must not be empty.")
    _check_rate_limit(request.client.host if request.client else "unknown", "fal", 3)

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
async def data_insights(request: Request, payload: DataInsightsRequest):
    _check_rate_limit(request.client.host if request.client else "unknown", "cala", 10)
    try:
        # Consultar Cala
        cala_data = await run_in_threadpool(
            fetch_data_insights,
            payload.transcript
        )

        results = cala_data.get("results", [])[:8]
        entities = cala_data.get("entities", [])[:8]

        # Ensure the meeting exists.
        if not get_meeting(payload.meetingId):
            save_meeting(payload.meetingId, payload.transcript)

        # Save the Cala result in SQLite.
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
