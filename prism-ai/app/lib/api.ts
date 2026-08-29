/**
 * Thin client for PrismAI's FastAPI backend (see backend/main.py).
 * Base URL is configurable via NEXT_PUBLIC_API_BASE_URL (see .env.local.example),
 * defaulting to the local dev server started with:
 *   uvicorn main:app --reload --port 8000
 */

import { parseSSEStream } from "./sse";
import type {
  CalaDataInsight,
  DataInsightsResponse,
  GenerateAssetResponse,
  ProcessMeetingResponse,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      `Could not reach the PrismAI backend at ${API_BASE_URL}. Is it running? ` +
        `(cd backend && uvicorn main:app --reload --port 8000)`
    );
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(
      typeof detail?.detail === "string" ? detail.detail : `Request to ${path} failed (${response.status}).`,
      response.status
    );
  }

  return (await response.json()) as TResponse;
}

/** POST /api/process-meeting — backlog + moodboard prompts + data insights, in one shot. */
export function processMeeting(transcript: string): Promise<ProcessMeetingResponse> {
  return postJson<ProcessMeetingResponse>("/api/process-meeting", { transcript });
}

/** POST /api/generate-asset — renders a single moodboard prompt via Fal.ai Flux Schnell. */
export function generateAsset(prompt: string): Promise<GenerateAssetResponse> {
  return postJson<GenerateAssetResponse>("/api/generate-asset", { prompt });
}

/** POST /api/data-insights — re-query Cala for fresh analytics off the same transcript. */
export function fetchDataInsights(transcript: string): Promise<DataInsightsResponse> {
  return postJson<DataInsightsResponse>("/api/data-insights", { transcript });
}

// ---------------------------------------------------------------------------
// Speech-to-workflow pipeline (POST /api/audio/transcribe-and-orchestrate, SSE)
// ---------------------------------------------------------------------------

export type PipelineEvent =
  | { type: "status"; stage: string; reason?: string }
  | { type: "transcript"; transcript: string }
  | { type: "extracted"; data: ProcessMeetingResponse }
  | { type: "visual_asset_ready"; index: number; imageUrl: string }
  | { type: "visual_asset_failed"; index: number; message: string }
  | { type: "insights_enriched"; dataInsights: CalaDataInsight[] }
  | { type: "done"; data: ProcessMeetingResponse }
  | { type: "error"; stage: string; message: string };

/**
 * POST /api/audio/transcribe-and-orchestrate — uploads a recorded clip and
 * streams the transcribe -> extract -> generate pipeline back as it runs.
 * Yields typed PipelineEvents as each stage (or each individual image /
 * the insights enrichment) completes, so the dashboard can populate
 * incrementally instead of waiting on the slowest call.
 */
export async function* transcribeAndOrchestrate(
  audioBlob: Blob,
  filename: string
): AsyncGenerator<PipelineEvent> {
  const formData = new FormData();
  formData.append("audio", audioBlob, filename);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/audio/transcribe-and-orchestrate`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new ApiError(
      `Could not reach the PrismAI backend at ${API_BASE_URL}. Is it running? ` +
        `(cd backend && uvicorn main:app --reload --port 8000)`
    );
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(
      typeof detail?.detail === "string" ? detail.detail : `Upload failed (${response.status}).`,
      response.status
    );
  }

  for await (const raw of parseSSEStream(response)) {
    const event = toPipelineEvent(raw.event, raw.data);
    if (event) yield event;
  }
}

function toPipelineEvent(event: string, data: unknown): PipelineEvent | null {
  const payload = (data ?? {}) as Record<string, unknown>;
  switch (event) {
    case "status":
      return { type: "status", stage: String(payload.stage), reason: payload.reason as string | undefined };
    case "transcript":
      return { type: "transcript", transcript: String(payload.transcript ?? "") };
    case "extracted":
      return { type: "extracted", data: payload as unknown as ProcessMeetingResponse };
    case "visual_asset_ready":
      return {
        type: "visual_asset_ready",
        index: Number(payload.index),
        imageUrl: String(payload.imageUrl ?? ""),
      };
    case "visual_asset_failed":
      return {
        type: "visual_asset_failed",
        index: Number(payload.index),
        message: String(payload.message ?? "Image generation failed."),
      };
    case "insights_enriched":
      return { type: "insights_enriched", dataInsights: (payload.dataInsights ?? []) as CalaDataInsight[] };
    case "done":
      return { type: "done", data: payload as unknown as ProcessMeetingResponse };
    case "error":
      return {
        type: "error",
        stage: String(payload.stage ?? "unknown"),
        message: String(payload.message ?? "Something went wrong."),
      };
    default:
      return null;
  }
}
