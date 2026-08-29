"""
PrismAI backend — FastAPI service.

Turns a raw meeting transcript into three simultaneous outputs:
  1. A Scrum/Jira-style software backlog (OpenAI, Structured Outputs).
  2. Moodboard / visual creative prompts, rendered as images via Fal.ai Flux Schnell.
  3. Cala-style ("Skip the Data") analytics insights.

Run locally with:
    uvicorn main:app --reload --port 8000
"""

import logging
import os

import fal_client
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from starlette.concurrency import run_in_threadpool

from mock_data import MOCK_GENERATE_ASSET_RESPONSE, MOCK_PROCESS_MEETING_RESPONSE
from schemas import (
    GenerateAssetRequest,
    GenerateAssetResponse,
    ProcessMeetingRequest,
    ProcessMeetingResponse,
)

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

load_dotenv()  # Reads OPENAI_API_KEY / FAL_KEY from a local .env file, if present.

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prismai")

OPENAI_MODEL = "gpt-4o-mini"
FAL_MODEL = "fal-ai/flux/schnell"

_openai_api_key = os.getenv("OPENAI_API_KEY")
if not _openai_api_key:
    logger.warning(
        "OPENAI_API_KEY is not set — /api/process-meeting will fall back to mock data. "
        "Copy .env.example to .env and set your key to enable live generation."
    )
# A placeholder key lets the client construct even when unset, so the service
# still boots (and /api/health, mock fallbacks, etc. still work) with zero
# configuration; the real failure surfaces per-request and is caught below.
openai_client = OpenAI(api_key=_openai_api_key or "sk-not-configured")

if not os.getenv("FAL_KEY"):
    logger.warning(
        "FAL_KEY is not set — /api/generate-asset will fall back to mock data. "
        "Copy .env.example to .env and set your key to enable live generation."
    )
# fal_client reads FAL_KEY from the environment automatically on each call,
# so no explicit client construction is required here.

app = FastAPI(
    title="PrismAI API",
    description="Real-time meeting copilot: backlog, moodboards & data insights.",
    version="0.1.0",
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

SYSTEM_PROMPT = """\
You are PrismAI, a real-time copilot embedded in product/engineering meetings.
Given a raw meeting transcript, you produce THREE outputs at once:

1. tickets — a Scrum/Jira-ready software backlog.
   - Split work into small, actionable tickets tagged Frontend, Backend, Design or Infra.
   - Assign a priority (High/Medium/Low) and a Fibonacci-style storyPoints estimate (1,2,3,5,8,13).
   - Write concrete, testable acceptanceCriteria for every ticket.

2. visualAssets — prompts for moodboards / visual creatives.
   - For each key visual/branding idea mentioned (or reasonably implied), produce a
     descriptive, high-quality image-generation prompt suitable for Fal.ai Flux Schnell.

3. dataInsights — Cala-style ("Skip the Data") analytics insights.
   - Surface the business questions the team seems to care about, the metric that
     answers each one, a plausible current value, its trend, and a one-line plain
     English summary a non-technical stakeholder could read.

Also produce a short executive `summary` of the meeting.
Be concise, concrete, and grounded strictly in what the transcript discusses.
"""


def _log_and_get_process_meeting_fallback(exc: Exception) -> ProcessMeetingResponse:
    logger.warning("process-meeting: falling back to mock data due to error: %s", exc)
    return ProcessMeetingResponse(**MOCK_PROCESS_MEETING_RESPONSE)


def _log_and_get_generate_asset_fallback(exc: Exception) -> GenerateAssetResponse:
    logger.warning("generate-asset: falling back to mock data due to error: %s", exc)
    return GenerateAssetResponse(**MOCK_GENERATE_ASSET_RESPONSE)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health_check() -> dict:
    """Basic liveness/config check for the service."""
    return {
        "status": "ok",
        "openaiConfigured": bool(os.getenv("OPENAI_API_KEY")),
        "falConfigured": bool(os.getenv("FAL_KEY")),
    }


@app.post("/api/process-meeting", response_model=ProcessMeetingResponse)
async def process_meeting(payload: ProcessMeetingRequest) -> ProcessMeetingResponse:
    """
    Analyze a meeting transcript with OpenAI Structured Outputs and return the
    backlog, visual asset prompts and data insights in a single shot.

    Falls back to static mock data (mock_data.py) if the OpenAI call fails, so
    a live demo never shows a broken screen. If even the fallback can't be
    built, an HTTPException(500) is raised.
    """
    if not payload.transcript.strip():
        raise HTTPException(status_code=422, detail="transcript must not be empty.")

    try:
        completion = await run_in_threadpool(
            openai_client.beta.chat.completions.parse,
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": payload.transcript},
            ],
            response_format=ProcessMeetingResponse,
        )

        message = completion.choices[0].message
        if message.refusal or message.parsed is None:
            raise ValueError(f"OpenAI refused or returned no parsed content: {message.refusal}")

        return message.parsed

    except Exception as exc:
        try:
            return _log_and_get_process_meeting_fallback(exc)
        except Exception as fallback_exc:
            logger.error("process-meeting: fallback data itself is invalid: %s", fallback_exc)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process meeting and fallback data is unavailable: {fallback_exc}",
            ) from fallback_exc


@app.post("/api/generate-asset", response_model=GenerateAssetResponse)
async def generate_asset(payload: GenerateAssetRequest) -> GenerateAssetResponse:
    """
    Generate a visual asset via Fal.ai Flux Schnell from a moodboard prompt.

    Falls back to a static placeholder image (mock_data.py) if the Fal.ai call
    fails, so a live demo never shows a broken screen. If even the fallback
    can't be built, an HTTPException(500) is raised.
    """
    if not payload.prompt.strip():
        raise HTTPException(status_code=422, detail="prompt must not be empty.")

    try:
        result = await run_in_threadpool(
            fal_client.subscribe,
            FAL_MODEL,
            arguments={
                "prompt": payload.prompt,
                "image_size": "landscape_16_9",
                "num_inference_steps": 4,
            },
        )

        images = result.get("images") or []
        if not images or not images[0].get("url"):
            raise ValueError(f"Fal.ai response did not contain an image URL: {result}")

        return GenerateAssetResponse(imageUrl=images[0]["url"])

    except Exception as exc:
        try:
            return _log_and_get_generate_asset_fallback(exc)
        except Exception as fallback_exc:
            logger.error("generate-asset: fallback data itself is invalid: %s", fallback_exc)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate asset and fallback data is unavailable: {fallback_exc}",
            ) from fallback_exc
