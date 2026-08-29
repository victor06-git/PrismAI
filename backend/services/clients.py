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
# Demo-resilience feature flag
# ---------------------------------------------------------------------------
# When true (default) a failed upstream call is logged and silently replaced
# with static mock data (mock_data.py) instead of surfacing an error to the
# caller — so a live demo never shows a broken screen. Set
# ENABLE_MOCK_FALLBACK=false to get real HTTPException(500/502) responses
# instead (useful to verify error handling, or outside of a demo context).
ENABLE_MOCK_FALLBACK = os.getenv("ENABLE_MOCK_FALLBACK", "true").strip().lower() != "false"

# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = "gpt-4o-mini"

if not OPENAI_API_KEY:
    logger.warning(
        "OPENAI_API_KEY is not set — /api/process-meeting will use fallback behavior. "
        "Copy .env.example to .env and set your key to enable live generation."
    )

# A placeholder key lets the client construct even when unset, so the service
# still boots (health checks, mock fallbacks, docs, etc. all still work) with
# zero configuration; the real failure surfaces per-request instead.
openai_client = OpenAI(api_key=OPENAI_API_KEY or "sk-not-configured")

# ---------------------------------------------------------------------------
# Fal.ai
# ---------------------------------------------------------------------------
FAL_KEY = os.getenv("FAL_KEY")
FAL_MODEL = "fal-ai/flux/schnell"

if not FAL_KEY:
    logger.warning(
        "FAL_KEY is not set — /api/generate-asset will use fallback behavior. "
        "Copy .env.example to .env and set your key to enable live generation."
    )
# fal_client's module-level functions (fal_client.subscribe, etc.) read
# FAL_KEY from the environment automatically on every call — there is no
# client object to construct, it just needs the env var loaded, which
# load_dotenv() above already guarantees.

# ---------------------------------------------------------------------------
# Cala ("Skip the Data" analytics)
# ---------------------------------------------------------------------------
CALA_API_KEY = os.getenv("CALA_API_KEY")
# NOTE: Cala's public REST contract/base URL wasn't provided for this hackathon
# build. CALA_API_BASE_URL is overridable via .env; point it at the real
# endpoint once you have it. Until then this call will fail fast and
# transparently fall back to mock insights (see services/cala_service.py).
CALA_API_BASE_URL = os.getenv("CALA_API_BASE_URL", "https://api.cala.example.com/v1")

CALA_API_BASE_URL = os.getenv(
    "CALA_API_BASE_URL",
    "https://api.cala.ai/v1"
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
