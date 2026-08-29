"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      subtitle="Configure workspace, integrations, and AI preferences."
      icon={<Settings className="h-7 w-7 text-gray-400" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <ContentCard title="Integrations" />
        <ContentCard title="AI Preferences" />
      </div>
    </PlaceholderPage>
  );
}
