from typing import Any, Literal

from schemas import CalaDataInsight
from services.clients import UpstreamServiceError, call_cala_api


def fetch_data_insights(transcript: str) -> dict:
    """
    Query Cala using the real structured knowledge endpoint.
    """

    payload = {
        "input": transcript
    }

    data = call_cala_api(
        path="knowledge/query",
        payload=payload
    )

    if not data:
        raise UpstreamServiceError(
            "Cala API returned an empty response."
        )

    return data


def _is_meaningful(item: dict[str, Any]) -> bool:
    """
    True if `item` actually looks like a KPI-style insight, rather than an
    explicit refusal or Cala's plain factual/entity-lookup shape.

    In practice Cala is a general entity/fact-lookup API (ask it "who is the
    CEO of Tesla" and it shines), not a product-analytics/KPI tool — for a
    typical product/engineering transcript it has nothing genuinely
    insight-shaped to say, and instead returns either an {"error": "..."}
    refusal or bare entity mentions with none of the fields a KPI card needs.
    """
    if "error" in item:
        return False
    has_question = bool(item.get("question") or item.get("title"))
    has_value = bool(item.get("value") or item.get("metric_value") or item.get("result"))
    return has_question or has_value


def _coerce_insight(item: dict[str, Any], index: int) -> CalaDataInsight:
    """
    Cala's raw {"results": [...], "entities": [...]} payload is free-form
    (dict[str, Any] in schemas.DataInsightsResponse) — its exact per-item
    contract isn't pinned down yet. Map defensively so callers that need a
    typed CalaDataInsight (the audio pipeline, /api/process-text) always get
    a usable object regardless of which keys Cala actually sent back.
    """
    question = str(item.get("question") or item.get("title") or item.get("name") or f"Insight {index + 1}")
    metric_target = str(item.get("metric") or item.get("metricTarget") or item.get("kpi") or "Metric")
    value = str(item.get("value") or item.get("metric_value") or item.get("result") or "N/A")

    raw_trend = str(item.get("trend") or "flat").strip().lower()
    trend: Literal["up", "down", "flat"] = raw_trend if raw_trend in ("up", "down", "flat") else "flat"

    summary = str(item.get("summary") or item.get("description") or item.get("context") or "")

    return CalaDataInsight(
        id=f"CALA-{index + 1}",
        question=question,
        metricTarget=metric_target,
        value=value,
        trend=trend,
        summary=summary,
    )


def fetch_data_insights_typed(transcript: str) -> list[CalaDataInsight]:
    """
    Same live Cala call as fetch_data_insights(), coerced into our canonical
    CalaDataInsight contract for callers that need a typed list (the audio
    pipeline's concurrent Fal.ai/Cala step, /api/process-text).

    Raises UpstreamServiceError — via fetch_data_insights, or when Cala
    responded but had nothing KPI-shaped to say (a refusal, or bare entity
    mentions) — so the caller falls back to the LLM's own business-insight
    guesses instead of showing an empty "N/A" card built from a mismatch.
    """
    data = fetch_data_insights(transcript)
    raw_items = [*(data.get("results") or []), *(data.get("entities") or [])]
    usable_items = [item for item in raw_items if _is_meaningful(item)]
    if not usable_items:
        raise UpstreamServiceError("Cala did not return KPI-shaped insight data for this transcript.")
    return [_coerce_insight(item, i) for i, item in enumerate(usable_items[:8])]