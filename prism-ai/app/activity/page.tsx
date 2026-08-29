"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { Activity } from "lucide-react";

export default function ActivityPage() {
  return (
    <PlaceholderPage
      title="Activity"
      subtitle="Recent workspace activity and AI-generated events."
      icon={<Activity className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Recent Activity" />
    </PlaceholderPage>
  );
}
