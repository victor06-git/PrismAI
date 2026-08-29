"""
services/cala_service.py

Enriches PrismAI's analytics tab with Cala-style ("Skip the Data") insights,
derived from the live conversation context.

NOTE: Cala's exact public REST contract wasn't provided for this build, so
this assumes a simple shape:
    POST {CALA_API_BASE_URL}/insights   {"context": <transcript>}
    -> {"insights": [{...CalaDataInsight fields...}, ...]}
Swap `_build_payload` / `_parse_response` below for the real contract once
you have Cala's docs — auth, error handling and the demo fallback all stay
exactly the same either way.
"""

from schemas import CalaDataInsight
from services.clients import UpstreamServiceError, call_cala_api


def _build_payload(transcript: str) -> dict:
    return {"context": transcript}


def _parse_response(data: dict) -> list[CalaDataInsight]:
    raw_insights = data.get("insights")
    if not raw_insights:
        raise UpstreamServiceError(f"Cala API response did not contain any insights: {data}")
    return [CalaDataInsight(**item) for item in raw_insights]


def fetch_data_insights(transcript: str) -> list[CalaDataInsight]:
    """
    Query Cala for analytics insights enriched with the given conversation
    context. Blocking (sync httpx call under the hood) — call via
    starlette.concurrency.run_in_threadpool from the route handler.

    Raises MissingAPIKeyError / UpstreamServiceError on failure; callers
    decide how to respond (HTTPException vs. mock fallback).
    """
    data = call_cala_api("insights", _build_payload(transcript))
    return _parse_response(data)
