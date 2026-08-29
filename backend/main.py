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

from typing import Callable

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from mock_data import (
    MOCK_DATA_INSIGHTS_RESPONSE,
    MOCK_GENERATE_ASSET_RESPONSE,
    MOCK_PROCESS_MEETING_RESPONSE,
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

# CORS — allow the Next.js frontend running on localhost to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
async def process_meeting(payload: ProcessMeetingRequest) -> ProcessMeetingResponse:
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


@app.post("/api/generate-asset", response_model=GenerateAssetResponse)
async def generate_asset(payload: GenerateAssetRequest) -> GenerateAssetResponse:
    """Generate a 16:9 mockup/moodboard image via Fal.ai Flux Schnell."""
    if not payload.prompt.strip():
        raise HTTPException(status_code=422, detail="prompt must not be empty.")

    def fallback() -> GenerateAssetResponse:
        return GenerateAssetResponse(**MOCK_GENERATE_ASSET_RESPONSE)

    try:
        image_url = await run_in_threadpool(generate_visual_asset, payload.prompt)
        return GenerateAssetResponse(imageUrl=image_url)
    except MissingAPIKeyError as exc:
        return _resolve_with_fallback("generate-asset", exc, 500, fallback)
    except UpstreamServiceError as exc:
        return _resolve_with_fallback("generate-asset", exc, 502, fallback)
    except Exception as exc:
        return _resolve_with_fallback("generate-asset", exc, 500, fallback)


@app.post("/api/data-insights", response_model=DataInsightsResponse)
async def data_insights(payload: DataInsightsRequest) -> DataInsightsResponse:
    """Query/enrich Cala-style ('Skip the Data') analytics from the live conversation context."""
    if not payload.transcript.strip():
        raise HTTPException(status_code=422, detail="transcript must not be empty.")

    def fallback() -> DataInsightsResponse:
        return DataInsightsResponse(**MOCK_DATA_INSIGHTS_RESPONSE)

    try:
        insights = await run_in_threadpool(fetch_data_insights, payload.transcript)
        return DataInsightsResponse(dataInsights=insights)
    except MissingAPIKeyError as exc:
        return _resolve_with_fallback("data-insights", exc, 500, fallback)
    except UpstreamServiceError as exc:
        return _resolve_with_fallback("data-insights", exc, 502, fallback)
    except Exception as exc:
        return _resolve_with_fallback("data-insights", exc, 500, fallback)
