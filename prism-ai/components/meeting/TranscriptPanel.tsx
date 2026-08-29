"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptLine } from "@/types";
import { LoadingSkeletonGroup } from "@/components/ui/LoadingSkeleton";

interface TranscriptPanelProps {
  lines: TranscriptLine[];
  isActive: boolean;
}

const highlightStyles = {
  task: "border-l-blue-400 bg-blue-50/50",
  decision: "border-l-violet-400 bg-violet-50/50",
  kpi: "border-l-amber-400 bg-amber-50/50",
  design: "border-l-pink-400 bg-pink-50/50",
};

const highlightLabels = {
  task: "Task detected",
  decision: "Decision",
  kpi: "KPI mention",
  design: "Design note",
};

export function TranscriptPanel({ lines, isActive }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-900">Live Transcript</h3>
        </div>
        {isActive && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-red-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
            </span>
            Recording
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {lines.length === 0 && isActive && <LoadingSkeletonGroup count={4} />}

        {lines.length === 0 && !isActive && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="h-8 w-8 text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">
              Transcript will appear here during the meeting
            </p>
          </div>
        )}

        {lines.map((line, index) => (
          <div
            key={line.id}
            className={cn(
              "rounded-lg border-l-2 pl-3 py-2 animate-slide-in-up",
              line.highlight
                ? highlightStyles[line.highlight]
                : "border-l-transparent",
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium text-gray-900">
                {line.speaker}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {line.timestamp}
              </span>
              {line.highlight && (
                <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5" />
                  {highlightLabels[line.highlight]}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{line.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
