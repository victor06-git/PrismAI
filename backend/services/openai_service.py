"""
services/openai_service.py

Turns a raw meeting transcript into PrismAI's structured backlog / visual
prompts / insights, using the official OpenAI client with Structured Outputs
against the `ProcessMeetingResponse` Pydantic model.
"""

from schemas import ProcessMeetingResponse
from services.clients import (
    MissingAPIKeyError,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    UpstreamServiceError,
    openai_client,
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


def _call_structured(system_prompt: str, user_content: str) -> ProcessMeetingResponse:
    if not OPENAI_API_KEY:
        raise MissingAPIKeyError("OPENAI_API_KEY is not configured.")

    try:
        completion = openai_client.beta.chat.completions.parse(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format=ProcessMeetingResponse,
        )
    except Exception as exc:
        raise UpstreamServiceError(f"OpenAI request failed: {exc}") from exc

    message = completion.choices[0].message
    if message.refusal or message.parsed is None:
        raise UpstreamServiceError(f"OpenAI refused or returned no parsed content: {message.refusal}")

    return message.parsed


def generate_meeting_outputs(transcript: str) -> ProcessMeetingResponse:
    """
    Call OpenAI with Structured Outputs and return a validated
    ProcessMeetingResponse. Blocking (sync SDK) — call via
    starlette.concurrency.run_in_threadpool from the route handler.

    Raises MissingAPIKeyError / UpstreamServiceError on failure; callers
    decide how to respond (HTTPException vs. mock fallback).
    """
    return _call_structured(SYSTEM_PROMPT, transcript)


def generate_meeting_outputs_incremental(
    transcript: str,
    known_ticket_titles: list[str],
    known_asset_names: list[str],
) -> ProcessMeetingResponse:
    """
    Same extraction, but told what's already been surfaced so far in this
    live session (see audio/live_session.py). Without this, re-running
    extraction on the growing transcript every few chunks produces the same
    underlying idea worded slightly differently each time ("Build login
    page" vs. "Create Login Page with Inline Validation") — which a plain
    exact-title dedup can't catch, since the LLM never guarantees stable
    phrasing between calls. Telling it explicitly what already exists (and
    to reuse those exact titles for anything still-covered) fixes the
    dedup at the source instead of trying to fuzzy-match unreliable
    natural-language titles afterward.

    Blocking — call via asyncio.to_thread. Raises MissingAPIKeyError /
    UpstreamServiceError on failure.
    """
    recap_lines = []
    if known_ticket_titles:
        recap_lines.append(
            "Tickets already created so far (reuse these EXACT titles verbatim if the topic recurs — "
            "do not reword them): " + "; ".join(known_ticket_titles)
        )
    if known_asset_names:
        recap_lines.append(
            "Visual assets already created so far (reuse these EXACT names verbatim if the topic "
            "recurs): " + "; ".join(known_asset_names)
        )

    incremental_prompt = SYSTEM_PROMPT + (
        "\n\nThis is a LIVE, still-in-progress meeting — the transcript below grows every few seconds. "
        "Only invent a new ticket/visual-asset title for topics not already covered. "
        + (" ".join(recap_lines) if recap_lines else "Nothing has been created yet.")
    )

    return _call_structured(incremental_prompt, transcript)
