"""
services/orchestrator.py

The intelligent agile prioritization algorithm, plus the consolidated
multi-agent orchestration (OpenAI structured parsing -> priority scoring ->
concurrent Fal.ai image generation + Cala enrichment) shared by every
endpoint that turns a transcript into a full PrismAI payload:
  - main.py: /api/process-meeting, /api/process-text
  - audio/router.py: /api/audio/transcribe-and-process (and the granular
    pieces are reused by /api/audio/transcribe-and-orchestrate's SSE stream)
  - audio/live_session.py: /ws/live (uses score_and_sort_tickets directly,
    since its progressive-extraction flow needs per-round dedup that a
    single opaque orchestration call can't express)

Priority formula (as specified):
    PriorityScore = businessImpact*0.45 + urgencyWeight*0.35 - complexityScore*0.20

`urgencyWeight` isn't otherwise defined, so Low/Medium/High/Critical are
mapped onto the same 1-10 scale businessImpact/complexityScore already use
(2.5/5/7.5/10) — keeps the three terms dimensionally comparable instead of
mixing an unscaled 4-point enum into a 1-10 weighted sum.

Badge thresholds (>=7 counts as "high", <=4 as "low", on the 1-10 scale):
    High impact + low complexity  -> "Quick Win"
    High impact + high complexity -> "Strategic Initiative"
    Low impact + high complexity  -> "Re-evaluate"
    everything else                -> "Balanced"
"""

import asyncio

from schemas import CalaDataInsight, ProcessMeetingResponse, Ticket, TicketDraft, VisualAssetPrompt
from services.cala_service import fetch_data_insights_typed
from services.clients import logger
from services.fal_service import generate_visual_asset
from services.openai_service import generate_meeting_outputs

URGENCY_WEIGHTS: dict[str, float] = {"Low": 2.5, "Medium": 5.0, "High": 7.5, "Critical": 10.0}

HIGH_THRESHOLD = 7
LOW_THRESHOLD = 4


def _clamp(value: int, lo: int = 1, hi: int = 10) -> int:
    """Defensive clamp — the LLM isn't given a hard schema constraint on 1-10 fields
    (OpenAI's strict Structured Outputs mode doesn't support minimum/maximum keywords)."""
    return max(lo, min(hi, value))


def score_priority(business_impact: int, urgency: str, complexity_score: int) -> float:
    urgency_weight = URGENCY_WEIGHTS.get(urgency, URGENCY_WEIGHTS["Medium"])
    business_impact = _clamp(business_impact)
    complexity_score = _clamp(complexity_score)
    return round(business_impact * 0.45 + urgency_weight * 0.35 - complexity_score * 0.20, 2)


def classify_ticket(business_impact: int, complexity_score: int) -> str:
    business_impact = _clamp(business_impact)
    complexity_score = _clamp(complexity_score)
    high_impact = business_impact >= HIGH_THRESHOLD
    low_impact = business_impact <= LOW_THRESHOLD
    high_complexity = complexity_score >= HIGH_THRESHOLD
    low_complexity = complexity_score <= LOW_THRESHOLD

    if high_impact and low_complexity:
        return "Quick Win"
    if high_impact and high_complexity:
        return "Strategic Initiative"
    if low_impact and high_complexity:
        return "Re-evaluate"
    return "Balanced"


def score_and_sort_tickets(drafts: list[TicketDraft], start_index: int = 0) -> list[Ticket]:
    """
    Assigns server-side ids (never trusts the LLM's own numbering — it can't
    stay unique across incremental extraction rounds), resolves each
    ticket's title-based `dependencies` into real ids, scores every ticket,
    and returns them sorted by priorityScore, highest first.
    """
    ids_by_title = {draft.title: f"TCK-{start_index + i + 1}" for i, draft in enumerate(drafts)}

    scored: list[Ticket] = []
    for draft in drafts:
        resolved_deps = [
            ids_by_title[dep] for dep in draft.dependencies if dep in ids_by_title and dep != draft.title
        ]
        scored.append(
            Ticket(
                **draft.model_dump(exclude={"dependencies"}),
                id=ids_by_title[draft.title],
                dependencies=resolved_deps,
                priorityScore=score_priority(draft.businessImpact, draft.urgency, draft.complexityScore),
                badge=classify_ticket(draft.businessImpact, draft.complexityScore),
            )
        )

    return sorted(scored, key=lambda t: t.priorityScore, reverse=True)


def extract_and_score(transcript: str) -> ProcessMeetingResponse:
    """
    One-shot structured extraction + priority scoring. visualAssets/dataInsights
    are still the LLM's own draft guesses at this point — Fal.ai/Cala haven't
    run yet (see generate_all_moodboard_images / enrich_with_cala below).

    Blocking (sync SDK calls under the hood) — call via asyncio.to_thread /
    starlette.concurrency.run_in_threadpool. Raises MissingAPIKeyError /
    UpstreamServiceError on failure.
    """
    draft = generate_meeting_outputs(transcript)
    tickets = score_and_sort_tickets(draft.tickets)
    return ProcessMeetingResponse(
        summary=draft.summary, tickets=tickets, visualAssets=draft.visualAssets, dataInsights=draft.dataInsights
    )


async def generate_all_moodboard_images(visual_assets: list[VisualAssetPrompt]) -> list[VisualAssetPrompt]:
    """One Fal.ai call per prompt, run concurrently (asyncio.gather). A single
    failed image just keeps its prompt with no imageUrl — never sinks the batch."""

    async def _one(asset: VisualAssetPrompt) -> VisualAssetPrompt:
        try:
            url = await asyncio.to_thread(generate_visual_asset, asset.falPrompt)
            return asset.model_copy(update={"imageUrl": url})
        except Exception as exc:
            logger.warning("orchestrator: image generation failed for %r: %s", asset.assetName, exc)
            return asset

    return list(await asyncio.gather(*(_one(asset) for asset in visual_assets)))


MAX_DATA_STORY_CARDS = 8


async def enrich_with_cala(transcript: str, ai_insights: list[CalaDataInsight]) -> list[CalaDataInsight]:
    """
    One Cala call, MERGED with the LLM's own narrated insights (source="ai")
    rather than replacing them — Cala often recognizes an entity (source=
    "cala") unrelated to the business metric the LLM already estimated, and
    the "Data as Art" canvas wants both kinds of card, not one silently
    discarding the other just because Cala also had something to say.
    """
    try:
        cala_insights = await asyncio.to_thread(fetch_data_insights_typed, transcript)
    except Exception as exc:
        logger.info("orchestrator: Cala had nothing to add: %s", exc)
        return ai_insights
    return [*ai_insights, *cala_insights][:MAX_DATA_STORY_CARDS]


async def run_full_orchestration(transcript: str) -> ProcessMeetingResponse:
    """
    The complete batch pipeline: extract + score, then Fal.ai images and
    Cala enrichment CONCURRENTLY (asyncio.gather). Raises MissingAPIKeyError
    / UpstreamServiceError if extraction itself fails — callers decide how
    to surface that (see main.py / audio/router.py).
    """
    extracted = await asyncio.to_thread(extract_and_score, transcript)

    visual_assets, data_insights = await asyncio.gather(
        generate_all_moodboard_images(extracted.visualAssets),
        enrich_with_cala(transcript, extracted.dataInsights),
    )

    return ProcessMeetingResponse(
        summary=extracted.summary, tickets=extracted.tickets, visualAssets=visual_assets, dataInsights=data_insights
    )
