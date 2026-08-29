"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { Users } from "lucide-react";

export default function TeamPage() {
  return (
    <PlaceholderPage
      title="Team"
      subtitle="Your workspace team members and roles."
      icon={<Users className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Team Members" />
    </PlaceholderPage>
  );
}
