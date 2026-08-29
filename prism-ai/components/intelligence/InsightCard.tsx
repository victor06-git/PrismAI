"use client";

import { cn } from "@/lib/utils";
import type { KpiInsight } from "@/types";
import { TrendIcon } from "./KpiPanel";

interface InsightCardProps {
  insight: KpiInsight;
  animate?: boolean;
}

const priorityStyles = {
  high: "border-l-red-400",
  medium: "border-l-amber-400",
  low: "border-l-gray-300",
};

export function InsightCard({ insight, animate }: InsightCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-gray-100 border-l-[3px] p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors",
        priorityStyles[insight.priority],
        animate && "animate-slide-in-up",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {insight.question}
          </p>
          <p className="text-xs text-gray-500">{insight.context}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1.5 justify-end">
            <TrendIcon trend={insight.trend} />
            <span className="text-lg font-medium text-gray-900">
              {insight.value}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">{insight.metric}</p>
        </div>
      </div>
    </div>
  );
}
