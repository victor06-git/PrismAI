"use client";

/**
 * PrismAI mission control — the live-demo flagship screen. "GTA VI Vice
 * City / cyber-neon" aesthetic: saturated magenta/cyan/amber gradients,
 * frosted glass, Framer Motion micro-interactions. Driven entirely by
 * useLiveMeeting() (real mic -> WebSocket /ws/live -> Whisper -> OpenAI
 * structured extraction + priority scoring -> Fal.ai + Cala, all real,
 * nothing mocked). The rest of the app (Tickets/Backlog/Team placeholders)
 * keeps the light "Prisma" shell the team built — this page is
 * deliberately a distinct, full-bleed experience since it's the one you
 * actually present.
 *
 * No Governance/Security/Aikido/Entire panel here by design — Tab 4 is
 * Cala's "Data as Art" canvas (components/intelligence/DataStoryCanvas.tsx).
 */

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Gem,
  Info,
  KanbanSquare,
  Mic,
  MessageSquare,
  Radio,
  RotateCcw,
  Sparkles,
  Square,
  Video,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveMeeting } from "@/hooks/useLiveMeeting";
import { VoiceVisualizer } from "@/components/meeting/VoiceVisualizer";
import { SmartBacklog } from "@/components/backlog/SmartBacklog";
import { MoodboardGallery } from "@/components/moodboard/MoodboardGallery";
import { DataStoryCanvas } from "@/components/intelligence/DataStoryCanvas";
import { AssigneeStack } from "@/components/tickets/AssigneeAvatar";
import type { ToastMessage } from "@/types";

type TabId = "live" | "backlog" | "moodboard" | "data";

const TABS: { id: TabId; label: string; icon: typeof Video }[] = [
  { id: "live", label: "Live Meeting", icon: Video },
  { id: "backlog", label: "Smart Backlog", icon: KanbanSquare },
  { id: "moodboard", label: "Moodboard", icon: Sparkles },
  { id: "data", label: "Data as Art", icon: Gem },
];

