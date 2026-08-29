"""
services/openai_service.py

Turns a raw meeting transcript into PrismAI's structured backlog / visual
prompts / insights, using the official OpenAI client with Structured Outputs
against the `ProcessMeetingResponseDraft` Pydantic model. Ticket priority
scoring is NOT done here — that's a fixed formula, not a model call (see
services/orchestrator.py's score_and_sort_tickets).
"""

from schemas import ProcessMeetingResponseDraft
from services.clients import (
    MissingAPIKeyError,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    UpstreamServiceError,
    openai_client,
)

SYSTEM_PROMPT = """\
You are a literal transcription analyzer. You must extract Jira tickets, visual prompts, \
and Cala data insights STRICTLY based on the provided transcription. DO NOT invent, guess, \
or hallucinate features, tasks, or thoughts that were not explicitly spoken by the users. \
If the transcript chunk does not contain actionable product information, return empty arrays \
for tickets, visualAssets, and/or dataInsights rather than fabricating something to fill them —
an empty array is the CORRECT output for small talk, silence, or off-topic chatter. Never pad
the response with generic "starter" tickets (e.g. "Set up project repository") that nobody in
the transcript actually asked for.

You are PrismAI, a real-time copilot embedded in product/engineering meetings.
Given a raw meeting transcript, you produce THREE outputs at once:

1. tickets — an intelligent, Scrum/Jira-ready software backlog.
   - Split work into small, actionable tickets tagged Frontend, Backend, AI, Design or Security.
   - Write a concise title and a one/two-sentence description for each.
   - Assign a Fibonacci-style storyPoints estimate (1,2,3,5,8,13).
   - Score complexityScore (1=trivial, 10=very hard) and businessImpact (1=negligible,
     10=critical) honestly and with real variation — do not default everything to the
     same number. Assign urgency (Low/Medium/High/Critical) based on how time-sensitive
     the work actually sounds in the conversation.
   - List dependencies as the exact TITLES of other tickets in this same response that
     block this one (empty list if none — most tickets have none).
   - Write concrete, testable acceptanceCriteria for every ticket.

2. visualAssets — prompts for moodboards / visual creatives.
   - For each key visual/branding/UI/product idea EXPLICITLY mentioned (color palettes,
     dashboard layouts, mobile screens, user personas, product shots), produce a descriptive,
     high-quality image-generation prompt suitable for Fal.ai Flux Schnell, framed for a
     16:9 landscape composition. Do not invent a visual for a product/feature the transcript
     never actually described.

3. dataInsights — "Data as Art": data deserves to be SEEN, not just queried.
   - Surface the business questions/curious data points the team seems to care about,
     the metric that answers each one, a plausible current value, and its trend.
   - comparison: a vivid, SPECIFIC, concrete real-world analogy for that value — the kind
     of line you'd see on neal.fun or ordinaryabundance.com ("that's about the length of
     two blue whales nose to tail", "enough people to fill a small stadium section").
     Never generic filler like "a significant amount" — always something a person can
     picture. Ground it in the actual number, don't just restate it.
   - magnitude: intimate/notable/big/massive — how large this comparison should render
     on an interactive canvas, relative to the OTHER insights in this same response.
   - summary: one or two sentences a non-technical stakeholder could read.

Also produce a short executive `summary` of the meeting.
Be concise, concrete, and grounded strictly in what the transcript discusses.

Reminder: this transcript may be a short, messy, real-time speech-to-text fragment — filler
words, false starts, and mid-sentence cutoffs are normal and are NOT license to invent what
the speaker "probably meant." If you are not confident something was actually said, leave it
out. Empty tickets/visualAssets/dataInsights arrays are a valid, expected, and CORRECT response
for a chunk with nothing actionable in it.
"""


def _call_structured(system_prompt: str, user_content: str) -> ProcessMeetingResponseDraft:
    if not OPENAI_API_KEY:
        raise MissingAPIKeyError("OPENAI_API_KEY is not configured.")

    try:
        completion = openai_client.beta.chat.completions.parse(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format=ProcessMeetingResponseDraft,
        )
    except Exception as exc:
        raise UpstreamServiceError(f"OpenAI request failed: {exc}") from exc

    message = completion.choices[0].message
    if message.refusal or message.parsed is None:
        raise UpstreamServiceError(f"OpenAI refused or returned no parsed content: {message.refusal}")

    parsed = message.parsed
    # Stamp provenance AND id ourselves — never trust the model to self-report
    # either. Provenance: so the "Data as Art" canvas can honestly badge
    # AI-narrated cards apart from real Cala facts (see
    # services/cala_service.py._coerce_insight). Id: the model always starts
    # counting from "INS-1" on every single call (same failure mode tickets
    # had — see score_and_sort_tickets's own comment) — harmless for a single
    # one-shot response, but a live session calling this repeatedly needs
    # those re-stamped again per-round to stay unique (see
    # LiveMeetingSession.dedupe_insights in audio/live_session.py).
    parsed.dataInsights = [
        insight.model_copy(update={"source": "ai", "id": f"INS-{i + 1}"})
        for i, insight in enumerate(parsed.dataInsights)
    ]
    return parsed


def generate_meeting_outputs(transcript: str) -> ProcessMeetingResponseDraft:
    """
    Call OpenAI with Structured Outputs and return a validated draft
    (tickets aren't scored/sorted yet — see services/orchestrator.py).
    Blocking (sync SDK) — call via asyncio.to_thread /
    starlette.concurrency.run_in_threadpool.

    Raises MissingAPIKeyError / UpstreamServiceError on failure; callers
    decide how to respond.
    """
    return _call_structured(SYSTEM_PROMPT, transcript)


def generate_meeting_outputs_incremental(
    transcript: str,
    known_ticket_titles: list[str],
    known_asset_names: list[str],
) -> ProcessMeetingResponseDraft:
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
