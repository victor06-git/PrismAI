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

# ---------------------------------------------------------------------------
# 1. Software Backlog (Scrum / Jira style)
# ---------------------------------------------------------------------------


class Ticket(BaseModel):
    id: str = Field(description="Unique short identifier, e.g. 'TCK-1'.")
    title: str = Field(description="Concise, actionable ticket title.")
    tag: Literal["Frontend", "Backend", "Design", "Infra"] = Field(
        description="Functional area this ticket belongs to."
    )
    priority: Literal["High", "Medium", "Low"] = Field(
        description="Business priority for the ticket."
    )
    storyPoints: int = Field(
        description="Fibonacci-style effort estimate (1, 2, 3, 5, 8, 13...)."
    )
    acceptanceCriteria: list[str] = Field(
        description="List of concrete, testable acceptance criteria (Given/When/Then style)."
    )


# ---------------------------------------------------------------------------
# 2. Visual moodboard prompts (Fal.ai Flux Schnell)
# ---------------------------------------------------------------------------


class VisualAssetPrompt(BaseModel):
    assetName: str = Field(description="Human readable name of the visual asset, e.g. 'Hero Moodboard'.")
    falPrompt: str = Field(
        description="Detailed, descriptive image-generation prompt ready to send to Fal.ai Flux Schnell."
    )


# ---------------------------------------------------------------------------
# 3. Cala-style data insights ("Skip the Data")
# ---------------------------------------------------------------------------


class CalaDataInsight(BaseModel):
    id: str = Field(description="Unique short identifier, e.g. 'INS-1'.")
    question: str = Field(description="The business question this insight answers.")
    metricTarget: str = Field(description="The metric/KPI being tracked, e.g. 'Activation Rate'.")
    value: str = Field(description="Current value of the metric, e.g. '42%' or '1.2k users'.")
    trend: Literal["up", "down", "flat"] = Field(description="Direction of the metric trend.")
    summary: str = Field(description="One or two sentence plain-English insight summary.")


# ---------------------------------------------------------------------------
# /api/process-meeting
# ---------------------------------------------------------------------------


class ProcessMeetingRequest(BaseModel):
    transcript: str = Field(description="Raw meeting transcript text to analyze.")


class ProcessMeetingResponse(BaseModel):
    summary: str = Field(description="Short executive summary of the meeting.")
    tickets: list[Ticket]
    visualAssets: list[VisualAssetPrompt]
    dataInsights: list[CalaDataInsight]


# ---------------------------------------------------------------------------
# /api/generate-asset
# ---------------------------------------------------------------------------


class GenerateAssetRequest(BaseModel):
    prompt: str = Field(description="Image generation prompt for Fal.ai Flux Schnell.")


class GenerateAssetResponse(BaseModel):
    imageUrl: str


# ---------------------------------------------------------------------------
# /api/data-insights
# ---------------------------------------------------------------------------


class DataInsightsRequest(BaseModel):
    transcript: str = Field(
        description="Meeting transcript / conversation context to enrich with Cala analytics."
    )


class DataInsightsResponse(BaseModel):
    dataInsights: list[CalaDataInsight]