const TOAST_ICON = { success: CheckCircle2, info: Info, warning: AlertCircle, error: XCircle };
const TOAST_COLOR = {
  success: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  info: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200",
  warning: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  error: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

export default function MeetingsPage() {
  const meeting = useLiveMeeting();
  const [tab, setTab] = useState<TabId>("live");
  const isActive = meeting.phase === "listening" || meeting.phase === "processing";

  function handleStart() {
    meeting.startMeeting();
    setTab("live");
  }

  function handleStop() {
    meeting.stopMeeting();
    setTab("backlog");
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#08040f] text-zinc-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 10% -10%, rgba(236,72,153,0.28), transparent 45%), " +
            "radial-gradient(circle at 90% 10%, rgba(34,211,238,0.22), transparent 45%), " +
            "radial-gradient(circle at 50% 110%, rgba(251,191,36,0.14), transparent 50%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <header className="relative z-10 flex items-center justify-between border-b border-fuchsia-500/15 bg-black/20 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400 text-white shadow-[0_0_24px_-4px_rgba(236,72,153,0.7)]"
          >
            <Zap className="size-4.5" />
          </Link>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wide text-white">
              Prism<span className="bg-gradient-to-r from-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">AI</span>
            </h1>
            <p className="text-[11px] text-zinc-500">Real mic → real Whisper → real OpenAI/Fal.ai/Cala. Zero mocks.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PhaseChip phase={meeting.phase} isListening={meeting.isListening} isPaused={meeting.isPaused} />
          <span className="font-mono text-xs text-zinc-500">{meeting.formatElapsed(meeting.elapsedSeconds)}</span>
          <AssigneeStack members={meeting.teamMembers} />
          {meeting.phase === "idle" && (
            <motion.button
              type="button"
              onClick={handleStart}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_24px_-6px_rgba(236,72,153,0.8)]"
            >
              <Radio className="size-4" />
              Start Meeting
            </motion.button>
          )}
          {isActive && (
            <motion.button
              type="button"
              onClick={handleStop}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgba(225,29,72,0.8)] hover:bg-rose-500"
            >
              <Square className="size-3.5" />
              Stop
            </motion.button>
          )}
          {meeting.phase === "review" && (
            <button
              type="button"
              onClick={() => {
                meeting.reset();
                setTab("live");
              }}
              className="flex items-center gap-2 rounded-lg border border-fuchsia-400/30 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
            >
              <RotateCcw className="size-3.5" />
              New Meeting
            </button>
          )}
        </div>
      </header>

      <nav className="relative z-10 flex gap-1 border-b border-fuchsia-500/15 bg-black/10 px-6 backdrop-blur-xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
              tab === id ? "text-white" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            <Icon className="size-4" />
            {label}
            {id === "backlog" && meeting.tickets.length > 0 && (
              <span className="rounded-full bg-fuchsia-500/20 px-1.5 text-[10px] text-fuchsia-300">
                {meeting.tickets.length}
              </span>
            )}
            {tab === id && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 shadow-[0_0_8px_rgba(236,72,153,0.8)]"
              />
            )}
          </button>
        ))}
      </nav>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {tab === "live" && <LiveTab meeting={meeting} isActive={isActive} onStart={handleStart} />}
            {tab === "backlog" && <SmartBacklog tickets={meeting.tickets} isActive={isActive} />}
            {tab === "moodboard" && <MoodboardGallery concepts={meeting.concepts} isActive={isActive} />}
            {tab === "data" && <DataStoryCanvas insights={meeting.kpiInsights} isActive={isActive} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <ToastStack toasts={meeting.toasts} onDismiss={meeting.dismissToast} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Live Meeting
// ---------------------------------------------------------------------------

function LiveTab({
  meeting,
  isActive,
  onStart,
}: {
  meeting: ReturnType<typeof useLiveMeeting>;
  isActive: boolean;
  onStart: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-fuchsia-500/20 bg-black/40 p-6 backdrop-blur-xl">
        <VoiceVisualizer level={isActive ? meeting.audioLevel : 0} active={isActive} className="h-20 w-full" />
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
          <span>{isActive ? (meeting.isPaused ? "Paused" : "Live — real mic input") : "Not recording"}</span>
          {isActive && (
            <button
              type="button"
              onClick={meeting.togglePause}
              className="rounded-full border border-fuchsia-400/30 px-3 py-1 text-zinc-300 hover:bg-white/5"
            >
              {meeting.isPaused ? "Resume" : "Pause"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:h-[440px]">
        <DarkTranscriptPanel lines={meeting.transcript} isActive={isActive} onStart={onStart} phase={meeting.phase} />
        <DarkContextPanel insights={meeting.insights} isActive={isActive} />
      </div>
    </div>
  );
}

function DarkTranscriptPanel({
  lines,
  isActive,
  onStart,
  phase,
}: {
  lines: ReturnType<typeof useLiveMeeting>["transcript"];
  isActive: boolean;
  onStart: () => void;
  phase: ReturnType<typeof useLiveMeeting>["phase"];
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-cyan-400/20 bg-black/40 backdrop-blur-xl">
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <MessageSquare className="size-4 text-cyan-300" />
        <h3 className="text-sm font-semibold tracking-tight text-zinc-100">Transcript</h3>
        {isActive && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-rose-300">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-rose-400" />
            </span>
            Recording
          </span>
        )}
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {lines.length === 0 && phase === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Mic className="size-8 text-zinc-700" />
            <p className="max-w-xs text-sm text-zinc-500">
              Every word here comes straight from Whisper transcribing your real microphone — nothing scripted.
            </p>
            <button
              type="button"
              onClick={onStart}
              className="rounded-lg bg-fuchsia-500/15 px-3 py-1.5 text-xs font-medium text-fuchsia-300 hover:bg-fuchsia-500/25"
            >
              Start a meeting
            </button>
          </div>
        )}
        {lines.length === 0 && isActive && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-skeleton h-4 w-full rounded bg-white/10" />
            ))}
          </div>
        )}
        {lines.map((line, index) => {
          // Alternating light/dark bubbles purely for visual rhythm — a
          // single mic has no real speaker diarization (see
          // backend/services/whisper_service.py), so this never claims to
          // separate who said what, just breaks up a wall of text the way
          // a chat log does.
          const isLight = index % 2 === 0;
          return (
            <div
              key={line.id}
              className="flex animate-card-in justify-start"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <p
                className={cn(
                  "w-fit max-w-[92%] rounded-[22px] px-4 py-3 text-sm leading-relaxed shadow-lg",
                  isLight ? "bg-white/95 text-zinc-900" : "border border-white/10 bg-zinc-900/90 text-zinc-100",
                )}
              >
                {line.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DarkContextPanel({
  insights,
  isActive,
}: {
  insights: ReturnType<typeof useLiveMeeting>["insights"];
  isActive: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-amber-400/20 bg-black/40 backdrop-blur-xl">
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Sparkles className="size-4 text-amber-300" />
        <h3 className="text-sm font-semibold tracking-tight text-zinc-100">AI Understanding</h3>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {insights.length === 0 && isActive && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-skeleton h-10 rounded-lg bg-white/10" />
            ))}
          </div>
        )}
        {insights.length === 0 && !isActive && (
          <p className="pt-8 text-center text-xs text-zinc-600">
            PrismAI will surface tasks, decisions and priorities here as the conversation happens.
          </p>
        )}
        {insights.map((insight, index) => (
          <div
            key={insight.id}
            className="animate-card-in rounded-lg border border-white/10 bg-white/5 p-3"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <p className="text-sm text-zinc-200">{insight.text}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="uppercase tracking-wide">{insight.type}</span>
              <span>{Math.round(insight.confidence * 100)}% confidence</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function PhaseChip({
  phase,
  isListening,
  isPaused,
}: {
  phase: ReturnType<typeof useLiveMeeting>["phase"];
  isListening: boolean;
  isPaused: boolean;
}) {
  const config = {
    idle: { label: "Ready", className: "bg-white/10 text-zinc-400" },
    listening: {
      label: isPaused ? "Paused" : isListening ? "Live" : "Connecting",
      className: isPaused ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300",
    },
    processing: { label: "Processing", className: "bg-amber-500/15 text-amber-300" },
    review: { label: "Complete", className: "bg-cyan-500/15 text-cyan-300" },
  } as const;
  const { label, className } = config[phase];

  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide", className)}>
      {label}
    </span>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = TOAST_ICON[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className={cn(
                "flex min-w-[300px] max-w-[380px] items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-xl",
                TOAST_COLOR[toast.type],
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-xs opacity-80">{toast.description}</p>}
              </div>
              <button onClick={() => onDismiss(toast.id)} className="opacity-60 hover:opacity-100">
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
