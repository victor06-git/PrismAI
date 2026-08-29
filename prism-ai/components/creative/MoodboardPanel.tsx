"use client";

import {
  Palette,
  Layout,
  Rocket,
  Bell,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreativeConcept } from "@/types";
import { CreativeCard } from "./CreativeCard";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

interface MoodboardPanelProps {
  concepts: CreativeConcept[];
  isActive: boolean;
}

const iconMap = {
  palette: Palette,
  layout: Layout,
  rocket: Rocket,
  bell: Bell,
};

export function MoodboardPanel({ concepts, isActive }: MoodboardPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <Image className="h-4 w-4 text-pink-500" />
        <h3 className="text-sm font-medium text-gray-900">
          Visual Concepts
        </h3>
        {concepts.length > 0 && (
          <span className="text-[10px] font-medium bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full">
            {concepts.length} generated
          </span>
        )}
      </div>

      <div className="p-5">
        {concepts.length === 0 && isActive && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} variant="card" />
            ))}
          </div>
        )}

        {concepts.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Palette className="h-8 w-8 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              Moodboards and visual concepts from the conversation
            </p>
          </div>
        )}

        {concepts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {concepts.map((concept, index) => (
              <CreativeCard
                key={concept.id}
                concept={concept}
                icon={iconMap[concept.icon as keyof typeof iconMap] ?? Palette}
                animate={index === concepts.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
