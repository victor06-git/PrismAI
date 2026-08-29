"use client";

import {
  Brain,
  UserCheck,
  Flag,
  FileText,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiInsight } from "@/types";
import { LoadingSkeletonGroup } from "@/components/ui/LoadingSkeleton";

interface ContextPanelProps {
  insights: AiInsight[];
  isActive: boolean;
}

const typeConfig = {
  task: { icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
  owner: { icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-50" },
  priority: { icon: Flag, color: "text-orange-500", bg: "bg-orange-50" },
  requirement: { icon: GitBranch, color: "text-violet-500", bg: "bg-violet-50" },
  decision: { icon: Brain, color: "text-indigo-500", bg: "bg-indigo-50" },
};

export function ContextPanel({ insights, isActive }: ContextPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
        <Brain className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-medium text-gray-900">AI Understanding</h3>
        {isActive && insights.length > 0 && (
          <span className="ml-auto text-[10px] font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full animate-pulse">
            Analyzing...
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {insights.length === 0 && isActive && (
          <LoadingSkeletonGroup count={3} />
        )}

        {insights.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Brain className="h-8 w-8 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              AI will identify tasks, owners, and priorities
            </p>
          </div>
        )}

        {insights.map((insight, index) => {
          const config = typeConfig[insight.type];
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              className={cn(
                "flex items-start gap-3 rounded-lg p-3 animate-slide-in-up",
                config.bg,
              )}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.color)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{insight.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    {insight.type}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {Math.round(insight.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
