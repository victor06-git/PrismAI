"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { Kanban } from "lucide-react";

export default function SprintPage() {
  return (
    <PlaceholderPage
      title="Sprint"
      subtitle="Active sprint board with tickets from meeting-generated work."
      icon={<Kanban className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Sprint 24 — Mobile GTM Launch" />
    </PlaceholderPage>
  );
}
