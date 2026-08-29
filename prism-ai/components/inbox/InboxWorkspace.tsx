"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListeningBar } from "@/components/meeting/ListeningBar";
import { LiveTranscriptRail } from "@/components/meeting/LiveTranscriptRail";
import { TasksTable } from "@/components/tickets/TasksTable";

type StatusTab = "tasks" | "moodboard" | "metrics";

const statusTabs: { id: StatusTab; label: string }[] = [
  { id: "tasks", label: "Tasks" },
  { id: "moodboard", label: "Moodboard" },
  { id: "metrics", label: "Metrics" },
];

const emptyCopy = {
  metrics: {
    title: "No metrics yet",
    body: "KPI questions and data insights from the meeting will show up in this tab.",
  },
};

export function InboxWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionActive = searchParams.get("start") === "1";

  const [status, setStatus] = useState<StatusTab>("tasks");
  const [listening, setListening] = useState(true);
  const [showBar, setShowBar] = useState(sessionActive);
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  return (
    <div className="relative flex h-screen overflow-hidden bg-prisma-canvas animate-fade-in">
      <aside className="flex w-16 shrink-0 flex-col bg-prisma-canvas px-2 pt-10">
        <Link
          href="/"
          aria-label="Main menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-prisma-muted transition-colors hover:bg-white/70 hover:text-prisma-text"
        >
          <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
        </Link>
      </aside>

      <div
        className={cn(
          "flex min-w-0 flex-1 bg-prisma-canvas pt-10 transition-[padding,gap] duration-300",
          transcriptOpen ? "gap-2" : "pr-6",
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-end gap-1">
            {statusTabs.map((tab) => {
              const active = status === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatus(tab.id)}
                  className={cn(
                    "relative px-5 py-2 font-serif text-lg leading-snug tracking-tight transition-colors",
                    active
                      ? "z-10 -mb-px border-t border-x border-prisma-border bg-prisma-surface text-prisma-text"
                      : "border border-prisma-border bg-[#E4E4DE] text-prisma-muted hover:text-prisma-text",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
            <div className="min-w-0 flex-1 self-stretch border-b border-prisma-border" />
          </div>

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-x border-prisma-border bg-prisma-surface">
            {status === "tasks" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-14">
                <TasksTable />
              </div>
            ) : status === "moodboard" ? (
              <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto px-8 py-8 pb-24">
                <div
                  className="relative flex aspect-[4/3] w-full max-w-lg items-center justify-center overflow-hidden rounded-md border border-prisma-border bg-prisma-canvas"
                  aria-busy="true"
                  aria-label="Generating moodboard image"
                >
                  <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-prisma-border border-t-prisma-text"
                    aria-hidden="true"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-8 pb-28">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-prisma-border bg-prisma-canvas">
                  <MessageSquare className="h-6 w-6 text-prisma-muted stroke-[1.5]" />
                </div>
                <h2 className="font-serif text-2xl tracking-tight text-prisma-text">
                  {emptyCopy.metrics.title}
                </h2>
                <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-prisma-muted">
                  {emptyCopy.metrics.body}
                </p>
              </div>
            )}

            {showBar && (
              <ListeningBar
                listening={listening}
                onTogglePause={() => setListening((prev) => !prev)}
                onComplete={() => {
                  setShowBar(false);
                  setListening(false);
                  router.replace("/inbox");
                }}
              />
            )}
          </main>
        </div>

        <LiveTranscriptRail
          open={transcriptOpen}
          onToggle={() => setTranscriptOpen((prev) => !prev)}
          listening={listening}
        />
      </div>
    </div>
  );
}
