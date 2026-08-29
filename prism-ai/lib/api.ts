/**
 * Thin client for PrismAI's FastAPI backend (see backend/main.py).
 * Base URL is configurable via NEXT_PUBLIC_API_BASE_URL (see .env.local.example),
 * defaulting to the local dev server started with:
 *   cd backend && uvicorn main:app --reload --port 8000
 */

import type { AudioProcessResponse, BackendMeetingResult, GenerateAssetResponse } from "./backendTypes";

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

async function request<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
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

function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * POST /api/audio/transcribe-and-process — uploads a recorded clip and awaits
 * the whole pipeline (Whisper -> OpenAI -> Fal.ai + Cala) as one consolidated
 * JSON payload (real transcript, real tickets, real images, real insights —
 * or a clearly-marked mock fallback if a third-party call is down).
 */
export function transcribeAndProcess(
  audioBlob: Blob,
  filename: string,
  meetingId: string
): Promise<AudioProcessResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, filename);
  formData.append("meetingId", meetingId);
  return request<AudioProcessResponse>("/api/audio/transcribe-and-process", {
    method: "POST",
    body: formData,
  });
}

/** POST /api/process-text — quick-testing fallback: same extraction, raw text in. */
export function processText(text: string, meetingId?: string): Promise<BackendMeetingResult> {
  return postJson<BackendMeetingResult>("/api/process-text", { text, meetingId });
}

/** POST /api/generate-asset — renders (or regenerates) a single moodboard prompt via Fal.ai. */
export function generateAsset(meetingId: string, prompt: string): Promise<GenerateAssetResponse> {
  return postJson<GenerateAssetResponse>("/api/generate-asset", { meetingId, prompt });
}
