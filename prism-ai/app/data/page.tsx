"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { BarChart3 } from "lucide-react";

export default function DataPage() {
  return (
    <PlaceholderPage
      title="Data Intelligence"
      subtitle="Cala-powered KPI detection and data insights from your meetings."
      icon={<BarChart3 className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Detected KPI Questions" />
    </PlaceholderPage>
  );
}
