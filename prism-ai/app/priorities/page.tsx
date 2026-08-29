"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { Flag } from "lucide-react";

export default function PrioritiesPage() {
  return (
    <PlaceholderPage
      title="Priorities"
      subtitle="Work organized by priority level."
      icon={<Flag className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Critical" className="mb-4" />
      <ContentCard title="High" className="mb-4" />
      <ContentCard title="Medium" className="mb-4" />
      <ContentCard title="Low" />
    </PlaceholderPage>
  );
}
