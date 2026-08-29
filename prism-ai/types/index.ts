export type MeetingPhase = "idle" | "listening" | "processing" | "review";

export type TicketStatus = "todo" | "in_progress" | "blocked" | "done";
export type TicketPriority = "critical" | "high" | "medium" | "low";
export type TicketType = "story" | "task" | "bug" | "epic";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
}

export interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  highlight?: "task" | "decision" | "kpi" | "design";
}

export interface Ticket {
  id: string;
  key: string;
  summary: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  assignee?: TeamMember;
  labels: string[];
  storyPoints?: number;
  sprint?: string;
  createdAt: string;
}

export interface AiInsight {
  id: string;
  type: "task" | "owner" | "priority" | "requirement" | "decision";
  text: string;
  confidence: number;
}

export interface CreativeConcept {
  id: string;
  title: string;
  description: string;
  tags: string[];
  gradient: string;
  icon: string;
  /** Real Fal.ai-rendered image (16:9), once generated. Falls back to the gradient+icon card while absent. */
  imageUrl?: string;
}

export interface KpiInsight {
  id: string;
  question: string;
  metric: string;
  trend: "up" | "down" | "neutral";
  value: string;
  context: string;
  priority: "high" | "medium" | "low";
}

export interface SprintItem {
  id: string;
  name: string;
  ticketCount: number;
  progress: number;
  startDate: string;
  endDate: string;
}

export interface MeetingSession {
  id: string;
  title: string;
  participants: TeamMember[];
  startedAt?: string;
  endedAt?: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: "success" | "info" | "warning" | "error";
}
