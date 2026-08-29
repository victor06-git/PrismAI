"use client";

import { PlaceholderPage, ContentCard } from "@/components/layout/PlaceholderPage";
import { Image } from "lucide-react";

export default function MoodboardPage() {
  return (
    <PlaceholderPage
      title="Moodboard"
      subtitle="Visual concepts and design direction generated from meeting conversations."
      icon={<Image className="h-7 w-7 text-gray-400" />}
    >
      <ContentCard title="Generated Concepts" />
    </PlaceholderPage>
  );
}
