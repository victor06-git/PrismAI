/**
 * TypeScript mirrors of the FastAPI backend's Pydantic schemas
 * (see backend/schemas.py). Keep these in sync by hand — there's no
 * codegen step in a 12-hour hackathon build.
 */

export type TicketTag = "Frontend" | "Backend" | "Design" | "Infra";
export type TicketPriority = "High" | "Medium" | "Low";
export type InsightTrend = "up" | "down" | "flat";

export interface Ticket {
  id: string;
  title: string;
  tag: TicketTag;
  priority: TicketPriority;
  storyPoints: number;
  acceptanceCriteria: string[];
}

export interface VisualAssetPrompt {
  assetName: string;
  falPrompt: string;
  /** Only set once Fal.ai has actually rendered it (e.g. via the audio pipeline's concurrent generation step). */
  imageUrl?: string | null;
}

export interface CalaDataInsight {
  id: string;
  question: string;
  metricTarget: string;
  value: string;
  trend: InsightTrend;
  summary: string;
}

export interface ProcessMeetingResponse {
  summary: string;
  tickets: Ticket[];
  visualAssets: VisualAssetPrompt[];
  dataInsights: CalaDataInsight[];
}

export interface GenerateAssetResponse {
  imageUrl: string;
}

export interface DataInsightsResponse {
  dataInsights: CalaDataInsight[];
}
