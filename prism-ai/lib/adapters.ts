/**
 * Translates the backend's canonical Pydantic-shaped responses
 * (lib/backendTypes.ts) into the frontend's richer, already-designed domain
 * types (types/index.ts) — so TicketCard, CreativeCard, KpiPanel,
 * TranscriptPanel etc. all keep working, fed entirely by real data (there
 * is no mock data anywhere in this project — backend or frontend).
 *
 * A couple of fields the backend doesn't produce (assignee, sprint) are
 * filled with clearly-labelled, deterministic defaults — never
 * random/fabricated content standing in for something the pipeline
 * actually said.
 *
 * Every string that ends up on screen is run through sanitizeText() here —
 * this is the single choke point where backend text becomes UI text.
 */

import type {
  BackendDataInsight,
  BackendMeetingResult,
  BackendTicket,
  BackendTranscriptSegment,
  BackendUrgency,
  BackendVisualAsset,
} from "./backendTypes";
import { sanitizeText } from "./sanitize";
import type { AiInsight, CreativeConcept, KpiInsight, Ticket, TicketPriority, TranscriptLine } from "@/types";

const PRIORITY_MAP: Record<BackendUrgency, TicketPriority> = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
};

const CONFIDENCE_BY_URGENCY: Record<BackendUrgency, number> = {
  Critical: 0.97,
  High: 0.9,
  Medium: 0.8,
  Low: 0.7,
};

const CONCEPT_GRADIENTS = [
  "from-blue-50 via-indigo-50 to-violet-50",
  "from-gray-50 via-slate-50 to-zinc-100",
  "from-emerald-50 via-teal-50 to-cyan-50",
  "from-amber-50 via-orange-50 to-rose-50",
];

const CONCEPT_ICONS: CreativeConcept["icon"][] = ["palette", "layout", "rocket", "bell"];

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function adaptTicket(ticket: BackendTicket, index: number): Ticket {
  return {
    id: ticket.id || `tk-${index}`,
    key: ticket.id,
    summary: sanitizeText(ticket.title),
    description: sanitizeText(ticket.description),
    status: "todo",
    priority: PRIORITY_MAP[ticket.urgency],
    type: "story",
    tag: ticket.tag,
    assignee: undefined,
    labels: [ticket.tag.toLowerCase()],
    storyPoints: ticket.storyPoints,
    sprint: "Current Sprint",
    createdAt: "Just now",
    priorityScore: ticket.priorityScore,
    complexityScore: ticket.complexityScore,
    businessImpact: ticket.businessImpact,
    badge: ticket.badge,
    dependencies: ticket.dependencies,
  };
}

export function adaptCreativeConcept(asset: BackendVisualAsset, index: number): CreativeConcept {
  return {
    id: `concept-${index}-${asset.assetName}`,
    title: sanitizeText(asset.assetName),
    description: sanitizeText(asset.falPrompt),
    tags: ["moodboard", "ai-generated"],
    gradient: CONCEPT_GRADIENTS[index % CONCEPT_GRADIENTS.length],
    icon: CONCEPT_ICONS[index % CONCEPT_ICONS.length],
    imageUrl: asset.imageUrl ?? undefined,
  };
}

export function adaptKpiInsight(insight: BackendDataInsight): KpiInsight {
  return {
    id: insight.id,
    question: sanitizeText(insight.question),
    metric: sanitizeText(insight.metricTarget),
    trend: insight.trend === "flat" ? "neutral" : insight.trend,
    value: sanitizeText(insight.value),
    context: sanitizeText(insight.summary),
    // The backend doesn't score insight priority — a downward trend is the
    // one case worth flagging by default; everything else defaults to medium.
    priority: insight.trend === "down" ? "high" : "medium",
    comparison: sanitizeText(insight.comparison),
    magnitude: insight.magnitude,
    // The backend always stamps this post-extraction — null only if an
    // older payload sneaks through; "ai" is the honest default (never claim "cala").
    source: insight.source ?? "ai",
  };
}

export function adaptTranscriptLine(segment: BackendTranscriptSegment): TranscriptLine {
  return {
    id: `seg-${segment.index}`,
    // whisper-1 doesn't do speaker diarization on a single mic feed — "You"
    // is an honest label, not a guessed name.
    speaker: "You",
    text: sanitizeText(segment.text),
    timestamp: formatTimestamp(segment.start),
  };
}

/** Same per-ticket "AI Understanding" mapping used by deriveContextInsights — exposed separately for the live (one-ticket-at-a-time) stream. */
export function adaptContextInsightFromTicket(ticket: BackendTicket): AiInsight {
  return {
    id: `ctx-${ticket.id}`,
    type: "task",
    text: sanitizeText(ticket.title),
    confidence: CONFIDENCE_BY_URGENCY[ticket.urgency],
  };
}

/** Lightweight "AI Understanding" entries derived from real backend output — not a separate LLM call. */
export function deriveContextInsights(result: BackendMeetingResult): AiInsight[] {
  const insights: AiInsight[] = [];

  if (result.summary) {
    insights.push({ id: "ctx-summary", type: "decision", text: sanitizeText(result.summary), confidence: 0.92 });
  }

  result.tickets.forEach((ticket) => insights.push(adaptContextInsightFromTicket(ticket)));

  return insights;
}

export function adaptMeetingResult(result: BackendMeetingResult) {
  return {
    tickets: result.tickets.map(adaptTicket),
    concepts: result.visualAssets.map(adaptCreativeConcept),
    kpiInsights: result.dataInsights.map(adaptKpiInsight),
    contextInsights: deriveContextInsights(result),
  };
}
