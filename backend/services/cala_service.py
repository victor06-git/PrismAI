"""
services/cala_service.py

Cala is a real, working entity/fact-lookup API (ask it "who is the CEO of
Tesla" and it shines) — NOT a product-analytics/KPI tool. For most
product/engineering meetings it has nothing KPI-shaped to say, but it's
genuinely good at one thing this project leans on for the "Data as Art"
canvas: recognizing real entities (companies, people, products) mentioned
in the conversation and returning verified facts about them. Those become
honestly-labelled "source": "cala" cards, distinct from the LLM's own
narrated "source": "ai" estimates — see schemas.CalaDataInsight.
"""

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
    True if `item` is either a KPI-style answer or a real entity mention —
    i.e. something worth a card — rather than an explicit refusal.
    """
    if "error" in item:
        return False
    has_question = bool(item.get("question") or item.get("title"))
    has_value = bool(item.get("value") or item.get("metric_value") or item.get("result"))
    has_entity = bool(item.get("name") and item.get("entity_type"))
    return has_question or has_value or has_entity


def _coerce_entity(item: dict[str, Any], index: int) -> CalaDataInsight:
    """
    A real Cala entity recognition (company/person/product/etc. mentioned in
    the transcript) — a genuine "curious data point" for the storytelling
    canvas. `comparison` here is deliberately a grounding note (how it
    showed up in the conversation), not an invented size analogy — there's
    no real numeric magnitude to compare an entity against, and fabricating
    one would defeat the point of labelling this card "source: cala".
    """
    name = str(item["name"])
    entity_type = str(item["entity_type"])
    mentions = item.get("mentions") or []

    comparison = (
        f'Mentioned in the conversation as "{mentions[0]}".'
        if mentions
        else f"A real {entity_type.lower()} Cala recognized from the discussion."
    )

    return CalaDataInsight(
        id=f"CALA-{index + 1}",
        question=f'What did Cala find on "{name}"?',
        metricTarget=entity_type,
        value=name,
        trend="flat",
        summary=comparison,
        comparison=comparison,
        magnitude="notable",
        source="cala",
    )


def _coerce_kpi(item: dict[str, Any], index: int) -> CalaDataInsight:
    """
    A KPI-question-shaped Cala answer. `comparison` reuses Cala's own
    description/context text when present (its own words, not an
    LLM-invented analogy) — never fabricated.
    """
    question = str(item.get("question") or item.get("title") or f"Insight {index + 1}")
    metric_target = str(item.get("metric") or item.get("metricTarget") or item.get("kpi") or "Metric")
    value = str(item.get("value") or item.get("metric_value") or item.get("result") or "N/A")

    raw_trend = str(item.get("trend") or "flat").strip().lower()
    trend: Literal["up", "down", "flat"] = raw_trend if raw_trend in ("up", "down", "flat") else "flat"

    summary = str(item.get("summary") or item.get("description") or item.get("context") or "")
    comparison = str(item.get("description") or item.get("context") or summary or "Straight from Cala.")

    return CalaDataInsight(
        id=f"CALA-{index + 1}",
        question=question,
        metricTarget=metric_target,
        value=value,
        trend=trend,
        summary=summary,
        comparison=comparison,
        magnitude="notable",
        source="cala",
    )


def _coerce_insight(item: dict[str, Any], index: int) -> CalaDataInsight:
    """Dispatches to the entity- or KPI-shaped coercion based on what Cala actually sent back."""
    if item.get("name") and item.get("entity_type"):
        return _coerce_entity(item, index)
    return _coerce_kpi(item, index)


def fetch_data_insights_typed(transcript: str) -> list[CalaDataInsight]:
    """
    Same live Cala call as fetch_data_insights(), coerced into our canonical
    CalaDataInsight contract (source="cala") for callers that need a typed
    list (the audio pipeline's concurrent Fal.ai/Cala step, /api/process-text).

    Raises UpstreamServiceError — via fetch_data_insights, or when Cala
    responded with nothing but a refusal — so the caller falls back to the
    LLM's own "source": "ai" narrated insights instead of showing an empty
    card built from a mismatch.
    """
    data = fetch_data_insights(transcript)
    raw_items = [*(data.get("results") or []), *(data.get("entities") or [])]
    usable_items = [item for item in raw_items if _is_meaningful(item)]
    if not usable_items:
        raise UpstreamServiceError("Cala did not return anything usable for this transcript.")
    return [_coerce_insight(item, i) for i, item in enumerate(usable_items[:8])]
