"""
services/clients.py

Single source of truth for environment loading and external API client
construction. Every module that talks to OpenAI, Fal.ai or Cala imports its
client/config from here instead of touching os.environ directly, so
credentials are loaded and validated in exactly one place.
"""

import logging
import os

import httpx
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()  # Reads OPENAI_API_KEY / FAL_KEY / CALA_API_KEY from a local .env file, if present.

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prismai")


class MissingAPIKeyError(Exception):
    """Raised when a required API key is not configured on this server (our fault, not theirs)."""


class UpstreamServiceError(Exception):
    """Raised when an external API (OpenAI, Fal.ai, Cala) call fails or returns an unusable response."""


# ---------------------------------------------------------------------------
# No mock fallback, by design.
# ---------------------------------------------------------------------------
# Every endpoint calls the real OpenAI/Fal.ai/Cala APIs and surfaces a real
# HTTPException (500 for a missing key, 502 for an upstream failure) if a
# call fails — there is no static/canned data anywhere in this backend.
# Set your keys in .env (see .env.example) before running a live demo.

# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = "gpt-4o-mini"

if not OPENAI_API_KEY:
    logger.warning(
        "OPENAI_API_KEY is not set — every endpoint that calls OpenAI will fail with a 500 "
        "until you set it. Copy .env.example to .env and set your key."
    )

# A placeholder key lets the client construct even when unset, so the service
# still boots (health checks, mock fallbacks, docs, etc. all still work) with
# zero configuration; the real failure surfaces per-request instead.
openai_client = OpenAI(api_key=OPENAI_API_KEY or "sk-not-configured")

# ---------------------------------------------------------------------------
# Fal.ai
# ---------------------------------------------------------------------------
# fal_client's module-level functions (fal_client.subscribe, etc.) read
# FAL_KEY directly from os.environ on every call — there's no client object
# to construct, but the env var must be named exactly "FAL_KEY" for the
# library itself to find it. FAL_API is accepted as a fallback alias (some
# .env files in this project have used that name), but gets re-exported
# under "FAL_KEY" so fal_client actually picks it up.
FAL_KEY = os.getenv("FAL_KEY") or os.getenv("FAL_API")
FAL_MODEL = "fal-ai/flux/schnell"

if FAL_KEY and not os.getenv("FAL_KEY"):
    os.environ["FAL_KEY"] = FAL_KEY
    logger.info("Using FAL_API as a fallback for FAL_KEY — fal_client needs the FAL_KEY name specifically.")

if not FAL_KEY:
    logger.warning(
        "Neither FAL_KEY nor FAL_API is set — every endpoint that calls Fal.ai will fail with a 500 "
        "until you set one. Copy .env.example to .env and set your key."
    )

# ---------------------------------------------------------------------------
# Cala ("Skip the Data" analytics)
# ---------------------------------------------------------------------------
CALA_API_KEY = os.getenv("CALA_API_KEY")
CALA_API_BASE_URL = os.getenv("CALA_API_BASE_URL", "https://api.cala.ai/v1")

if not CALA_API_KEY:
    logger.warning(
        "CALA_API_KEY is not set — every endpoint that calls Cala will fail with a 500 "
        "until you set it. Copy .env.example to .env and set your key."
    )


def call_cala_api(
    path: str,
    payload: dict,
    method: str = "POST",
    timeout: float = 60.0
) -> dict:

    if not CALA_API_KEY:
        raise MissingAPIKeyError(
            "CALA_API_KEY is not configured."
        )

    url = f"{CALA_API_BASE_URL.rstrip('/')}/{path.lstrip('/')}"

    headers = {
        "X-API-KEY": CALA_API_KEY,
        "Content-Type": "application/json",
    }

    try:
        response = httpx.request(
            method,
            url,
            json=payload,
            headers=headers,
            timeout=timeout
        )

        response.raise_for_status()
        return response.json()

    except httpx.HTTPStatusError as exc:
        raise UpstreamServiceError(
            f"Cala API returned {exc.response.status_code}"
        ) from exc

    except httpx.RequestError as exc:
        raise UpstreamServiceError(
            "Cala API request failed"
        ) from exc
