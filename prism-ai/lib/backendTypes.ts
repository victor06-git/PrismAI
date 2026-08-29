/**
 * TypeScript mirrors of the FastAPI backend's Pydantic schemas
 * (see backend/schemas.py). Kept separate from types/index.ts — these are
 * the backend's canonical shapes; types/index.ts is the frontend's own
 * (richer) domain model. lib/adapters.ts translates between the two.
 */

export type BackendTag = "Frontend" | "Backend" | "Design" | "Infra";
export type BackendPriority = "High" | "Medium" | "Low";
export type BackendTrend = "up" | "down" | "flat";

export interface BackendTicket {
  id: string;
  title: string;
  tag: BackendTag;
  priority: BackendPriority;
  storyPoints: number;
  acceptanceCriteria: string[];
}

export interface BackendVisualAsset {
  assetName: string;
  falPrompt: string;
  imageUrl?: string | null;
}

export interface BackendDataInsight {
  id: string;
  question: string;
  metricTarget: string;
  value: string;
  trend: BackendTrend;
  summary: string;
}

export interface BackendTranscriptSegment {
  index: number;
  start: number;
  end: number;
  text: string;
}

/** Shared by /api/process-meeting, /api/process-text, and each pipeline's final payload. */
export interface BackendMeetingResult {
  summary: string;
  tickets: BackendTicket[];
  visualAssets: BackendVisualAsset[];
  dataInsights: BackendDataInsight[];
}

/** POST /api/audio/transcribe-and-process */
export interface AudioProcessResponse extends BackendMeetingResult {
  meetingId: string;
  transcript: string;
  segments: BackendTranscriptSegment[];
}

/** POST /api/generate-asset */
export interface GenerateAssetResponse {
  imageUrl: string;
}

// ---------------------------------------------------------------------------
// WebSocket /ws/live — see backend/audio/live_session.py for the full protocol
// ---------------------------------------------------------------------------

export type LiveClientMessage =
  | { type: "init"; meetingId?: string }
  | { type: "stop" };

export type LiveServerEvent =
  | { type: "STATUS"; stage: string; meetingId?: string }
  | { type: "TRANSCRIPT_UPDATE"; text: string; cumulativeText: string; segmentIndex: number }
  | { type: "NEW_TICKET"; ticket: BackendTicket }
  | { type: "MOODBOARD_IMAGE"; assetName: string; falPrompt: string; imageUrl: string }
  | { type: "CALA_METRIC"; insight: BackendDataInsight }
  | { type: "ERROR"; message: string };
