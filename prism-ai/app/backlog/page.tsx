"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { Inbox } from "lucide-react";

export default function BacklogPage() {
  return (
    <PlaceholderPage
      title="Backlog"
      subtitle="Unscheduled work items waiting for sprint assignment."
      icon={<Inbox className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Backlog" />
    </PlaceholderPage>
  );
}
