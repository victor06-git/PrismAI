"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { UserCheck } from "lucide-react";

export default function AssignedPage() {
  return (
    <PlaceholderPage
      title="Assigned to me"
      subtitle="Tickets assigned to you across all sprints."
      icon={<UserCheck className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Your Tickets" />
    </PlaceholderPage>
  );
}
