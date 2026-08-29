/**
 * Real, static app configuration — product name, team roster, sprint
 * metadata. NOT meeting content: nothing here is ever presented as
 * something someone said or a ticket the AI generated. (The former
 * mockData.ts also held canned demo transcript/tickets/insights content —
 * that's been removed entirely, along with the fake-playback components
 * that used it, per the project's no-mocks policy.)
 */

import type { SprintItem, TeamMember } from "@/types";

export const PRODUCT_NAME = "PrismAI";

export const teamMembers: TeamMember[] = [
  { id: "1", name: "Sarah Chen", role: "Product Lead", avatar: "SC", color: "#6366F1" },
  { id: "2", name: "Marcus Webb", role: "Engineering", avatar: "MW", color: "#0EA5E9" },
  { id: "3", name: "Elena Rodriguez", role: "Design", avatar: "ER", color: "#EC4899" },
  { id: "4", name: "James Park", role: "Marketing", avatar: "JP", color: "#10B981" },
  { id: "5", name: "Aisha Patel", role: "Data Analytics", avatar: "AP", color: "#F59E0B" },
];

export const currentSprints: SprintItem[] = [
  { id: "s1", name: "Sprint 24 — Live Backlog", ticketCount: 0, progress: 0, startDate: "Aug 26", endDate: "Sep 9" },
];
