"""
Pydantic models (contracts) shared across PrismAI's backend.

These models are the single source of truth for:
  - Request/response validation on the FastAPI endpoints.
  - The JSON schema handed to OpenAI Structured Outputs
    (client.beta.chat.completions.parse(response_format=ProcessMeetingResponse)).

Keep fields required (no defaults / Optional) so the schema stays compatible
with OpenAI's strict Structured Outputs mode.
"""

from typing import Literal

from pydantic import BaseModel, Field

from typing import Any

# ---------------------------------------------------------------------------
# 1. Software Backlog (Scrum / Jira style) — intelligent prioritization
# ---------------------------------------------------------------------------
#
# TicketDraft is exactly what OpenAI's Structured Outputs fills in. Ticket
# adds the computed prioritization (priorityScore, badge) that
# services/orchestrator.py derives afterward — the LLM is asked for the raw
# inputs (businessImpact, complexityScore, urgency), never for the score
# itself, since that's a fixed formula, not a judgment call worth spending a
# model call on. `dependencies` references OTHER TICKETS BY TITLE (not id) —
# the LLM can't reliably predict the server-assigned id ahead of time, but
# titles are unique within a batch and the orchestrator resolves them to
# real ids once every ticket has one.


class TicketDraft(BaseModel):
    title: str = Field(description="Concise, actionable ticket title. Unique within this batch.")
    description: str = Field(description="One or two sentence description of the work.")
    tag: Literal["Frontend", "Backend", "AI", "Design", "Security"] = Field(
        description="Functional area this ticket belongs to."
    )
    storyPoints: int = Field(description="Fibonacci-style effort estimate (1, 2, 3, 5, 8, 13...).")
    complexityScore: int = Field(description="Technical complexity, on a 1 (trivial) to 10 (very hard) scale.")
    businessImpact: int = Field(description="Business value if shipped, on a 1 (negligible) to 10 (critical) scale.")
    urgency: Literal["Low", "Medium", "High", "Critical"] = Field(description="How time-sensitive this is.")
    dependencies: list[str] = Field(
        description=(
            "Titles of OTHER tickets in this same batch that this one depends on / is blocked by "
            "(must exactly match another ticket's title field). Empty list if none."
        )
    )
    acceptanceCriteria: list[str] = Field(
        description="List of concrete, testable acceptance criteria (Given/When/Then style)."
    )


class Ticket(BaseModel):
    id: str = Field(description="Server-assigned unique identifier, e.g. 'TCK-1'.")
    title: str
    description: str
    tag: Literal["Frontend", "Backend", "AI", "Design", "Security"]
    storyPoints: int
    complexityScore: int
    businessImpact: int
    urgency: Literal["Low", "Medium", "High", "Critical"]
    dependencies: list[str] = Field(description="Resolved ids (not titles) of blocking tickets.")
    acceptanceCriteria: list[str]
    priorityScore: float = Field(
        description="businessImpact*0.45 + urgencyWeight*0.35 - complexityScore*0.20 — see services/orchestrator.py."
    )
    badge: Literal["Quick Win", "Strategic Initiative", "Re-evaluate", "Balanced"] = Field(
        description="Quick Win = high impact/low complexity. Strategic Initiative = high impact/high complexity. "
        "Re-evaluate = low impact/high complexity. Balanced = everything else."
    )


# ---------------------------------------------------------------------------
# 2. Visual moodboard prompts (Fal.ai Flux Schnell)
# ---------------------------------------------------------------------------


class VisualAssetPrompt(BaseModel):
    assetName: str = Field(description="Human readable name of the visual asset, e.g. 'Hero Moodboard'.")
    falPrompt: str = Field(
        description="Detailed, descriptive image-generation prompt ready to send to Fal.ai Flux Schnell."
    )
    imageUrl: str | None = Field(
        default=None,
        description=(
            "Rendered image URL, once generated. Always null straight out of extraction — "
            "populated later by a Fal.ai call (e.g. the audio pipeline's concurrent generation step)."
        ),
    )


# ---------------------------------------------------------------------------
# 3. Cala "Data as Art" — data storytelling, not a spreadsheet
# ---------------------------------------------------------------------------
#
# `source` is deliberately never filled by the model — it's stamped
# programmatically afterward (services/openai_service.py._call_structured
# sets "ai"; services/cala_service.py._coerce_insight sets "cala") so the
# interactive canvas can honestly badge which cards are a real Cala fact
# vs. an AI-narrated framing of an LLM-estimated number. Using the nullable
# pattern (like VisualAssetPrompt.imageUrl) keeps it compatible with
# OpenAI's strict Structured Outputs mode.


