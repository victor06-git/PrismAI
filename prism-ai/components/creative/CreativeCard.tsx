"use client";

import { cn } from "@/lib/utils";
import type { CreativeConcept } from "@/types";
import type { LucideIcon } from "lucide-react";

interface CreativeCardProps {
  concept: CreativeConcept;
  icon: LucideIcon;
  animate?: boolean;
}

export function CreativeCard({ concept, icon: Icon, animate }: CreativeCardProps) {
  return (
    <div
      className={cn(
        "group rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md hover:border-gray-300",
        animate && "animate-slide-in-up",
      )}
    >
  <div
    className={cn(
      "h-40 bg-gradient-to-br flex items-center justify-center relative overflow-hidden",
      concept.gradient,
    )}
  >
    {concept.imageUrl ? (
      <img
        src={concept.imageUrl}
        alt={concept.title}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    ) : (
      <>
        <Icon className="h-10 w-10 text-gray-400/60 group-hover:scale-110 transition-transform duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent" />
      </>
    )}
  </div>
      <div className="p-3">
        <h4 className="text-sm font-medium text-gray-900 mb-1">
          {concept.title}
        </h4>
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">
          {concept.description}
        </p>
        <div className="flex flex-wrap gap-1">
          {concept.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
