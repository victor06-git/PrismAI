"use client";

import {
  Mic,
  Radio,
  Square,
  RotateCcw,
  Users,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MeetingPhase, TeamMember } from "@/types";
import { AssigneeStack } from "@/components/tickets/AssigneeAvatar";
import { PrimaryButton } from "@/components/layout/TopBar";

interface MeetingPanelProps {
  phase: MeetingPhase;
  isListening: boolean;
  elapsed: string;
  participants: TeamMember[];
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  transcriptCount: number;
  ticketCount: number;
  insightCount: number;
  /** 0..1 real mic input level — drives the visualizer's pulse when provided. */
  audioLevel?: number;
}

export function MeetingPanel({
  phase,
  isListening,
  elapsed,
  participants,
  onStart,
  onStop,
  onReset,
  transcriptCount,
  ticketCount,
  insightCount,
  audioLevel,
}: MeetingPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-medium text-gray-900">
                Q3 Mobile App GTM Planning
              </h2>
              <PhaseBadge phase={phase} isListening={isListening} />
            </div>
            <p className="text-sm text-gray-500">
              AI-powered meeting → execution pipeline
            </p>
          </div>
          <AssigneeStack members={participants} />
        </div>
      </div>

      <div className="p-5">
        {phase === "idle" && (
          <IdleState onStart={onStart} />
        )}

        {(phase === "listening" || phase === "processing") && (
          <ListeningState
            elapsed={elapsed}
            transcriptCount={transcriptCount}
            ticketCount={ticketCount}
            insightCount={insightCount}
            onStop={onStop}
            audioLevel={audioLevel}
          />
        )}

        {phase === "review" && (
          <ReviewState
            transcriptCount={transcriptCount}
            ticketCount={ticketCount}
            insightCount={insightCount}
            onReset={onReset}
          />
        )}
      </div>
    </div>
  );
}

function PhaseBadge({
  phase,
  isListening,
}: {
  phase: MeetingPhase;
  isListening: boolean;
}) {
  const config = {
    idle: { label: "Ready", className: "bg-gray-100 text-gray-600" },
    listening: {
      label: isListening ? "Live" : "Processing",
      className: "bg-red-50 text-red-600",
    },
    processing: {
      label: "Processing",
      className: "bg-amber-50 text-amber-600",
    },
    review: { label: "Complete", className: "bg-emerald-50 text-emerald-600" },
  };

  const { label, className } = config[phase];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full",
        className,
      )}
    >
      {(phase === "listening" && isListening) && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}
      {label}
    </span>
  );
}

function IdleState({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-4">
        <Mic className="h-8 w-8 text-blue-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Start a meeting to generate work
      </h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
        PrismAI listens to your product, engineering, or planning meetings
        and automatically converts conversation into Jira tickets, assignments,
        visual concepts, and KPI insights.
      </p>
      <PrimaryButton
        onClick={onStart}
        label="Start Meeting"
        icon={Radio}
      />
    </div>
  );
}

function ListeningState({
  elapsed,
  transcriptCount,
  ticketCount,
  insightCount,
  onStop,
  audioLevel,
}: {
  elapsed: string;
  transcriptCount: number;
  ticketCount: number;
  insightCount: number;
  onStop: () => void;
  audioLevel?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-8 mb-6">
        <ListeningVisualizer level={audioLevel} />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard icon={Clock} label="Duration" value={elapsed} />
        <StatCard icon={Mic} label="Transcript" value={`${transcriptCount} lines`} />
        <StatCard icon={Sparkles} label="AI Insights" value={`${insightCount}`} />
        <StatCard icon={Users} label="Tickets" value={`${ticketCount}`} />
      </div>

      <div className="flex items-center justify-center gap-3">
        <PrimaryButton
          onClick={onStop}
          label="Stop Meeting"
          icon={Square}
          variant="danger"
        />
      </div>
    </div>
  );
}

function ReviewState({
  transcriptCount,
  ticketCount,
  insightCount,
  onReset,
}: {
  transcriptCount: number;
  ticketCount: number;
  insightCount: number;
  onReset: () => void;
}) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
        <Sparkles className="h-7 w-7 text-emerald-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Meeting deliverables ready
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Generated {ticketCount} tickets, {insightCount} AI insights, and{" "}
        {transcriptCount} transcript lines
      </p>
      <PrimaryButton
        onClick={onReset}
        label="Start New Meeting"
        icon={RotateCcw}
        variant="ghost"
      />
    </div>
  );
}

function ListeningVisualizer({ level }: { level?: number }) {
  const isLive = level !== undefined;

  return (
    <div className="flex items-center gap-1 h-16">
      {Array.from({ length: 24 }).map((_, i) => {
        // Deterministic per-bar shape (no Math.random — that's an impure
        // call during render and risks a server/client hydration mismatch).
        const shape = 20 + Math.sin(i * 0.5) * 30 + Math.abs(Math.sin(i * 7.13)) * 20;
        const height = isLive ? Math.max((level ?? 0) * (shape / 70) * 100, 8) : shape;
        return (
          <div
            key={i}
            className={cn(
              "w-1 bg-blue-500 rounded-full",
              isLive ? "transition-[height] duration-75" : "animate-waveform",
            )}
            style={{
              animationDelay: isLive ? undefined : `${i * 0.05}s`,
              height: `${height}%`,
            }}
          />
        );
      })}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-center">
      <Icon className="h-4 w-4 text-gray-400 mx-auto mb-1" />
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