class CalaDataInsight(BaseModel):
    id: str = Field(description="Unique short identifier, e.g. 'INS-1'.")
    question: str = Field(description="The business question (or curious fact) this card answers.")
    metricTarget: str = Field(description="The metric/KPI/entity being spotlighted, e.g. 'Activation Rate'.")
    value: str = Field(description="Current value or headline fact, e.g. '42%' or '1.2k users'.")
    trend: Literal["up", "down", "flat"] = Field(description="Direction of the metric trend.")
    summary: str = Field(description="One or two sentence plain-English insight summary.")
    comparison: str = Field(
        description=(
            "A vivid, concrete, relatable real-world analogy for this value — short and specific, "
            "neal.fun-style ('that's roughly the weight of three elephants'). Never generic filler."
        )
    )
    magnitude: Literal["intimate", "notable", "big", "massive"] = Field(
        description="Rough visual scale tier for an interactive storytelling canvas — not a precise measurement."
    )
    source: Literal["cala", "ai"] | None = Field(
        default=None, description="Set programmatically after extraction — never by the model itself."
    )


# ---------------------------------------------------------------------------
# /api/process-meeting
# ---------------------------------------------------------------------------


class ProcessMeetingRequest(BaseModel):
    transcript: str = Field(description="Raw meeting transcript text to analyze.")


class ProcessMeetingResponseDraft(BaseModel):
    """Exactly what OpenAI's Structured Outputs returns — tickets aren't scored/sorted yet (see services/orchestrator.py)."""

    summary: str = Field(description="Short executive summary of the meeting.")
    tickets: list[TicketDraft]
    visualAssets: list[VisualAssetPrompt]
    dataInsights: list[CalaDataInsight]


class ProcessMeetingResponse(BaseModel):
    summary: str = Field(description="Short executive summary of the meeting.")
    tickets: list[Ticket] = Field(description="Scored and sorted by priorityScore, highest first.")
    visualAssets: list[VisualAssetPrompt]
    dataInsights: list[CalaDataInsight]


# ---------------------------------------------------------------------------
# /api/generate-asset
# ---------------------------------------------------------------------------


# class GenerateAssetRequest(BaseModel):
#     prompt: str = Field(description="Image generation prompt for Fal.ai Flux Schnell.")

class GenerateAssetRequest(BaseModel):
    meetingId: str = Field(
        min_length=1,
        max_length=100,
        description="Meeting identifier."
    )

    prompt: str = Field(
        min_length=10,
        max_length=2000,
        description="Image generation prompt for Fal.ai Flux Schnell."
    )
    

class GenerateAssetResponse(BaseModel):
    imageUrl: str


# ---------------------------------------------------------------------------
# /api/data-insights
# ---------------------------------------------------------------------------


class DataInsightsRequest(BaseModel):
    meetingId: str = Field(
        min_length=1,
        max_length=100,
        description="Meeting identifier."
    )

    transcript: str = Field(
        min_length=3,
        max_length=5000,
        description="Meeting context or query to enrich with Cala."
    )


class DataInsightsResponse(BaseModel):
    results: list[dict[str, Any]]
    entities: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# /api/process-text
# ---------------------------------------------------------------------------


class ProcessTextRequest(BaseModel):
    text: str = Field(
        min_length=1,
        description="Raw meeting text to analyze — quick-testing fallback for the audio pipeline.",
    )
    meetingId: str | None = Field(default=None, description="Optional meeting id to persist this run under.")


# ---------------------------------------------------------------------------
# /api/audio/transcribe-and-process
# ---------------------------------------------------------------------------


class TranscriptSegment(BaseModel):
    index: int
    start: float = Field(description="Segment start time, in seconds from the start of the recording.")
    end: float = Field(description="Segment end time, in seconds.")
    text: str


class AudioProcessResponse(BaseModel):
    meetingId: str
    transcript: str = Field(description="Full transcript, as actually transcribed by Whisper — never mock text.")
    segments: list[TranscriptSegment] = Field(
        description="Ordered, real timestamped transcript segments (chronological transcript log)."
    )
    summary: str
    tickets: list[Ticket]
    visualAssets: list[VisualAssetPrompt]
    dataInsights: list[CalaDataInsight]
