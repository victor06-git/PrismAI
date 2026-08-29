"use client";

import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiInsight } from "@/types";
import { InsightCard } from "./InsightCard";
import { LoadingSkeletonGroup } from "@/components/ui/LoadingSkeleton";

interface KpiPanelProps {
  insights: KpiInsight[];
  isActive: boolean;
}

export function KpiPanel({ insights, isActive }: KpiPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <BarChart3 className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-medium text-gray-900">
          Cala — Data Intelligence
        </h3>
        {insights.length > 0 && (
          <span className="text-[10px] font-medium bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
            {insights.length} detected
          </span>
        )}
      </div>

      <div className="p-5 space-y-3">
        {insights.length === 0 && isActive && (
          <LoadingSkeletonGroup count={3} />
        )}

        {insights.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-8 w-8 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              KPI questions and data insights from the conversation
            </p>
          </div>
        )}

        {insights.map((insight, index) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            animate={index === insights.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

export function TrendIcon({ trend }: { trend: KpiInsight["trend"] }) {
  const icons = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  };
  const colors = {
    up: "text-emerald-500",
    down: "text-red-500",
    neutral: "text-gray-400",
  };

  const Icon = icons[trend];
  return <Icon className={cn("h-4 w-4", colors[trend])} />;
}
